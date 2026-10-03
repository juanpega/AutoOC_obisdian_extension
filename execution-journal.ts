import * as fs from "fs";
import * as path from "path";
import { randomUUID } from "crypto";
import { atomicSettingsWrite } from "./settings-writer";
import type { ExecutionLease } from "./execution-lease";

type Phase = "ready" | "in_flight" | "completed" | "failed";
const writes = new Map<string, Promise<unknown>>();
export interface RunCheckpoint {
  schemaVersion: 1;
  runId: string;
  workflowId: string;
  definitionHash: string;
  revision: number;
  createdAt?: string;
  phase: Phase;
  nextStepId: string | null;
  steps: Array<{ stepId: string; status: "in_flight" | "completed" | "failed"; output?: string; startedAt?:string; codexThreadId?: string; codexTurnId?: string;
    branch?: {directory:string;name:string};
    result?: {succeeded:boolean;output:string;cancelled?:boolean};
    evaluations?: Array<{key:string;status:"in_flight"|"completed";output?:string}>;
    approval?: {token:string;ownerToken:string;requestId:string|number;kind:string;summary:string};
  }>;
}

export function validateExecutionCheckpoint(value: any): asserts value is RunCheckpoint {
  const validDate=(date:any)=>date === undefined || typeof date === "string" && Number.isFinite(Date.parse(date));
  if (!value || value.schemaVersion !== 1 || !/^[a-zA-Z0-9-]+$/.test(value.runId || "") ||
      typeof value.workflowId !== "string" || !value.workflowId ||
      !/^[a-f0-9]{64}$/.test(value.definitionHash || "") ||
      !Number.isSafeInteger(value.revision) || value.revision < 0 ||
      !["ready", "in_flight", "completed", "failed"].includes(value.phase) ||
      !(value.nextStepId === null || typeof value.nextStepId === "string" && value.nextStepId.length > 0) ||
      !Array.isArray(value.steps) || !validDate(value.createdAt)) throw new Error("Invalid execution checkpoint");
  for (const [index, step] of value.steps.entries()) {
    if(step?.branch && (typeof step.branch.directory!=="string" || !path.isAbsolute(step.branch.directory) || typeof step.branch.name!=="string" || !step.branch.name)) throw new Error("Invalid branch checkpoint");
    if(step?.result && (typeof step.result.succeeded!=="boolean" || typeof step.result.output!=="string" || step.result.cancelled!==undefined && (typeof step.result.cancelled!=="boolean" || step.result.cancelled && step.result.succeeded))) throw new Error("Invalid observed result");
    if(step?.evaluations!==undefined && (!step.result || !Array.isArray(step.evaluations) || new Set(step.evaluations.map((e:any)=>e.key)).size!==step.evaluations.length || step.evaluations.some((e:any)=>typeof e.key!=="string" || !["in_flight","completed"].includes(e.status) || e.status==="completed" && typeof e.output!=="string"))) throw new Error("Invalid evaluation checkpoint");
    if(step?.approval && (step.status!=="in_flight" || !/^[a-f0-9-]+$/.test(step.approval.token) || !/^[a-f0-9-]+$/.test(step.approval.ownerToken) || !["string","number"].includes(typeof step.approval.requestId) || !["command","file-change","permissions"].includes(step.approval.kind) || typeof step.approval.summary!=="string")) throw new Error("Invalid approval checkpoint");
    if (!validDate(step?.startedAt)) throw new Error("Invalid step timestamp");
    if (step?.codexThreadId !== undefined && (typeof step.codexThreadId !== "string" || !step.codexThreadId.trim())) throw new Error("Invalid Codex identity");
    if (step?.codexTurnId !== undefined && (!step.codexThreadId || typeof step.codexTurnId !== "string" || !step.codexTurnId.trim())) throw new Error("Invalid Codex turn identity");
    if (!step || typeof step.stepId !== "string" || !step.stepId ||
        !["in_flight", "completed", "failed"].includes(step.status) ||
        (step.status !== "in_flight" && typeof step.output !== "string") ||
        (step.status === "in_flight" && (index !== value.steps.length - 1 || step.output !== undefined)))
      throw new Error("Invalid step checkpoint");
  }
  const last = value.steps[value.steps.length - 1];
  if ((value.phase === "in_flight") !== (last?.status === "in_flight") ||
      (value.phase === "in_flight" && value.nextStepId !== last.stepId) ||
      (["ready", "in_flight"].includes(value.phase) && value.nextStepId === null) ||
      (["completed", "failed"].includes(value.phase) && value.nextStepId !== null))
    throw new Error("Inconsistent execution checkpoint");
}

// Host must persist begin() BEFORE performing effects, and finish() only AFTER
// observing the result. A recovered in_flight step needs reconciliation, never
// an automatic replay. Outputs supplied here must already be redacted by host.
export function readExecutionCheckpoint(directory:string,runId:string):RunCheckpoint {
  if (!/^[a-zA-Z0-9-]+$/.test(runId)) throw new Error("Invalid execution identity");
  const file = path.join(directory, runId + ".json");
  const stat = fs.lstatSync(file);
  if (stat.isSymbolicLink() || !stat.isFile()) throw new Error("Execution checkpoint must be a regular file");
  let state:unknown;
  try { state = JSON.parse(fs.readFileSync(file,"utf8")); }
  catch { throw new Error("Cannot read valid execution checkpoint"); }
  validateExecutionCheckpoint(state);
  if (state.runId !== runId) throw new Error("Execution identity changed");
  return state;
}

export class ExecutionJournal {
  private constructor(private lease: ExecutionLease, private file: string, private state: RunCheckpoint) {}

  static async create(lease: ExecutionLease, workflowId: string, definitionHash: string, entryStep: string) {
    lease.assertOwned();
    const state: RunCheckpoint = {schemaVersion:1,runId:randomUUID(),workflowId,definitionHash,revision:0,createdAt:new Date().toISOString(),phase:"ready",nextStepId:entryStep,steps:[]};
    validateExecutionCheckpoint(state);
    const file = path.join(lease.directory, state.runId + ".json");
    if (fs.existsSync(file)) throw new Error("Execution identity already exists");
    await atomicSettingsWrite(file, state);
    lease.assertOwned();
    return new ExecutionJournal(lease, file, state);
  }

  static open(lease: ExecutionLease, runId: string, definitionHash: string) {
    lease.assertOwned();
    if (!/^[a-zA-Z0-9-]+$/.test(runId)) throw new Error("Invalid execution identity");
    const file = path.join(lease.directory, runId + ".json");
    if (fs.lstatSync(file).isSymbolicLink()) throw new Error("Execution checkpoint cannot be a link");
    const state = readExecutionCheckpoint(lease.directory,runId);
    if (state.runId !== runId || state.definitionHash !== definitionHash) throw new Error("Execution identity or definition changed");
    return new ExecutionJournal(lease, file, state);
  }

  snapshot(): RunCheckpoint { return JSON.parse(JSON.stringify(this.state)); }

  private update(change: (next: RunCheckpoint) => void): Promise<void> {
    const operation = (writes.get(this.file) || Promise.resolve()).then(async () => {
      this.lease.assertOwned();
      if (fs.lstatSync(this.file).isSymbolicLink()) throw new Error("Execution checkpoint cannot be a link");
      const previous = fs.readFileSync(this.file, "utf8");
      if (JSON.stringify(JSON.parse(previous)) !== JSON.stringify(this.state)) throw new Error("Execution checkpoint changed");
      const next = this.snapshot();
      change(next); next.revision++; validateExecutionCheckpoint(next);
      await atomicSettingsWrite(this.file, next);
      this.lease.assertOwned();
      this.state = next;
    });
    const settled = operation.catch(() => {});
    writes.set(this.file, settled);
    void settled.then(() => { if (writes.get(this.file) === settled) writes.delete(this.file); });
    return operation;
  }

  begin(stepId: string): Promise<void> {
    return this.update(state => {
      if (state.phase !== "ready" || state.nextStepId !== stepId) throw new Error("Step is not ready; reconcile any interrupted execution first");
      state.phase = "in_flight";
      state.steps.push({stepId,status:"in_flight",startedAt:new Date().toISOString()});
    });
  }

  recordCodexThread(stepId: string, threadId: string, turnId?: string): Promise<void> {
    return this.update(state => {
      const step = state.steps[state.steps.length - 1];
      if (state.phase !== "in_flight" || step?.stepId !== stepId) throw new Error("No matching step in flight");
      if (step.codexThreadId && step.codexThreadId !== threadId) throw new Error("Codex execution identity changed");
      step.codexThreadId = threadId;
      if (turnId !== undefined) {
        if (step.codexTurnId && step.codexTurnId !== turnId) throw new Error("Codex turn identity changed");
        step.codexTurnId = turnId;
      }
    });
  }

  finish(stepId: string, succeeded: boolean, redactedOutput: string, nextStepId: string | null): Promise<void> {
    return this.update(state => {
      const step = state.steps[state.steps.length - 1];
      if (state.phase !== "in_flight" || step?.stepId !== stepId) throw new Error("No matching step in flight");
      step.status = succeeded ? "completed" : "failed"; step.output = redactedOutput;
      delete step.approval;
      state.nextStepId = nextStepId;
      state.phase = nextStepId !== null ? "ready" : succeeded ? "completed" : "failed";
    });
  }

  recordBranch(branch:{directory:string;name:string}) {return this.update(state=>{this.current(state).branch=branch;});}
  recordResult(result:{succeeded:boolean;output:string;cancelled?:boolean}) {
    return this.update(state=>{const step=this.current(state);if(step.result)throw new Error("Result already observed");step.result=result;delete step.approval;});
  }
  recordEvaluation(key:string,output?:string) {
    return this.update(state=>{
      const step=this.current(state);if(!step.result)throw new Error("Observe task result before evaluation");
      const entries=step.evaluations ||= [],entry=entries.find(e=>e.key===key);
      if(output===undefined) {if(entry)throw new Error("Evaluation already started");entries.push({key,status:"in_flight"});}
      else {if(!entry || entry.status!=="in_flight")throw new Error("Evaluation is not in flight");entry.status="completed";entry.output=output;}
    });
  }
  recordApproval(approval?:RunCheckpoint["steps"][number]["approval"]) {return this.update(state=>{const step=this.current(state);if(approval && step.approval)throw new Error("Approval already pending");step.approval=approval;});}
  private current(state:RunCheckpoint) {
    const step=state.steps[state.steps.length-1];
    if(state.phase!=="in_flight" || step?.status!=="in_flight")throw new Error("No step in flight");
    return step;
  }
}
