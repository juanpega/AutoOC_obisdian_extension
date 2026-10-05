const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync,spawn}=require('node:child_process');
const repo=path.resolve(__dirname,'..');

test('distributed ZIP and its skill support task, workflow, gates, error, stop and restart without Obsidian',async t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-package-'));
  t.after(()=>{assert.equal(path.dirname(fs.realpathSync(root)),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(root).startsWith('autooc-package-'));fs.rmSync(root,{recursive:true});});
  const out=path.join(root,'release'),vault=path.join(root,'vault'),install=path.join(vault,'.obsidian/plugins/auto-oc');
  fs.mkdirSync(install,{recursive:true});
  const packaged=spawnSync(process.execPath,[path.join(repo,'scripts/package-release.mjs'),'--out',out],{cwd:repo,encoding:'utf8',timeout:30000});
  assert.equal(packaged.status,0,packaged.stderr);
  const zip=path.join(out,fs.readdirSync(out).find(name=>name.endsWith('.zip')));
  const unpacked=process.platform==='win32'
    ? spawnSync('powershell.exe',['-NoProfile','-Command',`Expand-Archive -LiteralPath '${zip.replace(/'/g,"''")}' -DestinationPath '${install.replace(/'/g,"''")}'`],{encoding:'utf8',timeout:30000})
    : spawnSync('unzip',['-q',zip,'-d',install],{encoding:'utf8',timeout:30000});
  assert.equal(unpacked.status,0,unpacked.stderr);
  const cli=path.join(install,'autooc-cli.cjs'),config=path.join(install,'data.json');
  const call=(...args)=>spawnSync(process.execPath,[cli,...args],{cwd:root,encoding:'utf8',timeout:15000});
  const ok=(...args)=>{const r=call(...args);assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout);};
  const version=ok('version');
  assert.equal(version.version,JSON.parse(fs.readFileSync(path.join(install,'manifest.json'))).version);
  assert.equal(version.taskSelection,true);assert.ok(version.capabilities.includes('recover-lease'));
  assert.match(fs.readFileSync(path.join(install,'skills/autooc-runtime/SKILL.md'),'utf8'),/node CLI run --vault VAULT --task TASK_ID/);
  assert.match(ok('help').execution,/--task/);
  fs.writeFileSync(config,JSON.stringify({custom:'preserve',tasks:[{id:'task',name:'Task',taskKind:'code',codeAllowVault:true,code:'vault.append("task.txt","once"); output="task result";'}],workflows:[
    {id:'full',name:'Full',steps:[
      {id:'first',stepKind:'code',codeAllowVault:true,code:'vault.append("first.txt","once"); output="x".repeat(64000);'},
      {id:'task-step',stepKind:'task',taskId:'task'},
      {id:'last',stepKind:'code',codeAllowVault:true,code:'if(outputs.first.length!==64000 || !input.endsWith("task result"))throw Error("lost handoff"); vault.write("result.md","verified"); output="done";'}]},
    {id:'gate',name:'Gate',steps:[
      {id:'decision',stepKind:'code',codeAllowVault:true,code:'output=vault.exists("decision.md")?vault.read("decision.md"):"pending";',transitions:[{toStepId:'effect',mode:'conditional',condition:'input === "approved fixture"'}]},
      {id:'effect',stepKind:'code',codeAllowVault:true,code:'vault.write("gated.txt","authorized fixture");'}]},
    {id:'error',name:'Failure',steps:[{id:'fail',stepKind:'code',code:'throw Error("deliberate fixture failure");'}]},
    {id:'stop',name:'Stop',steps:[{id:'delay',stepKind:'delay',delayValue:30,delayUnit:'seconds'},{id:'effect',stepKind:'code',codeAllowVault:true,code:'vault.write("forbidden.txt","bad");'}]},
    {id:'restart',name:'Restart',steps:[{id:'first',stepKind:'code',codeAllowVault:true,code:'vault.append("restart.txt","once");'},{id:'second',stepKind:'code',code:'output="recovered";'}]}
  ]}));
  assert.equal(ok('list','--vault',vault).workflows.length,5);
  const task=ok('run','--vault',vault,'--task','task');assert.equal(task.phase,'completed');
  assert.equal(ok('resume','--vault',vault,'--task','task','--run',task.runId).runId,task.runId);
  assert.equal(fs.readFileSync(path.join(vault,'task.txt'),'utf8'),'once');
  const full=ok('run','--vault',vault,'--workflow','full');assert.equal(full.phase,'completed');
  assert.equal(fs.readFileSync(path.join(vault,'result.md'),'utf8'),'verified');
  ok('resume','--vault',vault,'--workflow','full','--run',full.runId);
  assert.equal(fs.readFileSync(path.join(vault,'first.txt'),'utf8'),'once');
  ok('run','--vault',vault,'--workflow','gate');assert.ok(!fs.existsSync(path.join(vault,'gated.txt')));
  fs.writeFileSync(path.join(vault,'decision.md'),'approved fixture'); // Test data, never an approval for a real workflow.
  ok('run','--vault',vault,'--workflow','gate');assert.ok(fs.existsSync(path.join(vault,'gated.txt')));
  const failed=call('run','--vault',vault,'--workflow','error');assert.equal(failed.status,1);assert.equal(JSON.parse(failed.stdout).phase,'failed');
  const wrong=call('run','--vault',root,'--workflow','full');assert.equal(wrong.status,1);assert.ok(!fs.existsSync(path.join(root,'.obsidian')));
  const child=spawn(process.execPath,[cli,'run','--vault',vault,'--workflow','stop'],{stdio:['ignore','pipe','pipe'],windowsHide:true});
  let output='',error='';child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>error+=b);
  const ended=new Promise(resolve=>child.once('exit',resolve));
  t.after(()=>{if(child.exitCode===null)child.kill();});
  const until=Date.now()+10000;let stopId;
  while(Date.now()<until){
    const current=JSON.parse(fs.readFileSync(config));stopId=current.workflows.find(w=>w.id==='stop').runtimeExecution?.runId;
    if(stopId)break;
    if(child.exitCode!==null)break;
    await new Promise(resolve=>setTimeout(resolve,30));
  }
  assert.ok(stopId,`running identity was published; exit=${child.exitCode}; stderr=${error}; stdout=${output}`);
  assert.equal(call('run','--vault',vault,'--workflow','full').status,1);
  const stopping=ok('stop','--vault',vault,'--workflow','stop','--run',stopId);assert.equal(stopping.requested,true);
  const status=await ended;assert.ok([1,130].includes(status),error);assert.equal(JSON.parse(output).phase,'failed');
  assert.ok(!fs.existsSync(path.join(vault,'forbidden.txt')));
  const driver=path.join(root,'pause.cjs');
  fs.writeFileSync(driver,`require(${JSON.stringify(path.join(install,'autooc-runtime.cjs'))}).runInstalledWorkflow({vault:${JSON.stringify(vault)},workflowId:'restart',newExecution:true,maxSteps:1,redact:s=>s}).then(s=>console.log(JSON.stringify(s))).catch(e=>{console.error(e);process.exitCode=1;});`);
  const first=spawnSync(process.execPath,[driver],{encoding:'utf8',timeout:15000});assert.equal(first.status,0,first.stderr);
  const run=JSON.parse(first.stdout);assert.equal(run.phase,'ready');
  assert.equal(ok('reconcile','--vault',vault,'--workflow','restart','--run',run.runId).phase,'ready');
  assert.equal(ok('resume','--vault',vault,'--workflow','restart','--run',run.runId).phase,'completed');
  assert.equal(fs.readFileSync(path.join(vault,'restart.txt'),'utf8'),'once');
  assert.equal(JSON.parse(fs.readFileSync(config)).custom,'preserve');
  assert.equal(ok('status','--vault',vault).activityVerified,false);
});
