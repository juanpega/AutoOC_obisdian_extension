const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),Module=require('node:module');
const cp=require('node:child_process'),ts=require('typescript');
function modules(overrides={}) {
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
  return load;
}
const load=modules();
const {openCodeRunArgs,openCodeInteractiveArgs}=load('opencode-profile');

test('versioned invocations retain v1 and use v2 standalone, lowercase logging and mini',()=>{
  assert.deepEqual(openCodeRunArgs(1,'p/m','review'),['run','--print-logs','--log-level','INFO','--auto','-m','p/m','--agent','review','--dangerously-skip-permissions']);
  const v2=openCodeRunArgs(2,'p/m','review');
  assert.deepEqual(v2,['run','--standalone','--print-logs','--log-level','info','--auto','--model','p/m','--agent','review']);
  assert.ok(!openCodeRunArgs(2,'p/m','review',true).includes('--agent'));
  assert.deepEqual(openCodeInteractiveArgs(2,'p/m','review','a\n"; $()'),['mini','--standalone','-m','p/m','--agent','review','--prompt','a\n"; $()']);
  assert.deepEqual(openCodeInteractiveArgs(1,'p/m','','hello'),['-m','p/m','--prompt','hello']);
});

test('new harness settings do not change existing fingerprints; v2 changes do invalidate v2 definitions',()=>{
  const {prepareWorkflowDefinition:prepare}=load('workflow-definition');
  const w={id:'w',steps:[{id:'s',stepKind:'task',taskId:'t'}]},v1=[{id:'t',taskKind:'opencode',prompt:'hello',model:'p/old'}];
  const settings={defaultModel:'p/old',opencodePath:'old-cli'};
  const next={...settings,opencode2Path:'new-cli',defaultOpencode2Model:'p/new',defaultOpencode2Agent:'build'};
  assert.equal(prepare(w,v1,settings).hash,prepare(w,v1,next).hash);
  const v2=[{...v1[0],taskKind:'opencode2',model:'p/new'}],first=prepare(w,v2,next);
  assert.equal(first.settings.opencode2Path,'new-cli');
  assert.notEqual(first.hash,prepare(w,v2,{...next,opencode2Path:'different-cli'}).hash);
  assert.notEqual(first.hash,prepare(w,v2,{...next,defaultOpencode2Model:'p/another'}).hash);
  assert.equal(first.hash,prepare(first.workflow,first.tasks,first.settings).hash);
});

test('version parsing rejects ambiguous output and distinguishes majors',()=>{
  const {parseOpenCodeVersion:parse}=load('opencode-version');
  for(const value of ['opencode v2.0.21','2.2.5','v2.0.0-preview.1'])assert.equal(parse(value).major,2);
  assert.equal(parse('1.19.0').major,1);assert.equal(parse('opencode v3.0.0').major,3);
  for(const value of ['node v2.0.0','error 2.0.21','2.0.21\n1.19.0',''])assert.equal(parse(value),undefined);
});

async function fixture(run) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),"autooc-v2 space '&-"));
  const children=[];
  const actual=load('cli-launchers');
  const local=modules({'cli-launchers':{...actual,launchHidden(script) {
    const child=cp.spawn(process.platform==='win32'?'powershell.exe':'sh',process.platform==='win32'?['-NoLogo','-NoProfile','-ExecutionPolicy','Bypass','-File',script]:[script],{windowsHide:true,stdio:'ignore'});
    children.push(new Promise(resolve=>{child.once('close',resolve);child.once('error',resolve);}));
    return {cleanup(){},kill(){child.kill();},onError(fn){child.once('error',fn);}};
  }}});
  const makeCli=(major,exit=0)=>{
    const name=`cli${major}`,record=path.join(root,name+'.jsonl'),js=path.join(root,name+'.cjs');
    fs.writeFileSync(js,`const fs=require('fs');const args=process.argv.slice(2);if(args[0]==='--version'){console.log('opencode v${major}.0.21');process.exit(0);}
const prompt=args.at(-1),file=prompt.match(/file at (.*) and follow it exactly\./)?.[1];
fs.appendFileSync(${JSON.stringify(record)},JSON.stringify({args,cwd:process.cwd(),prompt:file?fs.readFileSync(file,'utf8'):prompt})+'\\n');
console.log('fixture-${major}-result');process.exit(${exit});`);
    const bin=path.join(root,name+(process.platform==='win32'?'.ps1':'.sh'));
    fs.writeFileSync(bin,process.platform==='win32'?`& ${actual.psSingleQuoted(process.execPath)} ${actual.psSingleQuoted(js)} @args\nexit $LASTEXITCODE`:`#!/bin/sh\nexec ${actual.shSingleQuoted(process.execPath)} ${actual.shSingleQuoted(js)} "$@"\n`,{mode:0o700});
    return {bin,record};
  };
  try {await run({root,local,makeCli});}
  finally {await Promise.all(children);assert.equal(path.dirname(fs.realpathSync(root)),fs.realpathSync(os.tmpdir()));fs.rmSync(root,{recursive:true,force:true});}
}

test('real scripts preserve v2 input, cwd and failure without falling back to v1',()=>fixture(async({root,local,makeCli})=>{
  const legacy=makeCli(1),modern=makeCli(2,7);
  const adapter=local('cli-workflow-adapters').createOpenCodeWorkflowAdapter({settings:{opencodePath:legacy.bin,opencode2Path:modern.bin,defaultOpencode2Model:'fixture/new',defaultOpencode2Agent:'review',taskTimeoutSeconds:20}},root);
  const prompt='Synthetic full input\n'+('ñ 😀 $() ` "\n'.repeat(3000));
  const result=await adapter.execute({taskKind:'opencode2'},prompt);
  assert.equal(result.succeeded,false);assert.match(result.output,/fixture-2-result/);assert.equal(fs.existsSync(legacy.record),false);
  const records=fs.readFileSync(modern.record,'utf8').trim().split('\n').map(JSON.parse);
  assert.equal(records.length,1);assert.equal(records[0].prompt,prompt);
  // macOS /var and Windows 8.3 temp paths can name the same physical folder.
  assert.equal(fs.realpathSync.native(records[0].cwd),fs.realpathSync.native(root));
  assert.deepEqual(records[0].args.slice(0,-2),openCodeRunArgs(2,'fixture/new','review'));
  assert.equal(records[0].args.at(-2),'--');
}));

test('wrong version fails before a task or terminal launch',()=>fixture(async({root,local,makeCli})=>{
  const legacy=makeCli(1);
  const adapter=local('cli-workflow-adapters').createOpenCodeWorkflowAdapter({settings:{opencode2Path:legacy.bin,defaultOpencode2Model:'fixture/model'}},root);
  for(const interactiveTerminal of [false,true]) {
    const result=await adapter.execute({taskKind:'opencode2',interactiveTerminal},'never execute');
    assert.equal(result.succeeded,false);assert.match(result.output,/requires version 2.x/);
  }
  assert.equal(fs.existsSync(legacy.record),false);assert.equal(fs.existsSync(path.join(root,'.autooc')),false);
}));

test('catalog refresh reads project agents with Unicode labels through a CLI shim', () => fixture(async ({root, local}) => {
  const windows = process.platform === 'win32';
  const bin = path.join(root, windows ? 'catalog.ps1' : 'catalog.sh');
  const output = JSON.stringify([{id:'review',name:'Revisión',mode:'primary'}]);
  fs.writeFileSync(path.join(root, 'agents.json'), output);
  fs.writeFileSync(bin, windows
    ? "if ($args[0] -eq '--version') { '2.0.21'; exit 0 }\nif (($args -join ' ') -eq 'debug agents') { Get-Content -LiteralPath agents.json -Raw -Encoding UTF8; exit 0 }; exit 1"
    : '#!/bin/sh\ncase "$*" in --version) echo 2.0.21 ;; "debug agents") cat agents.json ;; *) exit 1 ;; esac\n', {mode:0o700});
  const catalog = new (local('opencode2-catalog').OpenCode2Catalog)();
  assert.deepEqual(await catalog.refresh(bin, root, 'agents'), [{value:'review',label:'Revisión'}]);
}));

test('a shared workflow can mix both OpenCode versions without rewriting either task',()=>fixture(async({root,local,makeCli})=>{
  const v1=makeCli(1),v2=makeCli(2);
  const tasks=[{id:'old',taskKind:'opencode',prompt:'first',model:'fixture/old'},{id:'new',taskKind:'opencode2',prompt:'second',model:'fixture/new'}];
  const w={id:'mixed',steps:[{id:'a',stepKind:'task',taskId:'old',transitions:[{toStepId:'b',mode:'default'}]},{id:'b',stepKind:'task',taskId:'new',transitions:[]}]};
  const settings={opencodePath:v1.bin,opencode2Path:v2.bin,taskTimeoutSeconds:20};
  const before=JSON.stringify(tasks),definition=local('workflow-definition').prepareWorkflowDefinition(w,tasks,settings);
  fs.mkdirSync(path.join(root,'runtime'));
  const result=await local('code-workflow-host').runCodeWorkflowHost({definition,runtimeDirectory:path.join(root,'runtime'),vaultBase:root,tasks:local('workflow-task-adapters').createWorkflowTaskAdapter(definition,root),redact:s=>s});
  assert.equal(result.phase,'completed');assert.equal(result.steps.length,2);assert.equal(JSON.stringify(tasks),before);
  const legacy=JSON.parse(fs.readFileSync(v1.record,'utf8')),modern=JSON.parse(fs.readFileSync(v2.record,'utf8'));
  assert.ok(legacy.args.includes('--dangerously-skip-permissions'));assert.ok(!legacy.args.includes('--standalone'));
  assert.ok(modern.args.includes('--standalone'));assert.ok(!modern.args.includes('--dangerously-skip-permissions'));
}));

test('v2 interactive tasks retain the startup acknowledgement contract',async()=>{
  let args,ack;
  const actual=load('cli-launchers'),capture=(...values)=>{args=values;ack=values.at(-1).onLaunched;};
  const local=modules({'opencode-version':{assertOpenCode2:async()=>{}},'cli-launchers':{...actual,openOpencodeCli:capture,openOpencodeCliLongPromptWindows:capture}});
  const adapter=local('cli-workflow-adapters').createOpenCodeWorkflowAdapter({settings:{opencode2Path:'modern',defaultOpencode2Model:'p/new'}},process.cwd());
  let settled=false;
  const pending=adapter.execute({taskKind:'opencode2',interactiveTerminal:true},'hello').then(result=>{settled=true;return result;});
  await new Promise(resolve=>setImmediate(resolve));assert.equal(settled,false);assert.equal(args[0],'modern');
  if(process.platform==='win32')assert.equal(args.at(-1).opencodeMajor,2);
  else assert.deepEqual(args[3],openCodeInteractiveArgs(2,'p/new','build','hello'));
  ack();assert.equal((await pending).succeeded,true);
});

test('abort during version detection never launches a task',async()=>{
  const controller=new AbortController();let launched=false;
  const actual=load('cli-launchers'),local=modules({'opencode-version':{assertOpenCode2:async()=>{controller.abort();}},'cli-launchers':{...actual,launchHidden(){launched=true;}}});
  const adapter=local('cli-workflow-adapters').createOpenCodeWorkflowAdapter({settings:{defaultOpencode2Model:'p/new'}},process.cwd());
  await assert.rejects(adapter.execute({taskKind:'opencode2'},'none',controller.signal),/cancelled before launch/);
  assert.equal(launched,false);
});

test('v2 preflight requires its own model and rejects the legacy Ralph Loop integration',()=>{
  const prepare=load('workflow-definition').prepareWorkflowDefinition,preflight=load('workflow-preflight').preflightInstalledWorkflow;
  const w={id:'w',steps:[{id:'s',stepKind:'task',taskId:'t'}]},task={id:'t',taskKind:'opencode2',prompt:'Synthetic'};
  assert.throws(()=>preflight(prepare(w,[task],{defaultModel:'legacy/model'}),process.cwd()),/model must be selected/);
  assert.doesNotThrow(()=>preflight(prepare(w,[task],{defaultOpencode2Model:'modern/model'}),process.cwd()));
  assert.throws(()=>preflight(prepare(w,[{...task,useRalphLoop:true}],{defaultOpencode2Model:'modern/model'}),process.cwd()),/Ralph Loop/);
});

test('official v2 binary accepts both generated command shapes (help only)',{skip:!process.env.AUTOOC_OPENCODE2_TEST_BIN},()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-v2-native-'));
  try {
    const env={...process.env,XDG_DATA_HOME:path.join(root,'data'),XDG_CONFIG_HOME:path.join(root,'config'),XDG_STATE_HOME:path.join(root,'state'),XDG_CACHE_HOME:path.join(root,'cache')};
    for(const args of [openCodeRunArgs(2,'fixture/model','build'),openCodeInteractiveArgs(2,'fixture/model','build','hello')]) {
      const result=cp.spawnSync(process.env.AUTOOC_OPENCODE2_TEST_BIN,[...args,'--help'],{cwd:root,env,encoding:'utf8',timeout:15000,windowsHide:true});
      assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/USAGE/);
    }
  } finally {assert.equal(path.dirname(fs.realpathSync(root)),fs.realpathSync(os.tmpdir()));fs.rmSync(root,{recursive:true,force:true});}
});
