import * as fs from "fs";
import * as path from "path";
import { execFile, spawn } from "child_process";
import { createHash } from "crypto";
import { directory, registrations } from "./finish-work";
import { verifyWorkPageEnvironment, type WorkPage } from "./work-pages";
import {parseWorktreeStatus, type WorktreeFile} from "./worktree-changes";

export interface MergeTarget { directory:string; branch:string; head:string; }
export interface MergeReview {
  source:MergeTarget; targets:MergeTarget[]; target?:MergeTarget;
  state:"blocked"|"ready"|"conflicts"|"resolved"|"integrated"|"unavailable";
  inProgress:boolean; conflicts:string[]; details:string; blockers:string[]; hash:string;
  completionBlockers:string[];
  integration:"verified"|"not-integrated"|"unknown";
  sourceFiles:WorktreeFile[]; targetFiles:WorktreeFile[];
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
// Status letters alone do not identify staged resolutions or edits to conflict files.
async function mergeContentHash(cwd:string):Promise<string> {
  const index=await git(cwd,["ls-files","--stage","-z"]);
  const working=await git(cwd,["diff","--no-ext-diff","--no-textconv","--binary","--"]);
  return createHash("sha256").update(index.text).update("\0").update(working.text).digest("hex");
}
async function ignoredMergeCollisions(target:string,sourceHead:string):Promise<string[]> {
  const ignored=(await git(target,["ls-files","--others","--ignored","--exclude-standard","-z"])).text.split("\0").filter(Boolean);
  if(!ignored.length)return [];
  const insensitive=(await git(target,["config","--bool","--get","core.ignorecase"],[0,1])).text.trim()==="true";
  const normalize=(file:string)=>insensitive?file.toLowerCase():file;
  const incoming=new Set((await git(target,["ls-tree","-r","--name-only","-z",sourceHead])).text.split("\0").filter(Boolean).map(normalize));
  const parents=new Set<string>();
  for(const file of incoming)for(let i=file.indexOf("/");i>=0;i=file.indexOf("/",i+1))parents.add(file.slice(0,i));
  return ignored.filter(file=>{
    const key=normalize(file);if(incoming.has(key)||parents.has(key))return true;
    for(let i=key.indexOf("/");i>=0;i=key.indexOf("/",i+1))if(incoming.has(key.slice(0,i)))return true;
    return false;
  });
}
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
  const review:MergeReview={source,targets,target:selected,state:"blocked",inProgress:false,conflicts:[],details:"",blockers:[...activityBlockers],completionBlockers:[],integration:"unknown",sourceFiles:[],targetFiles:[],hash:""};
  let contentHash="";
  const finish=()=>{review.hash=createHash("sha256").update(JSON.stringify([review,contentHash])).digest("hex");return review;};
  if(!selected){review.blockers.push("No other checked-out local branch is available in this repository.");return finish();}
  const target=await snapshot(selected.directory);review.target=target;
  if(target.branch!==selected.branch || target.head!==selected.head)throw new Error("The target branch changed during review. Recheck conflicts.");
  const common=async(cwd:string)=>directory(path.resolve(cwd,await value(cwd,["rev-parse","--git-common-dir"])));
  if(await common(source.directory)!==await common(target.directory))throw new Error("Source and target no longer belong to the same repository.");
  // Commit ancestry is independent of local files, plugin configuration and terminal activity.
  review.integration=(await git(target.directory,["merge-base","--is-ancestor",source.head,target.head],[0,1])).code===0?"verified":"not-integrated";
  const sourceStatus=await status(source.directory),targetStatus=await status(target.directory);
  review.sourceFiles=parseWorktreeStatus(sourceStatus);review.targetFiles=parseWorktreeStatus(targetStatus);
  const sourceOps=await operations(source.directory),targetOps=await operations(target.directory);
  if(sourceStatus && review.integration!=="verified")review.blockers.push("Review the listed source changes before starting a merge. Preserve local configuration separately; no automatic staging or commit is performed.");
  if(sourceOps.length)review.blockers.push("Finish the Git operation in the source worktree first: "+sourceOps.join(", "));
  for(const workspace of [source,target]) {
    const flags=(await git(workspace.directory,["ls-files","-v","-z"])).text.split("\0");
    if(flags.some(line=>/^[a-zS] /.test(line)))review.blockers.push("Review hidden index flags (assume-unchanged or skip-worktree) in "+workspace.directory);
  }
  review.inProgress=targetOps.includes("MERGE_HEAD");
  if(targetOps.some(op=>op!=="MERGE_HEAD"))review.blockers.push("Finish the existing Git operation in the target first: "+targetOps.join(", "));
  if(review.inProgress) {
    contentHash=await mergeContentHash(target.directory);
    const mergeHead=await mergeHeads(target.directory);
    if(mergeHead!==source.head)review.blockers.push("The target is merging a different commit. Complete or cancel that operation in your Git tool, then recheck.");
    review.conflicts=(await git(target.directory,["diff","--no-ext-diff","--no-textconv","--name-only","--diff-filter=U","-z","--"])).text.split("\0").filter(Boolean);
    review.state=review.conflicts.length?"conflicts":"resolved";
    if((await git(target.directory,["diff","--quiet","--no-ext-diff","--ignore-submodules=none","--"],[0,1])).code!==0)
      review.completionBlockers.push("Review and stage the remaining target edits before completing the merge.");
    review.details=review.conflicts.length?"Actual merge in progress. Resolve these files in the TARGET folder, then stage each resolution and recheck.":"No unmerged index entries remain. Review staged changes and run your tests before committing the merge.";
    if(mergeHead!==await mergeHeads(target.directory))review.blockers.push("The merge changed during review. Recheck conflicts.");
  } else {
    if(review.integration==="verified") {
      review.state="integrated";
      review.details="The source commit is already an ancestor of the target. No repeated merge or local configuration commit is needed to verify integration. Pending files are separate from committed integration; tests are not verified.";
    } else {
      if(targetStatus)review.blockers.push("Review the listed target changes before starting a merge. Preserve local configuration separately; no automatic staging or commit is performed.");
      if(!review.blockers.length) {
        // Git's --no-overwrite-ignore is not sufficient for every merge strategy.
        const collisions=await ignoredMergeCollisions(target.directory,source.head);
        if(collisions.length)review.blockers.push("Preserve ignored target files that collide with incoming paths before merging: "+collisions.slice(0,10).map(file=>JSON.stringify(file)).join(", "));
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
  if(JSON.stringify(source)!==JSON.stringify(await snapshot(source.directory)) || JSON.stringify(target)!==JSON.stringify(await snapshot(target.directory))) {
    review.integration="unknown";review.state="blocked";review.blockers.push("Branch or commit changed during review. Recheck integration.");
  }
  if(sourceStatus!==await status(source.directory) || targetStatus!==await status(target.directory) ||
      JSON.stringify(sourceOps)!==JSON.stringify(await operations(source.directory)) || JSON.stringify(targetOps)!==JSON.stringify(await operations(target.directory)) ||
      review.inProgress && contentHash!==await mergeContentHash(target.directory))review.blockers.push("The workspace changed during review. Recheck conflicts.");
  if(review.blockers.length && review.state!=="integrated")review.state="blocked";
  return finish();
}

export type MergeCommand="start"|"complete"|"abort";
const activeMerges=new Set<string>();

/** Called by the owning host under its page preparation reservation. No shell or automatic retry. */
export async function executePageMerge(page:WorkPage,targetDirectory:string,reviewHash:string,action:MergeCommand,
  assertCurrent:()=>void,abortConfirmed=false):Promise<{review:MergeReview;output:string}> {
  if(!["start","complete","abort"].includes(action))throw new Error("Unknown merge action.");
  if(action==="abort"&&!abortConfirmed)throw new Error("Confirm that aborting may discard conflict-resolution edits.");
  const key=directory(targetDirectory);
  if(activeMerges.has(key))throw new Error("A merge operation is already running for this target.");
  activeMerges.add(key);
  try {
    assertCurrent();
    const current=await reviewPageMerge(page,key);
    assertCurrent();
    if(current.hash!==reviewHash)throw new Error("Workspace changed after review. Recheck conflicts before continuing.");
    assertMergeAction(current,action);
    const args=action==="start"?["merge","--no-ff","--no-commit","--no-overwrite-ignore","--no-autostash",current.source.head]
      :action==="complete"?["commit","--no-edit"]:["merge","--abort"];
    const result=await new Promise<{code:number;output:string}>((resolve,reject)=>{
      // Hooks/signing may take time. Keep the host reservation until Git closes;
      // truncate displayed output instead of killing an in-progress mutation.
      const child=spawn("git",["-c","core.fsmonitor=false",...args],{cwd:key,windowsHide:true,
        env:{...process.env,GIT_TERMINAL_PROMPT:"0",GIT_MERGE_AUTOEDIT:"no"},stdio:["ignore","pipe","pipe"]});
      let output="",shortened=false;
      const append=(chunk:string)=>{const remaining=64000-output.length;output+=chunk.slice(0,remaining);if(chunk.length>remaining)shortened=true;};
      child.stdout.setEncoding("utf8");child.stderr.setEncoding("utf8");
      child.stdout.on("data",append);child.stderr.on("data",append);
      child.once("error",reject);
      child.once("close",(code)=>{
        if(shortened)output+="\nGit output shortened.";
        if(code===null)reject(new Error("Git outcome is unconfirmed. Recheck the target before another action.\n"+output));
        else resolve({code,output:output.trim()});
      });
    });
    // Reinspect even on failure: exit 1 can mean an ordinary merge conflict.
    const review=await reviewPageMerge(page,key);
    assertCurrent();
    const conflicts=action==="start"&&result.code===1&&review.inProgress&&review.state==="conflicts"&&!review.blockers.length;
    if(result.code!==0&&!conflicts)throw new Error("Git did not complete the operation. Recheck the target before continuing.\n"+result.output);
    if(action==="start"&&!review.inProgress&&review.state!=="integrated" || action==="complete"&&(review.inProgress||review.state!=="integrated") ||
      action==="abort"&&(review.inProgress||review.target?.head!==current.target!.head))throw new Error("Git outcome needs review. Recheck the target before another action.\n"+result.output);
    return {review,output:result.output};
  } finally {activeMerges.delete(key);}
}

function assertMergeAction(review:MergeReview,action:MergeCommand):void {
  if(!review.target || review.blockers.length || (action==="start" ? review.inProgress || !["ready","conflicts"].includes(review.state) : !review.inProgress || action==="complete" && review.state!=="resolved"))throw new Error("Recheck the merge before performing this action.");
  if(action==="complete"&&review.completionBlockers.length)throw new Error(review.completionBlockers.join("\n"));
}
export function mergeEditorUri(root:string,file?:string):string {
  const resolved=directory(root),target=file?path.resolve(resolved,file):resolved,relative=path.relative(resolved,target);
  if(relative===".."||relative.startsWith(".."+path.sep)||path.isAbsolute(relative))throw new Error("Conflict path is outside the target worktree.");
  const normalized=target.replace(/\\/g,"/");
  return "vscode://file"+(normalized.startsWith("/")?"":"/")+normalized.split("/").map(encodeURIComponent).join("/").replace(/^([a-zA-Z])%3A\//,"$1:/")+(file?"":"/");
}
