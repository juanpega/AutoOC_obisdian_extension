const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),Module=require('node:module');
const {transformSync}=require('esbuild');
const root=path.resolve(__dirname,'..');
function source(name,obsidian){
  const file=path.join(root,name),m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(root);
  const original=m.require.bind(m);m.require=n=>n==='obsidian'?obsidian:original(n);
  m._compile(transformSync(fs.readFileSync(file,'utf8'),{loader:'ts',format:'cjs'}).code,file);return m.exports;
}
const {LegacyOutputRedaction}=source('legacy-output-redaction.ts');
const decoder={decryptString:b=>b.toString()};
function fixture(t){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-legacy-notice-'));
  t.after(()=>{assert.equal(path.dirname(fs.realpathSync(dir)),fs.realpathSync(os.tmpdir()));assert.match(path.basename(dir),/^autooc-legacy-notice-/);fs.rmSync(dir,{recursive:true,force:true});});
  const file=path.join(dir,'secrets.vault.json'),preferences=new Map(),warnings=[];
  const storage={getItem:key=>preferences.get(key)??null,setItem:(key,value)=>preferences.set(key,value)};
  const create=()=>new LegacyOutputRedaction(()=>warnings.push('fixed message'),storage);
  const write=(values=['synthetic-secret'])=>{const bytes=JSON.stringify({schemaVersion:1,pin:{hash:'preserved'},secrets:values.map(v=>({encryptedValue:Buffer.from(v).toString('base64')}))});fs.writeFileSync(file,bytes);return bytes;};
  return {dir,file,preferences,storage,warnings,create,write};
}
test('repeated reloads warn once and acknowledging the exact issue persists without changing the historical file',t=>{
  const f=fixture(t),bytes=f.write(),r=f.create();
  r.load(f.file,null);r.load(f.file,null);assert.equal(f.warnings.length,1);
  assert.deepEqual(Object.keys(r.getIssue()).sort(),['acknowledged','dismissible','id','reason']);
  r.acknowledge(r.getIssue().id);assert.equal(r.getIssue().acknowledged,true);
  const reopened=f.create();reopened.load(f.file,null);assert.equal(f.warnings.length,1);assert.equal(reopened.getIssue().acknowledged,true);
  assert.equal(fs.readFileSync(f.file,'utf8'),bytes);assert.doesNotMatch(JSON.stringify([...f.preferences]),/synthetic-secret|encryptedValue/);
});
test('changed bytes, reason or installation require another review; successful retry still restores masking',t=>{
  const f=fixture(t);f.write();const r=f.create();r.load(f.file,null);r.acknowledge(r.getIssue().id);
  f.write(['different-synthetic-secret']);r.load(f.file,null);assert.equal(r.getIssue().acknowledged,false);assert.equal(f.warnings.length,2);
  r.acknowledge(r.getIssue().id);r.load(f.file,{decryptString(){throw Error('private diagnostic');}});assert.equal(r.getIssue().reason,'decryption-failed');assert.equal(r.getIssue().acknowledged,false);
  r.load(f.file,decoder);assert.equal(r.getIssue(),undefined);assert.equal(r.redact('different-synthetic-secret'),'[secret:redacted]');
  const other=path.join(f.dir,'other.json');fs.copyFileSync(f.file,other);r.load(other,null);assert.equal(r.getIssue().acknowledged,false);
  assert.equal(r.redact('different-synthetic-secret'),'different-synthetic-secret','never reuse another installation\'s values');
});
test('partial decryption, unavailable secure storage and malformed JSON retain already known masks',t=>{
  const f=fixture(t);f.write(['synthetic-one','synthetic-two']);const r=f.create();r.load(f.file,decoder);
  r.load(f.file,{decryptString:b=>{if(b.toString()==='synthetic-two')throw Error('private');return b.toString();}});
  assert.equal(r.redact('synthetic-one synthetic-two'),'[secret:redacted] [secret:redacted]');
  r.load(f.file,null);assert.equal(r.redact('synthetic-two'),'[secret:redacted]');
  fs.writeFileSync(f.file,'{broken: sensitive-diagnostic');r.load(f.file,decoder);assert.equal(r.getIssue().reason,'invalid-store');assert.equal(r.redact('synthetic-two'),'[secret:redacted]');
  assert.doesNotMatch(JSON.stringify(r.getIssue()),/synthetic|sensitive-diagnostic/);
  f.write(['replacement-value']);r.load(f.file,decoder);assert.equal(r.redact('synthetic-two replacement-value'),'synthetic-two [secret:redacted]');
});
test('acknowledgment rejects stale dialogs and unavailable preference storage',t=>{
  const f=fixture(t);f.write();const r=f.create();r.load(f.file,null);const id=r.getIssue().id;
  f.write(['changed-value']);assert.throws(()=>r.acknowledge(id),/changed/);assert.equal(f.preferences.size,0);
  r.load(f.file,null);assert.throws(()=>r.acknowledge(id),/changed/);
  const broken=new LegacyOutputRedaction(()=>{},{getItem(){return null;},setItem(){throw Error('sensitive-storage-error');}});broken.load(f.file,null);
  assert.throws(()=>broken.acknowledge(broken.getIssue().id),error=>/Could not save/.test(error.message)&&!error.message.includes('sensitive-storage-error'));
  assert.equal(broken.getIssue().acknowledged,false);
});
test('read errors cannot be acknowledged; missing and empty stores need no warning',t=>{
  const f=fixture(t),r=f.create();r.load(f.file,null);assert.equal(r.getIssue(),undefined);
  f.write([]);r.load(f.file,null);assert.equal(r.getIssue(),undefined);
  r.load(f.dir,null);assert.equal(r.getIssue().reason,'unreadable-store');assert.equal(r.getIssue().dismissible,false);assert.throws(()=>r.acknowledge(r.getIssue().id),/changed/);
});
class Element {
  constructor(){this.children=[];this.buttons=[];}
  empty(){this.children=[];this.buttons=[];}
  createEl(tag,options){this.children.push(options.text);return new Element();}
}
const {LegacyCredentialNoticeModal}=source('legacy-credential-notice.ts',{
  Modal:class{constructor(){this.contentEl=new Element();}close(){this.closed=true;this.onClose();}},
  Setting:class{constructor(root){this.root=root;this.settingEl={style:{}};this.controlEl={style:{}};}addButton(setup){const b={setButtonText(value){this.text=value;return this;},setDisabled(value){this.disabled=value;return this;},onClick(fn){this.click=fn;return this;}};setup(b);this.root.buttons.push(b);return this;}}
});
test('review dialog exposes retry and dismissal, accurately reports masking remains incomplete and preserves bytes',t=>{
  const f=fixture(t),bytes=f.write(),r=f.create();let available=null,closed=0;
  const modal=new LegacyCredentialNoticeModal({}, {review:()=>{r.load(f.file,available,false);return r.getIssue();},acknowledge:id=>r.acknowledge(id),onClosed:()=>closed++});
  modal.onOpen();assert.match(modal.contentEl.children.join(' '),/does not block task execution/);
  modal.contentEl.buttons.find(b=>b.text==='Keep file and dismiss reminder').click();
  assert.equal(r.getIssue().acknowledged,true);assert.match(modal.contentEl.children.join(' '),/still unavailable/);assert.equal(f.warnings.length,0);
  available=decoder;modal.contentEl.buttons.find(b=>b.text==='Try reading again').click();assert.match(modal.contentEl.children.join(' '),/No legacy credential issue/);
  assert.equal(r.redact('synthetic-secret'),'[secret:redacted]');assert.equal(fs.readFileSync(f.file,'utf8'),bytes);
  modal.contentEl.buttons.find(b=>b.text==='Close').click();assert.equal(closed,1);
});
test('review reports preference failures without leaking exceptions or claiming success',()=>{
  const modal=new LegacyCredentialNoticeModal({}, {review:()=>({id:'current',reason:'decryption-failed',acknowledged:false,dismissible:true}),acknowledge(){throw Error('private error');}});
  modal.onOpen();modal.contentEl.buttons.find(b=>b.text==='Keep file and dismiss reminder').click();
  assert.match(modal.contentEl.children.join(' '),/could not be saved/);assert.doesNotMatch(modal.contentEl.children.join(' '),/private error|preference saved/);
});
