import * as fs from "fs";
import * as path from "path";
import {createHash} from "crypto";
import {gitIn, pageChanges, type WorkPage, type WorktreeRemovalProof} from "./work-pages";
import {directory, noLinks, registrations, inspectWorktreeRemoval, assertRemovalScope, workPageRevision} from "./finish-work";

export interface DiscardWorkReview {
  pageId:string; hash:string; blockers:string[]; changes:string; commits:string;
  fileCount:number; commitCount:number; stage:"worktree"|"branch-only"|"discarded";
  proof?:WorktreeRemovalProof;
}
const readGit = (repo:string,args:string[])=>gitIn(repo,["--no-optional-locks",...args]);
const exists = (file:string)=>{try{fs.lstatSync(file);return true;}catch(e){if((e as NodeJS.ErrnoException).code === "ENOENT")return false;throw e;}};
const refName = (proof:WorktreeRemovalProof)=>"refs/heads/" + proof.branch;

/** A bounded, full-content review, including ignored files. No links or nested repositories. */
async function folderSnapshot(root:string,gitDirectory:string):Promise<{treeHash:string;fileCount:number}> {
  const hash=createHash("sha256");let fileCount=0,total=0,entries=0;
  const addFile=async(file:string,relative:string)=>{
    const before=await fs.promises.lstat(file);
    if(!before.isFile() || before.isSymbolicLink() || before.nlink!==1)throw new Error("Discard cannot inspect linked or special files: " + relative);
    total+=before.size;
    if(total>512*1024*1024)throw new Error("Discard review exceeds 512 MB. Preserve or remove large local files explicitly, then refresh.");
    const content=createHash("sha256"),handle=await fs.promises.open(file,fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
    try {
      const opened=await handle.stat();
      if(opened.ino!==before.ino || opened.dev!==before.dev || !opened.isFile())throw new Error("File identity changed during discard review.");
      for await(const chunk of handle.createReadStream({autoClose:false}))content.update(chunk);
    } finally {await handle.close();}
    const after=await fs.promises.lstat(file);
    if(before.ino!==after.ino || before.dev!==after.dev || before.size!==after.size || before.mtimeMs!==after.mtimeMs || before.ctimeMs!==after.ctimeMs)throw new Error("Files changed during discard review. Refresh the review.");
    hash.update(JSON.stringify([relative,before.mode,before.size,content.digest("hex")]));
  };
  const walk=async(folder:string,relative:string)=>{
    noLinks(folder);
    for(const entry of (await fs.promises.readdir(folder,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){
      if(++entries>20000)throw new Error("Discard review exceeds 20,000 entries. Review local dependencies manually before discarding.");
      const file=path.join(folder,entry.name),name=relative+entry.name;
      if(entry.name.toLowerCase()===".git"){
        if(relative || entry.name!==".git")throw new Error("A nested Git repository or unexpected metadata name blocks discard: " + name);
        continue;
      }
      const stat=await fs.promises.lstat(file);
      if(stat.isSymbolicLink())throw new Error("A symbolic link or junction blocks discard: " + name);
      if(stat.isDirectory()){hash.update(JSON.stringify([name+"/",stat.mode]));await walk(file,name+"/");}
      else {await addFile(file,name);fileCount++;}
    }
  };
  await walk(root,"");
  const index=path.join(gitDirectory,"index");
  if(exists(index))await addFile(index,"<worktree-index>");
  return {treeHash:hash.digest("hex"),fileCount};
}

/** Validate repository, exact ref value, branch protection and other worktree users. */
async function inspectBranch(proof:WorktreeRemovalProof,allowMissing=false):Promise<boolean> {
  const repo=directory(proof.repository);
  if(directory(path.resolve(repo,await readGit(repo,["rev-parse","--git-common-dir"])))!==proof.commonDirectory)throw new Error("Discard repository identity changed.");
  await readGit(repo,["check-ref-format",refName(proof)]);
  noLinks(path.join(proof.commonDirectory,refName(proof)));noLinks(path.join(proof.commonDirectory,"packed-refs"));
  if(/^(main|master|develop|dev|trunk)$/i.test(proof.branch))throw new Error("Protected branches cannot be discarded.");
  let mainRef="";
  try{mainRef=await readGit(repo,["symbolic-ref","--quiet","HEAD"]);}catch(e){if((e as any).gitExitCode!==1)throw e;}
  if(mainRef===refName(proof))throw new Error("The repository's main workspace branch cannot be discarded.");
  const defaults=(await readGit(repo,["for-each-ref","--format=%(symref)","refs/remotes"])).split("\n");
  if(defaults.some(ref=>ref.replace(/^refs\/remotes\/[^/]+\//,"")===proof.branch))throw new Error("A remote default branch cannot be discarded.");
  const users=(await registrations(repo)).filter(entry=>entry.branch===refName(proof));
  if(users.some(entry=>!entry.worktree || path.relative(entry.worktree,proof.directory)!==""))throw new Error("Another worktree uses this branch. Close and review that worktree first.");
  // Ref aliases could make a deletion act on a different branch.
  const refs=await readGit(repo,["for-each-ref","--format=%(refname) %(objectname) %(symref)",refName(proof)]);
  const ref=refs.split("\n").map(line=>line.trim().split(" ")).find(fields=>fields[0]===refName(proof));
  if(!ref){if(allowMissing)return false;throw new Error("The reviewed branch is missing.");}
  if(ref[2])throw new Error("Symbolic branch references cannot be discarded.");
  if(ref[1]!==proof.head)throw new Error("The branch changed since review. No branch deletion was performed.");
  return true;
}

export async function inspectDiscardOutcome(proof:WorktreeRemovalProof):Promise<"retained"|"branch-only"|"discarded"> {
  if(!proof.discard)throw new Error("Discard proof is missing.");
  noLinks(proof.directory);noLinks(proof.gitDirectory);
  const branchExists=await inspectBranch(proof,true),entries=await registrations(proof.repository);
  const registered=entries.some(entry=>entry.worktree && path.relative(entry.worktree,proof.directory)==="");
  if(!exists(proof.directory) && !exists(proof.gitDirectory) && !registered)return branchExists?"branch-only":"discarded";
  if(branchExists && exists(proof.directory) && exists(proof.gitDirectory) && registered){
    const page:WorkPage={id:"inspection",name:"Inspection",objective:"",kind:"worktree",directory:proof.directory,repository:proof.repository,branch:proof.branch,taskIds:[],workflowIds:[]};
    const inspected=await inspectWorktreeRemoval(page,[],[],true);
    const {discard,...original}=proof;
    if(JSON.stringify(inspected.proof)===JSON.stringify(original))return "retained";
  }
  throw new Error("Discard left changed or incomplete evidence. Review it manually; no deletion was retried.");
}

export async function reviewWorkPageDiscard(page:WorkPage,protectedDirectories:string[],pages:WorkPage[],blockers:string[]=[]):Promise<DiscardWorkReview> {
  let proof:WorktreeRemovalProof|undefined,changes="",commits="",fileCount=0,commitCount=0,stage:DiscardWorkReview["stage"]="worktree";
  try{
    if(page.kind!=="worktree")throw new Error("Discard work is only available for an independent Git worktree. Archive this folder page instead.");
    assertRemovalScope(page,protectedDirectories,pages);
    if(page.worktreeRemoval){
      if(page.worktreeRemoval.mode!=="discard" || page.worktreeRemoval.status!=="pending")throw new Error("This page already has another removal outcome. Review it first.");
      proof=page.worktreeRemoval.proof;
      const outcome=await inspectDiscardOutcome(proof);
      if(outcome==="discarded"){stage="discarded";throw new Error("Discard already finished. Use Check discard to record the outcome.");}
      if(outcome==="branch-only")stage="branch-only";
    }
    if(stage==="worktree"){
      const inspected=await inspectWorktreeRemoval(page,protectedDirectories,pages,true);
      blockers.push(...inspected.blockers);proof=inspected.proof;
      await inspectBranch(proof);
      const snapshot=await folderSnapshot(proof.directory,proof.gitDirectory);fileCount=snapshot.fileCount;
      const comparisonBase=await readGit(proof.repository,["rev-parse","--verify","--end-of-options",(page.baseCommit || "HEAD")+"^{commit}"]);
      proof={...proof,discard:{treeHash:snapshot.treeHash,comparisonBase}};
      changes=await pageChanges(page);
      const statuses=inspected.status.split("\0").filter(Boolean);
      changes+="\n\nFiles affected (including untracked and ignored):\n"+(statuses.slice(0,150).map(name=>JSON.stringify(name)).join("\n")||"No local changes.")+
        (statuses.length>150?"\nFile list shortened. Review all files in your Git tool; discard removes the entire worktree folder.":"");
    }else changes="The worktree folder was already removed. Only the reviewed local branch remains to be discarded.";
    const range=proof!.discard!.comparisonBase+".."+proof!.head;
    commitCount=Number(await readGit(proof!.repository,["rev-list","--count",range,"--"]));
    commits=await readGit(proof!.repository,["log","--no-decorate","--format=%h %s","-50",range,"--"]);
  }catch(e){blockers.push(e instanceof Error?e.message:String(e));}
  const hash=createHash("sha256").update(JSON.stringify([workPageRevision(page),proof,changes,commits,commitCount,stage])).digest("hex");
  return {pageId:page.id,hash,blockers,changes,commits,fileCount,commitCount,stage,proof};
}

/** Only after typing the branch, confirming loss/closed processes and publishing pending evidence. */
export async function removeDiscardedWorktree(page:WorkPage,proof:WorktreeRemovalProof,protectedDirectories:string[],pages:WorkPage[],assertOwned:()=>void):Promise<void> {
  if(!proof.discard)throw new Error("Discard proof is missing.");
  const inspected=await inspectWorktreeRemoval(page,protectedDirectories,pages,true);
  if(inspected.blockers.length)throw new Error(inspected.blockers.join("\n"));
  const {discard,...original}=proof;
  if(JSON.stringify(inspected.proof)!==JSON.stringify(original))throw new Error("Worktree identity changed after discard review.");
  if((await folderSnapshot(proof.directory,proof.gitDirectory)).treeHash!==discard.treeHash)throw new Error("Worktree files or index changed after review. Refresh before discarding.");
  await inspectBranch(proof);assertOwned();
  noLinks(proof.directory);noLinks(proof.gitDirectory);
  for(const [location,expected] of [[proof.directory,proof.directoryIdentity],[proof.gitDirectory,proof.gitIdentity]]){
    const s=fs.lstatSync(location);
    if(`${s.dev}:${s.ino}:${s.birthtimeMs}`!==expected)throw new Error("Worktree folder identity changed before discard.");
  }
  // One force permits reviewed local changes; never force a locked worktree or use shell deletion.
  await gitIn(proof.repository,["worktree","remove","--force","--",proof.directory]);
  if(await inspectDiscardOutcome(proof)!=="branch-only")throw new Error("Folder removal is unconfirmed. Check discard before continuing.");
}
export async function deleteDiscardedBranch(proof:WorktreeRemovalProof,assertOwned:()=>void):Promise<void> {
  if(await inspectDiscardOutcome(proof)!=="branch-only")throw new Error("The worktree must be removed before deleting its branch.");
  await inspectBranch(proof);assertOwned();
  // Compare-and-delete: a ref moved since the review must never be removed.
  await gitIn(proof.repository,["update-ref","--no-deref","-d",refName(proof),proof.head]);
  if(await inspectDiscardOutcome(proof)!=="discarded")throw new Error("Branch deletion is unconfirmed. Use Check discard.");
}
