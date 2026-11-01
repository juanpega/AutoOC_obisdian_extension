const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');

function harness(overrides = {}) {
  class Element {
    constructor(options = {}) { this.textContent = options.text || ''; this.children = []; this.style = {}; this.attrs = options.attr || {}; this.dataset = {}; this.value = ''; }
    createEl(tag, options = {}) { const el = new Element(options); el.tag = tag; this.children.push(el); return el; }
    createDiv(options) { return this.createEl('div', options); }
    createSpan(options) { return this.createEl('span', options); }
    empty() { this.children = []; }
    setText(value) { this.textContent = value; }
    addClass() {} removeClass() {} toggleClass() {} addEventListener() {} focus() {} select() {}
    setAttr(key, value) { this.attrs[key] = value; }
    setAttribute(key, value) { this.attrs[key] = value; }
    all() { return [this, ...this.children.flatMap(child => child.all())]; }
  }
  class Control {
    constructor(el) { this.inputEl = this.selectEl = this.buttonEl = el; }
    setValue(value) { this.inputEl.value = value; return this; }
    setButtonText(value) { this.buttonEl.textContent = value; return this; }
    setDisabled(value) { this.buttonEl.disabled = value; return this; }
    addOption(value, label) { const option=this.selectEl.createEl('option',{text:label});option.value=value;return this; }
    setCta() { return this; } setPlaceholder() { return this; } addOptions() { return this; } setTooltip() { return this; }
    onChange(callback) { this.inputEl.change = callback; return this; }
    onClick(callback) { this.buttonEl.onclick = callback; return this; }
  }
  class Setting {
    constructor(parent) { this.settingEl = parent.createDiv(); this.controlEl = this.settingEl; this.infoEl = this.settingEl; }
    setName(name) { this.settingEl.name = name; return this; } setDesc() { return this; } setHeading() { return this; }
    add(tag, callback) { callback(new Control(this.settingEl.createEl(tag))); return this; }
    addTextArea(cb) { return this.add('textarea', cb); } addText(cb) { return this.add('input', cb); }
    addDropdown(cb) { return this.add('select', cb); } addToggle(cb) { return this.add('input', cb); }
    addButton(cb) { return this.add('button', cb); }
  }
  const opened = [], notices = [], module = { exports: {} };
  class Stub {}
  const obsidian = { Plugin: Stub, ItemView: Stub, PluginSettingTab: Stub, Setting,
    Notice: class { constructor(message) { notices.push(message); } },
    Modal: class { constructor(app) { this.app = app; this.contentEl = new Element(); } open() { opened.push(this); this.onOpen(); } close() { this.onClose(); } },
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../main.js'), 'utf8') +
    '\nmodule.exports.draftTest = {AiDraftModal, CreateTaskModal, CreateWorkflowModal, buildDraftPrompt, parseGeneratedDraft, saveGeneratedDefinition, generateDraftText, toExportTask, AUTOOC_WORKFLOW_PROMPT, openAiDraft: AutoOCPlugin.prototype.openAiDraft};',
    { module, exports: module.exports, require: id => id === 'obsidian' ? obsidian : overrides[id] || require(id),
      process: overrides.process || process, Buffer, console, setTimeout, clearTimeout, setInterval, clearInterval, AbortController,
      window: { setTimeout, clearTimeout }, document: { createTextNode: text => new Element({ text }) } });
  const api = module.exports.draftTest;
  const plugin = new module.exports.default();
  plugin.app = { vault: { adapter: {} } };
  plugin.manifest = { version: '1.7.2' };
  plugin.settings = { tasks: [], workflows: [], defaultAiEngine: 'codex', defaultCodexModel: '', defaultCodexReasoningEffort: 'medium', defaultAgent: 'build', defaultModel: 'provider/model' };
  plugin.getEffectiveCodexModel = () => ''; plugin.getEffectiveDefaultModel = () => 'provider/model'; plugin.getEffectiveAgent = () => 'build';
  plugin.availableAgents = []; plugin.availableModels = []; plugin.availableCodexModels = [];
  plugin.getCodexReasoningEfforts = () => ['medium'];
  let writes = 0;
  plugin.saveSettings = async () => { writes++; };
  plugin.openAiDraft = (kind, objective, callback) => { plugin.useDraft = callback; return { close() {} }; };
  return { ...api, plugin, Element, opened, notices, writes: () => writes,
    button: (modal, text) => { const el = modal.contentEl.all().find(el => el.tag === 'button' && el.textContent === text); assert.ok(el, `Missing button: ${text}`); return el; } };
}
const defaults = { engine: 'codex', model: 'provider/model', codexModel: '', copilotModel: '', agent: 'build' };
const task = (id = 'one') => ({ exportId: id, name: `Task ${id}`, taskKind: 'codex', prompt: 'Write a short welcome message.' });
const packageOf = (tasks = [task()], workflows = []) => ({ autoOCExport: { schemaVersion: '1.6.0' }, tasks, workflows });
const workflowPackage = () => packageOf([task()], [{ name: 'Draft and wait', description: 'Synthetic authoring fixture', steps: [
  { id: 'a', stepKind: 'task', taskExportId: 'one', transitions: [{ toStepId: 'b', mode: 'eval', evaluatePrompt: 'Is the message clear?' }] },
  { id: 'b', stepKind: 'delay', delayValue: 1, delayUnit: 'seconds', transitions: [] },
] }]);

test('creator prompts and editors expose parallel policy without overriding inherited preferences',()=>{
  const h=harness();
  assert.match(h.AUTOOC_WORKFLOW_PROMPT,/"parallel" allows shared-vault execution/);
  assert.match(h.buildDraftPrompt(h.AUTOOC_WORKFLOW_PROMPT,'task','Synthetic goal','codex','1.7.16'),/Omit concurrency/);
  for(const kind of ['task','workflow']){
    const draft=h.parseGeneratedDraft(JSON.stringify(kind==='task' ? packageOf() : workflowPackage()),kind,defaults);
    const item=kind==='task' ? draft.tasks[0] : draft.workflow;
    assert.equal(item.concurrency,undefined);
    const modal=kind==='task' ? new h.CreateTaskModal(h.plugin.app,h.plugin,item) : new h.CreateWorkflowModal(h.plugin.app,h.plugin,item);
    modal.open();
    const setting=modal.contentEl.all().find(el=>el.name==='Concurrency');
    const select=setting.all().find(el=>el.tag==='select');
    assert.equal(select.value,'inherit');
    select.change('parallel');assert.equal(modal.draft.concurrency,'parallel');
    select.change('exclusive');assert.equal(modal.draft.concurrency,'exclusive');
    select.change('inherit');assert.equal(modal.draft.concurrency,undefined);
  }
});

test('saving an already open editor preserves an availability change from another view', async () => {
  for (const kind of ['task', 'workflow']) {
    const h = harness(), draft = h.parseGeneratedDraft(JSON.stringify(workflowPackage()), 'workflow', defaults);
    h.plugin.settings.tasks = draft.tasks; h.plugin.settings.workflows = [draft.workflow];
    const item = kind === 'task' ? draft.tasks[0] : draft.workflow;
    const editor = kind === 'task' ? new h.CreateTaskModal(h.plugin.app, h.plugin, item) : new h.CreateWorkflowModal(h.plugin.app, h.plugin, item);
    editor.open();
    if (kind === 'task') h.plugin.settings.tasks[0] = {...item, disabled: true};
    else h.plugin.settings.workflows[0] = {...item, disabled: true};
    editor.draft.name = 'Edited while disabled';
    const save = editor.contentEl.all().find(el => el.tag === 'button' && /Save/.test(el.textContent));
    assert.ok(save); await save.onclick();
    const saved = kind === 'task' ? h.plugin.settings.tasks[0] : h.plugin.settings.workflows[0];
    assert.equal(saved.disabled, true); assert.equal(saved.name, 'Edited while disabled'); assert.equal(h.writes(), 1);
  }
});

test('generated drafts use fresh identities, manual schedules and no inherited runtime or implicit permissions', () => {
  const h = harness(), data = workflowPackage();
  Object.assign(data.tasks[0], { id: 'existing', status: 'running', output: 'private', runtimeExecution: { runId: 'live' }, scheduleType: 'interval', copilotAllowAllTools: true, interactiveTerminal: true, workingDirectory: '/unrequested' });
  const draft = h.parseGeneratedDraft(JSON.stringify(data), 'workflow', defaults);
  assert.notEqual(draft.tasks[0].id, 'existing'); assert.equal(draft.tasks[0].status, 'pending');
  assert.equal(draft.tasks[0].scheduleType, 'manual'); assert.equal(draft.tasks[0].output, '');
  assert.equal(draft.tasks[0].runtimeExecution, undefined); assert.equal(draft.tasks[0].workingDirectory, undefined);
  assert.equal(draft.tasks[0].copilotAllowAllTools, false); assert.equal(draft.tasks[0].interactiveTerminal, false);
  assert.equal(draft.workflow.steps[0].taskId, draft.tasks[0].id);
  assert.equal(draft.workflow.steps[0].transitions[0].toStepId, draft.workflow.steps[1].id);
  assert.equal(draft.workflow.steps[0].evaluatePrompt, 'Is the message clear?');
  const code = h.parseGeneratedDraft(JSON.stringify(packageOf([{ ...task(), taskKind: 'code', code: 'return 1;', codeAllowTerminal: true, codeAllowFiles: true, codeAllowVault: true }])), 'task', defaults).tasks[0];
  assert.equal(code.codeAllowTerminal, false); assert.equal(code.codeAllowFiles, false); assert.equal(code.codeAllowVault, false);
});

test('invalid JSON, missing references, duplicates, orphan tasks and non-linear graphs cannot enter the editor', () => {
  const h = harness();
  assert.throws(() => h.parseGeneratedDraft('not json', 'task', defaults), /valid JSON/);
  assert.throws(() => h.parseGeneratedDraft(JSON.stringify(workflowPackage()), 'task', defaults), /one task/);
  for (const mutate of [
    d => d.tasks.push(task()), d => d.tasks.push(task('unused')),
    d => d.workflows[0].steps[0].taskExportId = 'missing',
    d => d.workflows[0].steps[1].id = 'a',
    d => d.workflows[0].steps[0].transitions = [],
    d => d.workflows[0].steps[0].transitions[0].mode = 'conditional',
    d => d.workflows[0].steps[0].transitions[0].toStepId = 'a',
    d => d.workflows[0].steps[0].transitions[0].evaluatePrompt = '',
    d => d.workflows[0].steps[1].delayValue = -1,
  ]) { const data = workflowPackage(); mutate(data); assert.throws(() => h.parseGeneratedDraft(JSON.stringify(data), 'workflow', defaults)); }
});

test('the real creator stages and edits generated tasks, saves once, and preserves transition semantics', async () => {
  const h = harness(), editor = new h.CreateWorkflowModal(h.plugin.app, h.plugin);
  editor.open(); h.button(editor, 'Create with AI').onclick();
  const draft = h.parseGeneratedDraft(JSON.stringify(workflowPackage()), 'workflow', defaults);
  h.plugin.useDraft(draft); assert.equal(h.plugin.settings.tasks.length, 0); assert.equal(h.writes(), 0);
  h.button(editor, 'Edit draft task').onclick();
  const taskEditor = h.opened.at(-1); taskEditor.draft.prompt = 'Edited before saving';
  await h.button(taskEditor, 'Apply to workflow draft').onclick();
  assert.equal(h.writes(), 0); assert.equal(h.plugin.settings.tasks.length, 0);
  await h.button(editor, 'Create Workflow').onclick();
  assert.equal(h.writes(), 1); assert.equal(h.plugin.settings.tasks[0].prompt, 'Edited before saving');
  assert.equal(h.plugin.settings.workflows.length, 1);
  assert.equal(h.plugin.settings.workflows[0].steps[0].transitions[0].mode, 'eval');
});

test('cancelling a generated workflow, including a manually added draft task, leaves no catalog records', async () => {
  const h = harness(), editor = new h.CreateWorkflowModal(h.plugin.app, h.plugin);
  editor.open(); h.button(editor, 'Create with AI').onclick();
  h.plugin.useDraft(h.parseGeneratedDraft(JSON.stringify(workflowPackage()), 'workflow', defaults));
  const add = editor.contentEl.all().find(el => el.tag === 'button' && /Create New Task/.test(el.textContent));
  assert.ok(add); await add.onclick(); const taskEditor = h.opened.at(-1);
  taskEditor.draft.name = 'Additional draft'; taskEditor.draft.prompt = 'Another prompt';
  await h.button(taskEditor, 'Apply to workflow draft').onclick();
  assert.equal(editor.draftTasks.length, 2); editor.close();
  assert.equal(h.writes(), 0); assert.equal(h.plugin.settings.tasks.length, 0); assert.equal(h.plugin.settings.workflows.length, 0);
});

test('new task generation stays editable and saves only after Create Task', async () => {
  const h = harness(), editor = new h.CreateTaskModal(h.plugin.app, h.plugin);
  editor.open(); h.button(editor, 'Create with AI').onclick();
  h.plugin.useDraft(h.parseGeneratedDraft(JSON.stringify(packageOf()), 'task', defaults));
  assert.equal(h.writes(), 0); editor.draft.name = 'Reviewed name';
  await h.button(editor, 'Create Task').onclick();
  assert.equal(h.writes(), 1); assert.equal(h.plugin.settings.tasks[0].name, 'Reviewed name');
});

test('failed save removes only this draft and allows retry; unused staged tasks are not saved', async () => {
  const h = harness(), draft = h.parseGeneratedDraft(JSON.stringify(workflowPackage()), 'workflow', defaults);
  const concurrent = { id: 'concurrent' }, catalog = { tasks: [], workflows: [] };
  await assert.rejects(h.saveGeneratedDefinition(catalog, draft.tasks, draft.workflow, async () => { catalog.tasks.push(concurrent); throw Error('disk unavailable'); }), /disk unavailable/);
  assert.deepEqual(catalog.tasks, [concurrent]); assert.equal(catalog.workflows.length, 0);
  draft.tasks.push({ id: 'removed-from-chain' }); let saves = 0;
  await h.saveGeneratedDefinition(catalog, draft.tasks, draft.workflow, async () => { saves++; });
  assert.equal(saves, 1); assert.equal(catalog.tasks.length, 2); assert.equal(catalog.workflows.length, 1);
});

test('generation cancellation rejects late results and invalid output keeps the existing editor untouched', async () => {
  const h = harness(); let finish, applied = 0, signal;
  const modal = new h.AiDraftModal({}, { kind: 'task', guide: 'Guide', version: '1.7.2', engine: 'codex', objective: 'Write a message', defaults: () => defaults,
    generate: (_prompt, _engine, _model, received) => { signal = received; return new Promise(resolve => { finish = resolve; }); }, useDraft: () => { applied++; } });
  modal.open(); const pending = h.button(modal, 'Generate draft').onclick();
  h.button(modal, 'Cancel generation').onclick(); assert.equal(signal.aborted, true);
  finish(JSON.stringify(packageOf())); await pending;
  assert.equal(applied, 0); assert.equal(h.button(modal, 'Review in editor').disabled, true);
  const retry = h.button(modal, 'Generate again').onclick(); finish('invalid'); await retry;
  assert.match(modal.contentEl.all().map(el => el.textContent).join(' '), /Could not create a draft/);
  assert.equal(applied, 0);
  const valid = h.button(modal, 'Generate again').onclick(); finish(JSON.stringify(packageOf())); await valid;
  assert.equal(h.button(modal, 'Review in editor').disabled, false);
  modal.contentEl.all().find(el => el.tag === 'textarea').change('Changed objective');
  assert.equal(h.button(modal, 'Review in editor').disabled, true);
});

test('both creators select a model per engine and pass it to generation and editable tasks', async () => {
  for (const kind of ['task','workflow']) for (const engine of ['opencode','opencode2','codex','copilot']) {
    const h=harness();let received,reviewed,finish;
    const data=kind==='task'?packageOf():workflowPackage();data.tasks[0].taskKind=engine;
    const modal=new h.AiDraftModal({}, {kind,guide:h.AUTOOC_WORKFLOW_PROMPT,version:'1.7.11',engine,objective:'Prepare a summary',
      defaults:()=>defaults, models:()=>[{value:'fixture/selected',label:'Selected model'}],
      generate:(_prompt,selectedEngine,model)=>{received={engine:selectedEngine,model};return new Promise(resolve=>finish=resolve)},useDraft:draft=>reviewed=draft});
    modal.open();
    const picker=modal.contentEl.all().find(el=>el.name==='Model').children.find(el=>el.tag==='select');
    assert.ok(picker.children.some(el=>el.value==='fixture/selected'&&el.textContent==='Selected model'));
    picker.value='fixture/selected';picker.change(picker.value);
    const pending=h.button(modal,'Generate draft').onclick();assert.equal(picker.disabled,true);
    finish(JSON.stringify(data));await pending;
    assert.deepEqual(received,{engine,model:'fixture/selected'});assert.equal(picker.disabled,false);
    h.button(modal,'Review in editor').onclick();
    assert.equal(reviewed.tasks[0].model,'fixture/selected');assert.equal(reviewed.tasks[0].taskKind,engine);
  }
});

test('model choices stay separate by engine, preserve custom IDs and invalidate an old preview', async () => {
  const h=harness();let received;
  const modal=new h.AiDraftModal({}, {kind:'task',guide:h.AUTOOC_WORKFLOW_PROMPT,version:'1.7.11',engine:'codex',objective:'Keep this objective',
    defaults:()=>({...defaults,codexModel:'not-in-list',opencode2Model:'v2/default'}),
    models:engine=>[{value:engine+'/listed',label:'Listed'},{value:engine+'/listed',label:'Listed'}],
    generate:async(_p,engine,model)=>{received={engine,model};return JSON.stringify(packageOf([{...task(),taskKind:engine}]))},useDraft:()=>{}});
  modal.open();
  const setting=name=>modal.contentEl.all().find(el=>el.name===name);
  const picker=setting('Model').children.find(el=>el.tag==='select');
  const engines=setting('AI engine').children.find(el=>el.tag==='select');
  const custom=setting('Other model').children.find(el=>el.tag==='input');
  assert.equal(picker.value,'not-in-list');assert.ok(picker.children.some(el=>el.value==='not-in-list'));
  assert.equal(picker.children.filter(el=>el.value==='codex/listed').length,1);
  const other=picker.children.find(el=>el.textContent==='Other model…');picker.change(other.value);
  assert.equal(setting('Other model').hidden,false);custom.change('  custom/model  ');
  engines.change('opencode2');assert.equal(picker.value,'v2/default');
  assert.equal(setting('Other model').hidden,true);assert.ok(!picker.children.some(el=>el.value==='codex/listed'));
  picker.change('');engines.change('codex');assert.equal(picker.value,'custom/model');
  engines.change('opencode2');assert.equal(picker.value,'');engines.change('codex');
  await h.button(modal,'Generate draft').onclick();assert.deepEqual(received,{engine:'codex',model:'custom/model'});
  assert.equal(h.button(modal,'Review in editor').disabled,false);
  picker.change('codex/listed');assert.equal(h.button(modal,'Review in editor').disabled,true);
  assert.equal(modal.contentEl.all().find(el=>el.tag==='textarea').value,'Keep this objective');
});

test('plugin supplies task editor model lists without mixing OpenCode versions or querying providers', () => {
  const h=harness();
  h.plugin.availableModels=[{value:'v1/listed',label:'OpenCode model'}];
  h.plugin.availableCodexModels=[{value:'codex/listed',label:'Codex model'}];
  h.plugin.settings.tasks=[{taskKind:'opencode2',model:'v2/used'},{taskKind:'copilot',model:'copilot-used'},{model:'v1/legacy'}];
  const modal=h.openAiDraft.call(h.plugin,'task','Synthetic objective',()=>{});
  assert.deepEqual(Array.from(modal.options.models('opencode'),m=>m.value),['v1/listed','v1/legacy']);
  assert.deepEqual(Array.from(modal.options.models('codex'),m=>m.value),['codex/listed']);
  assert.deepEqual(Array.from(modal.options.models('opencode2'),m=>m.value),['v2/used']);
  assert.deepEqual(Array.from(modal.options.models('copilot'),m=>m.value),['copilot-used']);
  assert.equal(h.writes(),0);modal.close();
});

test('the actual shipped creator prompt contains a valid example for each engine and editor', () => {
  const h=harness();
  for(const kind of ['task','workflow']) for(const engine of ['opencode','opencode2','codex','copilot']) {
    const prompt=h.buildDraftPrompt(h.AUTOOC_WORKFLOW_PROMPT,kind,'Actual creator request',engine,'1.7.11');
    assert.match(prompt,/Canonical complete export format/);assert.doesNotMatch(prompt,/Minimal valid workflow example:/);
    assert.match(prompt,/Do not include model IDs in the JSON/);
    const example=prompt.split('CREATOR EXAMPLE (replace its content with the requested objective):\n')[1].split('\n\nThe following JSON string')[0];
    assert.equal(JSON.parse(example).autoOCExport.pluginVersion,'1.7.11');
    const draft=h.parseGeneratedDraft(example,kind,defaults);
    assert.equal(draft.tasks[0].taskKind,engine);assert.equal(!!draft.workflow,kind==='workflow');
  }
});

test('OpenCode draft runner sends the exact prompt on stdin with denied tools in an isolated temporary directory', async () => {
  let captured, child;
  const spawn = (bin, args, options) => {
    captured = { bin, args, options };
    child = new EventEmitter(); child.stdin = new PassThrough(); child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.exitCode = null;
    let prompt = ''; child.stdin.on('data', chunk => { prompt += chunk; });
    child.stdin.on('finish', () => { captured.prompt = prompt; child.stdout.end(JSON.stringify({ type: 'text', part: { text: JSON.stringify(packageOf()) } }) + '\n'); child.exitCode = 0; child.emit('close', 0); });
    return child;
  };
  const h = harness({ child_process: { ...require('node:child_process'), spawn } });
  const prompt = 'literal "quotes" $(not a command) & \n' + 'x'.repeat(15000);
  const result = await h.generateDraftText({ engine: 'opencode', opencodePath: '/synthetic/opencode.exe', prompt }, new AbortController().signal);
  assert.equal(captured.prompt, prompt); assert.equal(captured.options.shell, false); assert.ok(!captured.args.includes(prompt));
  assert.equal(captured.options.stdio[0], 'pipe');
  assert.equal(JSON.parse(captured.options.env.OPENCODE_PERMISSION)['*'], 'deny');
  assert.equal(fs.existsSync(captured.options.cwd), false); assert.equal(JSON.parse(result).tasks.length, 1);
});

test('OpenCode 2 drafts use their own binary, standalone protocol and native deny-all policy', async () => {
  let captured, probes=0;
  const childProcess={...require('node:child_process'),
    execFile(bin,args,options,callback) { probes++; assert.equal(bin,'/synthetic/opencode2.exe'); assert.deepEqual(Array.from(args),['--version']); callback(null,'opencode v2.0.21\n'); },
    spawn(bin,args,options) {
      captured={bin,args:Array.from(args),options};
      const child=new EventEmitter();child.stdin=new PassThrough();child.stdout=new PassThrough();child.stderr=new PassThrough();child.exitCode=null;
      let input='';child.stdin.on('data',chunk=>input+=chunk);
      child.stdin.on('finish',()=>{captured.input=input;child.stdout.end(JSON.stringify({type:'text',part:{text:'{"draft":true}'}})+'\n');child.exitCode=0;child.emit('close',0);});
      return child;
    }};
  const h=harness({child_process:childProcess}),prompt='Draft only\n'+('" $() ñ 😀'.repeat(3000));
  const result=await h.generateDraftText({engine:'opencode2',opencodePath:'/wrong/opencode.exe',opencode2Path:'/synthetic/opencode2.exe',model:'fixture/model',prompt},new AbortController().signal);
  assert.equal(probes,1);assert.equal(captured.bin,'/synthetic/opencode2.exe');assert.equal(captured.input,prompt);
  assert.deepEqual(captured.args,['run','--standalone','--format','json','--print-logs','--log-level','error','--agent','autooc-draft','--model','fixture/model']);
  const config=JSON.parse(captured.options.env.OPENCODE_CONFIG_CONTENT);
  assert.deepEqual(config.permissions,[{action:'*',resource:'*',effect:'deny'}]);
  assert.deepEqual(config.agents['autooc-draft'].permissions,config.permissions);assert.match(config.agents['autooc-draft'].system,/Never execute/);
  assert.equal(captured.options.shell,false);assert.equal(fs.existsSync(captured.options.cwd),false);assert.equal(result,'{"draft":true}');
});

test('cancelled or timed-out version probes cannot start a late draft process', async () => {
  for(const mode of ['cancel','timeout']) {
    let finish,launches=0;
    const h=harness({child_process:{...require('node:child_process'),execFile(_bin,_args,_options,callback){finish=()=>callback(null,'2.0.21');},spawn(){launches++;throw Error('late launch');}}});
    const controller=new AbortController();
    const pending=h.generateDraftText({engine:'opencode2',opencode2Path:'/synthetic/opencode2.exe',prompt:'none'},controller.signal,mode==='timeout'?10:1000);
    if(mode==='cancel')controller.abort();
    await assert.rejects(pending,mode==='cancel'?/cancelled/:/timed out/);
    finish();await new Promise(resolve=>setImmediate(resolve));assert.equal(launches,0);
  }
});

test('OpenCode 2 drafts remain editable and preserve their version and defaults when saved',async()=>{
  const h=harness();
  const config={...defaults,engine:'opencode2',opencode2Model:'provider/v2',opencode2Agent:'review'};
  const draft=h.parseGeneratedDraft(JSON.stringify(packageOf([{...task(),taskKind:'opencode2'}])),'task',config);
  assert.equal(draft.tasks[0].model,'provider/v2');assert.equal(draft.tasks[0].agent,'review');
  const editor=new h.CreateTaskModal(h.plugin.app,h.plugin,draft.tasks[0],async task=>{h.plugin.settings.tasks.push(task);});
  editor.open();assert.equal(editor.draft.taskKind,'opencode2');editor.draft.name='Reviewed v2 task';
  const save=editor.contentEl.all().find(el=>el.tag==='button'&&/Save|Apply/.test(el.textContent));
  await save.onclick();assert.equal(h.plugin.settings.tasks[0].taskKind,'opencode2');assert.equal(h.plugin.settings.tasks[0].model,'provider/v2');
});

test('OpenCode 2 import/export preserves the selected harness and uses only its model default',async()=>{
  const h=harness();h.plugin.settings.defaultOpencode2Model='provider/v2-default';h.plugin.settings.defaultOpencode2Agent='v2-agent';
  const previous={id:'existing',taskKind:'opencode',model:'provider/v1',status:'completed',output:'preserved'};
  h.plugin.settings.tasks=[previous];
  const exported=h.toExportTask({...task(),taskKind:'opencode2',model:'provider/source',agent:'review',forceModel:true,interactiveTerminal:true,useRalphLoop:false},'v2');
  assert.equal(exported.taskKind,'opencode2');assert.equal(exported.model,undefined);
  const result=await h.plugin.importFromData(packageOf([exported]));assert.equal(result.tasksImported,1);
  assert.equal(h.plugin.settings.tasks[0],previous);
  const imported=h.plugin.settings.tasks[1];assert.equal(imported.taskKind,'opencode2');assert.equal(imported.model,'provider/v2-default');
  assert.equal(imported.agent,'review');assert.equal(imported.forceModel,true);assert.equal(imported.interactiveTerminal,true);
});

test('editing an imported v2 task with no model persists the default displayed in the editor',async()=>{
  const h=harness();h.plugin.settings.defaultOpencode2Model='provider/configured-later';
  const imported={...task(),id:'imported',taskKind:'opencode2',model:'',scheduleType:'manual'};
  let saved;
  const editor=new h.CreateTaskModal(h.plugin.app,h.plugin,imported,value=>{saved=value;});editor.open();
  assert.equal(editor.draft.model,'provider/configured-later');
  await h.button(editor,'Apply to workflow draft').onclick();assert.equal(saved.model,'provider/configured-later');
});

test('prompt reuses the shipped guide, quotes the objective, and constrains creator output', () => {
  const h = harness(), objective = 'A "quoted" objective\nwith context';
  const prompt = h.buildDraftPrompt('Existing WF Builder Prompt', 'workflow', objective, 'copilot', '1.7.2');
  assert.ok(prompt.startsWith('Existing WF Builder Prompt')); assert.ok(prompt.endsWith(JSON.stringify(objective)));
  assert.match(prompt, /exactly one workflow/); assert.match(prompt, /manual schedules/);
});

test('timeout and cancellation stop generation without returning a late draft', async () => {
  const children = [];
  const spawn = () => {
    const child = new EventEmitter(); child.stdin = new PassThrough(); child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.exitCode = null;
    child.kill = () => { child.killed = true; }; child.pid = 123456;
    children.push(child); return child;
  };
  const h = harness({ child_process: { ...require('node:child_process'), spawn }, process: { ...process, kill() {} } });
  const request = { engine: 'opencode', opencodePath: '/synthetic/opencode.exe', prompt: 'Make a draft' };
  const controller = new AbortController();
  const pending = h.generateDraftText(request, controller.signal); controller.abort();
  await assert.rejects(pending, /cancelled/);
  children[0].stdout.end(JSON.stringify({ type: 'text', part: { text: '{}' } })); children[0].emit('close', 0);
  await assert.rejects(h.generateDraftText(request, new AbortController().signal, 10), /timed out/);
  await assert.rejects(h.generateDraftText(request, controller.signal), /cancelled/);
});

test('a rejected OpenCode free-tier version gives an actionable error without waiting for the process to exit', async () => {
  const spawn = () => {
    const child = new EventEmitter(); child.stdin = new PassThrough(); child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.exitCode = null;
    queueMicrotask(() => child.stderr.write('level=ERROR agent=autooc-draft error.error="AI_APICallError: OpenCode 1.18.0 or newer is required to use the free tier"'));
    return child;
  };
  const h = harness({ child_process: { ...require('node:child_process'), spawn } });
  await assert.rejects(h.generateDraftText({ engine: 'opencode', opencodePath: '/synthetic/opencode.exe', prompt: 'A draft' }, new AbortController().signal), /Update the OpenCode CLI or choose another AI engine, such as Codex/);
});

test('OpenCode usage limits give a clear next step while title-only failures do not discard a valid draft', async () => {
  for (const titleOnly of [false, true]) {
    const spawn = () => {
      const child = new EventEmitter(); child.stdin = new PassThrough(); child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.exitCode = null;
      child.stdin.on('finish', () => {
        child.stderr.write(`level=ERROR agent=${titleOnly ? 'title' : 'autooc-draft'} error.error="AI_APICallError: Free usage limit reached"`);
        if (titleOnly) { child.stdout.end(JSON.stringify({ type: 'text', part: { text: JSON.stringify(packageOf()) } }) + '\n'); child.exitCode = 0; child.emit('close', 0); }
      });
      return child;
    };
    const h = harness({ child_process: { ...require('node:child_process'), spawn } });
    const result = h.generateDraftText({ engine: 'opencode', opencodePath: '/synthetic/opencode.exe', prompt: 'A draft' }, new AbortController().signal);
    if (titleOnly) assert.equal(JSON.parse(await result).tasks.length, 1);
    else await assert.rejects(result, /Free usage limit reached.*Choose another AI engine/);
  }
});
