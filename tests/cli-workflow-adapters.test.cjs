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
      assert.equal(path.dirname(dir),path.join(root,'.autooc','auxiliary'));
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
    assert.deepEqual(fs.readdirSync(root),['.autooc']);
    assert.deepEqual(fs.readdirSync(path.join(root,'.autooc','auxiliary')),['.gitignore']);
    // Branch selection now belongs to the shared host before this adapter.
    assert.equal(adapter.supports({taskKind:'opencode',branch:'other'}),true);
  } finally {assert.equal(path.dirname(fs.realpathSync(root)),fs.realpathSync(os.tmpdir()));fs.rmSync(root,{recursive:true,force:true});}
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

function auxiliaryFixture(run) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-auxiliary-'));
  try { return run(root,loadAdapters().load('execution-files')); }
  finally {assert.equal(path.dirname(fs.realpathSync(root)),fs.realpathSync(os.tmpdir()));fs.rmSync(root,{recursive:true,force:true});}
}

test('auxiliary storage preserves existing configuration, legacy folders and uncertain attempts',()=>auxiliaryFixture((root,api)=>{
  fs.mkdirSync(path.join(root,'.autooc'));fs.writeFileSync(path.join(root,'.autooc','data.json'),'unrelated configuration');
  const legacy=path.join(root,'.autooc-runtime-legacy');fs.mkdirSync(legacy);fs.writeFileSync(path.join(legacy,'input.txt'),'legacy evidence');
  const first=api.createAuxiliaryDirectory(root,'runtime'),second=api.createAuxiliaryDirectory(root,'interactive');
  assert.notEqual(first,second);assert.equal(path.dirname(first),path.join(root,'.autooc','auxiliary'));
  fs.writeFileSync(path.join(first,'input.txt'),'pending');
  api.createAuxiliaryDirectory(root,'runtime');
  assert.equal(fs.readFileSync(path.join(first,'input.txt'),'utf8'),'pending');
  assert.equal(fs.readFileSync(path.join(legacy,'input.txt'),'utf8'),'legacy evidence');
  assert.equal(fs.readFileSync(path.join(root,'.autooc','data.json'),'utf8'),'unrelated configuration');
}));

test('later launch cleans only completed auxiliary receipts and preserves foreign files',()=>auxiliaryFixture((root,api)=>{
  const done=api.createAuxiliaryDirectory(root,'runtime'),foreign=api.createAuxiliaryDirectory(root,'interactive'),uncertain=api.createAuxiliaryDirectory(root,'runtime');
  fs.writeFileSync(path.join(done,'input.txt'),'finished');
  fs.writeFileSync(path.join(done,api.AUXILIARY_COMPLETION),api.auxiliaryCompletionRecord(done,'runtime'));
  fs.writeFileSync(path.join(foreign,'prompt.txt'),'finished');fs.writeFileSync(path.join(foreign,'keep.md'),'keep');
  api.completeAuxiliaryDirectory(foreign,'interactive');
  assert.equal(fs.existsSync(path.join(foreign,'prompt.txt')),false);
  fs.writeFileSync(path.join(uncertain,'input.txt'),'uncertain');fs.writeFileSync(path.join(uncertain,api.AUXILIARY_COMPLETION),'{partial');
  api.createAuxiliaryDirectory(root,'runtime');
  assert.equal(fs.existsSync(done),false);
  assert.equal(fs.readFileSync(path.join(foreign,'keep.md'),'utf8'),'keep');
  assert.equal(fs.readFileSync(path.join(uncertain,'input.txt'),'utf8'),'uncertain');
}));

test('auxiliary storage refuses redirected parents without touching the destination',()=>auxiliaryFixture((root,api)=>{
  const target=path.join(root,'external');fs.mkdirSync(target);fs.writeFileSync(path.join(target,'keep.txt'),'keep');
  fs.symlinkSync(target,path.join(root,'.autooc'),process.platform==='win32'?'junction':'dir');
  assert.throws(()=>api.createAuxiliaryDirectory(root,'runtime'),/redirected/);
  assert.deepEqual(fs.readdirSync(target),['keep.txt']);
}));

test('auxiliary storage is ignored without changing project Git rules',()=>auxiliaryFixture((root,api)=>{
  const cp=require('node:child_process');cp.execFileSync('git',['init','--quiet',root]);
  fs.writeFileSync(path.join(root,'.gitignore'),'existing-rule\n');
  const dir=api.createAuxiliaryDirectory(root,'runtime');fs.writeFileSync(path.join(dir,'input.txt'),'private fixture');
  const args=['-c',`safe.directory=${root}`,'-C',root];
  assert.match(cp.execFileSync('git',[...args,'check-ignore',path.relative(root,path.join(dir,'input.txt'))],{encoding:'utf8'}),/input.txt/);
  assert.equal(fs.readFileSync(path.join(root,'.gitignore'),'utf8'),'existing-rule\n');
}));

for(const failure of ['cancel','launch error'])test(`OpenCode auxiliary files survive an uncertain ${failure}`,async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-auxiliary-')),controller=new AbortController();
  try {
    let directory;
    const actual=loadAdapters().load('cli-launchers');
    const loaded=loadAdapters({'cli-launchers':{...actual,launchHidden(script){
      directory=path.dirname(script);if(failure==='cancel')controller.abort();
      return {cleanup(known){assert.equal(known,false);},kill(){},onError(cb){if(failure==='launch error')cb(Error('unknown launch'));}};
    }}});
    const adapter=loaded.adapters().createOpenCodeWorkflowAdapter({settings:{opencodePath:'fixture'}},root);
    await assert.rejects(adapter.execute({taskKind:'opencode',model:'fixture'},'preserve complete input',controller.signal));
    assert.equal(fs.readFileSync(path.join(directory,'input.txt'),'utf8'),'preserve complete input');
    assert.equal(fs.existsSync(path.join(directory,'autooc-cleanup.json')),false);
    loaded.load('execution-files').createAuxiliaryDirectory(root,'runtime');
    assert.equal(fs.existsSync(directory),true);
    assert.deepEqual(fs.readdirSync(root),['.autooc']);
  }finally{assert.equal(path.dirname(fs.realpathSync(root)),fs.realpathSync(os.tmpdir()));fs.rmSync(root,{recursive:true,force:true});}
});
