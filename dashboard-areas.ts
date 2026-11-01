import { setIcon } from "obsidian";
import { workflowDisabledReason } from "./catalog-availability";
import { codeStepDisplay } from "./workflow-code-step";

interface Source {
  id: string; name?: string; area?: string; status?: string; disabled?: boolean;
  taskKind?: string; taskId?: string; stepKind?: string; lastRun?: string;
  runtimeExecution?: { requiresReconciliation?: boolean; terminalUncertainty?: boolean; disposition?: unknown };
  pendingCodexApproval?: unknown;
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
  selected?: string; collapsed: Set<string>;
}
export const createAreaDashboardState = (): AreaDashboardState => ({
  query: "", showDisabled: false, attentionOnly: false, collapsed: new Set(),
});

const needsAttention = (item: Source) => item.status === "failed" || item.status === "abandoned" ||
  !!item.pendingCodexApproval || !!item.runtimeExecution?.requiresReconciliation ||
  !!(item.runtimeExecution?.terminalUncertainty && !item.runtimeExecution.disposition);
const areaName = (area?: string) => area?.trim() || "No area";

/** Presentation only: never infer branch completion or write catalog/runtime state. */
export function dashboardItems(tasks: Source[], workflows: Flow[]): DashboardItem[] {
  const byId = new Map(tasks.map(task => [task.id, task]));
  const taskItems: DashboardItem[] = tasks.map(task => ({
    key: JSON.stringify(["task", task.id]), id: task.id, taskId: task.id,
    kind: task.taskKind === "code" ? "code" : "task", name: task.name || "Untitled task",
    area: areaName(task.area), status: task.status || "pending", disabled: !!task.disabled,
    attention: needsAttention(task), detail: task.taskKind === "code" ? "Code · JavaScript" : task.taskKind || "opencode",
    lastRun: task.lastRun,
  }));
  const flowItems: DashboardItem[] = workflows.map(workflow => {
    const children: DashboardItem[] = workflow.steps.map((step, index) => {
      const task = byId.get(step.taskId || ""), code = step.stepKind === "code";
      const display = code ? codeStepDisplay(step) : step;
      const status = display.status || "pending";
      return {
        key: JSON.stringify(["step", workflow.id, step.id]), id: step.id, workflowId: workflow.id,
        taskId: code || step.stepKind === "delay" ? undefined : step.taskId,
        kind: code || task?.taskKind === "code" ? "code" : step.stepKind === "delay" ? "delay" : "task",
        name: step.name?.trim() || task?.name || (code ? `Code step ${index + 1}` : step.stepKind === "delay" ? "Delay" : "Missing task"),
        area: areaName(step.area || workflow.area), status,
        disabled: !!(workflow.disabled || step.disabled || task?.disabled),
        attention: needsAttention({ ...step, status, runtimeExecution: code && step.codeExecution && display.lastRun === step.codeExecution.lastRun
          ? step.codeExecution.runtimeExecution : step.runtimeExecution }) ||
          (!code && step.stepKind !== "delay" && !task),
        detail: `Step ${index + 1} · ${workflow.name}`, lastRun: display.lastRun,
      };
    });
    const blocked = workflowDisabledReason(workflow, tasks);
    return {
      key: JSON.stringify(["workflow", workflow.id]), id: workflow.id, kind: "workflow",
      name: workflow.name || "Untitled workflow", area: areaName(workflow.area), status: workflow.status || "pending",
      disabled: !!workflow.disabled, attention: needsAttention(workflow) || children.some(child => child.attention) || !!blocked && !workflow.disabled,
      detail: blocked || `${children.length} steps${workflow.status === "running" ? ` · Step ${(workflow.currentStep || 0) + 1}` : ""}`,
      lastRun: workflow.lastRun, children, activeSteps: children.filter(child => child.status === "running").length,
    };
  });
  return [...flowItems, ...taskItems].sort((a, b) => a.area.localeCompare(b.area) || a.name.localeCompare(b.name) || a.key.localeCompare(b.key));
}

export function dashboardVisibleItems(items: DashboardItem[], state: AreaDashboardState) {
  const query = state.query.trim().toLowerCase();
  return items.filter(item => (state.showDisabled || !item.disabled) && (!state.attentionOnly || item.attention) &&
    (!query || [item.name, item.area, item.detail, ...(item.children || []).map(child => `${child.name} ${child.area}`)]
      .some(text => text.toLowerCase().includes(query))));
}
const stateLabel = (item: DashboardItem) => item.disabled ? "Disabled" : item.attention ? "Needs attention" :
  ({ pending: "Ready", running: "Running", completed: "Completed", failed: "Failed", abandoned: "Abandoned" }[item.status] || item.status);

/** Stable toolbar and lazy workflow detail. No polling, physics, catalog saves or output scans. */
export class AreaDashboard {
  readonly root: HTMLElement;
  private map: HTMLElement;
  private inspector: HTMLElement;
  private summary: HTMLElement;
  private event: HTMLElement;
  private items: DashboardItem[] = [];
  private signature = "";
  private previous = new Map<string, string>();
  private stepLimit = 40;
  private inspectedWorkflow?: string;
  constructor(parent: HTMLElement, private state: AreaDashboardState, private host: {
    items(): DashboardItem[]; diameter(): number;
    open(item: DashboardItem): void;
    log(item: DashboardItem): void; history(item: DashboardItem): void;
  }) {
    this.root = parent.createDiv("auto-oc-areas-dashboard");
    const heading = this.root.createDiv("auto-oc-areas-heading");
    heading.createEl("h2", { text: "Your areas" });
    heading.createEl("p", { text: "Workflows, tasks and Code steps. Select a bubble to see its details." });
    this.summary = this.root.createDiv("auto-oc-areas-summary");
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
    this.summary.empty();
    for (const [label, count] of [
      ["workflows", this.items.filter(item => item.kind === "workflow").length],
      ["tasks", this.items.filter(item => item.kind !== "workflow").length],
      ["Code steps", this.items.reduce((n, item) => n + (item.children?.filter(child => child.kind === "code").length || 0), 0)],
      ["items running", this.items.filter(item => !item.disabled && item.status === "running").length],
      ["steps running", this.items.reduce((n, item) => n + (item.activeSteps || 0), 0)],
      ["need attention", this.items.filter(item => !item.disabled && item.attention).length],
      ["disabled", this.items.filter(item => item.disabled).length],
    ]) {
      const metric = this.summary.createSpan(); metric.createEl("strong", { text: String(count) }); metric.createSpan({ text: ` ${label}` });
    }
    this.drawMap(); this.drawInspector();
  }
  private orb(parent: HTMLElement, item: DashboardItem) {
    const orb = parent.createSpan({ cls: `auto-oc-area-orb${item.kind === "workflow" ? "" : " auto-oc-dashboard-task-bubble"}` });
    orb.setAttr("data-kind", item.kind); orb.setAttr("aria-hidden", "true");
    orb.setAttr("data-state", item.disabled ? "disabled" : item.attention ? "attention" : item.status);
    const size = item.kind === "workflow" ? Math.max(36, this.host.diameter()) : this.host.diameter();
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
