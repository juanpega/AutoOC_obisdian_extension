import { physicalPath, samePhysicalPath, isWithinPhysicalPath } from "./path-identity";
import * as path from "path";
import { execFileSync } from "child_process";
import type { ExecutionJournal } from "./execution-journal";

export function validateBranchOptions(task:Readonly<Record<string,any>>) {
  if (task.branch !== undefined && typeof task.branch !== "string") throw new Error("Branch must be a string");
  if (task.createBranch !== undefined && typeof task.createBranch !== "boolean") throw new Error("createBranch must be boolean");
  if (task.createBranch && !task.branch?.trim()) throw new Error("Creating a branch requires its name");
  if (task.branch?.trim()) {
    try {execFileSync("git",["check-ref-format","--branch",task.branch],{stdio:"ignore",windowsHide:true});}
    catch {throw new Error("Invalid Git branch name");}
    if (task.branch.startsWith("-") || task.branch.includes("@{")) throw new Error("Invalid Git branch name");
  }
}

function git(cwd:string,args:string[]) {
  try {const output=execFileSync("git",["-c",`safe.directory=${cwd.replace(/\\/g,"/")}`,...args],{cwd,encoding:"utf8",stdio:["ignore","pipe","pipe"],windowsHide:true});return args.includes('-z')?output:output.trim();}
  catch {throw new Error("Git branch operation failed; working tree preserved, no forced checkout or cleanup");}
}

export function branchRepository(cwd:string,vault:string) {
  const directory=physicalPath(git(physicalPath(cwd),["rev-parse","--show-toplevel"]));
  if(!isWithinPhysicalPath(vault,directory)) throw new Error("Git repository is outside the selected vault");
  // Linked worktrees can write Git metadata outside the authorized vault.
  const metadata=physicalPath(git(directory,["rev-parse","--absolute-git-dir"]));
  const common=physicalPath(path.resolve(directory,git(directory,["rev-parse","--git-common-dir"])));
  if(!isWithinPhysicalPath(vault,metadata) || !isWithinPhysicalPath(vault,common)) throw new Error("Git metadata is outside the selected vault");
  return directory;
}

export function preflightTaskBranch(task:Readonly<Record<string,any>>,cwd:string,vault:string) {
  if(!task.branch?.trim() || task.createBranch)return;
  const directory=branchRepository(cwd,vault);
  if(git(directory,["branch","--show-current"])===task.branch)return;
  const untracked=git(directory,["ls-files","--others","--exclude-standard","-z"]).split('\0').filter(Boolean);
  const target=git(directory,["ls-tree","-r","--name-only","-z",task.branch]).split('\0').filter(Boolean);
  const collision=untracked.some(file=>target.some(name=>name===file || name.startsWith(file+'/') || file.startsWith(name+'/')));
  if(git(directory,["status","--porcelain","--untracked-files=no"]) || collision) {
    throw new Error("Git Branch cannot switch while the working tree has uncommitted changes. Clear Git Branch to use the current branch, or commit/stash your work first. No task was started.");
  }
}

export async function prepareTaskBranch(journal:ExecutionJournal,task:Readonly<Record<string,any>>,cwd:string,vault:string,handoff:boolean) {
  validateBranchOptions(task);
  const state=journal.snapshot();
  const previous=handoff ? [...state.steps].reverse().find(step=>step.branch)?.branch : undefined;
  if(!previous && !task.branch?.trim() && !handoff) return;
  const directory=branchRepository(cwd,vault);
  if(previous) {
    if(!samePhysicalPath(branchRepository(previous.directory,vault),directory) || git(directory,["branch","--show-current"])!==previous.name) throw new Error("Workflow branch changed; reconcile before continuation");
  } else if(task.branch?.trim()) {
    const name=task.createBranch ? `${task.branch}-${state.runId.slice(0,8)}-${state.steps.length}` : task.branch;
    git(directory,task.createBranch ? ["checkout","-b",name] : ["checkout",name]);
  }
  const name=git(directory,["branch","--show-current"]);
  if(!name) throw new Error("Workflow branch requires an attached Git branch");
  await journal.recordBranch({directory,name});
}

export function verifyWorkflowBranch(journal:ExecutionJournal,vault:string) {
  const branch=[...journal.snapshot().steps].reverse().find(step=>step.branch)?.branch;
  if(branch && git(branchRepository(branch.directory,vault),["branch","--show-current"])!==branch.name)throw new Error("Workflow branch changed; reconcile before continuation");
}
