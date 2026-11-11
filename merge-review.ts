import * as fs from "fs";
import * as path from "path";
import { execFile } from "child_process";
import { createHash } from "crypto";
import { directory, registrations } from "./finish-work";
import { verifyWorkPageEnvironment, type WorkPage } from "./work-pages";

export interface MergeTarget { directory:string; branch:string; head:string; }
export interface MergeReview {
  source:MergeTarget; targets:MergeTarget[]; target?:MergeTarget;
  state:"blocked"|"ready"|"conflicts"|"resolved"|"integrated"|"unavailable";
  inProgress:boolean; conflicts:string[]; details:string; blockers:string[]; hash:string;
}

// Preserve NUL-delimited paths and exit 1 output: merge-tree uses it for conflicts.
async function git(cwd:string,args:string[],allowed=[0]):Promise<{code:number;text:string}> {
  return new Promise((resolve,reject)=>execFile("git",["--no-optional-locks","-c","core.fsmonitor=false",...args],
    {cwd,encoding:"utf8",windowsHide:true,timeout:30000,maxBuffer:4*1024*1024},(error,stdout,stderr)=>{
      const code=error ? (error as any).code : 0;
      if(typeof code!=="number" || !allowed.includes(code)) reject(new Error("Git review: " + String(stderr || error?.message || "command failed").trim()));
      else resolve({code,text:stdout});
    }));
}
const value=async(cwd:string,args:string[]) => (await git(cwd,args)).text.trim();
const operationNames=["MERGE_HEAD","CHERRY_PICK_HEAD","REVERT_HEAD","rebase-merge","rebase-apply","sequencer","BISECT_START"];
async function operations(cwd:string):Promise<string[]> {
  const found:string[]=[];
  const gitDirectory=await value(cwd,["rev-parse","--absolute-git-dir"]);
  for(const name of operationNames) {
    const location=path.join(gitDirectory,name);
    try {fs.lstatSync(location);found.push(name);}catch(error){if((error as NodeJS.ErrnoException).code!=="ENOENT")throw error;}
  }
  return found;
}
async function snapshot(cwd:string):Promise<MergeTarget> {
  const root=directory(cwd);
  if(directory(await value(root,["rev-parse","--show-toplevel"]))!==root)throw new Error("Choose the root of a registered worktree.");
  return {directory:root,branch:await value(root,["symbolic-ref","--quiet","--short","HEAD"]),head:await value(root,["rev-parse","--verify","HEAD^{commit}"])};
}
const status=async(cwd:string)=>(await git(cwd,["status","--porcelain=v1","-z","--untracked-files=all","--ignore-submodules=none"])).text;
async function mergeHeads(cwd:string):Promise<string> {
  const file=path.join(await value(cwd,["rev-parse","--absolute-git-dir"]),"MERGE_HEAD");
  if(fs.statSync(file).size>4096)throw new Error("Unexpected merge metadata. Review it in your Git tool.");
  return fs.readFileSync(file,"utf8").trim();
}

/** Only Git's exit status determines whether the preview is conflicted. Some conflicts have no file stages. */
export function parseMergePreview(text:string,code:number) {
  const fields=text.split("\0"),tree=fields.shift();
  if(!tree || !/^[a-f0-9]{40,64}$/.test(tree))throw new Error("Unsupported merge-tree output. Review the merge in your Git tool.");
  const conflicts:string[]=[];
  while(fields.length && fields[0])conflicts.push(fields.shift()!);
  fields.shift();
  const messages:string[]=[];
  while(fields.length && fields[0]) {
    const count=Number(fields.shift());
    if(!Number.isSafeInteger(count)||count<0||count>fields.length-2)throw new Error("Unsupported merge-tree conflict details.");
    fields.splice(0,count);fields.shift();messages.push(fields.shift()!);
  }
  const details=messages.join("\n");
  return {conflicts,details:details.length>12000?details.slice(0,12000)+"\nDetails shortened. Review the full output in your Git tool.":details,state:code===0?"ready" as const:"conflicts" as const};
}

/** No checkout, merge, commit or index changes. merge-tree can create unreachable Git objects. */
export async function reviewPageMerge(page:WorkPage,targetDirectory?:string,activityBlockers:string[]=[]):Promise<MergeReview> {
  if(page.kind!=="worktree" || page.worktreeRemoval)throw new Error("Merge review requires an available independent Git worktree.");
  await verifyWorkPageEnvironment(page);
  const source=await snapshot(page.directory), repo=directory(page.repository!);
  const entries=await registrations(repo),sourceEntry=entries.find(e=>{try{return directory(e.worktree)===source.directory;}catch{return false;}});
  if(!sourceEntry || sourceEntry.branch!=="refs/heads/"+source.branch || "locked" in sourceEntry || "prunable" in sourceEntry)throw new Error("The source worktree registration changed or is locked.");
  const targets:MergeTarget[]=[];
  for(const entry of entries) {
    if(!entry.branch || entry.branch==="refs/heads/"+source.branch || "locked" in entry || "prunable" in entry || "bare" in entry)continue;
    // An unavailable stale worktree must not prevent inspecting the remaining valid targets.
    try {const root=directory(entry.worktree);if(root!==source.directory)targets.push({directory:root,branch:entry.branch.replace(/^refs\/heads\//,""),head:entry.HEAD});}catch{}
  }
  const selected=targetDirectory?targets.find(t=>t.directory===targetDirectory):targets.find(t=>t.directory===repo)||targets[0];
  if(targetDirectory&&!selected)throw new Error("The selected target is no longer an available worktree. Select it again.");
  const review:MergeReview={source,targets,target:selected,state:"blocked",inProgress:false,conflicts:[],details:"",blockers:[...activityBlockers],hash:""};
  const finish=()=>{review.hash=createHash("sha256").update(JSON.stringify({...review,hash:""})).digest("hex");return review;};
  if(!selected){review.blockers.push("No other checked-out local branch is available in this repository.");return finish();}
  const target=await snapshot(selected.directory);review.target=target;
  if(target.branch!==selected.branch || target.head!==selected.head)throw new Error("The target branch changed during review. Recheck conflicts.");
  const common=async(cwd:string)=>directory(path.resolve(cwd,await value(cwd,["rev-parse","--git-common-dir"])));
  if(await common(source.directory)!==await common(target.directory))throw new Error("Source and target no longer belong to the same repository.");
  const sourceStatus=await status(source.directory),targetStatus=await status(target.directory);
  const sourceOps=await operations(source.directory),targetOps=await operations(target.directory);
  if(sourceStatus)review.blockers.push("Commit or set aside all source changes, including untracked files, before merging.");
  if(sourceOps.length)review.blockers.push("Finish the Git operation in the source worktree first: "+sourceOps.join(", "));
  for(const workspace of [source,target]) {
    const flags=(await git(workspace.directory,["ls-files","-v","-z"])).text.split("\0");
    if(flags.some(line=>/^[a-zS] /.test(line)))review.blockers.push("Review hidden index flags (assume-unchanged or skip-worktree) in "+workspace.directory);
  }
  review.inProgress=targetOps.includes("MERGE_HEAD");
  if(targetOps.some(op=>op!=="MERGE_HEAD"))review.blockers.push("Finish the existing Git operation in the target first: "+targetOps.join(", "));
  if(review.inProgress) {
    const mergeHead=await mergeHeads(target.directory);
    if(mergeHead!==source.head)review.blockers.push("The target is merging a different commit. Complete or cancel that operation in your Git tool, then recheck.");
    review.conflicts=(await git(target.directory,["diff","--no-ext-diff","--no-textconv","--name-only","--diff-filter=U","-z","--"])).text.split("\0").filter(Boolean);
    review.state=review.conflicts.length?"conflicts":"resolved";
    review.details=review.conflicts.length?"Actual merge in progress. Resolve these files in the TARGET folder, then stage each resolution and recheck.":"No unmerged index entries remain. Review staged changes and run your tests before committing the merge.";
    if(mergeHead!==await mergeHeads(target.directory))review.blockers.push("The merge changed during review. Recheck conflicts.");
  } else {
    if(targetStatus)review.blockers.push("Commit or set aside all target changes before starting a merge.");
    if(!review.blockers.length) {
      const integrated=await git(target.directory,["merge-base","--is-ancestor",source.head,target.head],[0,1]);
      if(integrated.code===0){review.state="integrated";review.details="The source commit is an ancestor of the target. Integration is verified; tests are not verified.";}
      else {
        // A review must not silently execute repository-defined merge drivers or clean filters.
        const drivers=await git(target.directory,["config","--get-regexp","^merge\\..*\\.driver$"],[0,1]);
        const normalize=await git(target.directory,["config","--bool","--get","merge.renormalize"],[0,1]);
        if(drivers.code===0 || normalize.text.trim()==="true") {
          review.state="unavailable";review.details="Automatic preview is unavailable with custom merge drivers or merge.renormalize. Use your Git tool to review the merge; AutoOC can inspect its conflicts afterwards.";
        } else try {
          const preview=await git(target.directory,["merge-tree","--write-tree","--name-only","-z",target.head,source.head],[0,1]);
          Object.assign(review,parseMergePreview(preview.text,preview.code));
        } catch(error) {review.state="unavailable";review.details=String((error as Error).message)+" Use a Git version supporting merge-tree --write-tree, or review in your Git tool.";}
      }
    }
  }
  // Detect edits/ref movement during an asynchronous review instead of presenting stale readiness.
  if(JSON.stringify(source)!==JSON.stringify(await snapshot(source.directory)) || JSON.stringify(target)!==JSON.stringify(await snapshot(target.directory)) ||
      sourceStatus!==await status(source.directory) || targetStatus!==await status(target.directory) ||
      JSON.stringify(sourceOps)!==JSON.stringify(await operations(source.directory)) || JSON.stringify(targetOps)!==JSON.stringify(await operations(target.directory)))review.blockers.push("The workspace changed during review. Recheck conflicts.");
  if(review.blockers.length)review.state="blocked";
  return finish();
}

export type MergeCommand="start"|"complete"|"abort";
/** Copied for explicit execution by the developer; never run by the plugin. */
export function mergeReviewCommand(review:MergeReview,action:MergeCommand,platform=process.platform):string {
  const {source,target}=review;
  if(!target || review.blockers.length || (action==="start" ? review.inProgress || !["ready","conflicts"].includes(review.state) : !review.inProgress || action==="complete" && review.state!=="resolved"))throw new Error("Recheck the merge before copying this command.");
  const powershell=platform==="win32",quote=(s:string)=>"'"+s.replace(/'/g,powershell?"''":"'\"'\"'")+"'";
  const command=(cwd:string,args:string[])=>"git -C "+quote(cwd)+" "+args.map(quote).join(" ");
  const checks:[string[],string][]=[[["symbolic-ref","--quiet","--short","HEAD"],target.branch],[["rev-parse","HEAD"],target.head],[["rev-parse","--verify","refs/heads/"+source.branch],source.head]];
  if(action!=="start")checks.push([["rev-parse","--verify","MERGE_HEAD"],source.head]);
  const lines=checks.map(([args,expected])=>powershell
    ? "$autoocReviewValue = "+command(target.directory,args)+"; if ($LASTEXITCODE -ne 0 -or $autoocReviewValue -cne "+quote(expected)+") { throw 'Workspace changed. Recheck Merge review.' }"
    : "[ \"$("+command(target.directory,args)+")\" = "+quote(expected)+" ] || { echo 'Workspace changed. Recheck Merge review.'; exit 1; }");
  if(action==="start")for(const cwd of [source.directory,target.directory]) {
    const cmd=command(cwd,["status","--porcelain=v1","--untracked-files=all","--ignore-submodules=none"]);
    lines.push(powershell?"$autoocReviewValue = "+cmd+"; if ($LASTEXITCODE -ne 0 -or $autoocReviewValue) { throw 'Working files changed. Recheck Merge review.' }":"autooc_review_status=$("+cmd+") && [ -z \"$autooc_review_status\" ] || { echo 'Working files changed. Recheck Merge review.'; exit 1; }");
  }
  lines.push(command(target.directory,action==="start"?["merge","--no-ff","--no-commit","--no-overwrite-ignore","--no-autostash",source.head]:action==="complete"?["commit","--no-edit"]:["merge","--abort"]));
  if(powershell)lines.push("if ($LASTEXITCODE -ne 0) { throw 'Git did not complete cleanly. Read its output and recheck Merge review.' }");
  return (powershell?"& {":"(")+"\n"+lines.join("\n")+"\n"+(powershell?"}":")");
}

export function mergeEditorUri(root:string,file?:string):string {
  const resolved=directory(root),target=file?path.resolve(resolved,file):resolved,relative=path.relative(resolved,target);
  if(relative===".."||relative.startsWith(".."+path.sep)||path.isAbsolute(relative))throw new Error("Conflict path is outside the target worktree.");
  const normalized=target.replace(/\\/g,"/");
  return "vscode://file"+(normalized.startsWith("/")?"":"/")+normalized.split("/").map(encodeURIComponent).join("/").replace(/^([a-zA-Z])%3A\//,"$1:/")+(file?"":"/");
}
