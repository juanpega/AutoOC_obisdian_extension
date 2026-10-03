const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {EventEmitter}=require('node:events');
const root=path.resolve(__dirname,'..');
const built=require('esbuild').buildSync({entryPoints:[path.join(root,'main.ts')],bundle:true,write:false,metafile:true,platform:'node',format:'cjs',packages:'external',external:['obsidian','electron'],logLevel:'silent'});

test('release plugin has no dependency on deferred MCP access module',()=>{
  assert.ok(!Object.keys(built.metafile.inputs).some(f=>/(^|\/)mcp-access\.ts$/.test(f)));
});

test('declared test command uses present tests and excludes deferred 003 integration',()=>{
  const script=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).scripts.test;
  const files=script.split(/\s+/).filter(x=>x.startsWith('tests/'));
  assert.ok(files.length>0);
  for(const f of files){assert.ok(fs.existsSync(path.join(root,f)),f);assert.ok(!/^tests\/mcp-/.test(f),f);}
});

test('deferred credential endpoint cannot read secrets or open approval in release plugin',async()=>{
  let reads=0,prompts=0;
  const obsidian={Modal:class{constructor(){prompts++;}},Plugin:class{},ItemView:class{},PluginSettingTab:class{},Setting:class{},Notice:class{}};
  const context={module:{exports:{}},exports:{},require:n=>n==='obsidian'?obsidian:require(n),process,Buffer,console,URL,TextDecoder,setTimeout,clearTimeout,setInterval,clearInterval};
  vm.runInNewContext(built.outputFiles[0].text,context);
  const plugin=Object.create(context.module.exports.default.prototype);
  plugin.mcpBridgeToken='fixture-token';plugin.secretStore={list(){reads++;return[];},decryptValue(){reads++;throw Error('must not decrypt');}};
  const req=new EventEmitter();req.method='POST';req.url='/credential';req.headers={authorization:'Bearer fixture-token'};
  const result=await new Promise(resolve=>{const res={destroyed:false,writeHead(status){this.status=status;},end(body){resolve({status:this.status,body:JSON.parse(body)});}};plugin.handleMcpBridgeRequest(req,res);req.emit('data',Buffer.from('{"name":"fixture"}'));req.emit('end');});
  assert.equal(result.body.ok,false);assert.ok(result.status>=400);assert.equal(reads,0);assert.equal(prompts,0);
});
