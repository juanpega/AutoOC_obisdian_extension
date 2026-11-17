const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
function load(name){const file=path.resolve(__dirname,'..',name+'.ts'),mod=new Module(file,module);mod.filename=file;mod.paths=module.paths;mod.require=id=>id.startsWith('.')?load(id):require(id);mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,file);return mod.exports;}

const {taskEditDefinition,taskEditHash,applyTaskEdit,validTaskEdit}=load('task-edit');
function fixture(){const task={id:'t',name:'original',prompt:'old',model:'keep',status:'completed',output:'private',runtimeExecution:{runId:'old'}};const settings={tasks:[task,{id:'other',name:'keep'}],workflows:[{id:'w',steps:[{id:'s',taskId:'t'}]}]};let saved;return {task,settings,host:{settings,assertIdle(){},async save(validate){validate();saved=JSON.parse(JSON.stringify(settings));},get saved(){return saved;}}};}
function command(task,changes={prompt:'new'}){return {command:'edit-task',taskId:task.id,expectedHash:taskEditHash(task),changes};}
test('task edit preserves references, identity, configuration and history',async()=>{const {task,settings,host}=fixture(),before=JSON.parse(JSON.stringify(settings));assert.deepEqual(Object.keys(taskEditDefinition(task)),['id','name','prompt']);await applyTaskEdit(host,command(task,{name:'renamed',prompt:'new'}));before.tasks[0].name='renamed';before.tasks[0].prompt='new';assert.deepEqual(settings,before);assert.deepEqual(host.saved,before);});
test('stale hash, activity and ambiguous identities reject without writes',async()=>{for(const kind of ['hash','active','missing','duplicate']){const {task,settings,host}=fixture(),c=command(task);if(kind==='hash')task.prompt='human';if(kind==='active')host.assertIdle=()=>{throw Error('active');};if(kind==='missing')settings.tasks=[];if(kind==='duplicate')settings.tasks.push({...task});await assert.rejects(applyTaskEdit(host,c));assert.equal(host.saved,undefined);}});
test('task rollback preserves concurrent human edits',async()=>{const {task,host}=fixture();host.save=async()=>{task.name='human';throw Error('disk');};await assert.rejects(applyTaskEdit(host,command(task,{name:'agent',prompt:'agent'})),/disk/);assert.equal(task.name,'human');assert.equal(task.prompt,'old');});
test('task validation rejects unsupported fields and selectors',()=>{const {task}=fixture();for(const changes of [{id:'other'},{model:'new'},{status:'pending'},{name:''},{prompt:1},{},[],{code:'x'}])assert.equal(validTaskEdit(command(task,changes)),false);for(const key of ['workflowId','pageId','runId','stepId'])assert.equal(validTaskEdit({...command(task),[key]:'x'}),false);assert.equal(validTaskEdit(command(task,{prompt:''})),true);});
test('task changes enforce serialized UTF-8 size boundary',()=>{const {task}=fixture();const c=command(task,{prompt:''});c.changes.prompt='x'.repeat(2097152-Buffer.byteLength(JSON.stringify(c.changes)));assert.equal(validTaskEdit(c),true);c.changes.prompt+='x';assert.equal(validTaskEdit(c),false);});
test('older owner rejects task editing before publishing a request',async t=>{
 const os=require('os'),{acquireExecutionLease}=load('execution-lease');
 const {createPluginRequestHost,requestPluginTaskEdit}=load('cli-plugin-requests');
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-task-owner-')),lease=acquireExecutionLease(root);
 const owner=createPluginRequestHost(lease,async()=>{throw Error('must not execute');},async()=>({workflowId:'w',definitionHash:'a'.repeat(64)}));
 t.after(async()=>{owner.close();await owner.drain();lease.release();fs.rmSync(root,{recursive:true,force:true});});
 const {task}=fixture();await assert.rejects(requestPluginTaskEdit(root,command(task)),/does not support task editing/);
 assert.equal(fs.readdirSync(path.join(root,'cli-'+lease.token)).some(file=>file.endsWith('.request')),false);
});
test('packaged CLI exports and edits a 300 KiB step through a live owner',async t=>{
 const os=require('node:os'),{spawn,spawnSync}=require('node:child_process');
 const vault=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-large-edit-')),install=path.join(vault,'.obsidian/plugins/auto-oc');fs.mkdirSync(install,{recursive:true});
 for(const file of ['main.js','manifest.json','styles.css','autooc-cli.cjs','autooc-runtime.cjs','release-integrity.json','skills/autooc-runtime/SKILL.md']){const target=path.join(install,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.resolve(__dirname,'..',file),target);}
 const {task,settings,host}=fixture(),config=path.join(install,'data.json');fs.writeFileSync(config,JSON.stringify(settings));
 host.save=async validate=>{validate();fs.writeFileSync(config,JSON.stringify(settings));};
 const {acquireExecutionLease}=load('execution-lease'),{createPluginRequestHost}=load('cli-plugin-requests');
 const runtime=path.join(install,'runtime');fs.mkdirSync(runtime);const lease=acquireExecutionLease(runtime),owner=createPluginRequestHost(lease,async()=>{throw Error('no execution');},undefined,()=>({}),{editTask:c=>applyTaskEdit(host,c)});
 const timer=setInterval(()=>void owner.poll(),10);t.after(async()=>{clearInterval(timer);owner.close();await owner.drain();lease.release();assert.equal(path.dirname(fs.realpathSync(vault)),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(vault).startsWith('autooc-large-edit-'));fs.rmSync(vault,{recursive:true,force:true});});
 const cli=path.join(install,'autooc-cli.cjs'),out=path.join(vault,'export.json');
 const exported=spawnSync(process.execPath,[cli,'export-task','--vault',vault,'--task','t','--out',out],{encoding:'utf8',windowsHide:true});assert.equal(exported.status,0,exported.stderr);
 const code='á'.repeat(153600),patch=path.join(vault,'patch.json');fs.writeFileSync(patch,JSON.stringify({expectedHash:taskEditHash(task),changes:{prompt:code}}));
 const result=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,[cli,'edit-task','--vault',vault,'--task','t','--patch',patch],{windowsHide:true});let stdout='',stderr='';child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);child.on('error',reject);child.on('close',status=>resolve({status,stdout,stderr}));});
 assert.equal(result.status,0,result.stderr);assert.equal(JSON.parse(fs.readFileSync(config)).tasks[0].prompt,code);
 const again=spawnSync(process.execPath,[cli,'export-task','--vault',vault,'--task','t','--out',path.join(vault,'after.json')],{encoding:'utf8',windowsHide:true});assert.equal(again.status,0,again.stderr);assert.equal(JSON.parse(again.stdout).expectedHash,taskEditHash(task));
 fs.writeFileSync(patch,' '.repeat(3*1024*1024+1));const excess=spawnSync(process.execPath,[cli,'edit-task','--vault',vault,'--task','t','--patch',patch],{encoding:'utf8',windowsHide:true});assert.equal(excess.status,1);assert.match(excess.stderr,/3145729.*3145728/);
});
