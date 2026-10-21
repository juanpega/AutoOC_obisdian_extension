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
  t.after(async()=>{plugin.cliRequestHost?.close();if(plugin.cliRequestTimer!==undefined)clearInterval(plugin.cliRequestTimer);await plugin.cliRequestHost?.drain();plugin.releasePluginExecution(false);assert.equal(path.dirname(fs.realpathSync(vault)),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(vault).startsWith('autooc-coexist-'));fs.rmSync(vault,{recursive:true,force:true});});
  return {vault,directory,plugin};
}
function cli(vault,...args){return new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,[path.join(root,'autooc-cli.cjs'),...args,'--vault',vault],{windowsHide:true});
  let stdout='',stderr='',timedOut=false;
  // Own only this synthetic child; a failed protocol must not stall the suite.
  const watchdog=setTimeout(()=>{timedOut=true;child.kill();},45000);
  child.stdout.on('data',s=>stdout+=s);child.stderr.on('data',s=>stderr+=s);
  child.on('error',error=>{clearTimeout(watchdog);reject(error);});
  child.on('exit',code=>{clearTimeout(watchdog);if(timedOut)reject(new Error(`Synthetic CLI watchdog expired after 45000ms; stdout=${stdout}; stderr=${stderr}`));else resolve({code,stdout,stderr});});
});}

test('a local save during an async reload rejects the late load and preserves the edit',async t=>{
  const {directory,plugin}=fixture(t);await plugin.loadSettings();
  plugin.settings.syntheticPadding='synthetic'.repeat(3000000);
  await plugin.saveSettings(false);
  const loading=plugin.loadSettings();
  plugin.settings.defaultModel='local-edit';
  const saving=plugin.saveSettings(false);
  await assert.rejects(loading,/changed while loading/);
  await saving;
  assert.equal(plugin.settings.defaultModel,'local-edit');
  assert.equal(JSON.parse(fs.readFileSync(path.join(directory,'data.json'))).defaultModel,'local-edit');
});

test('an unsaved nested local edit during async reload is preserved with an explicit conflict',async t=>{
  const {plugin}=fixture(t);await plugin.loadSettings();
  plugin.settings.syntheticPadding='synthetic'.repeat(3000000);
  await plugin.saveSettings(false);
  const loading=plugin.loadSettings();
  plugin.settings.tasks[0].name='unsaved-local-edit';
  await assert.rejects(loading,/changed while loading/);
  assert.equal(plugin.settings.tasks[0].name,'unsaved-local-edit');
  await plugin.saveSettings(false);
});

test('checkpoints publish a confirmed catalog without full UI rereads',async t=>{
  const {vault,plugin}=fixture(t);await plugin.loadSettings();
  let reads=0;const load=plugin.settingsWriter.loadAsync.bind(plugin.settingsWriter);
  plugin.settingsWriter.loadAsync=(...args)=>{reads++;return load(...args);};
  await plugin.runSharedWorkflow('@task:single',undefined,false,false,'single');
  assert.equal(reads,0,'the persisted catalog must be reused, including final projection');
  assert.equal(plugin.settings.tasks[0].status,'completed');
  assert.equal(fs.readFileSync(path.join(vault,'effects.txt'),'utf8'),'once');
});

test('confirmed publication preserves an unsaved local edit and prevents the first effect',async t=>{
  const {vault,plugin}=fixture(t);await plugin.loadSettings();
  const adopt=plugin.settingsWriter.adoptConfirmed.bind(plugin.settingsWriter);
  plugin.settingsWriter.adoptConfirmed=(...args)=>{
    plugin.settings.tasks[0].name='unsaved-local-name';
    return adopt(...args);
  };
  await assert.rejects(plugin.runSharedWorkflow('@task:single',undefined,false,false,'single'),/changed while loading/);
  assert.equal(plugin.settings.tasks[0].name,'unsaved-local-name');
  assert.equal(fs.existsSync(path.join(vault,'effects.txt')),false);
  await plugin.saveSettings(false);
  assert.equal(JSON.parse(fs.readFileSync(path.join(vault,'.obsidian/plugins/auto-oc/data.json'))).tasks[0].name,'unsaved-local-name');
});

test('external edit between confirmed persistence and UI publication is retained without effects',async t=>{
  const {vault,directory,plugin}=fixture(t);await plugin.loadSettings();
  const adopt=plugin.settingsWriter.adoptConfirmed.bind(plugin.settingsWriter),file=path.join(directory,'data.json');
  let edited=false;
  plugin.settingsWriter.adoptConfirmed=(...args)=>{
    if(!edited){edited=true;const current=JSON.parse(fs.readFileSync(file));current.unrelatedEdit='external-kept';fs.writeFileSync(file,JSON.stringify(current));}
    return adopt(...args);
  };
  await assert.rejects(plugin.runSharedWorkflow('@task:single',undefined,false,false,'single'),/confirmed catalog changed externally/);
  assert.equal(JSON.parse(fs.readFileSync(file)).unrelatedEdit,'external-kept');
  assert.equal(fs.existsSync(path.join(vault,'effects.txt')),false);
  assert.equal(plugin.settings.unrelatedEdit,'external-kept');
  await plugin.saveSettings(false);
  assert.equal(JSON.parse(fs.readFileSync(file)).unrelatedEdit,'external-kept');
});
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
