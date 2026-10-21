// Synthetic bound history, distinct from the original 93 MB matrix. Run each
// variant sequentially in a fresh process, retaining every sample and all GC.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),Module=require('node:module');
const crypto=require('node:crypto'),assert=require('node:assert/strict');
const {performance,PerformanceObserver}=require('node:perf_hooks');
const [bundle,output,iterationsText='5']=process.argv.slice(2),iterations=Number(iterationsText);
assert.ok(bundle&&output&&Number.isInteger(iterations)&&iterations>0);
const source=path.dirname(path.resolve(bundle)),vault=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-history-latency-'));
const directory=path.join(vault,'.obsidian/plugins/auto-oc'),runtime=path.join(directory,'runtime');
fs.mkdirSync(runtime,{recursive:true});
for(const name of ['main.js','manifest.json','styles.css','autooc-cli.cjs','autooc-runtime.cjs','skills/autooc-runtime/SKILL.md','release-integrity.json']){
  const dest=path.join(directory,name);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(source,name),dest);
}
const {prepareWorkflowDefinition}=require(path.join(source,'autooc-runtime.cjs'));
const padding=('synthetic code \\\n😀;').repeat(180000);
const config={tasks:[{id:'synthetic-task',taskKind:'code',code:padding,status:'completed',output:'old task result'}],workflows:[],defaultModel:'fixture',defaultAiEngine:'codex'};
for(let i=0;i<8;i++){
  const wf={id:'synthetic-'+i,name:'Synthetic history '+i,steps:[{id:'s',stepKind:'task',taskId:'synthetic-task',description:padding}],status:'completed'};
  const definitionHash=prepareWorkflowDefinition(wf,config.tasks,config).hash,runId='synthetic-run-'+i;
  const checkpoint={schemaVersion:1,runId,workflowId:wf.id,definitionHash,revision:2,phase:'completed',nextStepId:null,steps:[{stepId:'s',status:'completed',output:('synthetic result '+i+' \\\n😀').repeat(40000)}]};
  wf.runtimeExecution={runId,workflowId:wf.id,definitionHash,revision:2,phase:'completed'};
  config.workflows.push(wf);fs.writeFileSync(path.join(runtime,runId+'.json'),JSON.stringify(checkpoint));
}
const catalog=path.join(directory,'data.json');fs.writeFileSync(catalog,JSON.stringify(config));
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const journalHashes=()=>Object.fromEntries(fs.readdirSync(runtime).filter(n=>/^synthetic-run-\d+\.json$/.test(n)).sort().map(n=>[n,sha(path.join(runtime,n))]));
const report={at:new Date().toISOString(),node:process.version,platform:process.platform,bundleSha256:sha(bundle),catalogBytes:fs.statSync(catalog).size,catalogHash:sha(catalog),journalHashes:journalHashes(),iterations,measurements:[],gcEvents:[],scope:'Background Node synthetic bound terminal histories; real full onload/load/save, mocked Obsidian and no providers/effects; distinct fixture from original 93MB matrix. Not GUI/native coordinator.'};
const observer=new PerformanceObserver(list=>{for(const entry of list.getEntries())report.gcEvents.push({startTime:entry.startTime,durationMs:entry.duration,kind:entry.detail?.kind});});
observer.observe({entryTypes:['gc']});
let diagnosticPhase;
// Diagnostic-only optional wrappers. Their output is never a normal benchmark.
if(process.env.AUTOOC_PROFILE==='1'){
  report.scope+=' Diagnostic wrappers enabled: not an acceptance measurement.';report.slowCalls=[];
  for(const [object,key]of [[JSON,'parse'],[JSON,'stringify'],[fs,'readFileSync'],[fs,'fsyncSync'],[fs,'lstatSync'],[fs,'statSync'],[fs.realpathSync,'native'],[fs,'realpathSync'],[fs,'readdirSync'],[Array.prototype,'join'],[Buffer.prototype,'toString'],[crypto.Hash.prototype,'update']]){
    const original=object[key];const wrapped=function(...args){const start=performance.now();try{return original.apply(this,args);}finally{
      const elapsedMs=performance.now()-start;if(elapsedMs>10)report.slowCalls.push({method:key,elapsedMs,phase:diagnosticPhase,stack:new Error().stack.split('\n').slice(2,7)});
    }};
    Object.assign(wrapped,original);object[key]=wrapped;
  }
}
const original=Module._load;let Plugin;
try{
  Module._load=function(name,...args){if(name==='obsidian')return Object.fromEntries(['Plugin','Notice','Modal','Setting','ItemView','PluginSettingTab','WorkspaceLeaf'].map(k=>[k,class{}]));return original.call(this,name,...args);};
  Plugin=require(path.resolve(bundle)).default;
}finally{Module._load=original;}
const oldWindow=global.window;global.window={setInterval:()=>1,clearInterval(){}};
function create(){
  const p=new Plugin();p.manifest=JSON.parse(fs.readFileSync(path.join(directory,'manifest.json')));
  p.app={vault:{adapter:{basePath:vault},configDir:'.obsidian'},workspace:{getLeavesOfType:()=>[],detachLeavesOfType(){},onLayoutReady(){}}};
  for(const name of ['registerView','addRibbonIcon','addCommand','addSettingTab','registerInterval','register','refreshModels','refreshAgents','lifecycleTimeout'])p[name]=()=>{};
  p.refreshCodexModels=async()=>{};p.checkForUpdates=async()=>{};p.runDueAll=async()=>{throw Error('No effects allowed in measurement');};
  if(process.env.AUTOOC_PROFILE==='1')for(const name of ['reservePluginExecution','completeInstalledRelease','loadSettings','journalSnapshotAsync','recordObservationProof','startCliRequests']){
    const original=p[name];if(!original)continue;
    p[name]=function(...args){const previous=diagnosticPhase;diagnosticPhase=name;const value=original.apply(this,args);if(value?.finally)return value.finally(()=>diagnosticPhase=previous);diagnosticPhase=previous;return value;};
  }
  return p;
}
async function measure(name,operation){
  const gaps=[];let previous=performance.now();const timer=setInterval(()=>{const now=performance.now();gaps.push(now-previous);if(process.env.AUTOOC_PROFILE==='1'&&now-previous>30)(report.slowGaps||=[]).push({at:now,gapMs:now-previous,phase:diagnosticPhase});previous=now;},5);
  try{
    await new Promise(r=>setTimeout(r,25));const start=performance.now(),memoryBefore=process.memoryUsage();
    await operation();const elapsedMs=performance.now()-start;
    await new Promise(r=>setTimeout(r,25));
    const measurement={name,elapsedMs,startedAtMonotonicMs:start,maxHeartbeatGapMs:Math.max(...gaps),heartbeatGapsMs:gaps,memoryBefore,memoryAfter:process.memoryUsage()};
    report.measurements.push(measurement);fs.writeFileSync(output,JSON.stringify(report,null,2));console.log(JSON.stringify({name,elapsedMs,maxHeartbeatGapMs:measurement.maxHeartbeatGapMs}));
  }finally{clearInterval(timer);}
}
let plugin;
(async()=>{
  for(let i=0;i<iterations;i++){
    plugin=create();await measure('full-startup-'+i,()=>plugin.onload());assert.equal(plugin.ready,true);
    await measure('historical-load-'+i,()=>plugin.loadSettings());
    await measure('historical-save-'+i,()=>plugin.saveSettings(false));
    const saved=JSON.parse(fs.readFileSync(catalog));
    assert.deepEqual(saved.tasks,config.tasks);
    for(let j=0;j<config.workflows.length;j++){
      const wf=saved.workflows[j],expected=config.workflows[j];
      assert.equal(wf.id,expected.id);assert.equal(wf.name,expected.name);assert.equal(wf.steps[0].description,padding);
      assert.equal(wf.runtimeExecution.definitionHash,expected.runtimeExecution.definitionHash);assert.equal(wf.runtimeExecution.phase,'completed');
      assert.equal(wf.steps[0].output,JSON.parse(fs.readFileSync(path.join(runtime,'synthetic-run-'+j+'.json'))).steps[0].output);
    }
    assert.deepEqual(journalHashes(),report.journalHashes);
    await plugin.onunload();plugin=undefined;
  }
  report.status='completed';report.dataPreserved=true;report.heartbeatBudgetMs=100;
  report.heartbeatBudgetMet=report.measurements.every(m=>m.maxHeartbeatGapMs<=100);
})().catch(error=>{report.status='failed';report.error=String(error);process.exitCode=1;console.error(error);}).finally(async()=>{
  if(plugin)await plugin.onunload().catch(()=>{});
  observer.disconnect();global.window=oldWindow;report.maxRssKiB=process.resourceUsage().maxRSS;
  fs.writeFileSync(output,JSON.stringify(report,null,2));
  assert.equal(path.dirname(fs.realpathSync(vault)),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(vault).startsWith('autooc-history-latency-'));
  fs.rmSync(vault,{recursive:true,force:true});
});
