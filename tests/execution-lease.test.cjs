const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
const file=path.resolve(__dirname,'../execution-lease.ts');
const mod=new Module(file,module);mod.filename=file;mod.paths=Module._nodeModulePaths(path.dirname(file));
mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,file);
const {acquireExecutionLease:acquire}=mod.exports;

test('explicit recovery archives a confirmed dead owner and preserves evidence; live owners cannot be recovered',()=>{
  const {spawnSync}=require('node:child_process');
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-lease-recovery-'));
  try {
    const live=acquire(dir);
    assert.throws(()=>mod.exports.recoverExecutionLease(dir,live.token),/live or cannot/);
    live.assertOwned();live.release();
    const child=spawnSync(process.execPath,['-e',`const fs=require('fs'),path=require('path'),crypto=require('crypto');const root=process.argv[1];fs.mkdirSync(path.join(root,'execution.lock'));fs.writeFileSync(path.join(root,'execution.lock','owner.json'),JSON.stringify({schemaVersion:1,token:crypto.randomUUID(),pid:process.pid,createdAt:new Date().toISOString()}));` ,dir],{encoding:'utf8'});
    assert.equal(child.status,0,child.stderr);
    const owner=mod.exports.readExecutionLeaseOwner(dir);
    const original=fs.readFileSync(path.join(dir,'execution.lock','owner.json'),'utf8');
    assert.throws(()=>mod.exports.recoverExecutionLease(dir,'wrong'),/identity changed/);
    const recovered=mod.exports.recoverExecutionLease(dir,owner.token);
    assert.equal(recovered.executionsResumed,false);
    assert.equal(fs.readFileSync(path.join(dir,recovered.archived,'owner.json'),'utf8'),original);
    const next=acquire(dir);next.release();
    assert.throws(()=>mod.exports.recoverExecutionLease(dir,owner.token));
  } finally {
    assert.equal(path.dirname(fs.realpathSync(dir)),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(dir).startsWith('autooc-lease-recovery-'));
    fs.rmSync(dir,{recursive:true});
  }
});

test('exclusive lease rejects a second owner and permits access after release',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-lease-'));
  try {
    const first=acquire(dir);first.assertOwned();
    assert.throws(()=>acquire(dir),/EEXIST/);
    first.release();assert.throws(()=>first.assertOwned(),/released/);
    const second=acquire(dir);assert.notEqual(second.token,first.token);second.release();
  } finally {fs.rmdirSync(dir);}
});
test('incomplete or abandoned ownership is not silently removed',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-lease-'));
  const lock=path.join(dir,'execution.lock');fs.mkdirSync(lock);
  try {assert.throws(()=>acquire(dir),/EEXIST/);assert.ok(fs.existsSync(lock));}
  finally {fs.rmdirSync(lock);fs.rmdirSync(dir);}
});
test('a changed owner cannot be released by an old handle',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-lease-'));
  const lease=acquire(dir),owner=path.join(dir,'execution.lock','owner.json');
  const before=fs.readFileSync(owner,'utf8');
  try {
    fs.writeFileSync(owner,JSON.stringify({schemaVersion:1,pid:process.pid,token:'other'}));
    assert.throws(()=>lease.release(),/ownership changed/);
    assert.equal(JSON.parse(fs.readFileSync(owner)).token,'other');
  } finally {fs.writeFileSync(owner,before);lease.release();fs.rmdirSync(dir);}
});

test('recovery proof runs under exclusion, rejects unverifiable PID and rechecks identity',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-lease-proof-'));
  t.after(()=>{
    assert.equal(path.dirname(fs.realpathSync(dir)),fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(dir).startsWith('autooc-lease-proof-'));fs.rmSync(dir,{recursive:true});
  });
  const {spawnSync}=require('node:child_process');
  const child=spawnSync(process.execPath,['-e',`require(${JSON.stringify(path.resolve(__dirname,'../autooc-runtime.cjs'))}).acquireExecutionLease(process.argv[1])`,dir],{encoding:'utf8'});
  assert.equal(child.status,0,child.stderr);
  const owner=mod.exports.readExecutionLeaseOwner(dir),ownerPath=path.join(dir,'execution.lock/owner.json');
  const bytes=fs.readFileSync(ownerPath);const kill=process.kill;
  try {
    process.kill=()=>{throw Object.assign(Error('unverifiable'),{code:'EPERM'});};
    assert.throws(()=>mod.exports.recoverExecutionLease(dir,owner.token,()=>assert.fail('proof must not run')),/live or cannot/);
  }finally{process.kill=kill;}
  assert.deepEqual(fs.readFileSync(ownerPath),bytes);
  assert.throws(()=>mod.exports.recoverExecutionLease(dir,owner.token,()=>{
    assert.throws(()=>acquire(dir),/recovery is in progress/);
    assert.throws(()=>mod.exports.recoverExecutionLease(dir,owner.token),{code:'EEXIST'});
    throw Error('uncertain journal');
  }),/uncertain journal/);
  assert.deepEqual(fs.readFileSync(ownerPath),bytes);
  assert.throws(()=>mod.exports.recoverExecutionLease(dir,owner.token,()=>{
    fs.writeFileSync(ownerPath,JSON.stringify({...owner,token:require('crypto').randomUUID()}));
  }),/changed during recovery/);
  assert.ok(fs.existsSync(path.join(dir,'execution.lock')));
  assert.ok(!fs.existsSync(path.join(dir,`abandoned-lease-${owner.token}`)));
});
