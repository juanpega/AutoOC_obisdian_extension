const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),Module=require('node:module');
const {spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..');
function fixture(t){
  const vault=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-coexist-'));
  const directory=path.join(vault,'.obsidian/plugins/auto-oc');fs.mkdirSync(directory,{recursive:true});
  const config={tasks:[{id:'single',name:'Single',taskKind:'code',codeAllowVault:true,code:'vault.append("effects.txt","once"); output="done";'}],workflows:[]};
  fs.writeFileSync(path.join(directory,'data.json'),JSON.stringify(config));
  const original=Module._load;
  let Plugin;
  try {Module._load=function(name,...args){if(name==='obsidian')return Object.fromEntries(['Plugin','Notice','Modal','Setting','ItemView','PluginSettingTab','WorkspaceLeaf'].map(k=>[k,class{}]));return original.call(this,name,...args);};Plugin=require('../main.js').default;}finally{Module._load=original;}
  const plugin=new Plugin();plugin.manifest={id:'auto-oc'};
  plugin.app={vault:{adapter:{basePath:vault},configDir:'.obsidian'},workspace:{getLeavesOfType:()=>[]}};
  plugin.createVaultMutationBatch=()=>({record(){},async flush(){}});
  plugin.reservePluginExecution();
  t.after(()=>{plugin.cliRequestHost?.close();if(plugin.cliRequestTimer!==undefined)clearInterval(plugin.cliRequestTimer);plugin.releasePluginExecution(false);assert.equal(path.dirname(fs.realpathSync(vault)),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(vault).startsWith('autooc-coexist-'));fs.rmSync(vault,{recursive:true,force:true});});
  return {vault,directory,plugin};
}
function cli(vault,...args){return new Promise((resolve,reject)=>{const child=spawn(process.execPath,[path.join(root,'autooc-cli.cjs'),...args,'--vault',vault]);let stdout='',stderr='';child.stdout.on('data',s=>stdout+=s);child.stderr.on('data',s=>stderr+=s);child.on('error',reject);child.on('exit',code=>resolve({code,stdout,stderr}));});}
test('CLI runs a task while plugin owns the vault and projects live progress without repeating effects',async t=>{
  const {vault,plugin}=fixture(t);await plugin.loadSettings();
  const observed=[];plugin.refreshOpenViews=()=>observed.push(JSON.parse(JSON.stringify(plugin.settings.tasks[0])));
  // Older versions have no reception path: this still exercises their real CLI rejection.
  if(plugin.startCliRequests){plugin.startCliRequests();const timer=setInterval(()=>plugin.cliRequestHost.poll(),10);t.after(()=>clearInterval(timer));}
  const result=await cli(vault,'run','--task','single');
  assert.equal(result.code,0,result.stderr);
  const state=JSON.parse(result.stdout);assert.equal(state.phase,'completed');
  assert.equal(fs.readFileSync(path.join(vault,'effects.txt'),'utf8'),'once');
  assert.ok(observed.some(task=>task.status==='running'));
  assert.ok(observed.some(task=>task.status==='completed'));
  const resumed=await cli(vault,'resume','--task','single','--run',state.runId);
  assert.equal(resumed.code,0,resumed.stderr);assert.equal(JSON.parse(resumed.stdout).runId,state.runId);
  assert.equal(fs.readFileSync(path.join(vault,'effects.txt'),'utf8'),'once');
  assert.ok(plugin.pluginExecutionLease);
});

test('CLI workflow progress, concurrent rejection, stop and resume share the plugin execution identity',async t=>{
  const {vault,directory,plugin}=fixture(t);
  fs.writeFileSync(path.join(directory,'data.json'),JSON.stringify({tasks:[],workflows:[{id:'w',name:'Workflow',steps:[
    {id:'first',stepKind:'code',codeAllowVault:true,code:'vault.append("effects.txt","first"); output="first";'},
    {id:'second',stepKind:'code',codeAllowVault:true,code:'vault.append("effects.txt","second"); output="second";'}
  ]}]}));
  await plugin.loadSettings();plugin.startCliRequests();
  const timer=setInterval(()=>plugin.cliRequestHost.poll(),10);t.after(()=>clearInterval(timer));
  const observed=[];plugin.refreshOpenViews=()=>observed.push(JSON.parse(JSON.stringify(plugin.settings.workflows[0])));
  let release,started;const entered=new Promise(resolve=>started=resolve),barrier=new Promise(resolve=>release=resolve);
  let first=true;plugin.createVaultMutationBatch=()=>({record(){},async flush(){if(first){first=false;started();await barrier;}}});
  const running=cli(vault,'run','--workflow','w');
  try{
    await entered;
    const runId=plugin.sharedWorkflowExecution.runId;assert.ok(runId);
    const competing=await cli(vault,'run','--workflow','w');assert.equal(competing.code,1);assert.match(competing.stderr,/already executing/);
    await assert.rejects(plugin.runSharedWorkflow('w'),/already executing/);
    const stopped=await cli(vault,'stop','--workflow','w','--run',runId);assert.equal(stopped.code,0,stopped.stderr);
    // Let the real installed host observe the stop before recording the first result.
    await new Promise(resolve=>setTimeout(resolve,150));release();
    const partial=await running;assert.equal(partial.code,0,partial.stderr);assert.equal(JSON.parse(partial.stdout).runId,runId);
    assert.equal(fs.readFileSync(path.join(vault,'effects.txt'),'utf8'),'first');
    const resumed=await cli(vault,'resume','--workflow','w','--run',runId);assert.equal(resumed.code,0,resumed.stderr);
    assert.equal(JSON.parse(resumed.stdout).phase,'completed');assert.equal(fs.readFileSync(path.join(vault,'effects.txt'),'utf8'),'firstsecond');
    assert.ok(observed.some(w=>w.status==='running'));assert.equal(plugin.settings.workflows[0].status,'completed');
  }finally{release();await running;}
});
