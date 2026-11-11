const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');

// Exercise the shipped view, editor, save callback and event subscriptions.
// Filesystem/providers are deliberately absent: these tests do not establish GUI acceptance.
function harness() {
  class Element {
    constructor(options = {}) {
      this.textContent = options.text || ''; this.children = []; this.style = {}; this.attrs = options.attr || {};
      this.value = ''; this.events = {}; this.classes = new Set((typeof options === 'string' ? options : options.cls || '').split(' '));
      this.classList = {contains: name => this.classes.has(name)};
    }
    createEl(tag, options = {}) { const el = new Element(options); el.tag = tag; el.parentElement = this; this.children.push(el); return el; }
    createDiv(options) { return this.createEl('div', options); } createSpan(options) { return this.createEl('span', options); }
    empty() { this.children = []; } setText(value) { this.textContent = value; }
    addClass(name) { this.classes.add(name); } removeClass(name) { this.classes.delete(name); } toggleClass() {}
    addEventListener(name, callback) { this.events[name] = callback; } focus() { this.focused = true; } select() {} scrollIntoView() {}
    setAttr(key, value) { this.attrs[key] = value; } setAttribute(key, value) { this.setAttr(key, value); }
    all() { return [this, ...this.children.flatMap(child => child.all())]; }
    querySelectorAll(selector) {
      return this.all().slice(1).filter(el => {
        if (selector.startsWith('.')) return el.classes.has(selector.slice(1));
        const match = selector.match(/^\[([^=\]]+)(?:="(.*)")?\]$/);
        return match && Object.hasOwn(el.attrs, match[1]) && (match[2] === undefined || el.attrs[match[1]] === match[2]);
      });
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  }
  class Control {
    constructor(el) { this.inputEl = this.selectEl = this.buttonEl = el; }
    setValue(value) { this.inputEl.value = value; return this; }
    setButtonText(value) { this.buttonEl.textContent = value; return this; }
    setDisabled(value) { this.buttonEl.disabled = value; return this; }
    setPlaceholder(value) { this.inputEl.placeholder = value; return this; }
    addOption(value, label) { const option = this.selectEl.createEl('option', {text:label}); option.value = value; return this; }
    addOptions(values) { for (const [key, value] of Object.entries(values)) this.addOption(key, value); return this; }
    setCta() { return this; } setWarning() { return this; } setTooltip() { return this; }
    onChange(fn) { this.inputEl.change = fn; return this; } onClick(fn) { this.buttonEl.onclick = fn; return this; }
  }
  class Setting {
    constructor(parent) { this.settingEl = parent.createDiv(); this.controlEl = this.infoEl = this.settingEl; }
    setName(value) { this.settingEl.name = value; return this; } setDesc(value) { this.settingEl.desc = value; return this; } setHeading() { return this; }
    add(tag, cb) { cb(new Control(this.settingEl.createEl(tag))); return this; }
    addText(cb) { return this.add('input', cb); } addTextArea(cb) { return this.add('textarea', cb); }
    addDropdown(cb) { return this.add('select', cb); } addToggle(cb) { return this.add('input', cb); } addButton(cb) { return this.add('button', cb); }
  }
  const opened = [], notices = [], module = {exports:{}};
  class Stub {}
  const obsidian = {Plugin:Stub, ItemView:Stub, PluginSettingTab:Stub, Setting,
    Notice:class { constructor(value) { notices.push(value); } },
    Modal:class { constructor(app) { this.app = app; this.contentEl = new Element(); } open() { opened.push(this); this.onOpen(); } close() { this.onClose(); } }};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../main.js'), 'utf8') +
    '\nmodule.exports.nameTest = {AutoOCView, CreateTaskModal, CreateWorkflowModal, ImportModal, toExportTask, toExportWorkflow, dashboardItems, workPageDashboardItems};',
    {module, exports:module.exports, require:id => id === 'obsidian' ? obsidian : require(id), process, Buffer, console,
      setTimeout, clearTimeout, setInterval, clearInterval, AbortController, window:{setTimeout:() => 0, clearTimeout},
      document:{createTextNode:text => new Element({text})}});
  const api = module.exports.nameTest, plugin = new module.exports.default();
  plugin.app = {vault:{adapter:{}}}; plugin.manifest = {version:'test'};
  plugin.settings = {tasks:[], workflows:[], defaultAiEngine:'codex', defaultAgent:'build', defaultModel:'', defaultCodexModel:''};
  plugin.availableAgents = []; plugin.availableModels = []; plugin.availableCodexModels = [];
  plugin.getCodexReasoningEfforts = () => ['medium'];
  plugin.isWorkflowExecuting = () => false; plugin.configureStartButton = () => {};
  let persisted, writes = 0;
  plugin.saveSettings = async () => { writes++; persisted = JSON.parse(JSON.stringify(plugin.settings)); };
  const view = Object.create(api.AutoOCView.prototype);
  Object.assign(view, {plugin, app:plugin.app, containerEl:new Element(), expandedWorkflows:new Set(), expandedTasks:new Set(),
    renderSelectionCheckbox() {}, renderExecutionStatus() {}, renderAvailabilityButton() {}, loadDashboardPositions() {},
    render() { throw Error('Name update must not reconstruct the view'); }});
  plugin.onTaskUpdated(task => view.updateTaskNameDom(task));
  plugin.onWorkflowUpdated(workflow => view.updateWorkflowNameDom(workflow));
  const button = (root, text) => { const found = root.all().find(el => el.tag === 'button' && el.textContent === text); assert.ok(found, `Missing ${text}`); return found; };
  return {...api, plugin, view, opened, notices, button, persisted:() => persisted, writes:() => writes};
}
function fixture(h, alias) {
  const task = {id:'task-a', name:'Original task', taskKind:'codex', prompt:'Synthetic prompt', scheduleType:'manual', status:'pending', output:'', area:''};
  const steps = [
    {id:'step-a', stepKind:'task', taskId:task.id, name:alias, position:{x:10,y:20}, transitions:[{toStepId:'step-b',mode:'default'}]},
    {id:'step-b', stepKind:'task', taskId:task.id, transitions:[]},
  ];
  const workflow = {id:'workflow-a', name:'Workflow', steps, status:'pending', currentStep:0, scheduleType:'manual'};
  h.plugin.settings.tasks = [task]; h.plugin.settings.workflows = [workflow];
  h.view.expandedWorkflows.add(workflow.id); h.view.renderWorkflowCard(h.view.containerEl, workflow);
  return {task, workflow};
}
const titles = h => h.view.containerEl.querySelectorAll('.auto-oc-workflow-task-title').map(el => el.textContent);
const plain = value => JSON.parse(JSON.stringify(value));

for (const alias of [undefined, '', 'Original task', 'Review gate']) {
  test(`rename through the real workflow Edit Task updates every title and transition (alias ${JSON.stringify(alias)})`, async () => {
    const h = harness(), {task, workflow} = fixture(h, alias), before = JSON.stringify(workflow);
    // Another workflow references the exact same task.
    const second = {...plain(workflow), id:'workflow-b'}; h.plugin.settings.workflows.push(second);
    h.view.renderWorkflowCard(h.view.containerEl, second);
    h.button(h.view.containerEl, '✏️ Edit Task').onclick({stopPropagation(){}});
    const editor = h.opened.at(-1); editor.draft.name = 'Renamed task';
    const elements = h.view.containerEl.all();
    await h.button(editor.contentEl, 'Save Changes').onclick();
    assert.equal(h.persisted().tasks[0].name, 'Renamed task');
    assert.equal(h.persisted().tasks[0].id, task.id);
    assert.ok(titles(h).every(name => name.includes('Renamed task')), titles(h).join(' | '));
    if (alias) assert.ok(titles(h)[0].includes(`${alias} · Task: Renamed task`));
    assert.ok(h.view.containerEl.querySelectorAll('.auto-oc-workflow-transition-label').some(el => el.textContent.includes('Renamed task')));
    assert.deepEqual(h.view.containerEl.all(), elements, 'update existing nodes instead of rebuilding');
    assert.equal(JSON.stringify(workflow), before, 'names must not mutate aliases, IDs, transitions or positions');
    // The button closure was rendered with the previous object; reopening must resolve current data by ID.
    h.button(h.view.containerEl, '✏️ Edit Task').onclick({stopPropagation(){}});
    assert.equal(h.opened.at(-1).draft.name, 'Renamed task');
  });
}

test('open workflow editor refreshes names, placeholders and transitions without losing draft input or focus', async () => {
  const h = harness(), {task, workflow} = fixture(h, 'Review gate');
  const editor = new h.CreateWorkflowModal(h.plugin.app, h.plugin, workflow); editor.open();
  const field = editor.contentEl.all().find(el => el.name === 'Step name').all().find(el => el.tag === 'input');
  field.value = 'Unsaved alias'; field.change(field.value); field.focus();
  editor.draft.description = 'Unsaved description';
  const nodes = editor.contentEl.all();
  const taskEditor = new h.CreateTaskModal(h.plugin.app, h.plugin, task); taskEditor.open(); taskEditor.draft.name = 'Renamed task';
  await h.button(taskEditor.contentEl, 'Save Changes').onclick();
  assert.ok(editor.contentEl.all().some(el => el.textContent === 'Unsaved alias · Task: Renamed task'));
  assert.ok(editor.contentEl.all().some(el => el.textContent.includes('After «Unsaved alias · Task: Renamed task»')));
  assert.match(field.placeholder, /Renamed task/); assert.equal(field.value, 'Unsaved alias'); assert.equal(field.focused, true);
  assert.equal(editor.draft.description, 'Unsaved description'); assert.deepEqual(editor.contentEl.all(), nodes);
  assert.equal(workflow.steps[0].name, 'Review gate');
  const callbacks = h.plugin.taskUpdatedCallbacks.size; editor.onOpen(); assert.equal(h.plugin.taskUpdatedCallbacks.size, callbacks);
  editor.close(); assert.equal(h.plugin.taskUpdatedCallbacks.size, callbacks - 1);
});

test('cancelled and rejected saves do not refresh names or announce a successful rename', async () => {
  const h = harness(), {task} = fixture(h);
  const cancelled = new h.CreateTaskModal(h.plugin.app, h.plugin, task); cancelled.open(); cancelled.draft.name = 'Cancelled'; cancelled.close();
  assert.equal(h.writes(), 0); assert.ok(titles(h).every(name => name.includes('Original task')));
  const rejected = new h.CreateTaskModal(h.plugin.app, h.plugin, task); rejected.open(); rejected.draft.name = 'Not saved';
  h.plugin.saveSettings = async () => { throw Error('Synthetic save failure'); };
  await assert.rejects(h.button(rejected.contentEl, 'Save Changes').onclick(), /Synthetic save failure/);
  assert.ok(titles(h).every(name => name.includes('Original task'))); assert.equal(h.notices.some(n => /saved/i.test(n)), false);
});

test('task and workflow labels preserve aliases, diagnose missing references and keep inline names independent', () => {
  const h = harness(), {workflow} = fixture(h, 'Alias');
  const child = {id:'child', name:'Child workflow', steps:[]}; h.plugin.settings.workflows.push(child);
  const editor = new h.CreateWorkflowModal(h.plugin.app, h.plugin, workflow);
  assert.equal(editor.workflowStepLabel({id:'c',stepKind:'code',name:'Inline code'}), 'Inline code');
  assert.equal(editor.workflowStepLabel({id:'d',stepKind:'delay',name:'Wait'}), 'Wait');
  assert.match(editor.workflowStepLabel({id:'missing',stepKind:'task',taskId:'absent',name:'Alias'}), /Alias.*deleted task/i);
  assert.equal(editor.workflowStepLabel({id:'w',stepKind:'workflow',workflowId:'child',name:'Child alias'}), 'Child alias · Workflow: Child workflow');
  h.plugin.settings.tasks[0].taskKind = 'code';
  assert.equal(editor.workflowStepLabel(workflow.steps[0]), 'Alias · Task: Original task');
});

test('task export/import retains workflow aliases and resolves renamed tasks by identity', async () => {
  const h = harness(), {task, workflow} = fixture(h, 'Review gate');
  task.name = 'Renamed task';
  const data = {autoOCExport:{schemaVersion:'1.6.0'}, tasks:[h.toExportTask(task, 'export-task')],
    workflows:[h.toExportWorkflow(workflow, 'export-workflow', new Map([[task.id, 'export-task']]))]};
  const validation = new h.ImportModal(h.plugin.app, h.plugin).validateExport(data);
  assert.equal(validation.errors.length, 0, validation.errors.join('\n'));
  h.plugin.settings.tasks = []; h.plugin.settings.workflows = [];
  await h.plugin.importFromData(data);
  const imported = h.plugin.settings.workflows.at(-1), linked = h.plugin.settings.tasks.find(t => t.id === imported.steps[0].taskId);
  assert.equal(imported.steps[0].name, 'Review gate'); assert.equal(linked.name, 'Renamed task');
  assert.equal(imported.steps[0].transitions[0].toStepId, imported.steps[1].id);
});

test('Dashboard and work page projections reflect the current name and preserve the alias and step identity', () => {
  const h = harness(), {task, workflow} = fixture(h, 'Review gate');
  task.name = 'Renamed task';
  const before = JSON.stringify(h.plugin.settings);
  const items = h.dashboardItems(h.plugin.settings.tasks, h.plugin.settings.workflows);
  const step = items.find(item => item.id === workflow.id).children[0];
  assert.equal(step.name, 'Review gate · Task: Renamed task');
  assert.equal(step.id, workflow.steps[0].id); assert.equal(step.taskId, task.id);
  const pageItems = h.workPageDashboardItems(h.plugin.settings.tasks, h.plugin.settings.workflows, 'page-a', []);
  assert.equal(pageItems.find(item => item.id === workflow.id).children[0].name, step.name);
  assert.equal(JSON.stringify(h.plugin.settings), before);
});

test('renaming a nested workflow refreshes open parent labels without replacing parent drafts', () => {
  const h = harness(), {workflow} = fixture(h);
  const child = {id:'child',name:'Original child',steps:[]}; h.plugin.settings.workflows.push(child);
  workflow.steps[0] = {id:'nested',stepKind:'workflow',workflowId:'child',name:'Child alias',transitions:[]};
  h.view.containerEl.empty(); h.view.renderWorkflowCard(h.view.containerEl, workflow);
  const editor = new h.CreateWorkflowModal(h.plugin.app, h.plugin, workflow); editor.open();
  editor.draft.description = 'Keep this draft'; const nodes = editor.contentEl.all();
  child.name = 'Renamed child'; h.plugin.emitWorkflowUpdated(child);
  assert.ok(titles(h)[0].includes('Child alias · Workflow: Renamed child'));
  assert.ok(editor.contentEl.all().some(el => el.textContent === 'Child alias · Workflow: Renamed child'));
  assert.equal(editor.draft.description, 'Keep this draft'); assert.deepEqual(editor.contentEl.all(), nodes);
  editor.close();
});
