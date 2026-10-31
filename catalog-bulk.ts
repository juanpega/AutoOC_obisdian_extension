import { createHash } from "crypto";

export type CatalogKind = "task" | "workflow";
export type BulkAction = { type: "delete" } | { type: "area"; area: string } | { type: "availability"; disabled: boolean };
export interface CatalogItem { id: string; name: string; area?: string; disabled?: boolean; steps?: Array<{ taskId?: string; stepKind?: string }>; }
export interface BulkCatalog { tasks: CatalogItem[]; workflows: CatalogItem[]; }
export interface BulkSelection { kind: CatalogKind; id: string; name: string; fingerprint: string; }
const fingerprint = (item: CatalogItem) => createHash("sha256").update(JSON.stringify(item)).digest("hex");
const list = (catalog: BulkCatalog, kind: CatalogKind) => kind === "task" ? catalog.tasks : catalog.workflows;

export function captureBulkSelection(catalog: BulkCatalog, taskIds: Set<string>, workflowIds: Set<string>): BulkSelection[] {
  return (["task", "workflow"] as const).flatMap(kind => list(catalog, kind)
    .filter(item => (kind === "task" ? taskIds : workflowIds).has(item.id))
    .map(item => ({ kind, id: item.id, name: item.name, fingerprint: fingerprint(item) })));
}

function dependencyIssues(catalog: BulkCatalog, selection: BulkSelection[]): string[] {
  const tasks = new Set(selection.filter(s => s.kind === "task").map(s => s.id));
  const workflows = new Set(selection.filter(s => s.kind === "workflow").map(s => s.id));
  return catalog.workflows.filter(w => !workflows.has(w.id)).flatMap(workflow => {
    const used = selection.filter(s => s.kind === "task" && tasks.has(s.id) && workflow.steps?.some(step =>
      (!step.stepKind || step.stepKind === "task") && step.taskId === s.id));
    return used.map(task => `"${task.name}" is used by workflow "${workflow.name}". Select that workflow too, or remove the task from its steps first.`);
  });
}

export function bulkSelectionIssues(catalog: BulkCatalog, selection: BulkSelection[], action: BulkAction,
  state: (kind: CatalogKind, id: string) => string): string[] {
  const issues: string[] = [];
  if (!selection.length) return ["Select at least one task or workflow."];
  for (const selected of selection) {
    const current = list(catalog, selected.kind).find(item => item.id === selected.id);
    if (!current || fingerprint(current) !== selected.fingerprint) {
      issues.push(`"${selected.name}" has changed or was removed. Close this dialog and review your selection again.`);
      continue;
    }
    const check = (kind: CatalogKind, item: CatalogItem) => {
      if (state(kind, item.id) !== "available") issues.push(`"${item.name}" is starting, running, or needs execution review. Finish or review that execution first.`);
    };
    check(selected.kind, current);
    if (selected.kind === "task") for (const workflow of catalog.workflows) {
      if (workflow.steps?.some(step => (!step.stepKind || step.stepKind === "task") && step.taskId === current.id)) check("workflow", workflow);
    }
    else for (const step of current.steps || []) {
      if (step.stepKind && step.stepKind !== "task") continue;
      const task = catalog.tasks.find(t => t.id === step.taskId);
      if (task) check("task", task);
    }
  }
  if (action.type === "delete") issues.push(...dependencyIssues(catalog, selection));
  if (action.type === "area" && action.area.trim().length > 200) issues.push("Use an area name of 200 characters or fewer.");
  return [...new Set(issues)];
}

/** Called inside the host's catalog transaction with execution admission paused. */
export async function applyBulkCatalogAction(catalog: BulkCatalog, selection: BulkSelection[], action: BulkAction,
  state: (kind: CatalogKind, id: string) => string, save: (validate: () => void) => Promise<void>): Promise<void> {
  const issues = bulkSelectionIssues(catalog, selection, action, state);
  if (issues.length) throw new Error(issues.join("\n"));
  const originals = selection.map(s => ({ ...s, item: list(catalog, s.kind).find(item => item.id === s.id)! }));
  const previousTasks = [...catalog.tasks], previousWorkflows = [...catalog.workflows];
  const previousAreas = originals.map(s => ({ item: s.item, area: s.item.area, present: Object.prototype.hasOwnProperty.call(s.item, "area") }));
  const previousAvailability = originals.map(s => ({ item: s.item, disabled: s.item.disabled, present: Object.prototype.hasOwnProperty.call(s.item, "disabled") }));
  if (action.type === "area") for (const { item } of originals) item.area = action.area.trim();
  else if (action.type === "availability") for (const { item } of originals) item.disabled = action.disabled;
  else {
    const tasks = new Set(selection.filter(s => s.kind === "task").map(s => s.id));
    const workflows = new Set(selection.filter(s => s.kind === "workflow").map(s => s.id));
    catalog.tasks = catalog.tasks.filter(t => !tasks.has(t.id));
    catalog.workflows = catalog.workflows.filter(w => !workflows.has(w.id));
  }
  const expected = originals.map(s => ({ ...s, fingerprint: fingerprint(s.item) }));
  const validate = () => {
    if (action.type === "delete") {
      const dependencies = dependencyIssues(catalog, selection);
      if (dependencies.length) throw new Error(dependencies.join("\n"));
      if (selection.some(s => list(catalog, s.kind).some(item => item.id === s.id))) throw new Error("The catalog changed while saving. Review your selection again.");
    } else if (expected.some(s => {
      const current = list(catalog, s.kind).find(item => item.id === s.id);
      return !current || fingerprint(current) !== s.fingerprint;
    })) throw new Error("A selected item changed while saving. Review your selection again.");
  };
  try { await save(validate); }
  catch (error) {
    if (action.type === "area") {
      for (const old of previousAreas) if (old.item.area === action.area.trim()) {
        if (old.present) old.item.area = old.area; else delete old.item.area;
      }
    } else if (action.type === "availability") {
      for (const old of previousAvailability) if (old.item.disabled === action.disabled) {
        if (old.present) old.item.disabled = old.disabled; else delete old.item.disabled;
      }
    } else {
      // Restore our removals in their original order without erasing later additions.
      const restore = (before: CatalogItem[], current: CatalogItem[], kind: CatalogKind) => {
        const removed = new Set(selection.filter(s => s.kind === kind).map(s => s.id));
        const byId = new Map(current.map(item => [item.id, item]));
        const result = before.flatMap(item => byId.has(item.id) ? [byId.get(item.id)!] : removed.has(item.id) ? [item] : []);
        const ids = new Set(result.map(item => item.id));
        return [...result, ...current.filter(item => !ids.has(item.id))];
      };
      catalog.tasks = restore(previousTasks, catalog.tasks, "task");
      catalog.workflows = restore(previousWorkflows, catalog.workflows, "workflow");
    }
    throw error;
  }
}
