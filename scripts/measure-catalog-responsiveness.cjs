// Synthetic-only diagnostic. Never discovers or reads the installed catalog.
// Usage: node scripts/measure-catalog-responsiveness.cjs BUNDLE OUTPUT ITERATIONS
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),Module=require('node:module');
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const {performance,PerformanceObserver}=require('node:perf_hooks');
const [bundle,output,count='5']=process.argv.slice(2),iterations=Number(count);
assert.ok(bundle&&output&&Number.isInteger(iterations)&&iterations>=1&&iterations<=10);
const vault=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-catalog-latency-'));
const directory=path.join(vault,'.obsidian/plugins/auto-oc');fs.mkdirSync(directory,{recursive:true});
const artifacts=['main.js','manifest.json','styles.css','autooc-cli.cjs','autooc-runtime.cjs','skills/autooc-runtime/SKILL.md','release-integrity.json'];
const sourceDirectory=path.dirname(path.resolve(bundle));
const startupAvailable=artifacts.every(name=>fs.existsSync(path.join(sourceDirectory,name)));
if(startupAvailable)for(const name of artifacts){const dest=path.join(directory,name);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(sourceDirectory,name),dest);}
const schedule={scheduleType:'manual',scheduleTime:'',scheduleDate:'',scheduleDays:[],scheduleMonthDays:[],scheduleIntervalValue:10,scheduleIntervalUnit:'minutes'};
const config={defaultModel:'fixture',defaultAiEngine:'codex',taskTimeoutSeconds:7200,libraryUrl:'https://example.invalid/catalog',dashboardPositions:{},tasks:[],workflows:[]};
for(let i=0;i<35;i++)config.tasks.push({id:'task-'+i,name:'Synthetic task '+i,taskKind:'code',code:'output="synthetic";',status:'pending',...schedule});
const padding='/* synthetic inert code padding; no user content */\n'.repeat(42000);
for(let i=0;i<42;i++)config.workflows.push({id:'workflow-'+i,name:'Synthetic workflow '+i,status:'pending',handoffOutput:true,steps:[{id:'step-'+i,stepKind:'code',code:padding,position:{x:40,y:60},transitions:[]}],...schedule});
const catalog=path.join(directory,'data.json');fs.writeFileSync(catalog,JSON.stringify(config,null,2));
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const report={at:new Date().toISOString(),node:process.version,platform:process.platform,bundleSha256:sha(bundle),initialHash:sha(catalog),catalogBytes:fs.statSync(catalog).size,iterations,measurements:[],scope:'Background sandbox; real plugin methods with mocked Obsidian; synthetic catalog; no GUI or native coordinator claim'};
const profile=process.env.AUTOOC_PROFILE==='1';
let phase;
const gc=[];
const observer=new PerformanceObserver(list=>{for(const entry of list.getEntries())gc.push({startTime:entry.startTime,durationMs:entry.duration,kind:entry.detail?.kind});});
observer.observe({entryTypes:['gc']});
if(profile){
  report.slowSynchronousCalls=[];
  for(const [object,key]of [[JSON,'parse'],[JSON,'stringify'],[fs,'readFileSync'],[Array.prototype,'join']]){
    const original=object[key];object[key]=function(...args){const started=performance.now();try{return original.apply(this,args);}finally{const elapsedMs=performance.now()-started;if(phase&&elapsedMs>10)report.slowSynchronousCalls.push({phase,method:key,elapsedMs,stack:new Error().stack.split('\n').slice(2,5)});}};
  }
}
let Plugin;const original=Module._load;
try{Module._load=function(name,...args){if(name==='obsidian')return Object.fromEntries(['Plugin','Notice','Modal','Setting','ItemView','PluginSettingTab','WorkspaceLeaf'].map(k=>[k,class{}]));return original.call(this,name,...args);};Plugin=require(path.resolve(bundle)).default;}finally{Module._load=original;}
const plugin=new Plugin();plugin.manifest={id:'auto-oc'};
plugin.app={vault:{adapter:{basePath:vault},configDir:'.obsidian'},workspace:{getLeavesOfType:()=>[]}};
plugin.createVaultMutationBatch=()=>({record(){},async flush(){}});
async function measure(name,operation){
  const gaps=[];let previous=performance.now();
  const timer=setInterval(()=>{const now=performance.now();gaps.push(now-previous);previous=now;},5);
  try{
    await new Promise(r=>setTimeout(r,25));
    const started=performance.now(),memoryBefore=process.memoryUsage();
    phase=name;
    try{await operation();}finally{phase=undefined;}
    const elapsedMs=performance.now()-started;
    await new Promise(r=>setTimeout(r,25));
    report.measurements.push({name,startedAtMonotonicMs:started,elapsedMs,maxHeartbeatGapMs:Math.max(...gaps),heartbeatSamples:gaps.length,heartbeatGapsMs:gaps,memoryBefore,memoryAfter:process.memoryUsage()});
    fs.writeFileSync(output,JSON.stringify(report,null,2));
    console.log(JSON.stringify({name,elapsedMs,maxHeartbeatGapMs:Math.max(...gaps)}));
  }finally{clearInterval(timer);}
}
(async()=>{
  plugin.reservePluginExecution();
  for(let i=0;i<iterations;i++){
    if(startupAvailable)await measure('startup-validation-'+i,async()=>{const guard=await plugin.completeInstalledRelease();await guard();});
    await measure('load-'+i,()=>plugin.loadSettings());
    await measure('save-'+i,()=>plugin.saveSettings(false));
    const saved=JSON.parse(fs.readFileSync(catalog,'utf8'));
    for(const [key,value]of Object.entries(config))assert.deepEqual(saved[key],value,'Original field preserved: '+key);
  }
  for(let i=0;i<iterations;i++){
    await measure('transition-'+i,()=>plugin.runSharedWorkflow('workflow-0',undefined,false,i>0));
    const saved=JSON.parse(fs.readFileSync(catalog,'utf8'));
    assert.equal(saved.workflows[0].status,'completed');
    for(let j=0;j<42;j++)assert.equal(saved.workflows[j].steps[0].code,config.workflows[j].steps[0].code);
    assert.deepEqual(saved.tasks,config.tasks);
  }
  await plugin.settingsWriter.drain();plugin.releasePluginExecution(false);
  report.dataPreserved=true;report.maxRssKiB=process.resourceUsage().maxRSS;report.status='completed';
  report.heartbeatBudgetMs=100;
  report.heartbeatBudgetMet=report.measurements.every(item=>item.maxHeartbeatGapMs<=100);
})().catch(error=>{report.status='failed';report.error=String(error);console.error(error);process.exitCode=1;}).finally(()=>{
  observer.disconnect();report.gcEvents=gc;
  fs.writeFileSync(output,JSON.stringify(report,null,2));
  // The diagnostic owns this synthetic temporary directory exclusively.
  assert.equal(path.dirname(fs.realpathSync(vault)),fs.realpathSync(os.tmpdir()));
  assert.ok(path.basename(vault).startsWith('autooc-catalog-latency-'));
  fs.rmSync(vault,{recursive:true,force:true});
});
