import * as fs from "fs";
import * as path from "path";
import type { RunCheckpoint } from "./execution-journal";

// A terminal task without a recorded end time has an unknown duration. Never
// turn time since reopening into execution time for legacy checkpoints.
export function taskElapsedSeconds(task: any, now = Date.now()): number | undefined {
  const start = Date.parse(task.lastRun);
  const end = task.status === "running" ? now : Date.parse(task.runtimeExecution?.finishedAt);
  return Number.isFinite(start) && Number.isFinite(end) ? Math.max(0, Math.floor((end - start) / 1000)) : undefined;
}

function regularDirectory(directory: string) {
  if (!fs.existsSync(directory)) fs.mkdirSync(directory);
  const stat = fs.lstatSync(directory);
  if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error("Task history requires regular directories");
}

// Output is already redacted and committed to the journal. Stable names include
// the attempt index, so resume and repeated task/step IDs cannot duplicate or
// overwrite an earlier execution. This is a projection, never recovery input.
export function persistTaskHistory(vault: string, workflow: any, checkpoint: RunCheckpoint, settings: any): void {
  if (settings.logsEnabled === false) return;
  const root = fs.realpathSync(vault);
  const touched = new Set<string>();
  for (const [index, observed] of checkpoint.steps.entries()) {
    const step = workflow.steps.find((item: any) => item.id === observed.stepId);
    if (!step?.taskId || step.stepKind && step.stepKind !== "task" || observed.status === "in_flight" || !observed.startedAt) continue;
    if (!/^[a-zA-Z0-9_-]+$/.test(step.taskId)) throw new Error("Unsafe task history identity");
    let directory = root;
    for (const part of [".opencode", "logs", step.taskId]) {
      directory = path.join(directory, part); regularDirectory(directory);
    }
    const date = new Date(observed.startedAt), pad = (n: number) => String(n).padStart(2, "0");
    const timestamp = `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}.${String(date.getMilliseconds()).padStart(3,"0")}`;
    const file = path.join(directory, `${timestamp}_${checkpoint.runId}_${String(index).padStart(6, "0")}.log`);
    const content = `Run: ${checkpoint.runId}\nStep: ${observed.stepId}\nStatus: ${observed.status}\nStarted: ${observed.startedAt}\nFinished: ${observed.finishedAt || "unknown"}\n\n${observed.output || "(no output)"}`;
    try { fs.writeFileSync(file, content, {encoding:"utf8", flag:"wx"}); }
    catch (error: any) {
      if (error.code !== "EEXIST") throw error;
      const stat = fs.lstatSync(file);
      if (!stat.isFile() || stat.isSymbolicLink() || fs.readFileSync(file, "utf8") !== content) throw new Error("Task history conflicts with durable output");
    }
    touched.add(directory);
  }
  for (const directory of touched) {
    // Apply the same user retention settings as plugin task logs, including
    // legacy filenames. Never follow a link while reading or pruning history.
    const files = fs.readdirSync(directory).filter(name => name.endsWith(".log") && name !== "latest.log").sort();
    const max = settings.maxLogsPerTask ?? 50, days = settings.logRetentionDays ?? 30;
    const retained: string[] = [];
    for (const name of files) {
      const file = path.join(directory, name), stat = fs.lstatSync(file);
      if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("Task history requires regular files");
      const match = name.match(/^(\d{4}-\d{2}-\d{2})_(\d{2})-(\d{2})-(\d{2})/);
      const date = match ? Date.parse(`${match[1]}T${match[2]}:${match[3]}:${match[4]}`) : NaN;
      if (days > 0 && date < Date.now() - days * 86400000) fs.unlinkSync(file);
      else retained.push(name);
    }
    while (max > 0 && retained.length > max) fs.unlinkSync(path.join(directory, retained.shift()!));
    const latest = path.join(directory, "latest.log");
    const stat = fs.lstatSync(latest, {throwIfNoEntry:false});
    if (stat) {
      if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("Task history latest must be a regular file");
    }
    if (retained.length) fs.writeFileSync(latest, fs.readFileSync(path.join(directory, retained[retained.length - 1])));
  }
}
