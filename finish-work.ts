import * as fs from "fs";
import * as path from "path";
import { createHash } from "crypto";
import { gitIn, pageChanges, type WorkPage, type WorktreeRemovalProof } from "./work-pages";
import { physicalPath } from "./path-identity";

export interface FinishWorkReview {
  pageId: string; hash: string; changes: string; archiveBlockers: string[];
  removalBlockers: string[]; proof?: WorktreeRemovalProof;
}
export const workPageRevision = (page: WorkPage) => createHash("sha256").update(JSON.stringify(page)).digest("hex");
const readGit = (directory: string, args: string[]) => gitIn(directory,["--no-optional-locks",...args]);
const within = (root: string, child: string) => {
  const relative = path.relative(root,child);
  return relative !== ".." && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative);
};
const exists = (file: string) => {
  try { fs.lstatSync(file); return true; } catch (e) { if ((e as NodeJS.ErrnoException).code === "ENOENT") return false; throw e; }
};
export function noLinks(location: string): void {
  if (!path.isAbsolute(location)) throw new Error("Worktree paths must be absolute.");
  const root = path.parse(location).root;
  let current = root;
  for (const part of path.relative(root,location).split(path.sep).filter(Boolean)) {
    current = path.join(current,part);
    if (exists(current) && fs.lstatSync(current).isSymbolicLink()) throw new Error("Worktree removal cannot follow symbolic links or junctions.");
  }
}
export function directory(location: string): string {
  noLinks(location);
  if (!fs.lstatSync(location).isDirectory()) throw new Error("Worktree folder is unavailable.");
  return physicalPath(location);
}
const identity = (location: string) => {
  const s = fs.lstatSync(location); return `${s.dev}:${s.ino}:${s.birthtimeMs}`;
};
export async function registrations(repository: string): Promise<Record<string,string>[]> {
  const text = await readGit(repository,["worktree","list","--porcelain","-z"]);
  return text.split("\0\0").filter(Boolean).map(block=>Object.fromEntries(block.split("\0").filter(Boolean).map(field=>{
    const split = field.indexOf(" "); return split < 0 ? [field,""] : [field.slice(0,split),field.slice(split+1)];
  })));
}
export function assertRemovalScope(page: WorkPage, protectedDirectories: string[], pages: WorkPage[]): void {
  for (const target of protectedDirectories) {
    const resolved = exists(target) ? physicalPath(target) : path.resolve(target);
    if (within(page.directory,resolved)) throw new Error("This folder contains Main workspace or the AutoOC installation and cannot be removed.");
  }
  for (const other of pages) {
    if (other.id === page.id || other.worktreeRemoval?.status === "removed") continue;
    const resolved = exists(other.directory) ? physicalPath(other.directory) : path.resolve(other.directory);
    if (within(page.directory,resolved)) throw new Error("Another page uses this folder or a folder inside it. Keep the worktree.");
  }
}

/** Inspection never changes HEAD, index flags, locks, or worktree registration. */
export async function inspectWorktreeRemoval(page: WorkPage, protectedDirectories: string[], pages: WorkPage[], allowDiscardedChanges = false): Promise<{proof:WorktreeRemovalProof; blockers:string[]; status:string}> {
  if (page.kind !== "worktree" || !page.repository || !page.branch) throw new Error("Only a linked Git worktree can be removed. Ordinary folders are kept.");
  const root = directory(page.directory), repository = directory(page.repository);
  if (root !== page.directory || repository !== page.repository) throw new Error("Worktree paths changed; review the page before removal.");
  assertRemovalScope(page,protectedDirectories,pages);
  const gitFile = path.join(root,".git"); noLinks(gitFile);
  if (!fs.lstatSync(gitFile).isFile()) throw new Error("The main Git working folder cannot be removed.");
  if (physicalPath(await readGit(root,["rev-parse","--show-toplevel"])) !== root) throw new Error("Select the exact linked worktree root.");
  const commonDirectory = directory(path.resolve(root,await readGit(root,["rev-parse","--git-common-dir"])));
  const gitDirectory = directory(path.resolve(root,await readGit(root,["rev-parse","--git-dir"])));
  if (commonDirectory !== directory(path.resolve(repository,await readGit(repository,["rev-parse","--git-common-dir"]))) ||
      gitDirectory === commonDirectory || !within(path.join(commonDirectory,"worktrees"),gitDirectory)) throw new Error("Worktree repository identity changed.");
  const branch = await readGit(root,["symbolic-ref","--quiet","--short","HEAD"]);
  const head = await readGit(root,["rev-parse","--verify","HEAD^{commit}"]);
  if (branch !== page.branch) throw new Error("Worktree branch changed; review the page before removal.");
  const entries = await registrations(repository), matches = entries.filter(e=>e.worktree && path.relative(e.worktree,root) === "");
  if (matches.length !== 1 || matches[0].HEAD !== head || matches[0].branch !== "refs/heads/" + branch) throw new Error("Worktree registration changed.");
  const blockers: string[] = [];
  if ("locked" in matches[0] || "prunable" in matches[0]) blockers.push("This worktree is locked or needs Git repair. AutoOC will not force removal.");
  if (entries.some(e=>e !== matches[0] && e.worktree && within(root,e.worktree))) blockers.push("Another registered worktree is inside this folder.");
  const status = await readGit(root,["status","--porcelain=v1","-z","--untracked-files=all","--ignored=matching","--ignore-submodules=none"]);
  if (status && !allowDiscardedChanges) blockers.push("The folder has modified, untracked or ignored files. Preserve or remove them explicitly before removing the worktree.");
  const files = (await readGit(root,["ls-files","--stage","-z"])).split("\0");
  if (files.some(line=>line.startsWith("160000 "))) blockers.push("Worktrees with submodules require manual Git handling.");
  const flags = (await readGit(root,["ls-files","-v","-z"])).split("\0");
  if (flags.some(line=>/^[a-zS] /.test(line))) blockers.push("Index flags can hide local changes. Review assume-unchanged or skip-worktree files first.");
  return {proof:{directory:root,repository,commonDirectory,gitDirectory,branch,head,directoryIdentity:identity(root),gitIdentity:identity(gitDirectory)},blockers,status};
}

export async function reviewWorkPage(page: WorkPage, protectedDirectories: string[], pages: WorkPage[], archiveBlockers: string[] = []): Promise<FinishWorkReview> {
  let changes: string;
  try { changes = await pageChanges(page); } catch { changes = "Git changes are unavailable. Archiving keeps the folder and its contents."; }
  let proof: WorktreeRemovalProof | undefined, removalBlockers: string[] = [];
  if (page.worktreeRemoval) {
    archiveBlockers.push("This worktree was removed or its removal needs review.");
    removalBlockers.push("Use Check removal for an interrupted operation; do not repeat removal.");
  } else {
    try {
      const inspected = await inspectWorktreeRemoval(page,protectedDirectories,pages);
      ({proof,blockers:removalBlockers} = inspected);
      if (inspected.status) {
        const entries = inspected.status.split("\0").filter(Boolean);
        changes += "\n\nFiles in worktree (including ignored files):\n" + entries.slice(0,100).map(entry=>JSON.stringify(entry)).join("\n") +
          (entries.length > 100 ? "\nMore files omitted. Review the folder in your Git tool." : "");
      }
    }
    catch (e) { removalBlockers.push(e instanceof Error ? e.message : String(e)); }
  }
  const hash = createHash("sha256").update(JSON.stringify([workPageRevision(page),proof,changes,removalBlockers])).digest("hex");
  return {pageId:page.id,hash,changes,archiveBlockers,removalBlockers,proof};
}

/** Called only after the exact review and a durable pending record, under the host reservation. */
export async function removeReviewedWorktree(page: WorkPage, proof: WorktreeRemovalProof, protectedDirectories: string[], pages: WorkPage[], assertOwned:()=>void): Promise<void> {
  const current = await inspectWorktreeRemoval(page,protectedDirectories,pages);
  if (current.blockers.length) throw new Error(current.blockers.join("\n"));
  if (JSON.stringify(current.proof) !== JSON.stringify(proof)) throw new Error("Worktree changed after review; no removal was started.");
  assertOwned();
  noLinks(proof.directory); noLinks(proof.gitDirectory);
  if (identity(proof.directory) !== proof.directoryIdentity || identity(proof.gitDirectory) !== proof.gitIdentity) throw new Error("Worktree folder identity changed before removal.");
  // Git performs its own final clean/locked/main-worktree checks. Never use --force,
  // shell deletion, branch deletion or pruning as an error fallback.
  await gitIn(proof.repository,["worktree","remove","--",proof.directory]);
  if (await inspectRemovalOutcome(proof) !== "removed") throw new Error("Worktree removal is unconfirmed. Keep the pending record and review it.");
}

/** Resolves evidence only. It never repeats Git removal or deletes leftover paths. */
export async function inspectRemovalOutcome(proof: WorktreeRemovalProof): Promise<"removed" | "retained"> {
  const repository = directory(proof.repository);
  if (directory(path.resolve(repository,await readGit(repository,["rev-parse","--git-common-dir"]))) !== proof.commonDirectory) throw new Error("Repository changed during removal; manual review required.");
  const branchHead = await readGit(repository,["rev-parse","--verify","--end-of-options","refs/heads/" + proof.branch + "^{commit}"]);
  if (branchHead !== proof.head) throw new Error("The preserved branch changed; review removal manually.");
  noLinks(proof.directory); noLinks(proof.gitDirectory);
  const entries = await registrations(repository);
  const registered = entries.some(e=>e.worktree && path.relative(e.worktree,proof.directory) === "");
  if (!exists(proof.directory) && !exists(proof.gitDirectory) && !registered) return "removed";
  if (exists(proof.directory) && exists(proof.gitDirectory) && registered && identity(proof.directory) === proof.directoryIdentity && identity(proof.gitDirectory) === proof.gitIdentity) {
    const observed = await inspectWorktreeRemoval({id:"inspection",name:"",objective:"",kind:"worktree",directory:proof.directory,repository,branch:proof.branch,workflowIds:[],taskIds:[]},[],[]);
    if (JSON.stringify(observed.proof) === JSON.stringify(proof)) return "retained";
  }
  throw new Error("Removal left incomplete or changed evidence. Review it manually; no cleanup or retry was performed.");
}
