const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm');
const {spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(predicate,message){const deadline=Date.now()+10000;while(!predicate()){assert.ok(Date.now()<deadline,message);await delay(25);}}

const streamingFixture = `
  const fs = require('node:fs'), path = require('node:path');
  const dir = process.argv[1];
  const file = name => path.join(dir, name);
  fs.writeFileSync(file('stdout.txt'), 'Primera salida TOKEN_PRIVADO');
  fs.writeFileSync(file('stderr.txt'), 'Primera traza');
  process.send('logs-written');
  const timer = setInterval(() => {
    if (!fs.existsSync(file('finish-test'))) return;
    clearInterval(timer);
    fs.unlinkSync(file('finish-test'));
    fs.appendFileSync(file('stdout.txt'), '\\nResultado final');
  }, 20);
`;

for(const entry of ['task UI','workflow UI','task CLI','workflow CLI'])test(`OpenCode live log renders before completion through ${entry}`,async()=>{
  const vault=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-live-log-'));
  const installation=path.join(vault,'.obsidian/plugins/auto-oc');fs.mkdirSync(installation,{recursive:true});
  const configFile=path.join(installation,'data.json');
  fs.writeFileSync(configFile,JSON.stringify({logsEnabled:true,tasks:[{id:'t',name:'Stream task',taskKind:'opencode',model:'fixture/model',prompt:'stream',status:'pending'}],
    workflows:[{id:'w',name:'Stream workflow',steps:[{id:'a',stepKind:'task',taskId:'t'}]}]}));
  const rendered=[],children=[],childClosures=[];let folder,job,p,modal,receiver,settled=false,closing=false;
  let signalReady, failStartup, fixtureChild, startupTimer;
  const fixtureReady = new Promise((resolve, reject) => { signalReady = resolve; failStartup = reject; });
  const trackChild=child=>{
    children.push(child);
    childClosures.push(new Promise(resolve=>child.once('close',resolve)));
  };
  class Stub{}
  const obsidian={Plugin:Stub,Notice:Stub,Modal:class{constructor(app){this.app=app;}},ItemView:Stub,PluginSettingTab:Stub,Setting:Stub,
    MarkdownRenderer:{render(_app,text){rendered.push(text);}}};
  const bundle={exports:{}};
  vm.runInNewContext(fs.readFileSync(path.join(root,'main.js'),'utf8')+'\nmodule.exports.LiveLog=LiveLogModal; module.exports.setLauncher=fn=>{launchHidden=fn;};',{
    module:bundle,exports:bundle.exports,require:name=>name==='obsidian'?obsidian:require(name),process,Buffer,console,AbortController,setTimeout,clearTimeout,setInterval,clearInterval,window:{clearInterval},
  });
  bundle.exports.setLauncher(script=>{
    folder=path.dirname(script);
    const child = spawn(process.execPath, ['-e', streamingFixture, folder], {
      windowsHide: true, stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    });
    fixtureChild = child;
    child.once('message', signalReady);
    child.once('error', failStartup);
    child.once('close', (code, signal) => {
      // As in the real launcher, publish the exit code after the provider exits.
      if (fs.existsSync(folder)) fs.writeFileSync(path.join(folder, 'done.txt'), String(code ?? 1));
      failStartup(new Error(`Log fixture exited before reporting readiness (${signal || code})`));
    });
    trackChild(child);
    if (closing) child.kill();
    return {onError(fn){child.once('error',fn);},kill(){child.kill();},cleanup(){}};
  });
  try{
    p=new bundle.exports.default();p.manifest={id:'auto-oc'};p.app={vault:{adapter:{basePath:vault},configDir:'.obsidian'},workspace:{getLeavesOfType:()=>[]}};
    p.redactSecrets=text=>text.replaceAll('TOKEN_PRIVADO','[REDACTED]');p.reservePluginExecution();await p.loadSettings();
    modal=new bundle.exports.LiveLog(p.app,p.settings.tasks[0],p);modal.renderEl={empty(){},scrollTop:0,scrollHeight:1};modal.statusEl={};
    if(entry.endsWith('CLI')){
      p.startCliRequests();receiver=setInterval(()=>p.cliRequestHost.poll(),10);
      const child=spawn(process.execPath,[path.join(root,'autooc-cli.cjs'),'run','--vault',vault,entry.startsWith('task')?'--task':'--workflow',entry.startsWith('task')?'t':'w'],{windowsHide:true});trackChild(child);
      job=new Promise((resolve,reject)=>{let stdout='',stderr='';child.stdout.on('data',s=>stdout+=s);child.stderr.on('data',s=>stderr+=s);child.on('error',reject);child.on('close',code=>{try{assert.equal(code,0,stderr);resolve(JSON.parse(stdout));}catch(error){reject(error);}});});
    }else job=entry.startsWith('task')?p.runTask(p.settings.tasks[0]):p.runWorkflow(p.settings.workflows[0]);
    job=job.finally(()=>{settled=true;});void job.catch(()=>{});
    // Give a cold runner time to start the provider. The live-render deadline
    // below begins only after the provider has actually written its streams.
    const ready = await Promise.race([
      fixtureReady,
      job.then(() => { throw new Error('Task finished before the log fixture was ready'); }),
      new Promise((_, reject) => {
        startupTimer = setTimeout(() => reject(new Error('Log fixture did not report readiness within 60s')), 60_000);
      }),
    ]);
    clearTimeout(startupTimer);
    assert.equal(ready, 'logs-written');
    const before=fs.readFileSync(configFile),runtime=path.join(installation,'runtime');
    const journal=fs.readdirSync(runtime).find(name=>/^[a-f0-9-]+\.json$/.test(name));const checkpoint=fs.readFileSync(path.join(runtime,journal));
    // stdout and stderr are independent writes. A valid first snapshot can
    // contain only stdout; wait for both streams without completing the task.
    await until(()=>{modal.refresh();return rendered.at(-1)?.includes('Primera salida')&&rendered.at(-1)?.includes('Primera traza');},'Live Log must render both streams before OpenCode exits');
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
    closing=true;
    clearTimeout(startupTimer);
    if (fixtureChild && !settled && fixtureChild.exitCode === null && fixtureChild.signalCode === null) fixtureChild.kill();
    if(job)await job.catch(()=>{});
    clearInterval(receiver);
    try {
      // close prevents new requests; drain waits for an in-flight heartbeat or
      // receipt write before the fixture releases its lease and removes files.
      p?.cliRequestHost?.close();await p?.cliRequestHost?.drain();p?.releasePluginExecution(false);
    } finally {
      for(const child of children)if(child.exitCode===null&&child.signalCode===null)child.kill();
      await Promise.all(childClosures);
      assert.equal(path.dirname(fs.realpathSync(vault)),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(vault).startsWith('autooc-live-log-'));fs.rmSync(vault,{recursive:true,force:true});
    }
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
