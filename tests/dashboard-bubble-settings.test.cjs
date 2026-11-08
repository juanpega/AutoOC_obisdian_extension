const {test} = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');

function renderer() {
  const api = {};
  const source = ts.transpileModule(fs.readFileSync(require.resolve('../dashboard-areas.ts'), 'utf8'),
    {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  vm.runInNewContext(source, {exports:api,require(id) {
    if (id === 'obsidian') return {setIcon() {}};
    if (id === './catalog-availability' || id === './workflow-code-step' || id === './execution-status-help') return {};
    throw Error(id);
  }});
  const dashboard = Object.create(api.AreaDashboard.prototype);
  dashboard.previous = new Map();
  dashboard.host = {get diameter() {throw Error('Retired size preference must not be consulted');}};
  return dashboard;
}

test('task and step bubbles remain fixed at 30 px regardless of historical preferences', () => {
  const dashboard = renderer();
  for (const kind of ['task','code','delay']) {
    const bubble = {style:{},setAttr() {},setText(value) {this.text=value;}};
    dashboard.orb({createSpan:()=>bubble},{kind,key:kind,status:'pending'});
    assert.equal(bubble.style.width,'30px');assert.equal(bubble.style.height,'30px');
    assert.equal(bubble.style.fontSize,undefined,'Do not scale labels with the bubble');
    if(kind === 'code')assert.equal(bubble.text,'{ }');
  }
});

test('workflow bubbles keep their existing 36 px double-ring presentation', () => {
  const dashboard = renderer(), bubble = {style:{},setAttr() {}};
  dashboard.orb({createSpan:()=>bubble},{kind:'workflow',key:'workflow',status:'pending'});
  assert.equal(bubble.style.width,'36px');assert.equal(bubble.style.height,'36px');
});
