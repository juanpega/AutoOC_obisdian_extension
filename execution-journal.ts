import * as fs from "fs";
import * as path from "path";
import { randomUUID, createHash } from "crypto";
import { physicalPath } from "./path-identity";
import { atomicSettingsWrite } from "./settings-writer";
import type { ExecutionLease } from "./execution-lease";

type Phase = "ready" | "in_flight" | "completed" | "failed" | "abandoned";
const writes = new Map<string, Promise<unknown>>();
export interface RunCheckpoint {
  schemaVersion: 1;
  runId: string;
  workflowId: string;
  definitionHash: string;
  revision: number;
  createdAt?: string;
  phase: Phase;
  disposition?: TerminalDisposition;
  abandonment?: {at:string;reason:string;outcome:"unknown";acknowledgedUnknownEffects:true;previousPhase:"ready"|"in_flight";previousNextStepId:string;previousRevision:number;snapshot:string};
  nextStepId: string | null;
  steps: Array<{ stepId: string; status: "in_flight" | "completed" | "failed"; output?: string; startedAt?:string; finishedAt?:string; codexThreadId?: string; codexTurnId?: string;
    branch?: {directory:string;name:string};
    result?: {succeeded:boolean;output:string;cancelled?:boolean};
    evaluations?: Array<{key:string;status:"in_flight"|"completed";output?:string}>;
    approval?: {token:string;ownerToken:string;requestId:string|number;kind:string;summary:string};
  }>;
}

export interface DispositionLocation { vault:string; installationDirectory:string; runtimeDirectory:string }
export interface TerminalDisposition {
  at:string; reason:string; outcome:"unknown"; acknowledgedUnknownEffects:true;
  previousRevision:number; snapshot:string; snapshotHash:string;
  vault:string; installationDirectory:string; runtimeDirectory:string;
  vaultIdentity:string; installationIdentity:string; runtimeIdentity:string;
  workflowId:string; runId:string; definitionHash:string; causes:string[];
}

export function checkpointUncertainties(state:RunCheckpoint):string[] {
  return state.steps.flatMap((step,index)=>[
    ...(step.status==="in_flight" ? [`${index}:in_flight`] : []),
    ...(step.approval ? [`${index}:approval`] : []),
    ...(step.result?.cancelled ? [`${index}:cancelled`] : []),
    ...(step.evaluations || []).filter(e=>e.status!=="completed").map(e=>`${index}:evaluation:${e.key}`)
  ]);
}

function directoryIdentity(directory:string):string {
  const stat=fs.lstatSync(directory);
  if(!stat.isDirectory() || stat.isSymbolicLink())throw new Error("Unsafe disposition directory");
  return `${stat.dev}:${stat.ino}:${stat.birthtimeMs}`;
}

export function dispositionLocation(location:DispositionLocation) {
  const vault=physicalPath(location.vault),installationDirectory=physicalPath(location.installationDirectory),runtimeDirectory=physicalPath(location.runtimeDirectory);
  if(path.relative(installationDirectory,runtimeDirectory)!=="runtime" || path.relative(vault,installationDirectory).split(path.sep).includes(".."))throw new Error("Disposition location mismatch");
  // Inspect every installation component before trusting its physical identity.
  let current=vault;
  for(const part of path.relative(vault,runtimeDirectory).split(path.sep)) {current=path.join(current,part);directoryIdentity(current);}
  return {vault,installationDirectory,runtimeDirectory,vaultIdentity:directoryIdentity(vault),installationIdentity:directoryIdentity(installationDirectory),runtimeIdentity:directoryIdentity(runtimeDirectory)};
}

export function validateExecutionCheckpoint(value: any): asserts value is RunCheckpoint {
  const validDate=(date:any)=>date === undefined || typeof date === "string" && Number.isFinite(Date.parse(date));
  if (!value || value.schemaVersion !== 1 || !/^[a-zA-Z0-9-]+$/.test(value.runId || "") ||
      typeof value.workflowId !== "string" || !value.workflowId ||
      !/^[a-f0-9]{64}$/.test(value.definitionHash || "") ||
      !Number.isSafeInteger(value.revision) || value.revision < 0 ||
      !["ready", "in_flight", "completed", "failed", "abandoned"].includes(value.phase) ||
      !(value.nextStepId === null || typeof value.nextStepId === "string" && value.nextStepId.length > 0) ||
      !Array.isArray(value.steps) || !validDate(value.createdAt)) throw new Error("Invalid execution checkpoint");
  for (const [index, step] of value.steps.entries()) {
    if(step?.branch && (typeof step.branch.directory!=="string" || !path.isAbsolute(step.branch.directory) || typeof step.branch.name!=="string" || !step.branch.name)) throw new Error("Invalid branch checkpoint");
    if(step?.result && (typeof step.result.succeeded!=="boolean" || typeof step.result.output!=="string" || step.result.cancelled!==undefined && (typeof step.result.cancelled!=="boolean" || step.result.cancelled && step.result.succeeded))) throw new Error("Invalid observed result");
    if(step?.evaluations!==undefined && (!step.result || !Array.isArray(step.evaluations) || new Set(step.evaluations.map((e:any)=>e.key)).size!==step.evaluations.length || step.evaluations.some((e:any)=>typeof e.key!=="string" || !["in_flight","completed"].includes(e.status) || e.status==="completed" && typeof e.output!=="string"))) throw new Error("Invalid evaluation checkpoint");
    if(step?.approval && (step.status!=="in_flight" || !/^[a-f0-9-]+$/.test(step.approval.token) || !/^[a-f0-9-]+$/.test(step.approval.ownerToken) || !["string","number"].includes(typeof step.approval.requestId) || !["command","file-change","permissions"].includes(step.approval.kind) || typeof step.approval.summary!=="string")) throw new Error("Invalid approval checkpoint");
    if (!validDate(step?.startedAt)) throw new Error("Invalid step timestamp");
    if (!validDate(step?.finishedAt) || step?.finishedAt !== undefined && (step.status === "in_flight" || !step.startedAt || Date.parse(step.finishedAt) < Date.parse(step.startedAt))) throw new Error("Invalid step finish timestamp");
    if (step?.codexThreadId !== undefined && (typeof step.codexThreadId !== "string" || !step.codexThreadId.trim())) throw new Error("Invalid Codex identity");
    if (step?.codexTurnId !== undefined && (!step.codexThreadId || typeof step.codexTurnId !== "string" || !step.codexTurnId.trim())) throw new Error("Invalid Codex turn identity");
    if (!step || typeof step.stepId !== "string" || !step.stepId ||
        !["in_flight", "completed", "failed"].includes(step.status) ||
        (step.status !== "in_flight" && typeof step.output !== "string") ||
        (step.status === "in_flight" && (index !== value.steps.length - 1 || step.output !== undefined)))
      throw new Error("Invalid step checkpoint");
  }
  const last = value.steps[value.steps.length - 1];
  if(value.disposition!==undefined) {
    const d=value.disposition;
    if(!["failed","completed"].includes(value.phase) || typeof d.at!=="string" || !validDate(d.at) ||
      typeof d.reason!=="string" || !d.reason.trim() || d.reason.length>1000 || d.outcome!=="unknown" || d.acknowledgedUnknownEffects!==true ||
      d.previousRevision!==value.revision-1 || d.snapshot!==`disposition-${value.runId}-${d.previousRevision}.snapshot` || !/^[a-f0-9]{64}$/.test(d.snapshotHash || "") ||
      d.runId!==value.runId || d.workflowId!==value.workflowId || d.definitionHash!==value.definitionHash ||
      !["vault","installationDirectory","runtimeDirectory"].every(key=>typeof d[key]==="string" && path.isAbsolute(d[key])) ||
      !["vaultIdentity","installationIdentity","runtimeIdentity"].every(key=>typeof d[key]==="string" && d[key]) ||
      !checkpointUncertainties(value).length || JSON.stringify(d.causes)!==JSON.stringify(checkpointUncertainties(value)))throw new Error("Invalid terminal disposition");
  }
  const abandoned=value.phase === "abandoned", decision=value.abandonment;
  if (abandoned ? !decision || typeof decision.at!=="string" || !validDate(decision.at) ||
      typeof decision.reason!=="string" || !decision.reason.trim() || decision.reason.length>1000 || decision.outcome!=="unknown" || decision.acknowledgedUnknownEffects!==true ||
      !["ready","in_flight"].includes(decision.previousPhase) || typeof decision.previousNextStepId!=="string" || !decision.previousNextStepId ||
      !Number.isSafeInteger(decision.previousRevision) || decision.previousRevision!==value.revision-1 ||
      decision.snapshot!==`abandonment-${value.runId}-${decision.previousRevision}.snapshot` ||
      (decision.previousPhase==="in_flight")!==(last?.status==="in_flight") ||
      decision.previousPhase==="in_flight" && decision.previousNextStepId!==last?.stepId
    : decision!==undefined) throw new Error("Invalid abandonment decision");
  if ((!abandoned && (value.phase === "in_flight") !== (last?.status === "in_flight")) ||
      (value.phase === "in_flight" && value.nextStepId !== last.stepId) ||
      (["ready", "in_flight"].includes(value.phase) && value.nextStepId === null) ||
      (["completed", "failed", "abandoned"].includes(value.phase) && value.nextStepId !== null))
    throw new Error("Inconsistent execution checkpoint");
}

// Host must persist begin() BEFORE performing effects, and finish() only AFTER
// observing the result. A recovered in_flight step needs reconciliation, never
// an automatic replay. Outputs supplied here must already be redacted by host.
export function readExecutionCheckpoint(directory:string,runId:string):RunCheckpoint {
  if (!/^[a-zA-Z0-9-]+$/.test(runId)) throw new Error("Invalid execution identity");
  const file = path.join(directory, runId + ".json");
  const stat = fs.lstatSync(file);
  if (stat.isSymbolicLink() || !stat.isFile() || stat.nlink!==1) throw new Error("Execution checkpoint must be a regular file");
  let state:unknown;
  try { state = JSON.parse(fs.readFileSync(file,"utf8")); }
  catch { throw new Error("Cannot read valid execution checkpoint"); }
  validateExecutionCheckpoint(state);
  if (state.runId !== runId) throw new Error("Execution identity changed");
  if(state.disposition) {
    const d=state.disposition,location=dispositionLocation(d);
    if(physicalPath(directory)!==location.runtimeDirectory || Object.entries(location).some(([key,value])=>(d as any)[key]!==value))throw new Error("Disposition installation identity changed");
    const snapshot=path.join(directory,d.snapshot),stat=fs.lstatSync(snapshot);
    if(!stat.isFile() || stat.isSymbolicLink() || stat.nlink!==1)throw new Error("Unsafe disposition snapshot");
    const original=fs.readFileSync(snapshot);
    if(createHash("sha256").update(original).digest("hex")!==d.snapshotHash)throw new Error("Disposition snapshot changed");
    const prior=JSON.parse(original.toString("utf8"));validateExecutionCheckpoint(prior);
    const {disposition,...expected}=state;expected.revision--;
    if(JSON.stringify(prior)!==JSON.stringify(expected))throw new Error("Disposition snapshot does not match checkpoint");
  }
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

  disposeTerminal(expectedRevision:number,reason:string,acknowledgedUnknownEffects:boolean,location:DispositionLocation):Promise<void> {
    return this.update((state,original)=>{
      if(state.revision!==expectedRevision)throw new Error("Execution revision changed; inspect again");
      if(state.disposition)throw new Error("Terminal execution already disposed");
      if(!["failed","completed"].includes(state.phase) || !checkpointUncertainties(state).length)throw new Error("No terminal uncertainty to dispose");
      if(acknowledgedUnknownEffects!==true)throw new Error("Explicit acknowledgement of unknown effects is required");
      if(typeof reason!=="string" || !reason.trim() || reason.length>1000)throw new Error("A concise disposition reason is required");
      const identity=dispositionLocation(location);
      if(identity.runtimeDirectory!==physicalPath(this.lease.directory))throw new Error("Disposition lease identity mismatch");
      const snapshot=`disposition-${state.runId}-${state.revision}.snapshot`,file=path.join(this.lease.directory,snapshot);
      if(fs.existsSync(file)) {
        const stat=fs.lstatSync(file);
        if(!stat.isFile() || stat.isSymbolicLink() || stat.nlink!==1 || fs.readFileSync(file,"utf8")!==original)throw new Error("Disposition snapshot changed");
      } else {
        const fd=fs.openSync(file,"wx",0o600);
        try {fs.writeFileSync(fd,original);fs.fsyncSync(fd);} finally {fs.closeSync(fd);}
      }
      this.lease.assertOwned();
      state.disposition={...identity,at:new Date().toISOString(),reason:reason.trim(),outcome:"unknown",acknowledgedUnknownEffects:true,
        previousRevision:state.revision,snapshot,snapshotHash:createHash("sha256").update(original).digest("hex"),
        workflowId:state.workflowId,runId:state.runId,definitionHash:state.definitionHash,causes:checkpointUncertainties(state)};
    });
  }

  abandon(expectedRevision:number, reason:string, acknowledgedUnknownEffects:boolean):Promise<void> {
    return this.update(state=>{
      if(state.revision!==expectedRevision)throw new Error("Execution revision changed; inspect again");
      if(!["ready","in_flight"].includes(state.phase))throw new Error("Execution is already terminal");
      if(acknowledgedUnknownEffects!==true)throw new Error("Explicit acknowledgement of unknown effects is required");
      if(typeof reason!=="string" || !reason.trim() || reason.length>1000)throw new Error("A concise abandonment reason is required");
      const snapshot=`abandonment-${state.runId}-${state.revision}.snapshot`, file=path.join(this.lease.directory,snapshot);
      const original=JSON.stringify(state);
      if(fs.existsSync(file)) {
        const stat=fs.lstatSync(file);
        if(!stat.isFile() || stat.isSymbolicLink() || stat.nlink!==1 || fs.readFileSync(file,'utf8')!==original)throw new Error("Abandonment snapshot changed");
      } else {
        const fd=fs.openSync(file,'wx',0o600);
        try {fs.writeFileSync(fd,original);fs.fsyncSync(fd);} finally {fs.closeSync(fd);}
      }
      state.abandonment={at:new Date().toISOString(),reason:reason.trim(),outcome:"unknown",acknowledgedUnknownEffects:true,
        previousPhase:state.phase as "ready"|"in_flight",previousNextStepId:state.nextStepId!,previousRevision:state.revision,snapshot};
      state.phase="abandoned";state.nextStepId=null;
    });
  }

  private update(change: (next: RunCheckpoint, original:string) => void): Promise<void> {
    const operation = (writes.get(this.file) || Promise.resolve()).then(async () => {
      this.lease.assertOwned();
      if (fs.lstatSync(this.file).isSymbolicLink()) throw new Error("Execution checkpoint cannot be a link");
      const previous = fs.readFileSync(this.file, "utf8");
      if (JSON.stringify(JSON.parse(previous)) !== JSON.stringify(this.state)) throw new Error("Execution checkpoint changed");
      const next = this.snapshot();
      if(next.disposition)throw new Error("Terminal execution already disposed; historical evidence is immutable");
      change(next,previous); next.revision++; validateExecutionCheckpoint(next);
      await atomicSettingsWrite(this.file, next, fs.promises, async()=>{
        this.lease.assertOwned();
        const stat=fs.lstatSync(this.file);
        if(!stat.isFile() || stat.isSymbolicLink() || stat.nlink!==1 || fs.readFileSync(this.file,"utf8")!==previous)throw new Error("Execution checkpoint changed before publication");
        if(next.disposition) {
          const d=next.disposition;
          if(Object.entries(dispositionLocation(d)).some(([key,value])=>(d as any)[key]!==value))throw new Error("Disposition identity changed");
          const snapshot=path.join(this.lease.directory,d.snapshot),stat=fs.lstatSync(snapshot);
          if(!stat.isFile() || stat.isSymbolicLink() || stat.nlink!==1 || fs.readFileSync(snapshot,'utf8')!==previous)throw new Error("Disposition snapshot changed before publication");
        }
      });
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

  recordCodexThread(stepId: string, threadId: string, turnId?: string, expectedStepIndex?: number): Promise<void> {
    return this.update(state => {
      if (expectedStepIndex !== undefined && expectedStepIndex !== state.steps.length - 1) throw new Error("Codex step occurrence changed");
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
      if (step.startedAt) step.finishedAt = new Date(Math.max(Date.now(), Date.parse(step.startedAt))).toISOString();
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
