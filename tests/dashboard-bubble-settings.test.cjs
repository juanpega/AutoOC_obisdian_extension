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
const api={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../dashboard-bubble-settings.ts'),'utf8'),
  {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,
  {exports:api,require:()=>({Setting})});

test('precise diameters preserve all legacy sizes and reject invalid persisted values',()=>{
  for(const [preset,size] of Object.entries({sm:24,md:30,lg:38,xl:48})) assert.equal(api.dashboardTaskDiameter({dashboardTaskBubbleSize:preset}),size);
  assert.equal(api.dashboardTaskDiameter({dashboardTaskBubbleSize:'sm',dashboardTaskBubbleDiameter:37}),37);
  for(const value of [null,'37',NaN,Infinity,0,15,81,37.5]) assert.equal(api.dashboardTaskDiameter({dashboardTaskBubbleSize:'lg',dashboardTaskBubbleDiameter:value}),38);
  assert.equal(api.dashboardTaskDiameter({}),30);
  assert.equal(api.dashboardTaskDiameter({dashboardTaskBubbleSize:'toString'}),30);
});

test('preview does not save; Apply uses exact pixels, failed save rolls back, Reset restores 30',async()=>{
  const root=new Element(), settings={dashboardTaskBubbleSize:'xl',tasks:[{id:'keep',output:'keep'}]};
  let writes=0, fail=false;
  api.addDashboardBubbleSizeSetting(root,{settings,async saveSettings(){writes++;if(fail)throw Error('save failed');}});
  const input=root.all().find(el=>el.tag==='input');
  const button=name=>root.all().find(el=>el.tag==='button'&&el.text===name);
  const enter=value=>{input.value=value;input.change();};
  assert.equal(input.value,'48');
  for(const invalid of ['', '0','81','30.5']) {enter(invalid);assert.equal(button('Apply').disabled,true);await button('Apply').click();}
  assert.equal(writes,0);
  enter('37');assert.ok(root.all().some(el=>el.style.width==='37px'));
  assert.equal(settings.dashboardTaskBubbleDiameter,undefined);assert.equal(writes,0);
  await button('Apply').click();assert.equal(settings.dashboardTaskBubbleDiameter,37);assert.equal(writes,1);
  fail=true;enter('42');await button('Apply').click();assert.equal(settings.dashboardTaskBubbleDiameter,37);
  assert.equal(button('Apply').disabled,false);assert.ok(root.all().some(el=>el.text.includes('Could not save')));
  fail=false;await button('Reset to default').click();assert.equal(input.value,'30');assert.equal(settings.dashboardTaskBubbleDiameter,30);
  assert.deepEqual(settings.tasks,[{id:'keep',output:'keep'}]);
});
