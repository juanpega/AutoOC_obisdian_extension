import { setIcon } from "obsidian";
import { workflowDisabledReason } from "./catalog-availability";
import { codeStepDisplay } from "./workflow-code-step";
import { executionStatusHelp } from "./execution-status-help";
import type { PageRun } from "./work-pages";

export interface PageRunProgress {
  steps: {stepId:string;status:string;startedAt?:string;finishedAt?:string}[];
}

interface Source {
  id: string; name?: string; area?: string; status?: string; disabled?: boolean;
  taskKind?: string; taskId?: string; workflowId?: string; stepKind?: string; lastRun?: string;
  runtimeExecution?: { workflowId?: string; runId?: string; phase?: string; requiresReconciliation?: boolean; terminalUncertainty?: boolean; disposition?: unknown };
  pendingCodexApproval?: unknown;
  legacyExecution?: { token?: string; stopState?: string };
  codeExecution?: any;
}
interface Flow extends Source { steps: Source[]; currentStep?: number; }
export interface DashboardItem {
  key: string; id: string; workflowId?: string; taskId?: string;
  kind: "workflow" | "task" | "code" | "delay";
  name: string; area: string; status: string; disabled: boolean; attention: boolean;
  detail: string; lastRun?: string; children?: DashboardItem[]; activeSteps?: number;
}
export interface AreaDashboardState {
  query: string; showDisabled: boolean; attentionOnly: boolean;
  kindFilter: "all" | "workflow" | "task";
  selected?: string; collapsed: Set<string>;
}
export const createAreaDashboardState = (): AreaDashboardState => ({
  query: "", showDisabled: false, attentionOnly: false, kindFilter: "all", collapsed: new Set(),
});

const needsAttention = (item: Source, owned: boolean) => {
  if (item.status === "failed" || item.status === "abandoned") return true;
  const binding = item.runtimeExecution;
  if (!binding) return !!item.pendingCodexApproval || !!item.legacyExecution?.stopState;
  return executionStatusHelp({
    name: item.name || "", status: item.status || "pending", owned,
    phase: binding.phase, runId: binding.runId,
    requiresReconciliation: binding.requiresReconciliation, terminalUncertainty: binding.terminalUncertainty,
    disposition: !!binding.disposition, waitingApproval: !!item.pendingCodexApproval,
    stopUnconfirmed: !!item.legacyExecution?.stopState,
  }).attention;
};
const areaName = (area?: string) => area?.trim() || "No area";

/** Presentation only: never infer branch completion or write catalog/runtime state. */
export function dashboardItems(tasks: Source[], workflows: Flow[], ownsExecution: (workflowId: string, runId: string) => boolean = () => false): DashboardItem[] {
  const byId = new Map(tasks.map(task => [task.id, task]));
  // Match the exact attempt, not just an open plugin or a recorded running label.
  // Reuse the result within this projection so shared steps do not repeat lease checks.
  const ownership = new Map<string, boolean>();
  const owned = (binding: Source["runtimeExecution"], workflowId = binding?.workflowId) => {
    if (!binding?.runId || !workflowId) return false;
    const key = JSON.stringify([workflowId, binding.runId]);
    if (!ownership.has(key)) ownership.set(key, ownsExecution(workflowId, binding.runId));
    return ownership.get(key)!;
  };
  const taskItems: DashboardItem[] = tasks.map(task => ({
    key: JSON.stringify(["task", task.id]), id: task.id, taskId: task.id,
    kind: task.taskKind === "code" ? "code" : "task", name: task.name || "Untitled task",
    area: areaName(task.area), status: task.status || "pending", disabled: !!task.disabled,
    attention: needsAttention(task, owned(task.runtimeExecution)), detail: task.taskKind === "code" ? "Code · JavaScript" : task.taskKind || "opencode",
    lastRun: task.lastRun,
  }));
  const flowItems: DashboardItem[] = workflows.map(workflow => {
    const children: DashboardItem[] = workflow.steps.map((step, index) => {
      const task = byId.get(step.taskId || ""), code = step.stepKind === "code";
      const nested = step.stepKind === "workflow", child = nested ? workflows.find(w=>w.id===step.workflowId) : undefined;
      const display = code ? codeStepDisplay(step) : step;
      const status = display.status || "pending";
      const binding = code && step.codeExecution && display.lastRun === step.codeExecution.lastRun
        ? step.codeExecution.runtimeExecution : step.runtimeExecution;
      return {
        key: JSON.stringify(["step", workflow.id, step.id]), id: step.id, workflowId: workflow.id,
        taskId: code || step.stepKind === "delay" ? undefined : step.taskId,
        kind: nested ? "workflow" : code || task?.taskKind === "code" ? "code" : step.stepKind === "delay" ? "delay" : "task",
        name: step.name?.trim() || child?.name || task?.name || (nested ? "Missing workflow" : code ? `Code step ${index + 1}` : step.stepKind === "delay" ? "Delay" : "Missing task"),
        area: areaName(step.area || workflow.area), status,
        disabled: !!(workflow.disabled || step.disabled || task?.disabled || child?.disabled),
        attention: needsAttention({ ...step, status, runtimeExecution: binding }, owned(binding, workflow.id)) ||
          (nested ? !child : !code && step.stepKind !== "delay" && !task),
        detail: `Step ${index + 1} · ${workflow.name}`, lastRun: display.lastRun,
      };
    });
    const blocked = workflowDisabledReason(workflow, tasks, workflows);
    return {
      key: JSON.stringify(["workflow", workflow.id]), id: workflow.id, kind: "workflow",
      name: workflow.name || "Untitled workflow", area: areaName(workflow.area), status: workflow.status || "pending",
      disabled: !!workflow.disabled, attention: needsAttention(workflow, owned(workflow.runtimeExecution, workflow.id)) || children.some(child => child.attention) || !!blocked && !workflow.disabled,
      detail: blocked || `${children.length} steps${workflow.status === "running" ? ` · Step ${(workflow.currentStep || 0) + 1}` : ""}`,
      lastRun: workflow.lastRun, children, activeSteps: children.filter(child => child.status === "running").length,
    };
  });
  return [...flowItems, ...taskItems].sort((a, b) => a.area.localeCompare(b.area) || a.name.localeCompare(b.name) || a.key.localeCompare(b.key));
}

export function dashboardVisibleItems(items: DashboardItem[], state: AreaDashboardState) {
  const query = state.query.trim().toLowerCase();
  return items.filter(item =>
    (state.kindFilter === "workflow" ? item.kind === "workflow" : state.kindFilter === "task" ? item.kind !== "workflow" : true) &&
    (state.showDisabled || !item.disabled) && (!state.attentionOnly || item.attention) &&
    (!query || [item.name, item.area, item.detail, ...(item.children || []).map(child => `${child.name} ${child.area}`)]
      .some(text => text.toLowerCase().includes(query))));
}

/** Same catalog and areas as Main; execution state belongs only to the selected page. */
export function workPageDashboardItems(tasks: Source[], workflows: Flow[], pageId: string, runs: PageRun[],
  owns: (workflowId:string,runId:string)=>boolean, progress: (run:PageRun)=>PageRunProgress | undefined): DashboardItem[] {
  const clean = (item:Source):Source => ({id:item.id,name:item.name,area:item.area,disabled:item.disabled,
    taskKind:item.taskKind,taskId:item.taskId,workflowId:item.workflowId,stepKind:item.stepKind,status:"pending"});
  const items = dashboardItems(tasks.map(clean),workflows.map(w=>({...clean(w),steps:w.steps.map(clean)})));
  const latest = new Map<string,PageRun>();
  for (const run of runs) if (run.pageId === pageId) latest.set(JSON.stringify([run.task,run.sourceId]),run);
  for (const item of items) {
    const run = latest.get(JSON.stringify([item.kind !== "workflow",item.id]));
    if (!run) continue;
    const owned = owns(run.workflowId,run.runId), terminal = ["completed","failed","abandoned"].includes(run.phase);
    item.status = terminal ? run.phase : owned ? "running" : "pending";
    item.lastRun = run.createdAt;
    item.attention ||= run.phase === "failed" || run.phase === "abandoned" || (!terminal || run.uncertain) && !owned;
    item.detail += " · Page run: " + run.phase;
    const state = progress(run);
    if (!state) { item.attention = true; item.detail += " · Execution details unavailable; review page history."; continue; }
    for (const step of state.steps) {
      const child = item.children?.find(child=>child.id === step.stepId);
      if (!child) continue;
      child.status = step.status === "in_flight" ? owned && !terminal ? "running" : "pending" : step.status;
      child.attention ||= step.status === "failed" || step.status === "in_flight" && (!owned || terminal);
      child.lastRun = step.finishedAt || step.startedAt;
    }
    item.activeSteps = item.children?.filter(child=>child.status === "running").length || 0;
  }
  return items;
}
const stateLabel = (item: DashboardItem) => item.disabled ? "Disabled" : item.attention ? "Needs attention" :
  ({ pending: "Ready", running: "Running", completed: "Completed", failed: "Failed", abandoned: "Abandoned" }[item.status] || item.status);

/** Stable toolbar and lazy workflow detail. No polling, physics, catalog saves or output scans. */
export class AreaDashboard {
  readonly root: HTMLElement;
  private map: HTMLElement;
  private inspector: HTMLElement;
  private metrics: HTMLElement;
  private kindFilters = new Map<AreaDashboardState["kindFilter"], { button: HTMLButtonElement; count: HTMLElement }>();
  private event: HTMLElement;
  private items: DashboardItem[] = [];
  private signature = "";
  private previous = new Map<string, string>();
  private stepLimit = 40;
  private inspectedWorkflow?: string;
  constructor(parent: HTMLElement, private state: AreaDashboardState, private host: {
    items(): DashboardItem[];
    open(item: DashboardItem): void;
    log(item: DashboardItem): void; history(item: DashboardItem): void;
  }) {
    this.root = parent.createDiv("auto-oc-areas-dashboard");
    const heading = this.root.createDiv("auto-oc-areas-heading");
    heading.createEl("h2", { text: "Your areas" });
    heading.createEl("p", { text: "Select Workflows or Tasks to filter your areas, then select a bubble to see its details." });
    const summary = this.root.createDiv("auto-oc-areas-summary");
    const filters = summary.createDiv({ cls: "auto-oc-areas-kind-filters", attr: { role: "group", "aria-label": "Filter areas by item type" } });
    for (const [kind, label] of [["all", "All"], ["workflow", "Workflows"], ["task", "Tasks"]] as const) {
      const button = filters.createEl("button", { cls: "auto-oc-areas-kind-filter", attr: {
        type: "button", "data-area-kind-filter": kind, "aria-label": kind === "all" ? "Show all items" : `Show ${label.toLowerCase()}`,
      } });
      const count = button.createEl("strong");
      button.createSpan({ text: label });
      button.onclick = () => { state.kindFilter = kind; this.draw(); };
      this.kindFilters.set(kind, { button, count });
    }
    this.metrics = summary.createDiv("auto-oc-areas-metrics");
    const tools = this.root.createDiv("auto-oc-areas-tools");
    const search = tools.createEl("input", { type: "search", placeholder: "Find a task, workflow or step", attr: { "aria-label": "Search Dashboard" } });
    search.value = state.query;
    search.oninput = () => { state.query = search.value; this.draw(); };
    const toggle = (label: string, key: "showDisabled" | "attentionOnly") => {
      const wrapper = tools.createEl("label"), input = wrapper.createEl("input", { type: "checkbox" });
      wrapper.createSpan({ text: label }); input.checked = state[key];
      input.onchange = () => { state[key] = input.checked; this.draw(); };
    };
    toggle("Needs attention", "attentionOnly"); toggle("Show disabled", "showDisabled");
    const collapse = tools.createEl("button", { text: "Collapse areas" });
    collapse.onclick = () => { this.items.forEach(item => state.collapsed.add(item.area)); this.drawMap(); };
    const expand = tools.createEl("button", { text: "Expand areas" });
    expand.onclick = () => { state.collapsed.clear(); this.drawMap(); };
    const workspace = this.root.createDiv("auto-oc-areas-workspace");
    this.map = workspace.createDiv("auto-oc-areas-map");
    this.inspector = workspace.createEl("aside", { cls: "auto-oc-areas-inspector", attr: { "aria-label": "Selected Dashboard item" } });
    this.root.createEl("p", { cls: "auto-oc-areas-legend", text: "Double ring: workflow · Terminal: AI task · { }: Code · Clock: delay" });
    this.event = this.root.createDiv({ cls: "auto-oc-areas-event", attr: { role: "status", "aria-live": "polite" } });
    this.update();
  }
  update() {
    const items = this.host.items(), signature = JSON.stringify(items);
    if (signature === this.signature) return;
    let message = "Recorded execution state. Select an item for controls, log and history.";
    const flat = items.flatMap(item => [item, ...(item.children || [])]);
    for (const item of flat) {
      const label = `${item.status}:${item.disabled}:${item.attention}`;
      if (this.previous.has(item.key) && this.previous.get(item.key) !== label) message = `${item.name} · ${stateLabel(item)}`;
    }
    this.items = items; this.signature = signature;
    this.draw();
    this.previous = new Map(flat.map(item => [item.key, `${item.status}:${item.disabled}:${item.attention}`]));
    this.event.setText(message);
  }
  private draw() {
    const visible = dashboardVisibleItems(this.items, this.state);
    if (!visible.some(item => item.key === this.state.selected || item.children?.some(child => child.key === this.state.selected))) {
      this.state.selected = (visible.find(item => !item.disabled && item.status === "running") || visible.find(item => !item.disabled && item.attention) || visible[0])?.key;
    }
    const workflowCount = this.items.filter(item => item.kind === "workflow").length;
    const counts = { all: this.items.length, workflow: workflowCount, task: this.items.length - workflowCount };
    for (const [kind, { button, count }] of this.kindFilters) {
      button.setAttr("aria-pressed", String(this.state.kindFilter === kind));
      count.setText(String(counts[kind]));
    }
    this.metrics.empty();
    for (const [label, count] of [
      ["Code steps", this.items.reduce((n, item) => n + (item.children?.filter(child => child.kind === "code").length || 0), 0)],
      ["items running", this.items.filter(item => !item.disabled && item.status === "running").length],
      ["steps running", this.items.reduce((n, item) => n + (item.activeSteps || 0), 0)],
      ["need attention", this.items.filter(item => !item.disabled && item.attention).length],
      ["disabled", this.items.filter(item => item.disabled).length],
    ]) {
      const metric = this.metrics.createSpan(); metric.createEl("strong", { text: String(count) }); metric.createSpan({ text: ` ${label}` });
    }
    this.drawMap(); this.drawInspector();
  }
  private orb(parent: HTMLElement, item: DashboardItem) {
    const orb = parent.createSpan({ cls: `auto-oc-area-orb${item.kind === "workflow" ? "" : " auto-oc-dashboard-task-bubble"}` });
    orb.setAttr("data-kind", item.kind); orb.setAttr("aria-hidden", "true");
    orb.setAttr("data-state", item.disabled ? "disabled" : item.attention ? "attention" : item.status);
    // Fixed task/step diameter; workflows retain their existing double-ring size.
    const size = item.kind === "workflow" ? 36 : 30;
    orb.style.width = orb.style.height = `${size}px`;
    if (item.kind === "code") orb.setText("{ }"); else setIcon(orb, item.kind === "workflow" ? "workflow" : item.kind === "delay" ? "clock" : "terminal");
    if (this.previous.has(item.key) && this.previous.get(item.key) !== `${item.status}:${item.disabled}:${item.attention}`) orb.addClass("auto-oc-area-changed");
  }
  private itemButton(parent: HTMLElement, item: DashboardItem, step = false) {
    const button = parent.createEl("button", { cls: step ? "auto-oc-area-step" : "auto-oc-area-node", attr: {
      "aria-label": `${item.name}, ${item.kind}, ${stateLabel(item)}`, "aria-pressed": String(this.state.selected === item.key),
      "data-area-item-key": item.key, "data-disabled": String(item.disabled),
    } });
    this.orb(button, item);
    button.createSpan({ cls: "auto-oc-area-name", text: item.name });
    button.createSpan({ cls: "auto-oc-area-meta", text: `${step ? item.kind : item.kind === "workflow" ? `${item.children?.length || 0} steps` : item.detail} · ${stateLabel(item)}${item.activeSteps ? ` · ${item.activeSteps} step(s) running` : ""}` });
    button.onclick = () => { this.state.selected = item.key; this.drawMap(); this.drawInspector(); this.restoreFocus(item.key); };
  }
  private restoreFocus(key?: string) {
    if (!key) return;
    Array.from(this.root.querySelectorAll<HTMLElement>("[data-area-item-key]")).find(el => el.getAttribute("data-area-item-key") === key)?.focus({ preventScroll: true });
  }
  private drawMap() {
    const focused = this.root.ownerDocument.activeElement?.getAttribute("data-area-item-key") || undefined;
    const top = this.map.scrollTop;
    this.map.empty();
    const visible = dashboardVisibleItems(this.items, this.state), groups = new Map<string, DashboardItem[]>();
    for (const item of visible) { const group = groups.get(item.area) || []; group.push(item); groups.set(item.area, group); }
    if (!visible.length) this.map.createEl("p", { text: this.items.length ? "No matching items. Try another search or show disabled items." : "No tasks or workflows yet. Create one from Tasks or WorkFlows.", cls: "auto-oc-areas-empty" });
    for (const [area, items] of groups) {
      const group = this.map.createEl("details", { cls: "auto-oc-area-group" });
      const summary = group.createEl("summary"); summary.createSpan({ text: area });
      summary.createSpan({ text: `${items.filter(item => item.kind === "workflow").length} workflows · ${items.filter(item => item.kind !== "workflow").length} tasks` });
      const nodes = group.createDiv("auto-oc-area-nodes");
      group.open = !this.state.collapsed.has(area);
      const populate = () => { if (!nodes.childElementCount) items.forEach(item => this.itemButton(nodes, item)); };
      if (group.open) populate();
      group.ontoggle = () => {
        if (!group.isConnected) return;
        if (group.open) { this.state.collapsed.delete(area); populate(); }
        else { this.state.collapsed.add(area); nodes.empty(); }
      };
    }
    this.map.scrollTop = top; this.restoreFocus(focused);
  }
  private drawInspector() {
    const focused = this.inspector.ownerDocument.activeElement?.getAttribute("data-area-item-key") || undefined;
    const top = this.inspector.scrollTop;
    this.inspector.empty();
    const parent = this.items.find(item => item.key === this.state.selected || item.children?.some(child => child.key === this.state.selected));
    if (!parent) { this.inspector.createEl("p", { text: "Select a workflow, task or Code step." }); return; }
    const item = parent.children?.find(child => child.key === this.state.selected) || parent;
    this.inspector.createDiv({ cls: "auto-oc-area-eyebrow", text: `${item.kind} · ${item.area}` });
    this.inspector.createEl("h3", { text: item.name });
    this.inspector.createEl("p", { cls: "auto-oc-area-meta", text: `${stateLabel(item)} · Last result: ${item.status}` });
    this.inspector.createEl("p", { text: item.detail });
    if (item.disabled) this.inspector.createEl("p", { text: "Execution is disabled. Configuration, output and history are kept." });
    else if (item.attention) this.inspector.createEl("p", { cls: "mod-warning", text: "Review the recorded result and execution controls before continuing." });
    const actions = this.inspector.createDiv("auto-oc-area-actions");
    const action = (text: string, callback: () => void) => {
      const button = actions.createEl("button", { text }); button.onclick = callback; return button;
    };
    action("Open controls", () => this.host.open(item));
    if (item.kind !== "delay") {
      action(item.kind === "workflow" ? "Current step log" : "Log", () => this.host.log(item));
      action(item.kind === "workflow" ? "Current step history" : "History", () => this.host.history(item));
    }
    if (item !== parent) action("Workflow", () => { this.state.selected = parent.key; this.drawMap(); this.drawInspector(); });
    if (parent.children) {
      if (this.inspectedWorkflow !== parent.key) { this.inspectedWorkflow = parent.key; this.stepLimit = 40; }
      const query = this.state.query.trim().toLowerCase();
      const matching = query ? parent.children.filter(child => `${child.name} ${child.area}`.toLowerCase().includes(query)) : [];
      const shown = matching.length ? matching : parent.children;
      this.inspector.createEl("h4", { text: `${matching.length ? "Matching workflow steps" : "Workflow steps"} · ${shown.length}` });
      const steps = this.inspector.createDiv("auto-oc-area-steps");
      shown.slice(0, this.stepLimit).forEach(child => this.itemButton(steps, child, true));
      if (shown.length > this.stepLimit) {
        const more = this.inspector.createEl("button", { text: `Show more steps (${shown.length - this.stepLimit} remaining)` });
        more.onclick = () => { this.stepLimit += 40; this.drawInspector(); };
      }
    }
    this.inspector.scrollTop = top; this.restoreFocus(focused);
  }
}
