const {test} = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const {EventEmitter} = require('node:events');
const ts = require('typescript');

// Real loopback transport; only the child/PTY owner is simulated.
async function harness(t) {
  const state = {retained:false, ready:false, stops:0, commands:[], input:[], sequence:0};
  let token;
  const server = http.createServer(async (request,response) => {
    assert.equal(request.headers.authorization,'Bearer '+token);
    request.setEncoding('utf8');let text='';for await(const chunk of request)text+=chunk;
    const body=JSON.parse(text);state.commands.push(request.url);
    let result={retained:state.retained};
    if(request.url==='/poll')result={entries:body.sequence===0?[{sequence:1,data:'same process'}]:[],exited:false};
    if(request.url==='/input'){state.input.push(body.data);state.onInput?.();}
    if(request.url==='/stop')state.stops++;
    if(request.url==='/detach') {
      if(!state.ready){response.writeHead(409);response.end('not ready');return;}
      state.retained=true;result={retained:true};
    }
    response.end(JSON.stringify(result));
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const child = new EventEmitter(), launches=[];
  Object.assign(child,{connected:true, disconnects:0, unrefs:0,
    send(config,callback) {
      if(config.type==='cancel'){callback?.();return;}
      token=config.token;state.config=config;
      queueMicrotask(()=>{callback?.();child.emit('message',{type:'ready',port:server.address().port,pid:4321});});
    },
    disconnect(){this.connected=false;this.disconnects++;},unref(){this.unrefs++;},
  });
  const module={exports:{}};
  const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../terminal-session.ts'),'utf8'),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020},
  }).outputText;
  vm.runInNewContext(code,{module,exports:module.exports,process,Buffer,console,setTimeout,clearTimeout,setInterval,clearInterval,
    require(id){if(id==='child_process')return{spawn(...args){launches.push(args);return child;}};
      if(id==='./terminal-environment')return{terminalEnvironment:(_file,env)=>({...env})};return require(id);},
  });
  const session=await module.exports.createTerminalSession({pluginDirectory:process.cwd(),file:'synthetic.exe',args:['literal prompt pointer'],options:{cwd:process.cwd()}});
  t.after(async()=>{session.disconnect();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});
  return{state,child,launches,session};
}

test('independent client launches one hidden Node host, preserves output and detaches without respawn',async t=>{
  const h=await harness(t);
  assert.equal(h.launches.length,1);assert.equal(h.launches[0][0],'node');
  assert.equal(h.launches[0][2].detached,true);assert.equal(h.launches[0][2].windowsHide,true);
  assert.equal(h.session.pid,4321);
  const output=await new Promise(resolve=>{
    const timer=setTimeout(()=>assert.fail('missing terminal output'),3000);
    h.session.onData(data=>{clearTimeout(timer);resolve(data);});
  });
  assert.equal(output,'same process');
  await h.session.detach(async url=>{
    const parsed=new URL(url);assert.equal(parsed.hostname,'127.0.0.1');
    assert.equal(parsed.hash.slice(1),h.state.config.token);h.state.ready=true;
  });
  assert.equal(h.session.detached,true);assert.equal(h.launches.length,1);
  h.session.write('must not write from integrated view');
  assert.deepEqual(h.state.input,[]);assert.equal(h.state.stops,0);
  h.session.disconnect();assert.equal(h.child.connected,false);assert.equal(h.state.stops,0);
});

test('failure to open external browser never releases or stops the original process',async t=>{
  const h=await harness(t);
  await assert.rejects(h.session.detach(async()=>{throw Error('browser unavailable');}),/browser unavailable/);
  assert.equal(h.session.detached,false);assert.equal(h.state.retained,false);
  assert.equal(h.launches.length,1);assert.equal(h.state.stops,0);
  await h.session.kill();assert.equal(h.state.stops,1);
});

test('large Unicode pastes are sent in order without splitting characters or replaying input',async t=>{
  const h=await harness(t), paste='\u{1F680}\u4E2D\u00F1\n'.repeat(5000);
  const received=new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error('input did not arrive')),3000);
    h.state.onInput=()=>{if(h.state.input.join('')===paste+'tail'){clearTimeout(timer);resolve();}};
  });
  h.session.write(paste);h.session.write('tail');await received;
  assert.equal(h.state.input.join(''),paste+'tail');
  assert.ok(h.state.input.every(part=>Buffer.byteLength(JSON.stringify({data:part}))<65536));
});
