const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),Module=require('node:module');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const names=['main.js','manifest.json','styles.css','autooc-cli.cjs','autooc-runtime.cjs','skills/autooc-runtime/SKILL.md','release-integrity.json'];
function loadPlugin(file=path.join(root,'main.js')) {
  const original=Module._load;
  try {
    Module._load=function(name,...args){
      if(name==='obsidian')return {Plugin:class{},Notice:class{},Modal:class{},Setting:class{},ItemView:class{},PluginSettingTab:class{},WorkspaceLeaf:class{}};
      return original.call(this,name,...args);
    };
    delete require.cache[require.resolve(file)];
    return require(file).default;
  }finally{Module._load=original;}
}
function fixture(t) {
  const vault=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-lifecycle-'));
  const directory=path.join(vault,'.obsidian/plugins/auto-oc'),runtime=path.join(directory,'runtime');
  fs.mkdirSync(runtime,{recursive:true});
  for(const name of names){fs.mkdirSync(path.dirname(path.join(directory,name)),{recursive:true});fs.copyFileSync(path.join(root,name),path.join(directory,name));}
  fs.writeFileSync(path.join(directory,'data.json'),JSON.stringify({tasks:[],workflows:[],custom:'preserved'}));
  t.after(()=>{
    assert.equal(path.dirname(fs.realpathSync(vault)),fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(vault).startsWith('autooc-lifecycle-'));fs.rmSync(vault,{recursive:true,force:true});
  });
  const Plugin=loadPlugin(path.join(directory,'main.js'));
  const create=()=>{
    const p=new Plugin();p.manifest=JSON.parse(fs.readFileSync(path.join(directory,'manifest.json')));
    p.app={vault:{adapter:{basePath:vault},configDir:'.obsidian'},workspace:{detachLeavesOfType(){},onLayoutReady(){}}};
    p.settings={tasks:[],workflows:[]};
    p.loadSettings=async()=>{};p.registerView=(type,factory)=>{p.createDashboard=factory;};p.addRibbonIcon=()=>{};p.addCommand=()=>{};p.addSettingTab=()=>{};p.registerInterval=()=>{};p.register=()=>{};
    p.refreshModels=()=>{};p.refreshAgents=()=>{};p.refreshCodexModels=async()=>{};p.checkForUpdates=async()=>{};
    return p;
  };
  return {vault,directory,runtime,create};
}
function timers(t){
  const old=global.window,st=global.setTimeout;const callbacks=[];
  global.window={setInterval:()=>1,clearInterval(){},setTimeout:fn=>{callbacks.push(fn);return 1;},clearTimeout(){}};
  global.setTimeout=fn=>{callbacks.push(fn);return 1;};
  t.after(()=>{global.window=old;global.setTimeout=st;});return callbacks;
}
function dashboard(t,p){
  const view=p.createDashboard({}),events=[];
  view.unsubscribeTaskUpdated=()=>events.push('tasks');
  view.unsubscribeWorkflowUpdated=()=>events.push('workflows');
  view.dashboardResizeObserver={disconnect:()=>events.push('observer')};
  const interval=setInterval(()=>assert.fail('closed Dashboard animation ran'),60000);
  t.after(()=>clearInterval(interval));view.sinkIntervals.set('task',interval);
  view.dashboardTaskDriftDirection.set('task',1);
  view.dashboardPositions.set('task',{x:12,y:34,sizePx:56});
  const clean=()=>{
    assert.deepEqual(events,['tasks','workflows','observer']);
    assert.equal(view.unsubscribeTaskUpdated,undefined);assert.equal(view.unsubscribeWorkflowUpdated,undefined);
    assert.equal(view.dashboardResizeObserver,null);assert.equal(view.sinkIntervals.size,0);
    assert.equal(view.dashboardTaskDriftDirection.size,0);assert.equal(interval._destroyed,true);
  };
  return {view,clean};
}
test('C11 real Dashboard close resolves during unload and preserves an immediate successor',async t=>{
  const callbacks=timers(t);const {create,directory,runtime}=fixture(t),first=create(),second=create();
  await first.onload();const {view,clean}=dashboard(t,first);
  const before=fs.readFileSync(path.join(directory,'data.json')),settings=JSON.stringify(first.settings);
  let closing,finishBridge,writes=0;const save=first.saveSettings.bind(first);
  first.saveSettings=(...args)=>{writes++;return save(...args);};
  first.stopMcpBridge=()=>new Promise(resolve=>{finishBridge=resolve;});
  first.app.workspace.detachLeavesOfType=()=>{closing=view.onClose().then(()=>({resolved:true}),error=>({resolved:false,error:String(error)}));};
  const unloading=first.onunload();
  try{
    await second.onload();const owner=fs.readFileSync(path.join(runtime,'execution.lock/owner.json'));
    finishBridge();await unloading;
    assert.deepEqual(await closing,{resolved:true});clean();
    assert.equal(writes,0);assert.equal(JSON.stringify(first.settings),settings);
    for(const callback of [...callbacks])callback();
    await view.onClose();clean();
    assert.deepEqual(fs.readFileSync(path.join(directory,'data.json')),before);
    assert.deepEqual(fs.readFileSync(path.join(runtime,'execution.lock/owner.json')),owner);
    await assert.rejects(first.saveSettings(),/stopped/);
  }finally{finishBridge();await unloading;await second.onunload();}
});
test('C11 active Dashboard saves positions through SettingsWriter and closes cleanly',async t=>{
  timers(t);const {create,directory}=fixture(t),p=create();await p.onload();
  p.settings=p.settingsWriter.load(path.join(directory,'data.json'));
  const {view,clean}=dashboard(t,p);
  try{
    assert.equal(await view.persistDashboardPositionsSafely(),'saved');
    view.dashboardPositions.set('task',{x:78,y:90});
    const closing=view.onClose();clean();await closing;
    const saved=JSON.parse(fs.readFileSync(path.join(directory,'data.json')));
    assert.deepEqual(saved.dashboardPositions,{task:{x:78,y:90}});assert.equal(saved.custom,'preserved');
  }finally{await p.onunload();}
});
test('C11 persistence failure is reported without exposing errors or interrupting cleanup',async t=>{
  timers(t);const {create,directory}=fixture(t),p=create();await p.onload();
  const {view,clean}=dashboard(t,p),before=fs.readFileSync(path.join(directory,'data.json'));
  const warn=console.warn,diagnostics=[];console.warn=(...args)=>diagnostics.push(args);
  const save=p.settingsWriter.save;p.settingsWriter.save=async()=>{throw Error('PRIVATE_CONFIGURATION_SENTINEL');};
  try{
    assert.equal(await view.persistDashboardPositionsSafely(),'failed');
    await view.onClose();clean();
    assert.equal(diagnostics.length,2);
    for(const diagnostic of diagnostics)assert.deepEqual(diagnostic,['AutoOC: Dashboard positions could not be saved.']);
    assert.deepEqual(fs.readFileSync(path.join(directory,'data.json')),before);
  }finally{console.warn=warn;p.settingsWriter.save=save;await p.onunload();}
});
test('C11 a pending real Dashboard save retains ownership through unload',async t=>{
  timers(t);const {create,directory,runtime}=fixture(t),p=create();await p.onload();
  const {view,clean}=dashboard(t,p),ownerFile=path.join(runtime,'execution.lock/owner.json');
  const owner=fs.readFileSync(ownerFile);const closing=view.onClose();clean();
  assert.equal(p.settingsWriter.hasPendingWrites,true);
  await p.onunload();assert.deepEqual(fs.readFileSync(ownerFile),owner);
  assert.throws(()=>create().reservePluginExecution(),/live or cannot/);
  await closing;assert.equal(p.settingsWriter.hasPendingWrites,false);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(directory,'data.json'))).dashboardPositions,{task:{x:12,y:34,sizePx:56}});
  p.releasePluginExecution(false);
});
test('C11 late Dashboard adjustments skip snapshot mutation and writing after unload',async t=>{
  timers(t);const {create,directory}=fixture(t),p=create();await p.onload();const {view,clean}=dashboard(t,p);
  let closing;p.app.workspace.detachLeavesOfType=()=>{closing=view.onClose();};
  await p.onunload();await closing;clean();
  const before=fs.readFileSync(path.join(directory,'data.json')),settings=JSON.stringify(p.settings);
  view.dashboardPositions.set('late',{x:99,y:99});
  assert.equal(await view.persistDashboardPositionsSafely(),'skipped');
  await view.onClose();clean();assert.equal(JSON.stringify(p.settings),settings);
  assert.deepEqual(fs.readFileSync(path.join(directory,'data.json')),before);
});
test('host may ignore unload promise: successor owns lease before delayed MCP close',async t=>{
  timers(t);const {create,runtime}=fixture(t),first=create();
  first.reservePluginExecution();let close;first.stopMcpBridge=()=>new Promise(resolve=>{close=resolve;});
  const unloading=first.onunload();const second=create();
  try {
    second.reservePluginExecution();const token=JSON.parse(fs.readFileSync(path.join(runtime,'execution.lock/owner.json'))).token;
    close();await unloading;
    assert.equal(JSON.parse(fs.readFileSync(path.join(runtime,'execution.lock/owner.json'))).token,token);
    await assert.rejects(first.saveSettings(),/stopp|unload|closed/i);
    await assert.rejects(first.runTask({id:'late'}),/stopp|unload|closed/i);
  }finally{close?.();await unloading;second.releasePluginExecution(false);first.releasePluginExecution(false);}
});
test('failure after loadSettings releases inactive reservation and permits retry',async t=>{
  timers(t);const {create,runtime}=fixture(t),first=create();
  first.startMcpBridge=async()=>{};first.registerView=()=>{throw Error('injected registerView');};
  await assert.rejects(first.onload(),/injected registerView/);
  assert.equal(fs.existsSync(path.join(runtime,'execution.lock')),false);
  const second=create();second.startMcpBridge=async()=>{};
  await second.onload();await second.onunload();
});

test('partial registration failure also disposes resources owned by the Obsidian component',async t=>{
  timers(t);const {create}=fixture(t),p=create();const views=new Set();
  p.registerView=type=>views.add(type);p.addRibbonIcon=()=>{throw Error('ribbon registration failed');};
  p.unload=()=>views.clear();
  await assert.rejects(p.onload(),/ribbon registration failed/);
  assert.equal(views.size,0);assert.equal(p.ready,false);
});
test('dead owner after normal process exit is archived on next reservation without replay',t=>{
  const {create,runtime,directory}=fixture(t);
  // A recurring task legitimately returns to pending after an observed finish.
  const data=JSON.stringify({tasks:[{id:'recurring',status:'pending',legacyExecution:{token:'old',finishedAt:'2026-10-05T12:00:00Z'}}],workflows:[]});
  fs.writeFileSync(path.join(directory,'data.json'),data);
  const child=spawnSync(process.execPath,['-e',`require(${JSON.stringify(path.join(root,'autooc-runtime.cjs'))}).acquireExecutionLease(process.argv[1])`,runtime],{encoding:'utf8'});
  assert.equal(child.status,0,child.stderr);
  const owner=fs.readFileSync(path.join(runtime,'execution.lock/owner.json'),'utf8'),token=JSON.parse(owner).token;
  const p=create();p.reservePluginExecution();
  try{
    assert.equal(fs.readFileSync(path.join(runtime,`abandoned-lease-${token}/owner.json`),'utf8'),owner);
    assert.equal(fs.readFileSync(path.join(directory,'data.json'),'utf8'),data);
  }finally{p.releasePluginExecution(false);}
});
test('three-file candidate completes itself before registering execution; complete package stays offline',async t=>{
  timers(t);const {create,directory}=fixture(t),p=create();p.startMcpBridge=async()=>{};
  const files=Object.fromEntries(names.map(n=>[n,fs.readFileSync(path.join(directory,n))]));
  for(const name of names.slice(3))fs.unlinkSync(path.join(directory,name));
  const prior=global.fetch;let requests=0;
  global.fetch=async url=>{requests++;const name=names.find(n=>url.includes('/'+n+'?'));assert.ok(name,url);return {ok:true,arrayBuffer:async()=>files[name]};};
  t.after(()=>{global.fetch=prior;});
  p.registerView=()=>{for(const name of names)assert.deepEqual(fs.readFileSync(path.join(directory,name)),files[name]);};
  await p.onload();assert.equal(requests,7);await p.onunload();
  const next=create();next.startMcpBridge=async()=>{};global.fetch=async()=>{throw Error('unexpected network');};
  await next.onload();await next.onunload();
  assert.equal(JSON.parse(fs.readFileSync(path.join(directory,'data.json'))).custom,'preserved');
});

test('original 1.6.0 updatePlugin with open Dashboard waits for its asynchronous catalog write',async t=>{
  timers(t);const {create,directory,vault}=fixture(t);
  const files=Object.fromEntries(names.map(n=>[n,fs.readFileSync(path.join(directory,n))]));
  const configuration=Buffer.from(JSON.stringify({tasks:[{id:'history',status:'completed',output:'PRESERVE_OLD_RESULT'}],workflows:[],dashboardPositions:{history:{x:1,y:2}}}));
  fs.writeFileSync(path.join(directory,'data.json'),configuration);
  for(const name of names)fs.unlinkSync(path.join(directory,name));
  const legacyRequests=[],bootstrapRequests=[],notices=[];let successor,writing;
  const response=name=>({ok:true,text:async()=>files[name].toString(),arrayBuffer:async()=>files[name]});
  const prior=global.fetch;
  global.fetch=async url=>{const name=names.find(n=>url.includes('/'+n+'?'));assert.ok(name,url);bootstrapRequests.push(name);return response(name);};
  t.after(()=>{global.fetch=prior;});
  const original=require('./fixtures/legacy-update-1.6.0.cjs')({
    confirm:()=>true,import_obsidian:{Notice:class{constructor(message){notices.push(message);}}},
    noCacheUrl:url=>url,REMOTE_FILE_URLS:{mainJs:'main.js',manifest:'manifest.json',styles:'styles.css'},
    fetch:async name=>{legacyRequests.push(name);return response(name);}
  });
  const legacy={manifest:{id:'auto-oc',version:'1.6.0'},latestVersion:JSON.parse(files['manifest.json']).version,
    app:{vault:{adapter:{write:async(relative,text)=>{
      const target=path.resolve(vault,relative);assert.ok(target.startsWith(directory+path.sep));fs.writeFileSync(target,text);
    }}},plugins:{disablePlugin:async()=>{
      // Host closes the still-open Dashboard but does not await its onClose/save.
      const fd=fs.openSync(path.join(directory,'data.json'),'w');
      writing=(async()=>{try{
        await require('node:timers/promises').setTimeout(30);
        fs.writeSync(fd,configuration.subarray(0,20));
        await require('node:timers/promises').setTimeout(30);
        fs.writeSync(fd,configuration.subarray(20));
      }finally{fs.closeSync(fd);}})();
    },enablePlugin:async()=>{
      successor=create();successor.manifest=legacy.manifest;
      successor.loadSettings=async()=>{successor.settings=successor.settingsWriter.load(path.join(directory,'data.json'));};
      await successor.onload();
    }}}};
  try {await original.call(legacy);} finally {await writing;}
  assert.deepEqual(legacyRequests,['main.js','manifest.json','styles.css']);assert.equal(bootstrapRequests.length,7);
  assert.equal(successor.ready,true);assert.ok(notices.includes('AutoOC: plugin reloaded.'));
  assert.equal(successor.manifest.version,JSON.parse(files['manifest.json']).version);
  assert.equal(successor.settings.tasks[0].output,'PRESERVE_OLD_RESULT');
  assert.deepEqual(successor.settings.dashboardPositions,{history:{x:1,y:2}});
  for(const name of names)assert.deepEqual(fs.readFileSync(path.join(directory,name)),files[name]);
  assert.deepEqual(fs.readFileSync(path.join(directory,'data.json')),configuration);await successor.onunload();
});

test('single SettingsWriter completes lock, temporary file and atomic rename during disable/enable',async t=>{
  timers(t);const {create,directory}=fixture(t),outgoing=create(),successor=create();
  const file=path.join(directory,'data.json'),originalRename=fs.promises.rename;
  outgoing.settings=outgoing.settingsWriter.load(file);
  outgoing.settings.dashboardPositions={history:{x:11,y:22}};
  let entered,finish,writing,temporary;
  const atRename=new Promise(resolve=>{entered=resolve;});
  const allowRename=new Promise(resolve=>{finish=resolve;});
  fs.promises.rename=async function(from,to){
    if(path.resolve(to)===path.resolve(file)) {temporary=from;entered();await allowRename;}
    return originalRename.call(this,from,to);
  };
  t.after(()=>{fs.promises.rename=originalRename;});
  const host={disablePlugin:async()=>{
    // 1.6.1 releases its idle lease before detachLeaves starts the Dashboard save.
    // The host doesn't await that view's asynchronous onClose.
    writing=outgoing.settingsWriter.save(file,()=>outgoing.settings);await atRename;
  },enablePlugin:async()=>{
    successor.manifest.version='1.6.1';
    successor.loadSettings=async()=>{successor.settings=successor.settingsWriter.load(file);};
    await successor.onload();
  }};
  await host.disablePlugin();
  assert.ok(fs.existsSync(file+'.write-lock'));assert.ok(fs.existsSync(temporary));
  const loading=host.enablePlugin();const result=loading.then(()=>null,error=>error);
  await require('node:timers/promises').setTimeout(60);assert.equal(successor.ready,false);
  finish();await writing;
  const error=await result;if(error)throw error;
  assert.equal(successor.ready,true);assert.deepEqual(successor.settings.dashboardPositions,{history:{x:11,y:22}});
  assert.equal(fs.existsSync(file+'.write-lock'),false);assert.equal(fs.existsSync(temporary),false);
  await successor.settingsWriter.save(file,()=>({...successor.settings,nextWrite:true}));
  assert.equal(JSON.parse(fs.readFileSync(file)).nextWrite,true);await successor.onunload();
});

for(const [writes,pace,gap] of [[2,65,0],[5,65,0],[5,0,0],[2,65,50]]) test(`historical 1.6.1 Dashboard drains ${writes} queued saves, pace ${pace}, gap ${gap}`,async t=>{
  timers(t);const {create,directory}=fixture(t),successor=create(),file=path.join(directory,'data.json');
  const legacy=require('./fixtures/legacy-settings-1.6.1.cjs');
  const outgoing={...legacy.plugin,settingsWriter:new legacy.SettingsWriter(),app:successor.app,manifest:{id:'auto-oc'},
    selectedExecutionLocation:()=>({configurationFile:file})};
  outgoing.settings=outgoing.settingsWriter.load(file);
  const view={...legacy.view,plugin:outgoing,dashboardPositions:new Map([['history',{x:11,y:22}]]),
    sinkIntervals:new Map(),dashboardTaskDriftDirection:new Map()};
  const originalRename=fs.promises.rename,originalMkdir=fs.promises.mkdir,delay=require('node:timers/promises').setTimeout;
  let entered,finish,count=0;const tokens=new Set();
  const firstRename=new Promise(resolve=>entered=resolve),allowFirst=new Promise(resolve=>finish=resolve);
  fs.promises.rename=async function(from,to){
    if(path.resolve(to)===path.resolve(file)){
      count++;tokens.add(fs.readFileSync(file+'.write-lock','utf8'));
      if(count===1){entered();await allowFirst;}else if(pace)await delay(pace);
    }
    return originalRename.call(this,from,to);
  };
  let mkdirCount=0;
  fs.promises.mkdir=async function(target,...args){
    if(gap && path.resolve(target)===path.resolve(directory) && ++mkdirCount===3)await delay(gap);
    return originalMkdir.call(this,target,...args);
  };
  t.after(()=>{fs.promises.rename=originalRename;fs.promises.mkdir=originalMkdir;});
  const jobs=Array.from({length:writes-1},()=>view.persistDashboardPositions());jobs.push(view.onClose());
  await firstRename;
  successor.loadSettings=async()=>{successor.settings=successor.settingsWriter.load(file);};
  const loading=successor.onload().then(()=>null,error=>error);
  await delay(60);finish();await Promise.all(jobs);
  const error=await loading;
  try {
    assert.equal(error,null);assert.equal(successor.ready,true);assert.equal(tokens.size,writes);
    assert.deepEqual(successor.settings.dashboardPositions,{history:{x:11,y:22}});
    assert.equal(fs.existsSync(file+'.write-lock'),false);
    await successor.settingsWriter.save(file,()=>({...successor.settings,successorSaved:true}));
    assert.equal(JSON.parse(fs.readFileSync(file)).successorSaved,true);
  }finally{successor.releasePluginExecution(false);}
});

for(const finishes of [true,false,'late']) test(`startup monotonic budget ${finishes==='late'?'includes final stabilization':finishes?'accepts a legitimate writer beyond two seconds':'rejects a stalled writer at the finite deadline'}`,async t=>{
  timers(t);const {create,directory,runtime}=fixture(t),p=create(),file=path.join(directory,'data.json');
  const lock=file+'.write-lock',token=require('crypto').randomUUID(),before=fs.readFileSync(file);
  const temporary=`${file}.${process.pid}.123.abc.tmp`;
  fs.writeFileSync(lock,token);fs.writeFileSync(temporary,before);
  let now=0,notify,closed=0,outcome;
  t.mock.method(performance,'now',()=>now);
  const watch=fs.watch;
  t.mock.method(fs,'watch',function(target,callback){
    const observer=watch.call(this,target,callback);notify=callback;
    const close=observer.close.bind(observer);observer.close=()=>{closed++;return close();};
    return observer;
  });
  const tick=async value=>{now=value;notify();await require('node:timers/promises').setImmediate();};
  const loading=p.onload().then(()=>{outcome='loaded';},error=>{outcome=error;});
  try {
    assert.equal(typeof notify,'function');
    // Keep real files and ownership checks; only monotonic elapsed time is controlled.
    await tick(3_000);
    assert.equal(outcome,undefined,'a legitimate pending writer must survive the former 2s deadline');
    assert.equal(p.ready,false);
    if(finishes){
      fs.renameSync(temporary,file);fs.unlinkSync(lock);
      await tick(finishes==='late'?9_900:3_100);await tick(finishes==='late'?10_000:3_250);await loading;
      if(finishes==='late'){
        assert.match(outcome.message,/did not become valid and stable/);assert.equal(p.ready,false);
      }else{assert.equal(outcome,'loaded');assert.equal(p.ready,true);}
      assert.deepEqual(fs.readFileSync(file),before);
    }else{
      await tick(9_999);assert.equal(outcome,undefined);
      await tick(10_000);await loading;
      assert.match(outcome.message,/startup wait expired/);assert.equal(p.ready,false);
      assert.equal(fs.readFileSync(lock,'utf8'),token);
      assert.deepEqual(fs.readFileSync(temporary),before);assert.deepEqual(fs.readFileSync(file),before);
      assert.ok(fs.existsSync(path.join(runtime,'execution.lock')),'uncertain write retains the reservation');
    }
    assert.equal(closed,1);
  }finally{await p.onunload();}
});

for(const scenario of ['persistent','token-replaced','lock-replaced','unobserved-rename','lock-hardlink','foreign-temporary','orphan-temporary',
  'temporary-replaced','corrupt','uncertain-catalog','journal','owner-changed','cancel','directory-replaced']) {
  test(`initial SettingsWriter transition rejects ${scenario} without changing evidence`,async t=>{
    timers(t);const {create,directory,runtime}=fixture(t),p=create(),file=path.join(directory,'data.json');
    const lock=file+'.write-lock',token=require('crypto').randomUUID(),delay=require('node:timers/promises').setTimeout;
    fs.writeFileSync(lock,token);const before=fs.readFileSync(file);
    let effects=0;p.registerView=()=>{effects++;};p.loadSettings=async()=>{effects++;};
    const temporary=`${file}.${process.pid}.123.abc.tmp`;
    if(scenario==='lock-hardlink')fs.linkSync(lock,path.join(directory,'lock-link'));
    if(scenario==='foreign-temporary')fs.writeFileSync(`${file}.0.123.abc.tmp`,'{}');
    if(scenario==='orphan-temporary'){fs.writeFileSync(temporary,'{}');fs.unlinkSync(lock);}
    if(scenario==='temporary-replaced')fs.writeFileSync(temporary,'{}');
    if(scenario==='corrupt')fs.writeFileSync(file,'{');
    if(scenario==='uncertain-catalog')fs.writeFileSync(file,JSON.stringify({tasks:[{id:'t',status:'running'}]}));
    if(scenario==='journal')fs.writeFileSync(path.join(runtime,'proof.json'),JSON.stringify({schemaVersion:1,runId:'proof',workflowId:'w',definitionHash:'a'.repeat(64),revision:1,phase:'in_flight',nextStepId:'s',steps:[{stepId:'s',status:'in_flight'}]}));
    let replacedDirectory=false;
    if(scenario==='directory-replaced'){
      // Windows can refuse renaming a watched directory (EPERM), before the
      // product sees any replacement. Inject the physical identity returned
      // by lstat instead; all other reads and the owner guard remain real.
      const lstat=fs.lstatSync,physicalDirectory=fs.realpathSync.native(directory);
      t.mock.method(fs,'lstatSync',function(target,...args){
        const stat=lstat.call(this,target,...args);
        if(replacedDirectory && fs.realpathSync.native(target)===physicalDirectory){
          // Windows inode numbers can exceed Number's exact integer range.
          const replacement=Object.create(stat);replacement.birthtimeMs=stat.birthtimeMs+1;return replacement;
        }
        return stat;
      });
    }
    const expected={persistent:/wait expired/,'token-replaced':/ownership changed/,'lock-replaced':/ownership changed/,'unobserved-rename':/ownership changed/,
      'lock-hardlink':/Unsafe/,'foreign-temporary':/Unsafe/,'orphan-temporary':/reconciliation/,'temporary-replaced':/identity changed/,
      corrupt:/JSON/,'uncertain-catalog':/Active execution/,journal:/uncertain effect/,'owner-changed':/lease|ownership/i,
      cancel:/stopped/,'directory-replaced':/identity|selection|installation/i}[scenario];
    const rejected=assert.rejects(p.onload(),expected);
    await delay(40);
    if(scenario==='token-replaced')fs.writeFileSync(lock,require('crypto').randomUUID());
    if(scenario==='lock-replaced'){fs.renameSync(lock,lock+'.previous');fs.writeFileSync(lock,token);}
    if(scenario==='unobserved-rename'){
      fs.renameSync(file,file+'.previous');fs.writeFileSync(file,before);
      fs.renameSync(lock,lock+'.previous');fs.writeFileSync(lock,require('crypto').randomUUID());
    }
    if(scenario==='temporary-replaced'){fs.renameSync(temporary,temporary+'.previous');fs.writeFileSync(temporary,'{}');}
    if(scenario==='owner-changed'){
      const ownerFile=path.join(runtime,'execution.lock/owner.json'),owner=JSON.parse(fs.readFileSync(ownerFile));
      fs.writeFileSync(ownerFile,JSON.stringify({...owner,token:require('crypto').randomUUID()}));
    }
    if(scenario==='cancel')await p.onunload();
    if(scenario==='directory-replaced'){
      replacedDirectory=true;
    }
    await rejected;assert.equal(p.ready,false);assert.equal(effects,0);
    if(!['corrupt','uncertain-catalog'].includes(scenario))assert.deepEqual(fs.readFileSync(file),before);
    assert.equal(fs.existsSync(lock),scenario!=='orphan-temporary');
  });
}

test('after atomic writer completes, even a byte-identical external catalog replacement is rejected',async t=>{
  timers(t);const {create,directory}=fixture(t),p=create(),file=path.join(directory,'data.json');
  const lock=file+'.write-lock',before=fs.readFileSync(file),delay=require('node:timers/promises').setTimeout;
  fs.writeFileSync(lock,require('crypto').randomUUID());
  const rejected=assert.rejects(p.onload(),/identity changed/);
  await delay(40);fs.unlinkSync(lock);await delay(50);
  fs.renameSync(file,file+'.external-backup');fs.writeFileSync(file,before);
  await rejected;assert.equal(p.ready,false);assert.deepEqual(fs.readFileSync(file),before);
});

for(const failure of [false,true]) test(`startup directory observer closes after ${failure?'failure':'success'}`,async t=>{
  timers(t);const {create,directory}=fixture(t),p=create(),watch=fs.watch;
  let opened=0,closed=0;
  fs.watch=function(target,...args){
    const observer=watch.call(this,target,...args);
    if(fs.realpathSync.native(target)===fs.realpathSync.native(directory)){
      opened++;const close=observer.close.bind(observer);
      observer.close=()=>{closed++;return close();};
      if(failure)queueMicrotask(()=>observer.emit('error',Error('injected observer failure')));
    }
    return observer;
  };
  try {
    if(failure)await assert.rejects(p.onload(),/injected observer failure/);
    else await p.onload();
    assert.equal(opened,1);assert.equal(closed,1);
  }finally{fs.watch=watch;await p.onunload();}
});

test('current version disable/enable prevents late Dashboard writes and preserves the successor lease',async t=>{
  timers(t);const {create,directory,runtime}=fixture(t),first=create(),second=create();
  await first.onload();let lateSave;
  first.app.workspace.detachLeavesOfType=()=>{lateSave=assert.rejects(first.saveSettings(),/stopped/);};
  const unload=first.onunload();await second.onload();
  const owner=fs.readFileSync(path.join(runtime,'execution.lock/owner.json'));
  await unload;await lateSave;
  assert.equal(second.ready,true);assert.deepEqual(fs.readFileSync(path.join(runtime,'execution.lock/owner.json')),owner);
  assert.equal(JSON.parse(fs.readFileSync(path.join(directory,'data.json'))).custom,'preserved');await second.onunload();
});

test('complete package loads offline with a cached legacy manifest and refreshes it only after verification',async t=>{
  timers(t);const {create,directory}=fixture(t),p=create();
  const installed=JSON.parse(fs.readFileSync(path.join(directory,'manifest.json')));
  const cached={...installed,version:'1.6.0',dir:'.obsidian/plugins/auto-oc'};
  p.manifest=cached;
  const prior=global.fetch;global.fetch=async()=>{throw Error('unexpected network');};t.after(()=>{global.fetch=prior;});
  p.loadSettings=async()=>{assert.equal(p.manifest.version,installed.version);};
  await p.onload();assert.equal(p.ready,true);assert.equal(cached.version,installed.version);
  assert.equal(p.manifest.dir,'.obsidian/plugins/auto-oc');await p.onunload();
});

test('complete offline package waits for a legacy write and uses the final SettingsWriter version',async t=>{
  timers(t);const {create,directory}=fixture(t),p=create(),file=path.join(directory,'data.json');
  const delay=require('node:timers/promises').setTimeout;
  fs.writeFileSync(file,'');
  const writing=(async()=>{await delay(30);fs.writeFileSync(file,JSON.stringify({tasks:[],workflows:[],custom:'intermediate'}));
    await delay(30);fs.writeFileSync(file,JSON.stringify({tasks:[],workflows:[],custom:'final'}));})();
  const prior=global.fetch;global.fetch=async()=>{throw Error('offline');};t.after(()=>{global.fetch=prior;});
  p.loadSettings=async()=>{p.settings=p.settingsWriter.load(file);};
  try {
    await p.onload();assert.equal(p.settings.custom,'final');
    await p.settingsWriter.save(file,()=>({...p.settings,saved:true}));
    assert.equal(JSON.parse(fs.readFileSync(file)).saved,true);
  }finally{await writing;await p.onunload();}
});

for(const scenario of ['corrupt','invalid-catalog','journal','live-owner','owner-changed','file-replaced','manifest-changed','cancel']) {
  test(`startup catalog wait fails closed for ${scenario}`,async t=>{
    timers(t);const {create,directory,runtime}=fixture(t),p=create(),file=path.join(directory,'data.json');
    const delay=require('node:timers/promises').setTimeout;
    const configuration=fs.readFileSync(file),files=Object.fromEntries(names.map(n=>[n,fs.readFileSync(path.join(directory,n))]));
    for(const name of names.slice(3))fs.unlinkSync(path.join(directory,name));
    let effects=0,requests=0,owner,mutation;
    const prior=global.fetch;global.fetch=async()=>{requests++;throw Error('must not download');};t.after(()=>{global.fetch=prior;});
    p.registerView=()=>{effects++;};p.loadSettings=async()=>{effects++;};
    if(scenario==='invalid-catalog')fs.writeFileSync(file,'{"tasks":{}}');
    else fs.writeFileSync(file,'');
    if(scenario==='live-owner') {create().reservePluginExecution();owner=fs.readFileSync(path.join(runtime,'execution.lock/owner.json'));}
    if(scenario==='journal')fs.writeFileSync(path.join(runtime,'proof.json'),JSON.stringify({schemaVersion:1,runId:'proof',workflowId:'w',definitionHash:'a'.repeat(64),revision:1,phase:'in_flight',nextStepId:'s',steps:[{stepId:'s',status:'in_flight'}]}));
    const loading=p.onload();
    const expected={corrupt:/valid and stable/, 'invalid-catalog':/Invalid execution catalog/,journal:/uncertain effect/,
      'live-owner':/live or cannot/, 'owner-changed':/lease|ownership/i,'file-replaced':/identity changed/,'manifest-changed':/identity changed/,cancel:/stopped/}[scenario];
    // Attach rejection handler before yielding to the host.
    const rejected=assert.rejects(loading,expected);
    if(['owner-changed','file-replaced','manifest-changed','cancel'].includes(scenario))mutation=(async()=>{
      await delay(30);
      if(scenario==='owner-changed'){
        const ownerFile=path.join(runtime,'execution.lock/owner.json');
        const value=JSON.parse(fs.readFileSync(ownerFile));value.token=require('crypto').randomUUID();
        fs.writeFileSync(ownerFile,JSON.stringify(value));owner=fs.readFileSync(ownerFile);
      }
      if(scenario==='file-replaced'){
        fs.renameSync(file,path.join(directory,'prior-data.json'));fs.writeFileSync(file,configuration);
      }
      if(scenario==='manifest-changed')fs.writeFileSync(path.join(directory,'manifest.json'),JSON.stringify({id:'auto-oc',version:'99.0.0'}));
      if(scenario==='cancel')await p.onunload();
    })();
    await rejected;await mutation;
    assert.equal(p.ready,false);assert.equal(effects,0);assert.equal(requests,0);
    assert.equal(fs.existsSync(path.join(directory,'autooc-cli.cjs')),false);
    assert.deepEqual(fs.readFileSync(path.join(directory,'main.js')),files['main.js']);
    if(owner)assert.deepEqual(fs.readFileSync(path.join(runtime,'execution.lock/owner.json')),owner);
    if(['corrupt','invalid-catalog','journal','live-owner','owner-changed','cancel'].includes(scenario))assert.ok(fs.existsSync(path.join(runtime,'execution.lock')));
    if(scenario==='corrupt')assert.equal(fs.readFileSync(file,'utf8'),'');
  });
}

test('catalog change during bootstrap is preserved and rejected before installation, then safe retry loads it',async t=>{
  timers(t);const {create,directory,runtime}=fixture(t),p=create(),file=path.join(directory,'data.json');
  const files=Object.fromEntries(names.map(n=>[n,fs.readFileSync(path.join(directory,n))]));
  for(const name of names.slice(3))fs.unlinkSync(path.join(directory,name));
  const final=JSON.stringify({tasks:[],workflows:[],custom:'external edit'});let changed=false;
  const prior=global.fetch;global.fetch=async url=>{
    if(!changed){changed=true;fs.writeFileSync(file,final);}
    const name=names.find(n=>url.includes('/'+n+'?'));return {ok:true,arrayBuffer:async()=>files[name]};
  };t.after(()=>{global.fetch=prior;});
  await assert.rejects(p.onload(),/Configuration changed after startup validation/);
  assert.equal(p.ready,false);assert.equal(fs.readFileSync(file,'utf8'),final);
  assert.equal(fs.existsSync(path.join(directory,'autooc-cli.cjs')),false);
  assert.equal(fs.existsSync(path.join(runtime,'execution.lock')),false);
  const next=create();next.loadSettings=async()=>{next.settings=next.settingsWriter.load(file);};
  await next.onload();assert.equal(next.ready,true);assert.equal(next.settings.custom,'external edit');await next.onunload();
});

for(const mismatch of ['version','id']) {
  test(`cached legacy metadata cannot override a mismatched physical manifest ${mismatch}`,async t=>{
    timers(t);const {create,directory,runtime}=fixture(t),p=create();
    p.manifest.version='1.6.0';
    const file=path.join(directory,'manifest.json'),physical=JSON.parse(fs.readFileSync(file));
    physical[mismatch]=mismatch==='version'?'99.0.0':'another-plugin';
    fs.writeFileSync(file,JSON.stringify(physical));const before=fs.readFileSync(file);
    let requests=0;const prior=global.fetch;global.fetch=async()=>{requests++;throw Error('unexpected network');};t.after(()=>{global.fetch=prior;});
    await assert.rejects(p.onload(),/manifest.*(identity|version)/i);
    assert.equal(requests,0);assert.equal(p.ready,false);assert.equal(p.manifest.version,'1.6.0');
    assert.deepEqual(fs.readFileSync(file),before);assert.equal(fs.existsSync(path.join(runtime,'execution.lock')),false);
  });
}

for(const scenario of ['live','ready','in_flight','evaluation','legacy','corrupt','binding','marker','write-lock']) {
  test(`automatic owner recovery preserves evidence and blocks ${scenario}`,t=>{
    const {create,runtime,directory}=fixture(t);
    if(scenario==='live')create().reservePluginExecution();
    else {
      const child=spawnSync(process.execPath,['-e',`require(${JSON.stringify(path.join(root,'autooc-runtime.cjs'))}).acquireExecutionLease(process.argv[1])`,runtime],{encoding:'utf8'});
      assert.equal(child.status,0,child.stderr);
    }
    const state={schemaVersion:1,runId:'proof',workflowId:'w',definitionHash:'a'.repeat(64),revision:1,phase:'completed',nextStepId:null,steps:[]};
    if(scenario==='ready')Object.assign(state,{phase:'ready',nextStepId:'s'});
    if(scenario==='in_flight')Object.assign(state,{phase:'in_flight',nextStepId:'s',steps:[{stepId:'s',status:'in_flight'}]});
    if(scenario==='evaluation')state.steps=[{stepId:'s',status:'completed',output:'observed',result:{succeeded:true,output:'observed'},evaluations:[{key:'e',status:'in_flight'}]}];
    fs.writeFileSync(path.join(runtime,'proof.json'),scenario==='corrupt'?'invalid':JSON.stringify(state));
    if(scenario==='legacy')fs.writeFileSync(path.join(directory,'data.json'),JSON.stringify({tasks:[{id:'t',status:'failed',legacyExecution:{token:'old',stopState:'unconfirmed'}}]}));
    if(scenario==='binding')fs.writeFileSync(path.join(directory,'data.json'),JSON.stringify({workflows:[{id:'w',status:'completed',runtimeExecution:{runId:'missing'}}]}));
    if(scenario==='marker')fs.writeFileSync(path.join(runtime,'update-pending.json'),'{}');
    if(scenario==='write-lock')fs.writeFileSync(path.join(directory,'data.json.write-lock'),'uncertain');
    const owner=fs.readFileSync(path.join(runtime,'execution.lock/owner.json'));
    const journal=fs.readFileSync(path.join(runtime,'proof.json'));
    assert.throws(()=>create().reservePluginExecution());
    assert.deepEqual(fs.readFileSync(path.join(runtime,'execution.lock/owner.json')),owner);
    assert.deepEqual(fs.readFileSync(path.join(runtime,'proof.json')),journal);
  });
}

for(const failure of ['loadSettings','close']) {
  test(`lifecycle ${failure} failure preserves original error and does not retain an idle owner`,async t=>{
    timers(t);const {create,runtime}=fixture(t),p=create();
    if(failure==='loadSettings'){
      p.loadSettings=async()=>{throw Error('original load failure');};
      await assert.rejects(p.onload(),/original load failure/);
    }else{
      p.reservePluginExecution();p.stopMcpBridge=async()=>{throw Error('close failure');};
      await assert.rejects(p.onunload(),/close failure/);
    }
    assert.equal(fs.existsSync(path.join(runtime,'execution.lock')),false);
  });
}

test('stale startup callbacks and repeated unload cannot launch effects or detach successor views',async t=>{
  const callbacks=timers(t);const {create}=fixture(t),p=create();let effects=0,detaches=0;
  p.app.workspace.onLayoutReady=fn=>callbacks.push(fn);p.app.workspace.detachLeavesOfType=()=>detaches++;
  p.refreshModels=p.refreshAgents=p.refreshCodexModels=p.checkForUpdates=p.runDueAll=()=>{effects++;};
  await p.onload();await p.onunload();const next=create();next.reservePluginExecution();
  for(const callback of [...callbacks])callback();
  await p.onunload();assert.equal(effects,0);assert.equal(detaches,1);next.releasePluginExecution(false);
});

test('queued settings write retains ownership until its result is known',async t=>{
  timers(t);const {create,runtime}=fixture(t),p=create();p.reservePluginExecution();
  const writing=p.saveSettings();
  assert.equal(p.settingsWriter.hasPendingWrites,true);
  await p.onunload();assert.ok(fs.existsSync(path.join(runtime,'execution.lock')));
  assert.throws(()=>create().reservePluginExecution(),/live or cannot/);
  await writing;assert.equal(p.settingsWriter.hasPendingWrites,false);
  p.releasePluginExecution(false);
});

test('hardlinked bundle cannot trigger bootstrap writes outside the installation',async t=>{
  timers(t);const {create,directory,vault}=fixture(t),p=create(),external=path.join(vault,'external-main.js');
  const bytes=fs.readFileSync(path.join(directory,'main.js'));
  fs.linkSync(path.join(directory,'main.js'),external);
  await assert.rejects(p.onload(),/Unsafe installed plugin bundle/);
  assert.deepEqual(fs.readFileSync(external),bytes);
});

for(const failure of ['404','timeout','descriptor','version','hash','revision','manifest-revision','write','rollback']) {
  test(`bootstrap ${failure} fails closed and preserves the prior three-file installation`,async t=>{
    timers(t);const {create,directory,runtime}=fixture(t),p=create();
    p.manifest.version='1.6.0';
    const files=Object.fromEntries(names.map(n=>[n,fs.readFileSync(path.join(directory,n))]));
    const before=Object.fromEntries(names.slice(0,3).map(n=>[n,files[n]]));
    for(const name of names.slice(3))fs.unlinkSync(path.join(directory,name));
    if(failure==='descriptor')files['release-integrity.json']=Buffer.from('{}');
    if(failure==='version'){const descriptor=JSON.parse(files['release-integrity.json']);descriptor.version='99.0.0';files['release-integrity.json']=Buffer.from(JSON.stringify(descriptor));}
    if(failure==='hash'||failure==='revision'){
      files['main.js']=Buffer.from('another bundle');
      if(failure==='revision'){const descriptor=JSON.parse(files['release-integrity.json']);descriptor.sha256['main.js']=require('crypto').createHash('sha256').update(files['main.js']).digest('hex');files['release-integrity.json']=Buffer.from(JSON.stringify(descriptor));}
    }
    if(failure==='manifest-revision'){
      const manifest=JSON.parse(files['manifest.json']);manifest.description='different revision';
      files['manifest.json']=Buffer.from(JSON.stringify(manifest));
      const descriptor=JSON.parse(files['release-integrity.json']);
      descriptor.sha256['manifest.json']=require('crypto').createHash('sha256').update(files['manifest.json']).digest('hex');
      files['release-integrity.json']=Buffer.from(JSON.stringify(descriptor));
    }
    const prior=global.fetch,write=fs.writeFileSync;let writesFailed=false,rollbackFailed=false;
    // Match physical files: installRelease uses the canonical long path even
    // when TEMP and the fixture directory were supplied through an 8.3 alias.
    const physicalDirectory=fs.realpathSync.native(directory);
    const isInstalledFile=(file,name)=>typeof file==='string' &&
      path.basename(file)===name && fs.realpathSync.native(path.dirname(file))===physicalDirectory;
    global.fetch=async(url,options)=>{
      assert.ok(options.signal,'downloads have a timeout signal');
      if(failure==='timeout')throw Error('fixture timeout');
      const name=names.find(n=>url.includes('/'+n+'?'));return {ok:failure!=='404',status:404,arrayBuffer:async()=>files[name]};
    };
    fs.writeFileSync=function(file,...args){
      if(['write','rollback'].includes(failure)&&isInstalledFile(file,'styles.css')&&!writesFailed){writesFailed=true;throw Error('injected install write');}
      if(failure==='rollback'&&writesFailed&&isInstalledFile(file,'main.js')){rollbackFailed=true;throw Error('injected rollback');}
      return write.call(this,file,...args);
    };
    try{
      const expected=failure==='write'?/injected install write/:failure==='rollback'?/injected rollback/:
        failure==='revision'?/Bootstrap revision differs/:failure==='manifest-revision'?/Bootstrap manifest differs/:undefined;
      await assert.rejects(p.onload(),expected);assert.equal(p.ready,false);assert.equal(p.manifest.version,'1.6.0');
    }finally{global.fetch=prior;fs.writeFileSync=write;}
    assert.equal(writesFailed,['write','rollback'].includes(failure));
    assert.equal(rollbackFailed,failure==='rollback');
    assert.equal(fs.existsSync(path.join(runtime,'update-pending.json')),failure==='rollback');
    if(failure!=='rollback'){
      for(const name of names.slice(0,3))assert.deepEqual(fs.readFileSync(path.join(directory,name)),before[name]);
      assert.equal(fs.existsSync(path.join(runtime,'execution.lock')),false);
    }else assert.ok(fs.existsSync(path.join(runtime,'execution.lock')));
  });
}
