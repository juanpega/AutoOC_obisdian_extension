const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm');
const {spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(predicate,message){const deadline=Date.now()+10000;while(!predicate()){assert.ok(Date.now()<deadline,message);await delay(25);}}

for(const entry of ['task UI','workflow UI','task CLI','workflow CLI'])test(`OpenCode live log renders before completion through ${entry}`,async()=>{
  const vault=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-live-log-'));
  const installation=path.join(vault,'.obsidian/plugins/auto-oc');fs.mkdirSync(installation,{recursive:true});
  const configFile=path.join(installation,'data.json');
  fs.writeFileSync(configFile,JSON.stringify({logsEnabled:true,tasks:[{id:'t',name:'Stream task',taskKind:'opencode',model:'fixture/model',prompt:'stream',status:'pending'}],
    workflows:[{id:'w',name:'Stream workflow',steps:[{id:'a',stepKind:'task',taskId:'t'}]}]}));
  const rendered=[],children=[];let folder,job,p,modal,receiver,settled=false;
  class Stub{}
  const obsidian={Plugin:Stub,Notice:Stub,Modal:class{constructor(app){this.app=app;}},ItemView:Stub,PluginSettingTab:Stub,Setting:Stub,
    MarkdownRenderer:{render(_app,text){rendered.push(text);}}};
  const bundle={exports:{}};
  vm.runInNewContext(fs.readFileSync(path.join(root,'main.js'),'utf8')+'\nmodule.exports.LiveLog=LiveLogModal; module.exports.setLauncher=fn=>{launchHidden=fn;};',{
    module:bundle,exports:bundle.exports,require:name=>name==='obsidian'?obsidian:require(name),process,Buffer,console,AbortController,setTimeout,clearTimeout,setInterval,clearInterval,window:{clearInterval},
  });
  bundle.exports.setLauncher(script=>{
    folder=path.dirname(script);
    const child=spawn(process.execPath,['-e',`const fs=require('fs'),path=require('path');const dir=process.argv[1];fs.writeFileSync(path.join(dir,'stdout.txt'),'Primera salida TOKEN_PRIVADO');fs.writeFileSync(path.join(dir,'stderr.txt'),'Primera traza');const timer=setInterval(()=>{if(fs.existsSync(path.join(dir,'finish-test'))){clearInterval(timer);fs.unlinkSync(path.join(dir,'finish-test'));fs.appendFileSync(path.join(dir,'stdout.txt'),'\\nResultado final');fs.writeFileSync(path.join(dir,'done.txt'),'0');}},20);`,folder],{windowsHide:true,stdio:'ignore'});
    children.push(child);
    return {onError(fn){child.once('error',fn);},kill(){child.kill();},cleanup(){}};
  });
  try{
    p=new bundle.exports.default();p.manifest={id:'auto-oc'};p.app={vault:{adapter:{basePath:vault},configDir:'.obsidian'},workspace:{getLeavesOfType:()=>[]}};
    p.redactSecrets=text=>text.replaceAll('TOKEN_PRIVADO','[REDACTED]');p.reservePluginExecution();await p.loadSettings();
    modal=new bundle.exports.LiveLog(p.app,p.settings.tasks[0],p);modal.renderEl={empty(){},scrollTop:0,scrollHeight:1};modal.statusEl={};
    if(entry.endsWith('CLI')){
      p.startCliRequests();receiver=setInterval(()=>p.cliRequestHost.poll(),10);
      const child=spawn(process.execPath,[path.join(root,'autooc-cli.cjs'),'run','--vault',vault,entry.startsWith('task')?'--task':'--workflow',entry.startsWith('task')?'t':'w'],{windowsHide:true});children.push(child);
      job=new Promise((resolve,reject)=>{let stdout='',stderr='';child.stdout.on('data',s=>stdout+=s);child.stderr.on('data',s=>stderr+=s);child.on('error',reject);child.on('exit',code=>{try{assert.equal(code,0,stderr);resolve(JSON.parse(stdout));}catch(error){reject(error);}});});
    }else job=entry.startsWith('task')?p.runTask(p.settings.tasks[0]):p.runWorkflow(p.settings.workflows[0]);
    job=job.finally(()=>{settled=true;});void job.catch(()=>{});
    await until(()=>folder&&fs.existsSync(path.join(folder,'stdout.txt')),'fixture must produce output while task is running');
    const before=fs.readFileSync(configFile),runtime=path.join(installation,'runtime');
    const journal=fs.readdirSync(runtime).find(name=>/^[a-f0-9-]+\.json$/.test(name));const checkpoint=fs.readFileSync(path.join(runtime,journal));
    await until(()=>{modal.refresh();return rendered.some(text=>text.includes('Primera salida'));},'Live Log must render output before OpenCode exits');
    assert.equal(settled,false);assert.equal(p.settings.tasks[0].status,'running');
    assert.match(rendered.at(-1),/Primera traza/);assert.match(rendered.at(-1),/\[REDACTED\]/);assert.ok(!rendered.at(-1).includes('TOKEN_PRIVADO'));
    // Unchanged output is not redrawn; streaming never writes the full catalog or journal.
    const count=rendered.length;await delay(150);modal.refresh();assert.equal(rendered.length,count);
    assert.deepEqual(fs.readFileSync(configFile),before);assert.deepEqual(fs.readFileSync(path.join(runtime,journal)),checkpoint);
    // Reloading the persisted catalog cannot erase the transient live view.
    await p.loadSettings();modal.refresh();assert.match(rendered.at(-1),/Primera salida/);
    fs.writeFileSync(path.join(folder,'stdout.txt'),'Segunda salida TOKEN_PRIVADO');
    await until(()=>{modal.refresh();return rendered.at(-1)?.includes('Segunda salida');},'successive output must replace the live snapshot');
    fs.writeFileSync(path.join(folder,'finish-test'),'');await job;modal.refresh();
    assert.equal(p.settings.tasks[0].status,'completed');assert.match(rendered.at(-1),/Resultado final/);
    assert.ok(!rendered.at(-1).includes('TOKEN_PRIVADO'));assert.match(JSON.parse(fs.readFileSync(configFile)).tasks[0].output,/Resultado final/);
  }finally{
    if(folder&&fs.existsSync(folder)&&!settled)fs.writeFileSync(path.join(folder,'finish-test'),'');
    if(job)await job.catch(()=>{});
    clearInterval(receiver);p?.cliRequestHost?.close();p?.releasePluginExecution(false);
    for(const child of children)if(child.exitCode===null)child.kill();
    assert.equal(path.dirname(fs.realpathSync(vault)),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(vault).startsWith('autooc-live-log-'));fs.rmSync(vault,{recursive:true,force:true});
  }
});

test('transient task output is redacted, bound to its attempt and ignored after completion or stop',async()=>{
  const {runCodeWorkflowHost,prepareWorkflowDefinition}=require('../autooc-runtime.cjs');
  const runtime=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-live-owner-'));
  const definition=prepareWorkflowDefinition({id:'w',steps:[{id:'a',stepKind:'task',taskId:'t'},{id:'b',stepKind:'task',taskId:'t'}]},[{id:'t',taskKind:'opencode'}],{});
  const events=[],outputs=[];let first;
  try{
    const result=await runCodeWorkflowHost({definition,runtimeDirectory:runtime,vaultBase:runtime,redact:text=>text.replaceAll('SECRET','[redacted]'),onTaskOutput:event=>events.push(event),
      tasks:{supports:()=>true,async execute(_task,_prompt,_signal,_record,interaction){
        if(!first)first=interaction.onOutput;else first('STALE');
        const before=fs.readdirSync(runtime).filter(p=>p.endsWith('.json')).map(p=>fs.readFileSync(path.join(runtime,p),'utf8'));
        interaction.onOutput('live SECRET');outputs.push(interaction.onOutput);
        assert.deepEqual(fs.readdirSync(runtime).filter(p=>p.endsWith('.json')).map(p=>fs.readFileSync(path.join(runtime,p),'utf8')),before);
        return {succeeded:true,output:'FINAL'};
      }}});
    first('LATE');outputs[1]('LATE');assert.equal(events.length,2);
    assert.deepEqual(events.map(e=>[e.stepId,e.stepIndex,e.output]),[['a',0,'live [redacted]'],['b',1,'live [redacted]']]);
    assert.ok(events.every(e=>e.runId===result.runId&&e.workflowId==='w'&&e.taskId==='t'));
    assert.deepEqual(result.steps.map(s=>s.output),['FINAL','FINAL']);
    const controller=new AbortController(),beforeCount=events.length;
    await runCodeWorkflowHost({definition,runtimeDirectory:runtime,vaultBase:runtime,signal:controller.signal,redact:s=>s,onTaskOutput:event=>events.push(event),
      tasks:{supports:()=>true,async execute(_task,_prompt,_signal,_record,interaction){controller.abort();interaction.onOutput('AFTER STOP');return {succeeded:false,cancelled:true,output:'stopped'};}}});
    assert.equal(events.length,beforeCount);
  }finally{assert.equal(path.dirname(fs.realpathSync(runtime)),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(runtime).startsWith('autooc-live-owner-'));fs.rmSync(runtime,{recursive:true,force:true});}
});
