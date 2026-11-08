const {test} = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const {EventEmitter} = require('node:events');
const ts = require('typescript');

async function harness(t, load) {
  const process = new EventEmitter(), pty = new EventEmitter();
  Object.assign(process, {connected:true, send(message) { this.messages.push(message); }, messages:[], exit() {}});
  Object.assign(pty, {pid:1234, kills:0, writes:[], sizes:[],
    onData(fn) { this.on('data', fn); }, onExit(fn) { this.on('exit', fn); },
    write(data) { this.writes.push(data); }, resize(...size) { this.sizes.push(size); },
    async kill() { this.kills++; this.emit('exit', {exitCode:0}); },
  });
  const servers = [], timers = [], completed = [], spawns = [];
  const module = {exports:{}};
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../terminal-session-host.ts'), 'utf8'), {
    compilerOptions:{module:ts.ModuleKind.CommonJS, target:ts.ScriptTarget.ES2020},
  }).outputText;
  vm.runInNewContext(code, {module, exports:module.exports, process, Buffer, console,
    AUTOOC_TERMINAL_JS:'/* xterm */', AUTOOC_TERMINAL_FIT_JS:'/* fit */', AUTOOC_TERMINAL_CSS:'/* css */',
    setTimeout(fn, ms) { const timer = setTimeout(fn, ms); timer.unref(); timers.push(timer); return timer; },
    require(id) {
      if (id === 'http') return {...http, createServer(...args) { const server=http.createServer(...args); servers.push(server); return server; }};
      if (id === './terminal-pty') return {loadTerminalPty:load || (async () => ({spawn(...args) {spawns.push(args);return pty;}}))};
      if (id === './execution-files') return {completeAuxiliaryDirectory: (...args) => completed.push(args)};
      throw Error(id);
    },
  });
  t.after(async () => {
    for (const timer of timers) clearTimeout(timer);
    for (const server of servers) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  });
  const config = {pluginDirectory:'synthetic', file:'synthetic.exe', args:[], options:{cwd:'synthetic'}, token:'a'.repeat(64), auxiliaryDirectory:'owned-prompt'};
  return {process, pty, completed, spawns, start:() => module.exports.runTerminalSessionHost(config),
    async call(action, body={}, headers={}) {
      const ready=process.messages.find(message=>message.type==='ready');
      return new Promise((resolve,reject)=>{
        const request=http.request({host:'127.0.0.1',port:ready.port,path:'/'+action,method:'POST',headers:{Authorization:'Bearer '+config.token,...headers}},response=>{
          let body='';response.on('data',chunk=>body+=chunk);response.on('end',()=>resolve({code:response.statusCode,body:JSON.parse(body)}));
        });request.on('error',reject);request.end(JSON.stringify(body));
      });
    },
  };
}

test('host rejects unauthorized and cross-origin terminal commands', async t => {
  const h=await harness(t);await h.start();
  assert.equal((await h.call('input',{data:'bad'},{Authorization:'Bearer incorrect'})).code,403);
  assert.equal((await h.call('input',{data:'bad'},{Origin:'https://evil.example'})).code,403);
  assert.equal((await h.call('input',{data:'bad'},{Host:'evil.example'})).code,403);
  assert.deepEqual(h.pty.writes,[]);
});

test('host replays the same process, validates commands, and does not spawn on handoff', async t => {
  const h=await harness(t);await h.start();h.pty.emit('data','hello');
  assert.equal((await h.call('poll',{sequence:0})).body.entries[0].data,'hello');
  assert.equal((await h.call('detach')).code,409);
  await h.call('external-ready');assert.equal((await h.call('detach')).body.retained,true);
  await h.call('input',{data:'unchanged session'});await h.call('resize',{cols:100,rows:30});
  assert.deepEqual(h.pty.writes,['unchanged session']);assert.deepEqual(h.pty.sizes,[[100,30]]);
  assert.equal((await h.call('resize',{cols:-1,rows:30})).code,400);
  h.process.emit('disconnect');assert.equal(h.pty.kills,0);assert.equal(h.spawns.length,1);
  assert.equal((await h.call('stop')).code,200);assert.equal(h.pty.kills,1);
  assert.equal((await h.call('poll',{sequence:1})).body.exited,true);
  assert.deepEqual(h.completed,[['owned-prompt','interactive']]);
});

test('unreleased session stops on parent disconnect, not on client disconnect', async t => {
  const h=await harness(t);await h.start();
  await h.call('poll',{sequence:0});assert.equal(h.pty.kills,0);
  h.process.emit('disconnect');assert.equal(h.pty.kills,1);
});

test('replay is bounded and reports a gap rather than pretending complete output', async t => {
  const h=await harness(t);await h.start();
  h.pty.emit('data','x'.repeat(2*1024*1024));
  const state=(await h.call('poll',{sequence:0})).body;
  assert.equal(state.gap,true);assert.ok(state.entries.reduce((sum,entry)=>sum+entry.data.length,0)<=1024*1024);
});

test('cancellation while native support loads prevents a late PTY spawn', async t => {
  let resolve, spawned=false;
  const h=await harness(t,()=>new Promise(yes=>resolve=yes));
  const starting=h.start();h.process.emit('message',{type:'cancel'});
  resolve({spawn(){spawned=true;throw Error('must not spawn');}});
  await assert.rejects(starting,/cancelled before spawn/);assert.equal(spawned,false);
});
