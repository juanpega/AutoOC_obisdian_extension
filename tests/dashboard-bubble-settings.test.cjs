const {test} = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
class Element {
  constructor(tag='div', options={}) {this.tag=tag;this.text=options.text||'';this.children=[];this.style={};this.attrs={};this.value='';}
  createEl(tag, options) {const child=new Element(tag,options);this.children.push(child);return child;}
  createDiv(options) {return this.createEl('div',options);}
  createSpan(options) {return this.createEl('span',options);}
  setText(text) {this.text=text;}
  setAttribute(key,value) {this.attrs[key]=value;}
  addEventListener(key,handler) {this[key]=handler;}
  all() {return [this,...this.children.flatMap(child=>child.all())];}
}
class Setting {
  constructor(parent) {this.root=parent.createDiv();}
  setName() {return this;} setDesc() {return this;}
  addText(callback) {const el=this.root.createEl('input');callback({inputEl:el,setValue(v){el.value=v;return this;},onChange(fn){el.change=fn;return this;}});return this;}
  addButton(callback) {const el=this.root.createEl('button');callback({buttonEl:el,setButtonText(v){el.text=v;return this;},setCta(){return this;},onClick(fn){el.click=fn;return this;}});return this;}
}
const api={}, localValues=new Map();
vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../dashboard-bubble-settings.ts'),'utf8'),
  {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,
  {exports:api,require:()=>({Setting}),localStorage:{getItem:key=>localValues.get(key),setItem:(key,value)=>localValues.set(key,value)}});

test('precise diameters preserve all legacy sizes and reject invalid persisted values',()=>{
  for(const [preset,size] of Object.entries({sm:24,md:30,lg:38,xl:48})) assert.equal(api.dashboardTaskDiameter({dashboardTaskBubbleSize:preset}),size);
  assert.equal(api.dashboardTaskDiameter({dashboardTaskBubbleSize:'sm',dashboardTaskBubbleDiameter:37}),37);
  for(const value of [null,'37',NaN,Infinity,0,9,81,37.5]) assert.equal(api.dashboardTaskDiameter({dashboardTaskBubbleSize:'lg',dashboardTaskBubbleDiameter:value}),38);
  for(const value of [10,16,80]) assert.equal(api.dashboardTaskDiameter({dashboardTaskBubbleDiameter:value}),value);
  assert.equal(api.dashboardTaskDiameter({}),30);
  assert.equal(api.dashboardTaskDiameter({dashboardTaskBubbleSize:'toString'}),30);
});

test('preview does not save; Apply uses exact pixels, failed save rolls back, Reset restores 30',async()=>{
  const root=new Element();
  let writes=0, fail=false, diameter=48, applied;
  api.addDashboardBubbleSizeSetting(root,{getDiameter:()=>diameter,async saveDiameter(value){writes++;if(fail)throw Error('save failed');diameter=value;},applyDiameter:value=>applied=value});
  const input=root.all().find(el=>el.tag==='input');
  const button=name=>root.all().find(el=>el.tag==='button'&&el.text===name);
  const enter=value=>{input.value=value;input.change();};
  assert.equal(input.value,'48');
  for(const invalid of ['', '0','81','30.5']) {enter(invalid);assert.equal(button('Apply').disabled,true);await button('Apply').click();}
  assert.equal(writes,0);
  enter('37');assert.ok(root.all().some(el=>el.style.width==='37px'));
  assert.equal(diameter,48);assert.equal(writes,0);
  await button('Apply').click();assert.equal(diameter,37);assert.equal(writes,1);assert.equal(applied,37);
  fail=true;enter('42');await button('Apply').click();assert.equal(diameter,37);assert.equal(applied,37);
  assert.equal(button('Apply').disabled,false);assert.ok(root.all().some(el=>el.text.includes('Could not save')));
  fail=false;await button('Reset to default').click();assert.equal(input.value,'30');assert.equal(diameter,30);
  enter('10');await button('Apply').click();assert.equal(diameter,10);assert.equal(applied,10);
});

test('visual preference persists independently of catalog size, activity and old settings',()=>{
  const saved=new Map(), app={vault:{configDir:'.obsidian'},loadLocalStorage:key=>saved.get(key),saveLocalStorage:(key,value)=>saved.set(key,value)};
  const legacy={dashboardTaskBubbleDiameter:16,get tasks(){throw Error('must not read catalog');},get workflows(){throw Error('must not read history');}};
  assert.equal(api.loadDashboardBubbleDiameter(app,'auto-oc',legacy),16);
  api.saveDashboardBubbleDiameter(app,'auto-oc',10);
  assert.equal(api.loadDashboardBubbleDiameter(app,'auto-oc',legacy),10);
  assert.equal(legacy.dashboardTaskBubbleDiameter,16);
  assert.equal(JSON.stringify([...saved.values()]),'[10]');
  assert.throws(()=>api.saveDashboardBubbleDiameter(app,'auto-oc',9));
  assert.equal(api.loadDashboardBubbleDiameter({...app,vault:{configDir:'.other'}},'auto-oc',legacy),16);
  app.saveLocalStorage=()=>{throw Error('quota');};
  assert.throws(()=>api.saveDashboardBubbleDiameter(app,'auto-oc',20));
  assert.equal(api.loadDashboardBubbleDiameter(app,'auto-oc',legacy),10);
});

test('pre-1.8.7 fallback isolates vaults and installations',()=>{
  const app={vault:{configDir:'.obsidian',adapter:{basePath:'C:/vault-a'}}};
  api.saveDashboardBubbleDiameter(app,'auto-oc',10);
  assert.equal(api.loadDashboardBubbleDiameter(app,'auto-oc',{}),10);
  assert.equal(api.loadDashboardBubbleDiameter({...app,vault:{...app.vault,adapter:{basePath:'C:/vault-b'}}},'auto-oc',{}),30);
});

test('size updates only existing bubbles without reconstructing the panel or reading history',()=>{
  const bubbles=[{style:{left:'20%',top:'30%'}},{style:{left:'40%',top:'50%'}}];
  const root={querySelectorAll(selector){assert.equal(selector,'.auto-oc-dashboard-task-bubble');return bubbles;},empty(){throw Error('must not rebuild');}};
  api.applyDashboardBubbleDiameter(root,10);
  for(const bubble of bubbles) {assert.equal(bubble.style.width,'10px');assert.equal(bubble.style.height,'10px');}
  assert.equal(bubbles[0].style.left,'20%');assert.equal(bubbles[1].style.top,'50%');
});

test('pending save gives feedback and rejects duplicate submissions until completion',async()=>{
  const root=new Element();let finish, writes=0, diameter=16;
  api.addDashboardBubbleSizeSetting(root,{getDiameter:()=>diameter,saveDiameter(value){writes++;return new Promise(resolve=>{finish=()=>{diameter=value;resolve();};});},applyDiameter(){}});
  const input=root.all().find(el=>el.tag==='input'), apply=root.all().find(el=>el.text==='Apply');
  input.value='10';input.change();const pending=apply.click();
  assert.equal(apply.text,'Saving…');assert.equal(input.disabled,true);
  assert.ok(root.all().some(el=>el.text==='Saving size…'));
  await apply.click();assert.equal(writes,1);finish();await pending;
  assert.equal(apply.text,'Apply');assert.equal(input.disabled,false);
  assert.ok(root.all().some(el=>el.text==='Saved: 10 px'));
});
