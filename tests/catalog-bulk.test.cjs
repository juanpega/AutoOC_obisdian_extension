const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');

function harness(selectionMode = true) {
  class Element {
    constructor(options = {}) { this.textContent = options.text || ''; this.children = []; this.style = {}; this.attrs = options.attr || {}; this.value = ''; this.classList = { toggle() {} }; }
    createEl(tag, options = {}) { const el = new Element(options); el.tag = tag; this.children.push(el); return el; }
    createDiv(options) { return this.createEl('div', options); }
    createSpan(options) { return this.createEl('span', options); }
    empty() { this.children = []; } setText(value) { this.textContent = value; }
    addClass() {} removeClass() {} setAttr(key, value) { this.attrs[key] = value; }
    all() { return [this, ...this.children.flatMap(child => child.all())]; }
  }
  class Control {
    constructor(el) { this.inputEl = this.buttonEl = el; }
    setValue(value) { this.inputEl.value = value; return this; }
    setButtonText(value) { this.buttonEl.textContent = value; return this; }
    setDisabled(value) { this.buttonEl.disabled = value; return this; }
    setWarning() { return this; } setCta() { return this; } setPlaceholder() { return this; }
    onChange(callback) { this.inputEl.change = callback; return this; }
    onClick(callback) { this.buttonEl.onclick = callback; return this; }
  }
  class Setting {
    constructor(parent) { this.settingEl = parent.createDiv(); }
    setName(name) { this.settingEl.name = name; return this; } setDesc() { return this; }
    addText(cb) { cb(new Control(this.settingEl.createEl('input'))); return this; }
    addButton(cb) { cb(new Control(this.settingEl.createEl('button'))); return this; }
  }
  const opened = [], notices = [], module = { exports: {} };
  class Stub {}
  const obsidian = { Plugin: Stub, ItemView: Stub, PluginSettingTab: Stub, Setting,
    Notice: class { constructor(message) { notices.push(message); } },
    Modal: class { constructor(app) { this.app = app; this.contentEl = new Element(); } open() { opened.push(this); this.onOpen(); } close() { this.onClose(); } },
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../main.js'), 'utf8') +
    '\nmodule.exports.bulkTest = {AutoOCView, BulkCatalogModal, ExportModal, captureBulkSelection, bulkSelectionIssues, applyBulkCatalogAction, workflowCodeEntries, matchesWorkflowCodeEntry, isTaskDue, isWorkflowDue, toExportTask, toExportWorkflow, prepareWorkflowDefinitionAsync};',
    { module, exports: module.exports, require: id => id === 'obsidian' ? obsidian : require(id),
      process, Buffer, console, setTimeout, clearTimeout, setInterval, clearInterval, AbortController });
  const api = module.exports.bulkTest, plugin = new module.exports.default();
  plugin.app = { vault: { adapter: {} }, workspace: { getLeavesOfType: () => [] } };
  plugin.settings = { tasks: [], workflows: [] };
  let writes = 0;
  plugin.saveSettings = async (_, validate) => { validate?.(); writes++; };
  const view = new api.AutoOCView({}, plugin);
  if (selectionMode) view.selectionMode = true; // Existing bulk tests explicitly enter selection mode.
  view.app = plugin.app;
  const root = new Element();
  view.render = () => { root.empty(); view.currentTab === 'workflows' ? view.renderWorkflows(root) : view.renderTasks(root); };
  // Exercise real list filtering, bulk toolbar and checkbox handlers without unrelated engine/log widgets.
  view.renderTaskCard = (parent, item) => view.renderSelectionCheckbox(parent, 'task', item);
  view.renderWorkflowCard = (parent, item) => view.renderSelectionCheckbox(parent, 'workflow', item);
  const button = (root, text) => { const el = root.all().find(el => el.tag === 'button' && el.textContent === text); assert.ok(el, `Missing ${text}`); return el; };
  return { ...api, plugin, view, root, Element, opened, notices, button, writes: () => writes };
}
const task = (id, area = 'Research') => ({ id, name: `Task ${id}`, prompt: 'Synthetic fixture', status: 'completed', area, output: 'Keep output', logs: [{ output: 'Keep history' }], scheduleType: 'manual' });
const workflow = (id, tasks = []) => ({ id, name: `Workflow ${id}`, status: 'pending', area: 'Research', steps: tasks.map(taskId => ({ id: `step-${taskId}`, stepKind: 'task', taskId })) });
const capture = (h, tasks = [], workflows = []) => h.captureBulkSelection(h.plugin.settings, new Set(tasks), new Set(workflows));

test('selection starts collapsed, opens across tabs, and hiding clears invisible selections', () => {
  const h = harness(false); h.plugin.settings.tasks = [task('a')]; h.plugin.settings.workflows = [workflow('w')];
  h.view.render();
  assert.equal(h.button(h.root, 'Select items').attrs['aria-expanded'], 'false');
  assert.equal(h.root.all().some(el => el.attrs['aria-label'] === 'Select task: Task a'), false);
  assert.equal(h.root.all().some(el => el.textContent === 'Delete selected'), false);
  h.button(h.root, 'Select items').onclick(); h.button(h.root, 'Select visible').onclick();
  h.view.currentTab = 'workflows'; h.view.render(); h.button(h.root, 'Select visible').onclick();
  h.button(h.root, 'Hide selection').onclick();
  assert.equal(h.view.selectedTaskIds.size + h.view.selectedWorkflowIds.size, 0);
  assert.equal(h.root.all().some(el => el.attrs['aria-label'] === 'Select workflow: Workflow w'), false);
  h.button(h.root, 'Select items').onclick(); assert.equal(h.button(h.root, 'Disable selected').disabled, true);
});

test('bulk disable and enable preserve all definitions and history, including shared tasks', async () => {
  const h = harness(), a = task('a'), b = task('b'), w = workflow('w', ['a', 'b']);
  a.runtimeExecution = { phase: 'completed', runId: 'retained' };
  h.plugin.settings.tasks = [a, b]; h.plugin.settings.workflows = [w];
  const before = JSON.parse(JSON.stringify(h.plugin.settings));
  await h.plugin.applyBulkSelection(capture(h, ['a'], ['w']), { type: 'availability', disabled: true });
  before.tasks[0].disabled = before.workflows[0].disabled = true;
  assert.deepEqual(JSON.parse(JSON.stringify(h.plugin.settings)), before); assert.equal(b.disabled, undefined);
  await h.plugin.applyBulkSelection(capture(h, ['a'], ['w']), { type: 'availability', disabled: false });
  before.tasks[0].disabled = before.workflows[0].disabled = false;
  assert.deepEqual(JSON.parse(JSON.stringify(h.plugin.settings)), before);
});

test('availability changes reject active dependencies and roll back failed saves', async () => {
  const h = harness(), a = task('a'), w = workflow('w', ['a']);
  h.plugin.settings.tasks = [a]; h.plugin.settings.workflows = [w]; w.status = 'running';
  await assert.rejects(h.plugin.applyBulkSelection(capture(h, ['a']), { type: 'availability', disabled: true }), /execution review/);
  w.status = 'pending'; h.plugin.saveSettings = async () => { a.output = 'New output'; throw Error('Disk unavailable'); };
  await assert.rejects(h.plugin.applyBulkSelection(capture(h, ['a'], ['w']), { type: 'availability', disabled: true }), /Disk unavailable/);
  assert.equal(Object.hasOwn(a, 'disabled'), false); assert.equal(Object.hasOwn(w, 'disabled'), false); assert.equal(a.output, 'New output');
});

test('availability dialogs show consequences, offer no area input, and apply only reviewed items', async () => {
  const h = harness(); h.plugin.settings.tasks = [task('a')]; h.view.render(); h.button(h.root, 'Select visible').onclick();
  h.button(h.root, 'Disable selected').onclick(); const disable = h.opened.at(-1);
  assert.ok(disable.contentEl.all().some(el => /Workflows that use a disabled task/.test(el.textContent)));
  assert.equal(disable.contentEl.all().some(el => el.tag === 'input'), false);
  await h.button(disable.contentEl, 'Disable 1 items').onclick(); assert.equal(h.plugin.settings.tasks[0].disabled, true);
  h.button(h.root, 'Select visible').onclick(); h.button(h.root, 'Enable selected').onclick(); const enable = h.opened.at(-1);
  assert.ok(enable.contentEl.all().some(el => /next scheduler check/.test(el.textContent)));
  await h.button(enable.contentEl, 'Enable 1 items').onclick(); assert.equal(h.plugin.settings.tasks[0].disabled, false);
});

test('individual availability button changes only its item and does not expand the card', async () => {
  const h = harness(false), a = task('a'), b = task('b'); h.plugin.settings.tasks = [a, b];
  h.view.renderAvailabilityButton(h.root, 'task', a);
  let stopped = false;
  await h.button(h.root, 'Disable').onclick({stopPropagation() {stopped = true;}});
  assert.equal(stopped, true); assert.equal(a.disabled, true); assert.equal(b.disabled, undefined);
  h.root.empty(); h.view.renderAvailabilityButton(h.root, 'task', a);
  await h.button(h.root, 'Enable').onclick({stopPropagation() {}});
  assert.equal(a.disabled, false); assert.equal(h.writes(), 2);
});

test('disabled tasks and workflows cannot start manually, on schedule, or through shared execution', async () => {
  const h = harness(), a = {...task('a'), disabled: true, scheduleType: 'interval'}, w = {...workflow('w', ['a']), scheduleType: 'interval'};
  h.plugin.settings.tasks = [a]; h.plugin.settings.workflows = [w];
  h.plugin.beginExecutionEffects = () => assert.fail('No execution effects allowed');
  assert.equal(h.isTaskDue(a), false);
  assert.equal(h.isWorkflowDue({...w, disabled: true}), false);
  await assert.rejects(h.plugin.runTask(a), /disabled/);
  await assert.rejects(h.plugin.runWorkflow(w), /disabled/);
  await assert.rejects(h.plugin.runSharedWorkflow(w.id), /disabled/);
  const play = new h.Element(); h.plugin.configureStartButton(play, 'workflow', 'w', false);
  assert.equal(play.disabled, true); assert.match(play.title, /Task a.*disabled/);
  h.plugin.runTask = h.plugin.runWorkflow = () => assert.fail('Scheduler must skip disabled definitions and dependencies');
  await h.plugin.runDueTasks(); await h.plugin.runDueWorkflows();
  a.disabled = false; w.disabled = true;
  assert.equal(h.plugin.definitionDisabledReason('task', a.id), undefined);
  assert.match(h.plugin.definitionDisabledReason('workflow', w.id), /Workflow w.*disabled/);
});

test('export and import retain availability, legacy imports remain enabled and invalid flags reject', async () => {
  const h = harness(), a = {...task('a'), disabled: true}, w = {...workflow('w', ['a']), disabled: true};
  h.plugin.settings.tasks = [a]; h.plugin.settings.workflows = [w];
  const payload = {autoOCExport: {schemaVersion: '1.6.0'}, tasks: [h.toExportTask(a, 'task-a')], workflows: [h.toExportWorkflow(w, 'wf-w', new Map([['a','task-a']]))]};
  assert.equal(payload.tasks[0].disabled, true); assert.equal(payload.workflows[0].disabled, true);
  h.plugin.ensureUniqueTaskName = h.plugin.ensureUniqueWorkflowName = name => name;
  h.plugin.getEffectiveDefaultModel = () => 'fixture'; h.plugin.getEffectiveAgent = () => 'fixture';
  h.plugin.settings.tasks = []; h.plugin.settings.workflows = [];
  await h.plugin.importFromData(payload);
  assert.equal(h.plugin.settings.tasks[0].disabled, true); assert.equal(h.plugin.settings.workflows[0].disabled, true);
  delete payload.tasks[0].disabled; delete payload.workflows[0].disabled;
  await h.plugin.importFromData(payload); assert.equal(h.plugin.settings.tasks[1].disabled, undefined);
  payload.tasks[0].disabled = 'yes';
  await assert.rejects(h.plugin.importFromData(payload), /boolean/);
});

test('availability preserves historical hashes and the shared runtime rejects disabled work before effects', async () => {
  const h = harness();
  const runtime = require('../autooc-runtime.cjs');
  const a = {...task('a'), taskKind: 'code', code: 'throw Error("must not execute")'};
  const w = workflow('w', ['a']);
  const original = runtime.prepareWorkflowDefinition(w, [a], {});
  a.disabled = true;
  const disabled = runtime.prepareWorkflowDefinition(w, [a], {});
  assert.equal(disabled.hash, original.hash); assert.equal(disabled.tasks[0].disabled, true);
  const pending = h.prepareWorkflowDefinitionAsync(w, [a], {});
  a.disabled = false; // Async preparation must capture availability before yielding.
  const captured = await pending;
  assert.equal(captured.hash, original.hash); assert.equal(captured.tasks[0].disabled, true);
  await assert.rejects(runtime.runCodeWorkflowHost({definition: disabled, runtimeDirectory: 'must-not-create', vaultBase: 'unused', redact: value => value}), /disabled/);
  a.disabled = false; w.disabled = true;
  const disabledWorkflow = runtime.prepareWorkflowDefinition(w, [a], {});
  assert.equal(disabledWorkflow.hash, original.hash);
  await assert.rejects(runtime.runCodeWorkflowHost({definition: disabledWorkflow, runtimeDirectory: 'must-not-create', vaultBase: 'unused', redact: value => value}), /disabled/);
  assert.equal(fs.existsSync('must-not-create'), false);
});

test('installed runtime blocks disabled standalone tasks and referenced tasks without changing the catalog', async t => {
  const os = require('node:os'), runtime = require('../autooc-runtime.cjs');
  const vault = fs.mkdtempSync(path.join(os.tmpdir(), 'autooc-availability-'));
  t.after(() => {
    assert.equal(path.dirname(fs.realpathSync(vault)), fs.realpathSync(os.tmpdir()));
    assert.match(path.basename(vault), /^autooc-availability-/);
    fs.rmSync(vault, {recursive: true, force: true});
  });
  const directory = path.join(vault, '.obsidian', 'plugins', 'auto-oc'); fs.mkdirSync(directory, {recursive: true});
  const a = {...task('a'), taskKind: 'code', disabled: true, code: 'throw Error("must not execute")'}, w = workflow('w', ['a']);
  const file = path.join(directory, 'data.json'), bytes = JSON.stringify({tasks:[a], workflows:[w]}); fs.writeFileSync(file, bytes);
  for (const identity of [{taskId:'a'}, {workflowId:'w'}]) {
    await assert.rejects(runtime.runInstalledWorkflow({vault, ...identity, newExecution: true, redact: value => value}), /disabled/);
    assert.equal(fs.readFileSync(file, 'utf8'), bytes);
    assert.equal(fs.existsSync(path.join(directory,'runtime')), false);
  }
});

test('bulk area updates task and workflow identities once, preserving runtime, history and step areas', async () => {
  const h = harness(), a = task('a'), b = task('b'), w = workflow('w', ['a']);
  a.runtimeExecution = { phase: 'completed', runId: 'old-run' }; w.steps[0].area = 'Step area';
  h.plugin.settings.tasks = [a, b]; h.plugin.settings.workflows = [w];
  const before = JSON.parse(JSON.stringify(h.plugin.settings));
  await h.plugin.applyBulkSelection(capture(h, ['a'], ['w']), { type: 'area', area: '  Product  ' });
  before.tasks[0].area = before.workflows[0].area = 'Product';
  assert.deepEqual(JSON.parse(JSON.stringify(h.plugin.settings)), before);
  assert.equal(h.writes(), 1);
  await h.plugin.applyBulkSelection(capture(h, ['a']), { type: 'area', area: ' ' });
  assert.equal(a.area, '');
});

test('deleting a referenced task alone rejects the entire batch; selecting its workflows removes only explicit items', async () => {
  const h = harness(); h.plugin.settings.tasks = [task('a'), task('b'), task('c')];
  h.plugin.settings.workflows = [workflow('w', ['a', 'c']), workflow('other', ['a'])];
  await assert.rejects(h.plugin.applyBulkSelection(capture(h, ['a', 'b'], ['w']), { type: 'delete' }), /Workflow other/);
  assert.equal(h.writes(), 0); assert.equal(h.plugin.settings.tasks.length, 3);
  await h.plugin.applyBulkSelection(capture(h, ['a', 'b'], ['w', 'other']), { type: 'delete' });
  assert.deepEqual(Array.from(h.plugin.settings.tasks, t => t.id), ['c']);
  assert.equal(h.plugin.settings.workflows.length, 0); assert.equal(h.writes(), 1);
});

test('deleting only workflows preserves every underlying task', async () => {
  const h = harness(); h.plugin.settings.tasks = [task('a')]; h.plugin.settings.workflows = [workflow('w', ['a'])];
  await h.plugin.applyBulkSelection(capture(h, [], ['w']), { type: 'delete' });
  assert.equal(h.plugin.settings.tasks[0].id, 'a'); assert.equal(h.plugin.settings.workflows.length, 0);
});

test('active, starting and uncertain definitions block mutation without blocking unrelated completed items', async () => {
  for (const state of ['running', 'starting', 'uncertain']) {
    const h = harness(), a = task('a'); h.plugin.settings.tasks = [a, task('b')];
    if (state === 'running') a.status = 'running';
    if (state === 'starting') h.plugin.definitionStarts.set('task:a', Symbol());
    if (state === 'uncertain') a.runtimeExecution = { phase: 'failed', terminalUncertainty: true };
    await assert.rejects(h.plugin.applyBulkSelection(capture(h, ['a', 'b']), { type: 'delete' }), /execution review/);
    assert.equal(h.plugin.settings.tasks.length, 2); assert.equal(h.writes(), 0);
    await h.plugin.applyBulkSelection(capture(h, ['b']), { type: 'delete' });
    assert.equal(h.plugin.settings.tasks.length, 1);
  }
});

test('future tasks in an active workflow and workflows with active tasks cannot be edited or removed', async () => {
  const h = harness(), a = task('a'), w = workflow('w', ['a']);
  h.plugin.settings.tasks = [a]; h.plugin.settings.workflows = [w]; w.status = 'running';
  await assert.rejects(h.plugin.applyBulkSelection(capture(h, ['a']), { type: 'area', area: 'Other' }), /Workflow w/);
  w.status = 'pending'; a.status = 'running';
  await assert.rejects(h.plugin.applyBulkSelection(capture(h, [], ['w']), { type: 'delete' }), /Task a/);
});

test('a changed or missing item after confirmation opened aborts the whole selection', async () => {
  const h = harness(); h.plugin.settings.tasks = [task('a'), task('b')];
  const selection = capture(h, ['a', 'b']); h.plugin.settings.tasks[0].name = 'Changed';
  await assert.rejects(h.plugin.applyBulkSelection(selection, { type: 'delete' }), /changed or was removed/);
  assert.equal(h.writes(), 0); assert.equal(h.plugin.settings.tasks.length, 2);
});

test('save failure restores deleted records in order and preserves unrelated additions', async () => {
  const h = harness(); h.plugin.settings.tasks = [task('a'), task('b'), task('c')];
  h.plugin.settings.workflows = [workflow('w', ['a'])];
  h.plugin.saveSettings = async () => { h.plugin.settings.tasks.push(task('new')); throw Error('Disk unavailable'); };
  await assert.rejects(h.plugin.applyBulkSelection(capture(h, ['a', 'c'], ['w']), { type: 'delete' }), /Disk unavailable/);
  assert.deepEqual(Array.from(h.plugin.settings.tasks, t => t.id), ['a', 'b', 'c', 'new']);
  assert.equal(h.plugin.settings.workflows[0].id, 'w'); assert.equal(h.plugin.bulkCatalogMutationInProgress, false);
});

test('failed area save restores only the changed fields and keeps unrelated concurrent edits', async () => {
  const h = harness(); h.plugin.settings.tasks = [task('a'), task('b')]; delete h.plugin.settings.tasks[0].area;
  h.plugin.saveSettings = async () => { h.plugin.settings.tasks[1].output = 'New output'; throw Error('Disk unavailable'); };
  await assert.rejects(h.plugin.applyBulkSelection(capture(h, ['a', 'b']), { type: 'area', area: 'New' }), /Disk unavailable/);
  assert.equal(Object.hasOwn(h.plugin.settings.tasks[0], 'area'), false);
  assert.equal(h.plugin.settings.tasks[1].area, 'Research'); assert.equal(h.plugin.settings.tasks[1].output, 'New output');
});

test('new references during save are revalidated and restore the attempted deletion', async () => {
  const h = harness(); h.plugin.settings.tasks = [task('a')];
  h.plugin.saveSettings = async (_, validate) => { h.plugin.settings.workflows.push(workflow('new', ['a'])); validate(); };
  await assert.rejects(h.plugin.applyBulkSelection(capture(h, ['a']), { type: 'delete' }), /Workflow new/);
  assert.equal(h.plugin.settings.tasks[0].id, 'a');
});

test('execution admission is paused only during publication and resumes even after failure', async () => {
  const h = harness(); h.plugin.settings.tasks = [task('a'), task('b')];
  h.plugin.saveSettings = async (_, validate) => {
    assert.equal(h.plugin.getDefinitionStartState('task', 'b'), 'starting');
    await assert.rejects(h.plugin.withDefinitionStart('task', 'b', async () => { assert.fail('must not start'); }), /Catalog changes/);
    h.plugin.runDueTasks = async () => { assert.fail('scheduler must wait for the next tick'); };
    await h.plugin.runDueAll();
    validate();
  };
  await h.plugin.applyBulkSelection(capture(h, ['a']), { type: 'area', area: 'New' });
  assert.equal(h.plugin.getDefinitionStartState('task', 'b'), 'available');
});

test('installed catalog transactions serialize bulk actions and reject a stale second confirmation', async () => {
  const h = harness(), directory = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'autooc-bulk-'));
  h.plugin.app.vault.adapter.basePath = directory;
  h.plugin.selectedExecutionLocation = () => ({ configurationFile: path.join(directory, 'data.json') });
  h.plugin.settings.tasks = [task('a'), task('b')];
  const first = capture(h, ['a']), other = capture(h, ['b']);
  let active = 0, maxActive = 0, writes = 0;
  h.plugin.saveSettings = async (_, validate) => {
    maxActive = Math.max(maxActive, ++active);
    await new Promise(resolve => setTimeout(resolve, 10)); validate(); writes++; active--;
  };
  try {
    const results = await Promise.allSettled([
      h.plugin.applyBulkSelection(first, { type: 'area', area: 'First' }),
      h.plugin.applyBulkSelection(other, { type: 'area', area: 'Second' }),
      h.plugin.applyBulkSelection(first, { type: 'delete' }),
    ]);
    assert.equal(results[0].status, 'fulfilled'); assert.equal(results[1].status, 'fulfilled');
    assert.equal(results[2].status, 'rejected'); assert.match(String(results[2].reason), /changed or was removed/);
    assert.equal(maxActive, 1); assert.equal(writes, 2);
    assert.equal(h.plugin.settings.tasks[0].area, 'First'); assert.equal(h.plugin.settings.tasks[1].area, 'Second');
  } finally { fs.rmdirSync(directory); }
});

test('selection follows identities across filters and tabs, reports hidden items, and clear resets both types', () => {
  const h = harness(); h.plugin.settings.tasks = [task('a'), task('b')]; h.plugin.settings.workflows = [workflow('w')];
  h.view.filterText = 'task a'; h.view.render(); h.button(h.root, 'Select visible').onclick();
  assert.deepEqual(Array.from(h.view.selectedTaskIds), ['a']);
  h.view.currentTab = 'workflows'; h.view.filterText = ''; h.view.render(); h.button(h.root, 'Select visible').onclick();
  assert.equal(h.view.selectedWorkflowIds.has('w'), true);
  assert.ok(h.root.all().some(el => /1 tasks \+ 1 workflows selected \(1 outside this list\)/.test(el.textContent)));
  h.view.currentTab = 'tasks'; h.view.filterText = 'nothing'; h.view.render();
  assert.equal(h.button(h.root, 'Select visible').disabled, true);
  assert.equal(h.button(h.root, 'Delete selected').disabled, false);
  h.button(h.root, 'Clear selection').onclick();
  assert.equal(h.view.selectedTaskIds.size + h.view.selectedWorkflowIds.size, 0);
});

test('checkbox clicks do not expand cards, update actions, and removed identities are pruned', () => {
  const h = harness(); h.plugin.settings.tasks = [task('a')]; h.view.render();
  const cb = h.root.all().find(el => el.attrs['aria-label'] === 'Select task: Task a');
  let stopped = false; cb.onclick({ stopPropagation: () => { stopped = true; } }); cb.checked = true; cb.onchange();
  assert.equal(stopped, true); assert.equal(h.button(h.root, 'Delete selected').disabled, false);
  h.plugin.settings.tasks = []; h.view.render(); assert.equal(h.view.selectedTaskIds.size, 0);
});

test('delete opens an exact review, Cancel is read-only, and failures leave selection available for retry', async () => {
  const h = harness(); h.plugin.settings.tasks = [task('a'), task('b')]; h.view.render();
  h.view.selectedTaskIds.add('a'); h.view.render(); h.button(h.root, 'Delete selected').onclick();
  const modal = h.opened.at(-1);
  assert.deepEqual(Array.from(modal.contentEl.all().filter(el => el.tag === 'li'), el => el.textContent), ['Task: Task a']);
  h.button(modal.contentEl, 'Cancel').onclick(); assert.equal(h.writes(), 0);
  h.button(h.root, 'Delete selected').onclick(); const retry = h.opened.at(-1);
  h.plugin.saveSettings = async () => { throw Error('Disk unavailable'); };
  await h.button(retry.contentEl, 'Delete 1 items').onclick();
  assert.ok(retry.contentEl.all().some(el => /Disk unavailable/.test(el.textContent)));
  assert.equal(h.view.selectedTaskIds.has('a'), true); assert.equal(h.plugin.settings.tasks.length, 2);
  h.plugin.saveSettings = async (_, validate) => validate();
  await h.button(retry.contentEl, 'Delete 1 items').onclick();
  assert.equal(h.view.selectedTaskIds.size, 0); assert.deepEqual(Array.from(h.plugin.settings.tasks, t => t.id), ['b']);
});

test('area dialog uses existing area suggestions and saves the reviewed selection only', async () => {
  const h = harness(); h.plugin.settings.tasks = [task('a'), task('b', 'Product')];
  h.view.selectedTaskIds.add('a'); h.view.render(); h.button(h.root, 'Change area').onclick(); const modal = h.opened.at(-1);
  h.button(modal.contentEl, 'Product').onclick(); await h.button(modal.contentEl, 'Apply area').onclick();
  assert.equal(h.plugin.settings.tasks[0].area, 'Product'); assert.equal(h.writes(), 1);
});

test('export bulk preselection is copied and normal export still defaults to all items', () => {
  const h = harness(); h.plugin.settings.tasks = [task('a'), task('b')]; h.plugin.settings.workflows = [workflow('w', ['a'])];
  const selection = new Set(['b']), modal = new h.ExportModal(h.plugin.app, h.plugin, selection, new Set()); selection.clear();
  assert.deepEqual(Array.from(modal.selectedTaskIds), ['b']); assert.equal(modal.selectedWorkflowIds.size, 0);
  const normal = new h.ExportModal(h.plugin.app, h.plugin);
  assert.equal(normal.selectedTaskIds.size, 2); assert.equal(normal.selectedWorkflowIds.size, 1);
  const payload = h.plugin.buildExportSelectionPayload(new Set(), new Set(['w']));
  assert.equal(payload.tasks.length, 1); assert.equal(payload.tasks[0].name, 'Task a');
});

test('Tasks lists inline code even without catalog tasks, without modifying workflow definitions', () => {
  const h = harness(), w = workflow('w');
  w.status = 'completed';
  w.steps = [{ id: 'inline', stepKind: 'code', name: 'Inspect files', code: 'output = "<script>literal</script>";', area: 'Automation', codeAllowFiles: true, transitions: [{ toStepId: 'wait', mode: 'default' }] },
    { id: 'wait', stepKind: 'delay', delayValue: 2 }];
  h.plugin.settings.workflows = [w];
  const before = JSON.stringify(h.plugin.settings);
  h.view.render();
  const all = h.root.all();
  assert.ok(all.some(el => el.textContent === 'Workflow code steps'));
  assert.ok(all.some(el => el.textContent === 'Inspect files'));
  assert.ok(all.some(el => el.textContent === 'pending')); // A completed workflow may skip branches.
  assert.ok(all.some(el => el.textContent === 'Workflow w · Step 1 · Automation'));
  assert.equal(all.filter(el => el.attrs['data-auto-oc-code-step-id']).length, 1);
  assert.equal(all.filter(el => el.tag === 'pre').length, 0);
  const code = all.find(el => el.tag === 'details' && el.children[0].textContent === 'View code');
  code.open = true; code.ontoggle();
  assert.equal(code.children[1].textContent, w.steps[0].code);
  assert.equal(JSON.stringify(h.plugin.settings), before); assert.equal(h.writes(), 0);
  assert.equal(h.button(h.root, 'Select visible').disabled, true);
  assert.equal(h.button(h.root, 'Delete selected').disabled, true);
});

test('inline code uses workflow and step identity, while referenced reusable code tasks appear only once', () => {
  const h = harness(), code = { ...task('reusable'), taskKind: 'code', code: 'output = "reusable-marker";' };
  h.plugin.settings.tasks = [code];
  const first = workflow('one', ['reusable']), second = workflow('two', ['reusable']);
  first.steps.push({ id: 'same', stepKind: 'code', name: 'First inline', code: 'output=1;' });
  second.steps.push({ id: 'same', stepKind: 'code', name: 'Second inline', code: 'output=2;' });
  h.plugin.settings.workflows = [first, second];
  const entries = h.workflowCodeEntries(h.plugin.settings.workflows);
  assert.equal(entries.length, 2); assert.equal(entries[0].step, first.steps[1]); assert.equal(entries[1].step, second.steps[1]);
  h.view.render(); h.button(h.root, 'Select visible').onclick();
  assert.deepEqual(Array.from(h.view.selectedTaskIds), ['reusable']);
  assert.equal(h.root.all().filter(el => el.attrs['data-auto-oc-code-step-id'] === 'same').length, 2);
  h.view.filterText = 'reusable-marker'; h.view.render();
  assert.equal(h.root.all().filter(el => el.attrs['aria-label'] === 'Select task: Task reusable').length, 1);
  assert.equal(h.root.all().filter(el => el.attrs['data-auto-oc-code-step-id']).length, 0);
});

test('inline code filters match step name, workflow name, code, inherited area and step status', () => {
  const h = harness(), w = workflow('Source');
  w.steps = [{ id: 'a', stepKind: 'code', name: 'Validate data', code: 'output = uniqueMarker;', status: 'failed', area: 'Checks' },
    { id: 'b', stepKind: 'code', code: '', status: 'completed' }];
  h.plugin.settings.workflows = [w];
  for (const query of ['validate', 'workflow source', 'uniquemarker', 'checks']) {
    h.view.filterText = query; h.view.filterStatus = 'all'; h.view.filterArea = 'all'; h.view.render();
    assert.ok(h.root.all().some(el => el.attrs['data-auto-oc-code-step-id'] === 'a'), query);
  }
  h.view.filterText = ''; h.view.filterArea = 'Checks'; h.view.filterStatus = 'failed'; h.view.render();
  assert.equal(h.view.filterArea, 'Checks'); // Step-only area is a valid filter option.
  assert.equal(h.root.all().filter(el => el.attrs['data-auto-oc-code-step-id']).length, 1);
  h.view.filterArea = 'Research'; h.view.filterStatus = 'completed'; h.view.render();
  assert.ok(h.root.all().some(el => el.textContent === 'Code step 2'));
  assert.equal(h.root.all().filter(el => el.attrs['data-auto-oc-code-step-id']).length, 1);
  h.view.filterStatus = 'running'; h.view.render();
  assert.ok(h.root.all().some(el => el.textContent === 'No tasks or workflow code steps match your filters.'));
});

test('Open workflow targets the exact owning step and checks for removal before navigating', () => {
  const h = harness(), w = workflow('w'); w.steps = [{ id: 'code', stepKind: 'code', code: 'output=1;' }];
  h.plugin.settings.workflows = [w]; h.view.render();
  let scrolled = false;
  const target = { getAttribute: name => name === 'data-auto-oc-owner-workflow-id' ? 'w' : 'code', scrollIntoView: () => { scrolled = true; } };
  h.view.containerEl = { querySelectorAll: () => [target] };
  h.button(h.root, 'Open workflow').onclick();
  assert.equal(h.view.currentTab, 'workflows'); assert.equal(h.view.expandedWorkflows.has('w'), true); assert.equal(scrolled, true);
  assert.equal(h.view.filterArea, 'all'); assert.equal(h.view.filterStatus, 'all'); assert.equal(h.writes(), 0);
  h.view.currentTab = 'tasks'; h.view.render(); const stale = h.button(h.root, 'Open workflow');
  w.steps = []; stale.onclick();
  assert.match(h.notices.at(-1), /removed or changed/); assert.equal(h.view.currentTab, 'tasks');
});

test('large inline output previews are lazy, bounded and explicitly marked as truncated', () => {
  const h = harness(), w = workflow('w'); w.steps = [{ id: 'code', stepKind: 'code', output: 'x'.repeat(30000) }];
  h.plugin.settings.workflows = [w]; h.view.render();
  assert.equal(h.root.all().filter(el => el.tag === 'pre').length, 0);
  const output = h.root.all().find(el => el.tag === 'details' && el.children[0].textContent === 'View output');
  output.open = true; output.ontoggle(); output.ontoggle();
  assert.equal(output.children.filter(el => el.tag === 'pre').length, 1);
  assert.equal(output.children[1].textContent.length, 12000);
  assert.ok(output.children.some(el => /Preview limited/.test(el.textContent)));
  assert.equal(w.steps[0].output.length, 30000);
});

test('Task source filter can show only workflow code, keeps bulk scope explicit, and restores catalog tasks', () => {
  const h = harness(), w = workflow('w'); w.steps = [{ id: 'inline', stepKind: 'code', code: 'output=1;' }];
  h.plugin.settings.tasks = [task('a')]; h.plugin.settings.workflows = [w]; h.view.render();
  const select = h.root.all().find(el => el.attrs['aria-label'] === 'Task source');
  select.value = 'workflow-code'; select.onchange();
  assert.equal(h.root.all().filter(el => el.attrs['aria-label'] === 'Select task: Task a').length, 0);
  assert.equal(h.root.all().filter(el => el.attrs['data-auto-oc-code-step-id']).length, 1);
  assert.equal(h.button(h.root, 'Select visible').disabled, true);
  select.value = 'catalog'; select.onchange();
  assert.equal(h.root.all().filter(el => el.attrs['aria-label'] === 'Select task: Task a').length, 1);
  assert.equal(h.root.all().filter(el => el.attrs['data-auto-oc-code-step-id']).length, 0);
  select.value = 'all'; select.onchange();
  assert.equal(h.root.all().filter(el => el.attrs['data-auto-oc-code-step-id']).length, 1);
});
