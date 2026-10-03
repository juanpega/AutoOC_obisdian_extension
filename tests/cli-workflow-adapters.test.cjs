const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
const {spawnSync}=require('node:child_process');
function loadAdapters(overrides={}) {
  const cache=new Map();
  function load(name) {
    if(overrides[name])return overrides[name];
    if(cache.has(name))return cache.get(name).exports;
    const file=path.resolve(__dirname,'../'+name+'.ts'),m=new Module(file,module);
    m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));cache.set(name,m);
    const original=m.require.bind(m);m.require=id=>id.startsWith('./')?load(id.slice(2)):original(id);
    m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,file);
    return m.exports;
  }
  return {load,adapters:()=>load('cli-workflow-adapters')};
}

test('OpenCode adapter preserves full handoff through real files and process output; native launcher is unit-injected',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-cli-adapter-'));
  try {
    let capturedScript;
    const actual=loadAdapters().load('cli-launchers');
    const loaded=loadAdapters({'cli-launchers':{...actual,launchHidden(script) {
      capturedScript=fs.readFileSync(script,'utf8');
      const dir=path.dirname(script);
      const child=spawnSync(process.execPath,['-e',`const fs=require('fs'),path=require('path');const dir=process.argv[1];const input=fs.readFileSync(path.join(dir,'input.txt'),'utf8');fs.writeFileSync(path.join(dir,'stdout.txt'),input);fs.writeFileSync(path.join(dir,'done.txt'),'0');`,dir],{encoding:'utf8'});
      assert.equal(child.status,0,child.stderr);
      return {cleanup(){},kill(){},onError(){}};
    }}});
    const definition={settings:{opencodePath:'opencode',taskTimeoutSeconds:2,defaultAgent:'build'}};
    const adapter=loaded.adapters().createOpenCodeWorkflowAdapter(definition,root);
    const prompt='original\n'+('á $() ` "'.repeat(3000))+'\nEND';
    const result=await adapter.execute({taskKind:'opencode',model:'fixture/model'},prompt);
    assert.equal(result.succeeded,true);assert.equal(result.output,'## Response\n\n'+prompt);
    assert.ok(capturedScript.includes('fixture/model'));
    assert.deepEqual(fs.readdirSync(root),[]);
    // Branch selection now belongs to the shared host before this adapter.
    assert.equal(adapter.supports({taskKind:'opencode',branch:'other'}),true);
  } finally {assert.equal(path.dirname(fs.realpathSync(root)),fs.realpathSync(os.tmpdir()));fs.rmdirSync(root);}
});

test('Copilot adapter preserves model and permission opt-in and leaves cancellation uncertain',async()=>{
  let options,disposed=0;
  const controller=new AbortController();
  class Client {
    async run(prompt,received) {options=received;if(prompt==='cancel')controller.abort();return {output:prompt,error:'',exitCode:0};}
    dispose(){disposed++;}
  }
  const {createCopilotWorkflowAdapter}=loadAdapters({'copilot-client':{CopilotCliClient:Client,resolveCopilotBin:s=>s}}).adapters();
  const adapter=createCopilotWorkflowAdapter({settings:{copilotPath:'fixture',defaultCopilotModel:'default',taskTimeoutSeconds:2}},process.cwd());
  const task={taskKind:'copilot',model:'selected',copilotAllowAllTools:false};
  assert.equal((await adapter.execute(task,'x'.repeat(24000))).output.length,24000);
  assert.equal(options.model,'selected');assert.equal(options.allowAllTools,false);assert.equal(options.timeoutMs,2000);
  await assert.rejects(adapter.execute(task,'cancel',controller.signal),/uncertain/);
  assert.ok(disposed>=2);
  assert.equal(adapter.supports({...task,interactiveTerminal:true}),false);
});

test('interactive OpenCode only settles after launch acknowledgement and reports opening rather than task completion',async()=>{
  let acknowledge;
  const actual=loadAdapters().load('cli-launchers');
  const capture=(...args)=>{acknowledge=args[args.length-1].onLaunched;};
  const adapter=loadAdapters({'cli-launchers':{...actual,openOpencodeCli:capture,openOpencodeCliLongPromptWindows:capture}}).adapters().createOpenCodeWorkflowAdapter({settings:{opencodePath:'fixture'}},process.cwd());
  let settled=false;
  const pending=adapter.execute({taskKind:'opencode',model:'fixture',interactiveTerminal:true},'prompt').then(value=>{settled=true;return value;});
  await Promise.resolve();assert.equal(settled,false);acknowledge();
  const result=await pending;assert.equal(result.succeeded,true);assert.match(result.output,/task result is not observed/);
});
