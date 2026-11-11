import type { ObservedVersion } from "./settings-writer";
import * as fs from "fs";
import * as path from "path";
import { execFileSync } from "child_process";
import { physicalPath, isWithinPhysicalPath, samePhysicalPath } from "./path-identity";
import type { ExecutionLease } from "./execution-lease";
import type { PreparedWorkflow } from "./workflow-definition";
import { readExecutionCheckpoint, checkpointUncertainties, type RunCheckpoint } from "./execution-journal";

import { concurrencySettings, validateConcurrency } from "./execution-concurrency-settings";
import { independentGitWorkspaces } from "./workspace-conflicts";
export { validateConcurrency, type ConcurrencyPolicy } from "./execution-concurrency-settings";
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
  if ((error as {name?:unknown})?.name === 'DisabledExecutionError') return 'Selected task, workflow or step is disabled. Inspect list/status and enable it in AutoOC before running.';
  const message=(error as {message?:unknown})?.message;
  return typeof message==='string' && (admissionDiagnostics.has(message) || /^Concurrent execution limit reached \([1-9][0-9]{0,15}\)$/.test(message)) ? message : undefined;
}
export interface ExecutionWorkspace { directory: string; worktree: boolean; }
type Resources = {exclusive:boolean; sharedWorkspace:boolean; tasks:Set<string>; workflows:Set<string>; directories:string[]; repositories:Set<string>; workspace?:ExecutionWorkspace};
function resources(definition:PreparedWorkflow,vault:string,workspace?:ExecutionWorkspace):Resources {
  const {workflow,tasks,settings}=definition;
  const workflows=[workflow,...(definition.workflows || [])];
  for(const item of [...workflows,...tasks])validateConcurrency(item);
  const standalone=workflow.id.startsWith('@task:');
  const policy=(standalone ? tasks[0]?.concurrency : workflow.concurrency) ?? concurrencySettings(definition.admissionSettings || {}).defaultConcurrency;
  const result:Resources={exclusive:policy==="exclusive" || workflows.some(w=>!!w.handoffBranch || w.concurrency === "exclusive"),sharedWorkspace:policy==="parallel" && !workflows.some(w=>w.concurrency === "independent"),tasks:new Set(tasks.map(t=>t.id)),workflows:new Set(workflows.map(w=>w.id)),directories:[],repositories:new Set()};
  if(workspace) {result.workspace=workspace;result.sharedWorkspace=false;result.directories.push(physicalPath(workspace.directory));}
  for(const item of [...workflows.flatMap(w=>w.steps).filter((s:any)=>s.stepKind==='code'),...tasks] as any[]) {
    if(item.branch || workflow.handoffBranch)result.exclusive=true;
    if(item.interactiveTerminal || (item.taskKind===undefined && item.stepKind!=='code' && settings.defaultInteractiveTerminal)) result.exclusive=true;
    if(item.stepKind==='code' || item.taskKind==='code') {
      if(!workspace && (item.codeAllowVault || item.codeAllowFiles || item.codeAllowTerminal))result.directories.push(physicalPath(vault));
      if(!workspace && !result.sharedWorkspace && (item.codeAllowVault || item.codeAllowFiles || item.codeAllowTerminal))result.exclusive=true;
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
  if(!workspace && workflows.some(w=>w.steps.some((s:any)=>s.transitionMode==='eval' || s.transitions?.some((t:any)=>t.mode==='eval')))) {
    result.directories.push(physicalPath(vault));
    if(!result.sharedWorkspace)result.exclusive=true;
  }
  return result;
}
function canShareWorkspace(a:Resources,b:Resources):boolean {
  return !a.exclusive && !b.exclusive && a.sharedWorkspace && b.sharedWorkspace;
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
    const current=resources(definition,this.vault,this.resources.workspace);
    if(JSON.stringify(current.directories)!==JSON.stringify(this.resources.directories) || JSON.stringify([...current.repositories])!==JSON.stringify([...this.resources.repositories]))throw new Error('Execution resource identity changed; reservation retained');
  }
  bind(checkpoint:RunCheckpoint):void {
    this.assertOwned(this.coordinator.lease,this.definition);
    if(checkpoint.workflowId!==this.definition.workflow.id || checkpoint.definitionHash!==this.definition.hash || this.runId && this.runId!==checkpoint.runId)throw new Error('Admission checkpoint identity changed');
    this.runId=checkpoint.runId;
  }
  knows(runId:string):boolean {return this.coordinator.knows(runId);}
  permitsPending(checkpoint:RunCheckpoint):boolean {return this.coordinator.permitsPending(this,checkpoint);}
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
  permitsPending(admission:ExecutionAdmission,checkpoint:RunCheckpoint):boolean {
    this.assertOwned(admission,this.lease);
    const known=[...this.sessions].find(s=>s.runId===checkpoint.runId && s.definition.workflow.id===checkpoint.workflowId && s.definition.hash===checkpoint.definitionHash);
    if(!known)return false;
    if(known.advancing)return true;
    // Retained parallel runs reserve their own tasks without stopping other
    // opted-in work in this host. Nothing closes or replays the retained run.
    return canShareWorkspace(admission.resources,known.resources) &&
      ![...admission.resources.workflows].some(id=>known.resources.workflows.has(id)) &&
      ![...admission.resources.tasks].some(id=>known.resources.tasks.has(id));
  }
  admit(definition:PreparedWorkflow,vault:string,resumeRunId?:string,workspace?:ExecutionWorkspace):ExecutionAdmission {
    this.lease.assertOwned();
    const requested=resources(definition,vault,workspace);
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
      if([...requested.workflows].some(id=>current.resources.workflows.has(id)) || [...requested.tasks].some(id=>current.resources.tasks.has(id)))throw new Error('A shared workflow is already executing; definition or referenced task is reserved');
      if(!current.advancing && !canShareWorkspace(requested,current.resources))throw new Error('Execution outcome requires continuation or reconciliation; reservation retained');
      if(requested.exclusive || current.resources.exclusive)throw new Error('Exclusive execution must finish before shared execution');
      const overlaps = requested.directories.some(a=>current.resources.directories.some(b=>isWithinPhysicalPath(a,b)||isWithinPhysicalPath(b,a)));
      const sharesRepository = [...requested.repositories].some(a=>[...current.resources.repositories].some(b=>samePhysicalPath(a,b)));
      const separateWorktrees = (overlaps || sharesRepository) && requested.workspace && current.resources.workspace &&
        independentGitWorkspaces(requested.workspace.directory,current.resources.workspace.directory);
      if(!canShareWorkspace(requested,current.resources) && !separateWorktrees && (overlaps || sharesRepository))throw new Error('Execution resource is occupied (workspace or Git repository)');
    }
    const limit=concurrencySettings(definition.admissionSettings || {}).maxConcurrentExecutions;
    if(limit>0 && this.sessions.size>=limit)throw new Error(`Concurrent execution limit reached (${limit})`);
    const session=new ExecutionAdmission(this,definition,requested,vault);this.sessions.add(session);return session;
  }
  finish(session:ExecutionAdmission):void {
    session.advancing=false;
    // No run means admission/preflight failed before journal creation. Every
    // uncertain or suspended durable execution keeps its resources reserved.
    if(!session.runId || session.confirmedTerminal)this.sessions.delete(session);
  }
}
