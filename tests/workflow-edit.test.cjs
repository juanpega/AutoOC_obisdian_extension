const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
function load(name){const file=path.resolve(__dirname,'..',name+'.ts'),mod=new Module(file,module);mod.filename=file;mod.paths=module.paths;mod.require=id=>id.startsWith('.')?load(id):require(id);mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,file);return mod.exports;}
const {workflowEditDefinition,workflowEditHash,applyWorkflowEdit,validWorkflowEdit}=load('workflow-edit');
function fixture(){const workflow={id:'w',name:'original',description:'old',status:'completed',output:'private history',runtimeExecution:{runId:'history',phase:'completed'},steps:[{id:'s',stepKind:'code',code:'output=1',codeAllowFiles:false,status:'completed',output:'keep'}]};const settings={tasks:[{id:'t',prompt:'keep'}],workflows:[workflow,{id:'other',name:'keep'}],custom:'preserved'};let saved;return{workflow,settings,host:{settings,assertIdle(){},async save(validate){validate();saved=JSON.parse(JSON.stringify(settings));},get saved(){return saved;}}};}
test('edits existing workflow text and code without exposing or changing history, IDs, permissions or other objects',async()=>{
 const {workflow,settings,host}=fixture(),before=JSON.parse(JSON.stringify(settings)),definition=workflowEditDefinition(workflow);
 assert.equal(JSON.stringify(definition).includes('private history'),false);
 const command={command:'edit-workflow',workflowId:'w',expectedHash:workflowEditHash(workflow),changes:{description:'new',stepChanges:[{id:'s',code:'output=2'}]}};
 const result=await applyWorkflowEdit(host,command);assert.equal(result.definitionHash,workflowEditHash(workflow));
 before.workflows[0].description='new';before.workflows[0].steps[0].code='output=2';assert.deepEqual(settings,before);assert.deepEqual(host.saved,before);
});
test('stale edit rejects without writes and keeps the newer edit',async()=>{const {workflow,host}=fixture(),hash=workflowEditHash(workflow);workflow.description='human edit';await assert.rejects(applyWorkflowEdit(host,{command:'edit-workflow',workflowId:'w',expectedHash:hash,changes:{description:'agent'}}),/conflict/i);assert.equal(workflow.description,'human edit');assert.equal(host.saved,undefined);});
test('active execution rejects before changing the definition',async()=>{const {workflow,host}=fixture();host.assertIdle=()=>{throw Error('execution active');};await assert.rejects(applyWorkflowEdit(host,{command:'edit-workflow',workflowId:'w',expectedHash:workflowEditHash(workflow),changes:{name:'new'}}),/active/);assert.equal(workflow.name,'original');});
test('failed save rolls back only this edit and preserves concurrent human changes',async()=>{const {workflow,host}=fixture();host.save=async()=>{workflow.name='human';throw Error('disk denied');};await assert.rejects(applyWorkflowEdit(host,{command:'edit-workflow',workflowId:'w',expectedHash:workflowEditHash(workflow),changes:{name:'agent',description:'agent'}}),/disk denied/);assert.equal(workflow.name,'human');assert.equal(workflow.description,'old');});
test('unsupported fields, duplicate step patches, missing steps and malformed payloads are rejected',async()=>{for(const changes of [{status:'pending'},{stepChanges:[{id:'s',codeAllowFiles:true}]},{stepChanges:[{id:'s',code:'a'},{id:'s',code:'b'}]},{stepChanges:[{id:'missing',code:'x'}]},{name:10},null]){const {workflow,host}=fixture();await assert.rejects(applyWorkflowEdit(host,{command:'edit-workflow',workflowId:'w',expectedHash:workflowEditHash(workflow),changes}));assert.equal(workflow.name,'original');assert.equal(host.saved,undefined);}assert.equal(validWorkflowEdit({command:'edit-workflow'}),false);});

for(const size of [220000,250000,300000,307200])test('large UTF-8 edit preserves exact content and unrelated fields: '+size,async()=>{
 const {workflow,settings,host}=fixture();workflow.steps[0].connections=['next'];workflow.steps[0].model='preserved';
 const unit='á😀\n"\\',code=unit.repeat(Math.floor(size/Buffer.byteLength(unit)))+'x'.repeat(size%Buffer.byteLength(unit));
 assert.equal(Buffer.byteLength(code),size);const before=JSON.parse(JSON.stringify(settings));
 await applyWorkflowEdit(host,{command:'edit-workflow',workflowId:'w',expectedHash:workflowEditHash(workflow),changes:{stepChanges:[{id:'s',code}]}});
 before.workflows[0].steps[0].code=code;assert.deepEqual(host.saved,before);assert.equal(workflowEditDefinition(workflow).steps[0].code,code);
});
test('serialized changes exact boundary, excess and aggregate count UTF-8 bytes',async()=>{
 const {WORKFLOW_EDIT_MAX_CHANGES_BYTES:max}=load('workflow-edit');const {workflow,host}=fixture();
 const changes={description:''},overhead=Buffer.byteLength(JSON.stringify(changes));changes.description='x'.repeat(max-overhead);
 const command={command:'edit-workflow',workflowId:'w',expectedHash:workflowEditHash(workflow),changes};
 assert.equal(validWorkflowEdit(command),true);await applyWorkflowEdit(host,command);
 changes.description+='x';assert.equal(validWorkflowEdit(command),false);await assert.rejects(applyWorkflowEdit(host,command),/2097153.*2097152/);
 command.changes={description:'á'.repeat(max/4),stepChanges:[{id:'s',code:'x'.repeat(max/2)}]};assert.equal(validWorkflowEdit(command),false);
});
test('large edit stale hash and save failure preserve definition',async()=>{
 const {workflow,host}=fixture(),hash=workflowEditHash(workflow),command={command:'edit-workflow',workflowId:'w',expectedHash:hash,changes:{stepChanges:[{id:'s',code:'x'.repeat(307200)}]}};
 host.save=async()=>{throw Error('disk denied');};await assert.rejects(applyWorkflowEdit(host,command),/disk denied/);assert.equal(workflowEditHash(workflow),hash);
 workflow.name='newer';await assert.rejects(applyWorkflowEdit(host,command),/conflict/);assert.equal(workflow.steps[0].code,'output=1');
});

test('packaged CLI exports and edits a 300 KiB step through a live owner',async t=>{
 const os=require('node:os'),{spawn,spawnSync}=require('node:child_process');
 const vault=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-large-edit-')),install=path.join(vault,'.obsidian/plugins/auto-oc');fs.mkdirSync(install,{recursive:true});
 for(const file of ['main.js','manifest.json','styles.css','autooc-cli.cjs','autooc-runtime.cjs','release-integrity.json','skills/autooc-runtime/SKILL.md']){const target=path.join(install,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.resolve(__dirname,'..',file),target);}
 const {workflow,settings,host}=fixture(),config=path.join(install,'data.json');fs.writeFileSync(config,JSON.stringify(settings));
 host.save=async validate=>{validate();fs.writeFileSync(config,JSON.stringify(settings));};
 const {acquireExecutionLease}=load('execution-lease'),{createPluginRequestHost}=load('cli-plugin-requests');
 const runtime=path.join(install,'runtime');fs.mkdirSync(runtime);const lease=acquireExecutionLease(runtime),owner=createPluginRequestHost(lease,async()=>{throw Error('no execution');},c=>applyWorkflowEdit(host,c));
 const timer=setInterval(()=>void owner.poll(),10);t.after(async()=>{clearInterval(timer);owner.close();await owner.drain();lease.release();assert.equal(path.dirname(fs.realpathSync(vault)),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(vault).startsWith('autooc-large-edit-'));fs.rmSync(vault,{recursive:true,force:true});});
 const cli=path.join(install,'autooc-cli.cjs'),out=path.join(vault,'export.json');
 const exported=spawnSync(process.execPath,[cli,'export-workflow','--vault',vault,'--workflow','w','--out',out],{encoding:'utf8',windowsHide:true});assert.equal(exported.status,0,exported.stderr);
 const code='á'.repeat(153600),patch=path.join(vault,'patch.json');fs.writeFileSync(patch,JSON.stringify({expectedHash:workflowEditHash(workflow),changes:{stepChanges:[{id:'s',code}]}}));
 const result=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,[cli,'edit-workflow','--vault',vault,'--workflow','w','--patch',patch],{windowsHide:true});let stdout='',stderr='';child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);child.on('error',reject);child.on('close',status=>resolve({status,stdout,stderr}));});
 assert.equal(result.status,0,result.stderr);assert.equal(JSON.parse(fs.readFileSync(config)).workflows[0].steps[0].code,code);
 const again=spawnSync(process.execPath,[cli,'export-workflow','--vault',vault,'--workflow','w','--out',path.join(vault,'after.json')],{encoding:'utf8',windowsHide:true});assert.equal(again.status,0,again.stderr);assert.equal(JSON.parse(again.stdout).expectedHash,workflowEditHash(workflow));
 fs.writeFileSync(patch,' '.repeat(3*1024*1024+1));const excess=spawnSync(process.execPath,[cli,'edit-workflow','--vault',vault,'--workflow','w','--patch',patch],{encoding:'utf8',windowsHide:true});assert.equal(excess.status,1);assert.match(excess.stderr,/3145729.*3145728/);
});
