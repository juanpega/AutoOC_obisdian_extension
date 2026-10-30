const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),Module=require('node:module'),cp=require('node:child_process');
function plugin(file){const load=Module._load;try{Module._load=function(name,...args){if(name==='obsidian')return {Plugin:class{},Notice:class{},Modal:class{},Setting:class{},ItemView:class{},PluginSettingTab:class{},WorkspaceLeaf:class{}};return load.call(this,name,...args);};delete require.cache[require.resolve(file)];return require(file).default;}finally{Module._load=load;}}
if(process.argv[2]==='writer'){
 (async()=>{
  const [vault,phase]=process.argv.slice(3),directory=path.join(vault,'.obsidian/plugins/auto-oc'),file=path.join(directory,'data.json');
  const Plugin=plugin(path.join(directory,'main.js')),p=new Plugin();p.manifest=JSON.parse(fs.readFileSync(path.join(directory,'manifest.json')));p.app={vault:{adapter:{basePath:vault},configDir:'.obsidian'}};
  p.reservePluginExecution();await p.settingsWriter.loadAsync(file);
  const open=fs.promises.open,rename=fs.promises.rename;
  const freeze=async()=>{process.send({phase,primaryHash:require('crypto').createHash('sha256').update(fs.readFileSync(file)).digest('hex')});await new Promise(()=>{setInterval(()=>{},1000);});};
  fs.promises.open=async function(target,...args){const h=await open.call(this,target,...args);if(phase==='partial'&&String(target).startsWith(file+'.'+process.pid+'.')&&String(target).endsWith('.tmp')){const write=h.writeFile.bind(h);h.writeFile=async(...args)=>{await write(...args);await freeze();};}return h;};
  fs.promises.rename=async function(from,to){const r=await rename.call(this,from,to);if(phase==='committed'&&to===file&&String(from).startsWith(file+'.'+process.pid+'.'))await freeze();return r;};
  await p.settingsWriter.save(file,()=>({tasks:[],workflows:[],custom:'new synthetic snapshot',padding:'😀é inert '.repeat(300000)}));
 })().catch(e=>{process.send?.({error:e.stack});process.exit(1);});
}else{
 const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
 const root=process.env.AUTOOC_TEST_PACKAGE?path.resolve(process.env.AUTOOC_TEST_PACKAGE):path.resolve(__dirname,'..'),names=['main.js','manifest.json','styles.css','autooc-cli.cjs','autooc-runtime.cjs','skills/autooc-runtime/SKILL.md','release-integrity.json'];
 function fixture(t){const vault=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-crash-')),directory=path.join(vault,'.obsidian/plugins/auto-oc'),runtime=path.join(directory,'runtime');fs.mkdirSync(runtime,{recursive:true});for(const n of names){fs.mkdirSync(path.dirname(path.join(directory,n)),{recursive:true});fs.copyFileSync(path.join(root,n),path.join(directory,n));}fs.writeFileSync(path.join(directory,'data.json'),'{"tasks":[],"workflows":[],"custom":"keep saved catalogue 😀"}');const journal={schemaVersion:1,runId:'history',workflowId:'historical',definitionHash:'a'.repeat(64),revision:3,phase:'completed',nextStepId:null,steps:[{stepId:'one',status:'completed',output:'historical evidence'}]};fs.writeFileSync(path.join(runtime,'history.json'),JSON.stringify(journal));t.after(()=>{assert.equal(path.dirname(fs.realpathSync(vault)),fs.realpathSync(os.tmpdir()));assert(path.basename(vault).startsWith('autooc-crash-'));fs.rmSync(vault,{recursive:true,force:true,maxRetries:10,retryDelay:50});});return {vault,directory,runtime,file:path.join(directory,'data.json')};}
 function host(t,f){const old=global.window,events=new Map();global.window={setInterval:()=>1,clearInterval(){},addEventListener:(n,fn)=>events.set(n,fn),removeEventListener:(n,fn)=>{if(events.get(n)===fn)events.delete(n);}};t.after(()=>global.window=old);const Plugin=plugin(path.join(f.directory,'main.js')),p=new Plugin();p.manifest=JSON.parse(fs.readFileSync(path.join(f.directory,'manifest.json')));p.app={vault:{adapter:{basePath:f.vault},configDir:'.obsidian'},workspace:{detachLeavesOfType(){},onLayoutReady(){}}};p.registerView=()=>{};p.addRibbonIcon=()=>{};p.addCommand=()=>{};p.addSettingTab=()=>{};p.registerInterval=()=>{};p.register=()=>{};p.refreshModels=()=>{};p.refreshAgents=()=>{};p.refreshCodexModels=async()=>{};p.checkForUpdates=async()=>{};return {p,events};}
 async function crash(t,f,phase,keepAlive=false){const child=cp.fork(__filename,['writer',f.vault,phase],{stdio:['ignore','ignore','pipe','ipc'],windowsHide:true});let errors='';child.stderr.on('data',b=>errors+=b);t.after(()=>{if(child.exitCode===null&&!child.killed)child.kill();});const info=await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Child never reached crash injection: '+errors)),20000);child.once('message',m=>{clearTimeout(timeout);m.error?reject(Error(m.error)):resolve(m);});child.once('exit',code=>{clearTimeout(timeout);reject(Error('Child exited before injection '+code+': '+errors));});});if(keepAlive)return {...info,child};child.kill();await new Promise(r=>child.once('exit',r));return info;}
 for(const phase of ['partial','committed'])test('real killed settings writer reopens safely after '+phase+' write without replay',{timeout:30000},async t=>{
  const f=fixture(t),original=fs.readFileSync(f.file),journal=fs.readFileSync(path.join(f.runtime,'history.json')),info=await crash(t,f,phase),before=fs.readFileSync(f.file);
  if(phase==='partial')assert(before.equals(original));else assert.notDeepEqual(before,original);
  assert.equal(crypto.createHash('sha256').update(before).digest('hex'),info.primaryHash);
  const {p}=host(t,f),load=p.loadSettings.bind(p);let observedPrimary=false;
  p.loadSettings=async()=>{assert(fs.readFileSync(f.file).equals(before),'recovery must preserve exact primary bytes before ordinary settings migration');observedPrimary=true;await load();};
  try{await p.onload();assert.equal(p.ready,true,'a proven interrupted settings save must not strand startup in recovery');assert(observedPrimary);const saved=JSON.parse(fs.readFileSync(f.file)),prior=JSON.parse(before);for(const key of Object.keys(prior))assert.deepEqual(saved[key],prior[key],'normal settings defaults must preserve every saved field');assert(fs.readFileSync(path.join(f.runtime,'history.json')).equals(journal));assert.equal(fs.existsSync(f.file+'.write-lock'),false);const archives=fs.readdirSync(f.runtime).filter(n=>n.startsWith('settings-write-recovery-'));assert.equal(archives.length,1);const archived=path.join(f.runtime,archives[0]);assert(fs.existsSync(path.join(archived,'data.json.write-intent')));if(phase==='partial')assert(fs.readdirSync(archived).some(n=>/^data\.json\.\d+\..+\.tmp$/.test(n)));}
  finally{await p.onunload();}
  const second=host(t,f).p;try{await second.onload();assert.equal(second.ready,true);assert.equal(fs.readdirSync(f.runtime).filter(n=>n.startsWith('settings-write-recovery-')).length,1,'subsequent startup must not repeat recovery');assert(fs.readFileSync(path.join(f.runtime,'history.json')).equals(journal));}finally{await second.onunload();}
 });
 test('beforeunload cancels window destruction while its settings write is still pending',{timeout:15000},async t=>{
  const f=fixture(t),{p,events}=host(t,f);await p.onload();let finish,entered;const pending=new Promise(r=>finish=r),started=new Promise(r=>entered=r),original=p.settingsWriter.save.bind(p.settingsWriter);p.settingsWriter.save=(...args)=>original(args[0],()=>{entered();return args[1]();},...args.slice(2));
  const write=fs.promises.open;t.mock.method(fs.promises,'open',async function(target,...args){const h=await write.call(this,target,...args);if(String(target).startsWith(f.file+'.'+process.pid+'.')){const saving=h.writeFile.bind(h);h.writeFile=async(...args)=>{await pending;return saving(...args);};}return h;});
  const saving=p.saveSettings(false);await started;const event={prevented:false,preventDefault(){this.prevented=true;},returnValue:undefined};
  try{events.get('beforeunload')(event);assert.equal(event.prevented,true,'Electron must be stopped synchronously before it destroys the writer');assert.equal(event.returnValue,false);assert.equal(p.isLifecycleStopped(),false,'cancelled close keeps the live instance usable');const drain=p.windowCloseDrain;events.get('beforeunload')({preventDefault(){},returnValue:undefined});assert.equal(p.windowCloseDrain,drain,'repeated close attempts must share one drain');finish();await saving;await drain;const retry={prevented:false,preventDefault(){this.prevented=true;},returnValue:undefined};events.get('beforeunload')(retry);assert.equal(retry.prevented,false);assert.equal(p.isLifecycleStopped(),true);assert.equal(fs.existsSync(path.join(f.runtime,'execution.lock')),false);}
  finally{finish();await saving;await p.settingsWriter.drain();await p.onunload();}
 });
 function snapshot(directory){const out={};for(const item of fs.readdirSync(directory,{withFileTypes:true})){const file=path.join(directory,item.name);if(item.isDirectory()){for(const [k,v]of Object.entries(snapshot(file)))out[item.name+'/'+k]=v;}else out[item.name]=crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');}return out;}
 for(const mutation of ['live-writer','unverifiable-pid','reused-pid','changed-primary','invalid-primary','changed-token','changed-proof','wrong-directory','unproven-legacy','unknown-temporary','uncertain-journal','pending-update','hardlinked-intent'])test('automatic settings recovery preserves blocked evidence: '+mutation,{timeout:30000},async t=>{
  const f=fixture(t),paused=await crash(t,f,'partial',mutation==='live-writer'),intentFile=f.file+'.write-intent',ownerFile=path.join(f.runtime,'execution.lock/owner.json');
  const changeIntent=(change,reanchor=false)=>{const d=JSON.parse(fs.readFileSync(intentFile));change(d);fs.writeFileSync(intentFile,JSON.stringify(d));if(reanchor){const o=JSON.parse(fs.readFileSync(ownerFile));o.settingsWriteIntent.sha256=crypto.createHash('sha256').update(fs.readFileSync(intentFile)).digest('hex');fs.writeFileSync(ownerFile,JSON.stringify(o));}};
  if(mutation==='unverifiable-pid')t.mock.method(process,'kill',()=>{const e=Error('unverifiable');e.code='EPERM';throw e;});
  if(mutation==='reused-pid'){const o=JSON.parse(fs.readFileSync(ownerFile));o.pid=process.pid;fs.writeFileSync(ownerFile,JSON.stringify(o));changeIntent(d=>d.owner.pid=process.pid,true);}
  if(mutation==='changed-primary')fs.appendFileSync(f.file,' ');
  if(mutation==='invalid-primary'){fs.writeFileSync(f.file,'invalid JSON');changeIntent(d=>d.originalHash=crypto.createHash('sha256').update('invalid JSON').digest('hex'),true);}
  if(mutation==='changed-token')fs.writeFileSync(f.file+'.write-lock',crypto.randomUUID());
  if(mutation==='changed-proof')changeIntent(d=>d.originalHash='f'.repeat(64));
  if(mutation==='wrong-directory')changeIntent(d=>d.directoryIdentity='other directory',true);
  if(mutation==='unproven-legacy')fs.unlinkSync(intentFile);
  if(mutation==='unknown-temporary')fs.writeFileSync(f.file+'.123.1.unknown.tmp','unidentified');
  if(mutation==='uncertain-journal'){const d=JSON.parse(fs.readFileSync(path.join(f.runtime,'history.json')));d.phase='in_flight';d.nextStepId='one';d.steps=[{stepId:'one',status:'in_flight'}];fs.writeFileSync(path.join(f.runtime,'history.json'),JSON.stringify(d));}
  if(mutation==='pending-update')fs.writeFileSync(path.join(f.runtime,'update-pending.json'),'{}');
  if(mutation==='hardlinked-intent')fs.linkSync(intentFile,intentFile+'.hardlink');
  const before=snapshot(f.directory),{p}=host(t,f);
  try{await p.onload();assert.equal(p.ready,false);assert.deepEqual(snapshot(f.directory),before,'a rejected proof must not mutate catalogs, journals, owners or evidence');assert.equal(fs.existsSync(path.join(f.runtime,'lease-recovery.lock')),false);}
  finally{await p.onunload();if(paused.child){paused.child.kill();await new Promise(r=>paused.child.once('exit',r));}}
 });
 test('two simultaneous startups do not both recover or acquire the same installation',{timeout:30000},async t=>{
  const f=fixture(t);await crash(t,f,'partial');const first=host(t,f).p,second=host(t,f).p;
  try{await Promise.all([first.onload(),second.onload()]);assert.equal([first,second].filter(p=>p.ready).length,1);assert.equal(fs.readdirSync(f.runtime).filter(n=>n.startsWith('settings-write-recovery-')).length,1);}
  finally{await first.onunload();await second.onunload();}
 });
 test('archival I/O failure keeps evidence and does not auto retry a partial recovery',{timeout:30000},async t=>{
  const f=fixture(t);await crash(t,f,'partial');const original=fs.readFileSync(f.file),rename=fs.promises.rename;
  t.mock.method(fs.promises,'rename',async(from,to)=>{if(String(to).includes('settings-write-recovery-')){const e=Error('injected archival denial');e.code='EPERM';throw e;}return rename.call(fs.promises,from,to);});
  const first=host(t,f).p;await first.onload();assert.equal(first.ready,false);await first.onunload();assert(fs.readFileSync(f.file).equals(original));assert(fs.existsSync(f.file+'.write-intent'));
  const archives=fs.readdirSync(f.runtime).filter(n=>n.startsWith('settings-write-recovery-'));assert.equal(archives.length,1);assert(fs.existsSync(path.join(f.runtime,archives[0],'failure.json')));
  t.mock.restoreAll();const second=host(t,f).p;try{await second.onload();assert.equal(second.ready,false);assert.equal(fs.readdirSync(f.runtime).filter(n=>n.startsWith('settings-write-recovery-')).length,1);assert(fs.readFileSync(f.file).equals(original));}finally{await second.onunload();}
 });
}
