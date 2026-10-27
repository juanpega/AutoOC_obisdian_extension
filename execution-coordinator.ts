import type { ObservedVersion } from "./settings-writer";
import * as fs from "fs";
import * as path from "path";
import { execFileSync } from "child_process";
import { physicalPath, isWithinPhysicalPath, samePhysicalPath } from "./path-identity";
import type { ExecutionLease } from "./execution-lease";
import type { PreparedWorkflow } from "./workflow-definition";
import { readExecutionCheckpoint, checkpointUncertainties, type RunCheckpoint } from "./execution-journal";

export type ConcurrencyPolicy = "exclusive" | "independent";
// Only these fixed host diagnostics may cross the mailbox. Never forward an
// arbitrary provider/filesystem message, which can contain private data.
const admissionDiagnostics=new Set([
  'A shared workflow is already executing',
  'A shared workflow is already executing; definition is already starting',
  'A shared workflow is already executing; definition or referenced task is reserved',
  'Execution outcome requires continuation or reconciliation; reservation retained',
  'Exclusive execution must finish before shared execution',
  'Execution resource is occupied (workspace or Git repository)',
  'Concurrent execution limit reached (2)',
  'Catalog has unresolved running activity; verify its owner before execution',
]);
export function executionAdmissionDiagnostic(error:unknown):string|undefined {
  const message=(error as {message?:unknown})?.message;
  return typeof message==='string' && admissionDiagnostics.has(message) ? message : undefined;
}
export function validateConcurrency(item:Readonly<Record<string,any>>):void {
  if(item.concurrency !== undefined && item.concurrency !== "exclusive" && item.concurrency !== "independent") throw new Error("Invalid concurrency policy");
}
type Resources = {exclusive:boolean; tasks:Set<string>; directories:string[]; repositories:Set<string>};
function resources(definition:PreparedWorkflow,vault:string):Resources {
  const {workflow,tasks,settings}=definition;
  for(const item of [workflow,...tasks])validateConcurrency(item);
  const standalone=workflow.id.startsWith('@task:');
  const result:Resources={exclusive:(standalone ? tasks[0]?.concurrency : workflow.concurrency)!=="independent",tasks:new Set(tasks.map(t=>t.id)),directories:[],repositories:new Set()};
  for(const item of [...workflow.steps.filter((s:any)=>s.stepKind==='code'),...tasks] as any[]) {
    if(item.interactiveTerminal || (item.taskKind===undefined && item.stepKind!=='code' && settings.defaultInteractiveTerminal)) result.exclusive=true;
    if(item.stepKind==='code' || item.taskKind==='code') {
      if(item.codeAllowVault || item.codeAllowFiles || item.codeAllowTerminal || item.branch || workflow.handoffBranch)result.exclusive=true;
      continue;
    }
    const directory=physicalPath(item.workingDirectory || settings.workingDirectory || vault);
    result.directories.push(directory);
    // No Git probe failure may be interpreted as proof of independence. Walk
    // physical ancestors to distinguish a non-repository from an unreadable one.
    let parent=directory,gitRoot:string|undefined;
    for(;;){if(fs.existsSync(path.join(parent,'.git'))){gitRoot=parent;break;}const next=path.dirname(parent);if(next===parent)break;parent=next;}
    if(gitRoot) {
      const common=execFileSync('git',['-c',`safe.directory=${gitRoot.replace(/\\/g,'/')}`,'rev-parse','--git-common-dir'],{cwd:gitRoot,encoding:'utf8',stdio:['ignore','pipe','pipe'],windowsHide:true}).trim();
      result.repositories.add(physicalPath(path.resolve(gitRoot,common)));
    }
    // Engines can access their workspace. Their declared directories are a
    // cooperation contract for trusted tasks, never a security sandbox.
  }
  if(workflow.steps.some((s:any)=>s.transitionMode==='eval' || s.transitions?.some((t:any)=>t.mode==='eval')))result.exclusive=true;
  return result;
}
const coordinators=new WeakMap<ExecutionLease,ExecutionCoordinator>();
export function executionCoordinator(lease:ExecutionLease):ExecutionCoordinator {
  let value=coordinators.get(lease);if(!value){value=new ExecutionCoordinator(lease);coordinators.set(lease,value);}return value;
}
export class ExecutionAdmission {
  runId?:string;
  advancing=true;
  confirmedTerminal=false;
  constructor(readonly coordinator:ExecutionCoordinator,readonly definition:PreparedWorkflow,readonly resources:Resources,readonly vault:string){}
  assertOwned(lease:ExecutionLease,definition:PreparedWorkflow):void {
    this.coordinator.assertOwned(this,lease);
    if(this.definition.hash!==definition.hash)throw new Error('Admission definition changed');
    const current=resources(definition,this.vault);
    if(JSON.stringify(current.directories)!==JSON.stringify(this.resources.directories) || JSON.stringify([...current.repositories])!==JSON.stringify([...this.resources.repositories]))throw new Error('Execution resource identity changed; reservation retained');
  }
  bind(checkpoint:RunCheckpoint):void {
    this.assertOwned(this.coordinator.lease,this.definition);
    if(checkpoint.workflowId!==this.definition.workflow.id || checkpoint.definitionHash!==this.definition.hash || this.runId && this.runId!==checkpoint.runId)throw new Error('Admission checkpoint identity changed');
    this.runId=checkpoint.runId;
  }
  knows(runId:string):boolean {return this.coordinator.knows(runId);}
  confirm(checkpoint:RunCheckpoint):void {
    this.bind(checkpoint);
    this.confirmedTerminal=['completed','failed','abandoned'].includes(checkpoint.phase) && !checkpointUncertainties(checkpoint).length;
  }
  finish():void {this.coordinator.finish(this);}
}
export class ExecutionCoordinator {
  catalogVersion?:ObservedVersion;
  private sessions=new Set<ExecutionAdmission>();
  constructor(readonly lease:ExecutionLease){}
  assertOwned(session:ExecutionAdmission,lease:ExecutionLease):void {
    lease.assertOwned();
    if(lease!==this.lease || !this.sessions.has(session) || !session.advancing)throw new Error('Execution admission is not owned');
  }
  knows(runId:string):boolean {return [...this.sessions].some(s=>s.runId===runId && s.advancing);}
  admit(definition:PreparedWorkflow,vault:string,resumeRunId?:string):ExecutionAdmission {
    this.lease.assertOwned();
    const requested=resources(definition,vault);
    for(const session of this.sessions) {
      if(session.advancing || !session.runId)continue;
      // Only a validated durable disposition/abandonment from the official
      // procedure resolves retained uncertainty. Missing evidence stays blocked.
      try {
        const state=readExecutionCheckpoint(this.lease.directory,session.runId);
        if(state.workflowId===session.definition.workflow.id && state.definitionHash===session.definition.hash && (state.disposition || state.phase==='abandoned'))this.sessions.delete(session);
      } catch { /* Ownership or damaged evidence never authorizes release. */ }
    }
    const previous=[...this.sessions].find(s=>s.runId===resumeRunId && !!resumeRunId);
    if(previous && !previous.advancing && previous.definition.hash===definition.hash) {
      previous.advancing=true;previous.confirmedTerminal=false;return previous;
    }
    for(const current of this.sessions) {
      if(current.definition.workflow.id===definition.workflow.id || [...requested.tasks].some(id=>current.resources.tasks.has(id)))throw new Error('A shared workflow is already executing; definition or referenced task is reserved');
      if(!current.advancing)throw new Error('Execution outcome requires continuation or reconciliation; reservation retained');
      if(requested.exclusive || current.resources.exclusive)throw new Error('Exclusive execution must finish before shared execution');
      if(requested.directories.some(a=>current.resources.directories.some(b=>isWithinPhysicalPath(a,b)||isWithinPhysicalPath(b,a))) || [...requested.repositories].some(a=>[...current.resources.repositories].some(b=>samePhysicalPath(a,b))))throw new Error('Execution resource is occupied (workspace or Git repository)');
    }
    if(this.sessions.size>=2)throw new Error('Concurrent execution limit reached (2)');
    const session=new ExecutionAdmission(this,definition,requested,vault);this.sessions.add(session);return session;
  }
  finish(session:ExecutionAdmission):void {
    session.advancing=false;
    // No run means admission/preflight failed before journal creation. Every
    // uncertain or suspended durable execution keeps its resources reserved.
    if(!session.runId || session.confirmedTerminal)this.sessions.delete(session);
  }
}
