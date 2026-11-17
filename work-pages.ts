import * as fs from "fs";
import * as path from "path";
import { randomUUID, createHash } from "crypto";
import { execFile } from "child_process";
import { catalogTransaction } from "./catalog-transaction";
import { physicalPath, isWithinPhysicalPath } from "./path-identity";
import { independentGitWorkspaces } from "./workspace-conflicts";

export const WORKTREE_FOLDER = ".autooc/worktrees";
export const WORKTREE_IGNORE = "/.autooc/worktrees/";
export interface WorkPage {
  id: string; name: string; objective: string; directory: string;
  kind: "folder" | "worktree"; repository?: string; branch?: string; baseCommit?: string;
  workflowIds: string[]; taskIds: string[]; archived?: boolean;
  requirementId?: string;
  requirementFile?: {path:string;sha256:string};
  worktreeRemoval?: {
    status: "pending" | "removed"; token: string; ownerToken: string; requestedAt: string; completedAt?: string;
    proof: WorktreeRemovalProof; mode?: "discard";
  };
}
export interface WorktreeRemovalProof {
  directory: string; repository: string; commonDirectory: string; gitDirectory: string;
  branch: string; head: string; directoryIdentity: string; gitIdentity: string;
  discard?: {treeHash:string;comparisonBase:string};
}
export interface PageRun {
  pageId: string; sourceId: string; task: boolean; runId: string; workflowId: string;
  name: string; phase: string; revision: number; createdAt: string; uncertain: boolean;
}
export interface PageTerminalClaim { id: string; pageId: string; directory: string; createdAt: string; exclusive?: boolean; }
export interface WorkPageSettings {
  worktreesEnabled?: boolean; workPages?: WorkPage[]; pageRuns?: PageRun[];
  pageTerminalClaims?: PageTerminalClaim[]; worktreeNoticeDismissed?: string[];
}

export function validateWorkPages(settings: WorkPageSettings): void {
  if (settings.worktreesEnabled !== undefined && typeof settings.worktreesEnabled !== "boolean") throw new Error("Invalid worktree preference");
  if (settings.workPages !== undefined && !Array.isArray(settings.workPages)) throw new Error("Invalid work pages; existing data has been preserved");
  const ids = new Set<string>();
  for (const page of settings.workPages || []) {
    if (!page || !/^[a-zA-Z0-9-]{1,80}$/.test(page.id) || ["main", "general"].includes(page.id) || ids.has(page.id) ||
        typeof page.name !== "string" || !page.name.trim() || typeof page.objective !== "string" ||
        typeof page.directory !== "string" || !path.isAbsolute(page.directory) || !["folder", "worktree"].includes(page.kind) ||
        !Array.isArray(page.workflowIds) || !Array.isArray(page.taskIds) || [...page.workflowIds, ...page.taskIds].some(id => typeof id !== "string" || !id)) {
      throw new Error("Invalid work page; existing data has been preserved");
    }
    ids.add(page.id);
    if(page.requirementId!==undefined && (typeof page.requirementId!=="string" || !page.requirementId.trim() || page.requirementId.length>200) ||
        page.requirementFile!==undefined && (!page.requirementId || page.requirementFile?.path!==".autooc/requirement.md" || !/^[a-f0-9]{64}$/.test(page.requirementFile?.sha256))) throw new Error("Invalid page requirement metadata");
    const removal = page.worktreeRemoval;
    if (removal && (removal.mode !== undefined && removal.mode !== "discard" ||
        removal.mode === "discard" && (!removal.proof?.discard || !/^[a-f0-9]{64}$/.test(removal.proof.discard.treeHash) || !/^[a-f0-9]{40,64}$/.test(removal.proof.discard.comparisonBase)) ||
        removal.mode !== "discard" && removal.proof?.discard !== undefined)) throw new Error("Invalid discard evidence; existing data has been preserved");
    if (removal !== undefined && (!removal || page.kind !== "worktree" || page.archived !== true ||
        !["pending","removed"].includes(removal.status) || typeof removal.token !== "string" || !/^[a-f0-9-]{36}$/.test(removal.token) ||
        typeof removal.ownerToken !== "string" || !/^[a-f0-9-]{36}$/.test(removal.ownerToken) ||
        typeof removal.requestedAt !== "string" || !Number.isFinite(Date.parse(removal.requestedAt)) ||
        removal.status === "removed" && (typeof removal.completedAt !== "string" || !Number.isFinite(Date.parse(removal.completedAt))) ||
        !removal.proof || ["directory","repository","commonDirectory","gitDirectory"].some(key=>typeof (removal.proof as any)[key] !== "string" || !path.isAbsolute((removal.proof as any)[key])) ||
        ["branch","head","directoryIdentity","gitIdentity"].some(key=>typeof (removal.proof as any)[key] !== "string" || !(removal.proof as any)[key]) ||
        removal.proof.directory !== page.directory || removal.proof.repository !== page.repository || removal.proof.branch !== page.branch)) {
      throw new Error("Invalid worktree removal evidence; existing data has been preserved");
    }
  }
  for (const key of ["pageRuns", "pageTerminalClaims", "worktreeNoticeDismissed"] as const) {
    if (settings[key] !== undefined && !Array.isArray(settings[key])) throw new Error("Invalid " + key + "; existing data has been preserved");
  }
  if (settings.worktreeNoticeDismissed?.some(key=>typeof key!=="string" || !key)) throw new Error("Invalid worktree notice preferences");
  if (settings.pageTerminalClaims?.some(claim=>!claim || typeof claim.id!=="string" || !claim.id || typeof claim.pageId!=="string" ||
      typeof claim.directory!=="string" || !path.isAbsolute(claim.directory) || typeof claim.createdAt!=="string" ||
      claim.exclusive !== undefined && typeof claim.exclusive !== "boolean")) throw new Error("Invalid page terminal reservations; existing data has been preserved");
  if (settings.pageRuns?.some(run=>!run || typeof run.runId!=="string" || !/^[a-f0-9-]+$/.test(run.runId) ||
      typeof run.pageId!=="string" || typeof run.sourceId!=="string" || typeof run.task!=="boolean" ||
      typeof run.workflowId!=="string" || typeof run.name!=="string" || typeof run.createdAt!=="string" || typeof run.uncertain!=="boolean" ||
      !Number.isSafeInteger(run.revision) || run.revision<0 || !["ready","in_flight","completed","failed","abandoned"].includes(run.phase))) throw new Error("Invalid page history; existing data has been preserved");
}
export function selectWorkPage(settings: WorkPageSettings, id: string): WorkPage {
  validateWorkPages(settings);
  const matches = (settings.workPages || []).filter(page => page.id === id);
  if (matches.length !== 1) throw new Error("Work page is missing or ambiguous");
  return matches[0];
}

/** Shared registration boundary for the UI and CLI. A retry never replaces an existing page. */
export async function registerWorkPage(settings:WorkPageSettings,page:WorkPage,save:()=>Promise<void>):Promise<void> {
  validateWorkPages(settings);validateWorkPages({workPages:[page]});
  const previous=settings.workPages,existing=previous?.find(item=>item.id===page.id);
  if(existing){if(JSON.stringify(existing)!==JSON.stringify(page))throw new Error("Page ID already exists with different settings");return;}
  if(previous?.some(item=>physicalPath(item.directory)===physicalPath(page.directory)))throw new Error("Another page already uses this folder");
  const next=[...(previous || []),page];settings.workPages=next;
  try{await save();}catch(error){if(settings.workPages===next)settings.workPages=previous;throw error;}
}
export function pageExecutionId(pageId: string, sourceId: string, task = false): string {
  return "@page:" + pageId + ":" + (task ? "task:" : "workflow:") + sourceId;
}
/** Omission and explicit main preserve the legacy execution path. */
export function normalizePageSelection(id?: string): string | undefined {
  if (id === undefined || id === "main") return undefined;
  if (typeof id !== "string" || !/^[a-zA-Z0-9-]{1,80}$/.test(id) || id === "general") throw new Error("Invalid page ID; use pages --vault to list workspaces. Overview cannot execute work.");
  return id;
}

/** Read-only CLI discovery: never publish objectives, prompts, results or secrets. */
export function summarizeWorkPages(settings: WorkPageSettings & {workingDirectory?: string}, vault: string) {
  validateWorkPages(settings);
  return [{id:"main",name:"Main workspace",directory:settings.workingDirectory?.trim() || vault,kind:"main",archived:false},
    ...(settings.workPages || []).map(({id,name,directory,kind,branch,archived,worktreeRemoval,requirementId,requirementFile})=>({id,name,directory,kind,branch,archived:!!archived,...(worktreeRemoval ? {worktreeRemoval:worktreeRemoval.status} : {}),...(requirementId ? {requirementId,requirementFile:requirementFile?.path} : {})}))];
}
export function directoriesOverlap(a: string, b: string): boolean {
  return isWithinPhysicalPath(a, b) || isWithinPhysicalPath(b, a);
}
export function assertNoPageTerminal(settings: WorkPageSettings, directory: string, scopedWorkspace = false): void {
  for (const claim of settings.pageTerminalClaims || []) {
    if (!claim || typeof claim.directory !== "string") throw new Error("Invalid terminal reservation; review existing sessions");
    if (claim.exclusive) throw new Error("An exclusive page terminal reserves execution. Close its session before starting another writer.");
    if (directoriesOverlap(claim.directory, directory) && !(scopedWorkspace && independentGitWorkspaces(claim.directory,directory))) throw new Error("A page terminal reserves this folder. Close the session and confirm its completion in the page before starting another writer.");
  }
}
export function gitIn(directory: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => execFile("git", ["-c", "safe.directory=" + directory.replace(/\\/g, "/"), ...args],
    { cwd: directory, encoding: "utf8", windowsHide: true, timeout: 30000, maxBuffer: 4 * 1024 * 1024 },
    (error, stdout, stderr) => error ? reject(Object.assign(new Error("Git: " + String(stderr || error.message).trim()), {gitExitCode: error.code})) : resolve(stdout.trim())));
}
export type WorkspaceGitState = {kind: "branch"; branch: string} | {kind: "detached"; commit: string} | {kind: "no-repository"};
/** Read-only, including unborn branches; never check out a branch to inspect it. */
export async function readWorkspaceGitState(directory: string): Promise<WorkspaceGitState> {
  try {
    return {kind: "branch", branch: await gitIn(directory, ["symbolic-ref", "--quiet", "--short", "HEAD"])};
  } catch (error) {
    if ((error as {gitExitCode?: number}).gitExitCode === 1) {
      return {kind: "detached", commit: await gitIn(directory, ["rev-parse", "--short=8", "HEAD"])};
    }
    if (/not a git repository/i.test(error instanceof Error ? error.message : String(error))) return {kind: "no-repository"};
    throw error;
  }
}
function regularPath(root: string, relative: string): void {
  let current = root;
  for (const part of relative.split("/")) {
    current = path.join(current, part);
    try { if (fs.lstatSync(current).isSymbolicLink()) throw new Error("Worktree preparation cannot follow symbolic links"); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  }
}
export interface WorktreePreparation { repository: string; ignoreFile: string; directory: string; excluded: boolean; preferenceKey: string; }

export async function inspectWorktreePreparation(project: string): Promise<WorktreePreparation> {
  const repository = physicalPath(await gitIn(physicalPath(project), ["rev-parse", "--show-toplevel"]));
  regularPath(repository, WORKTREE_FOLDER); regularPath(repository, ".gitignore");
  const ignoreFile = path.join(repository, ".gitignore");
  if (fs.existsSync(ignoreFile) && !fs.statSync(ignoreFile).isFile()) throw new Error(".gitignore is not a regular file");
  if ((await gitIn(repository, ["ls-files", "--", WORKTREE_FOLDER])).length) throw new Error("The worktree folder contains tracked files. .gitignore cannot untrack them; review the location first.");
  let excluded = false;
  try { excluded = !!await gitIn(repository, ["check-ignore", "--no-index", "--", WORKTREE_FOLDER + "/autooc-probe"]); }
  catch (error) { if ((error as any).gitExitCode !== 1) throw error; }
  const directory = path.join(repository, WORKTREE_FOLDER);
  return { repository, ignoreFile, directory, excluded, preferenceKey: repository + "\n" + directory + "\n" + WORKTREE_IGNORE };
}

/** Only after acceptance, or under that project's saved preparation preference. */
export async function prepareWorktreeIgnore(observed: WorktreePreparation): Promise<WorktreePreparation> {
  return catalogTransaction(observed.ignoreFile, async () => {
    const current = await inspectWorktreePreparation(observed.repository);
    if (current.preferenceKey !== observed.preferenceKey) throw new Error("Worktree location changed; review it again");
    if (current.excluded) return current;
    const exists = fs.existsSync(current.ignoreFile);
    const before = exists ? fs.readFileSync(current.ignoreFile) : Buffer.alloc(0);
    const text = before.toString("utf8"), newline = text.includes("\r\n") ? "\r\n" : "\n";
    const addition = (before.length && !text.endsWith("\n") ? newline : "") + WORKTREE_IGNORE + newline;
    const temporary = current.ignoreFile + ".autooc-" + randomUUID() + ".tmp";
    const bytes = Buffer.concat([before, Buffer.from(addition, "utf8")]);
    fs.writeFileSync(temporary, bytes, { flag: "wx", mode: exists ? fs.statSync(current.ignoreFile).mode : 0o600 });
    regularPath(current.repository, ".gitignore");
    if (exists !== fs.existsSync(current.ignoreFile) || exists && !fs.readFileSync(current.ignoreFile).equals(before)) {
      throw new Error(".gitignore changed during preparation; original edits and the prepared temporary file were preserved. Review and retry.");
    }
    if (exists) fs.renameSync(temporary, current.ignoreFile);
    else { fs.writeFileSync(current.ignoreFile, bytes, { flag: "wx", mode: 0o600 }); fs.unlinkSync(temporary); }
    const verified = await inspectWorktreePreparation(current.repository);
    if (!verified.excluded) throw new Error("Worktree folder is not effectively ignored; no worktree was created");
    return verified;
  });
}
export async function createPageWorktree(prepared: WorktreePreparation, pageId: string, branch: string, base: string): Promise<Pick<WorkPage, "directory" | "repository" | "branch" | "baseCommit" | "kind">> {
  if (!/^[a-zA-Z0-9-]{1,80}$/.test(pageId) || !branch.trim() || !base.trim()) throw new Error("A page ID, branch and base are required");
  return catalogTransaction(path.join(prepared.repository, ".autooc-worktree-preparation"), async () => {
    const verified = await inspectWorktreePreparation(prepared.repository);
    if (!verified.excluded || verified.preferenceKey !== prepared.preferenceKey) throw new Error("Prepare the worktree location first");
    await gitIn(verified.repository, ["check-ref-format", "--branch", branch]);
    const baseCommit = await gitIn(verified.repository, ["rev-parse", "--verify", "--end-of-options", base + "^{commit}"]);
    regularPath(verified.repository, WORKTREE_FOLDER);
    fs.mkdirSync(verified.directory, { recursive: true });
    const directory = path.join(verified.directory, pageId);
    if (fs.existsSync(directory)) throw new Error("Page folder already exists; link it instead");
    await gitIn(verified.repository, ["worktree", "add", "-b", branch, "--", directory, baseCommit]);
    return { kind: "worktree", directory: physicalPath(directory), repository: verified.repository, branch, baseCommit };
  });
}
export async function describePageFolder(directory: string, worktree: boolean): Promise<Pick<WorkPage, "directory" | "repository" | "branch" | "kind">> {
  if (!path.isAbsolute(directory)) throw new Error("Choose an absolute folder path");
  const resolved = physicalPath(directory);
  if (!fs.statSync(resolved).isDirectory()) throw new Error("The selected path is not a folder");
  if (!worktree) return { directory: resolved, kind: "folder" };
  const top = physicalPath(await gitIn(resolved, ["rev-parse", "--show-toplevel"]));
  if (top !== resolved || !fs.statSync(path.join(top, ".git")).isFile()) throw new Error("Select the root of an existing linked worktree");
  const common = physicalPath(path.resolve(top, await gitIn(top, ["rev-parse", "--git-common-dir"])));
  const branch = await gitIn(top, ["branch", "--show-current"]);
  if (!branch) throw new Error("The worktree must have an attached branch");
  const primary = (await gitIn(top, ["worktree", "list", "--porcelain", "-z"])).split("\0").find(field=>field.startsWith("worktree "));
  if (!primary) throw new Error("The worktree repository is unavailable");
  const repository = physicalPath(primary.slice(9));
  if (physicalPath(path.resolve(repository,await gitIn(repository,["rev-parse","--git-common-dir"]))) !== common) throw new Error("The worktree repository changed; review it again");
  return { kind: "worktree", directory: resolved, repository, branch };
}

/** Shared by workflow execution and new manual CLI sessions; never changes Git state. */
export async function verifyWorkPageEnvironment(page: WorkPage): Promise<void> {
  if (physicalPath(page.directory) !== page.directory || !fs.statSync(page.directory).isDirectory()) throw new Error("Page folder is unavailable or changed");
  if(page.requirementFile){
    validateWorkPages({workPages:[page]});regularPath(page.directory,".autooc/requirement.md");
    const file=path.join(page.directory,page.requirementFile.path),stat=fs.lstatSync(file);
    if(!stat.isFile() || stat.nlink!==1 || stat.size>160000 || createHash("sha256").update(fs.readFileSync(file)).digest("hex")!==page.requirementFile.sha256)throw new Error("Page requirement snapshot changed; preserve its original contents before running");
  }
  if (page.kind !== "worktree") return;
  if (!page.repository || !page.branch) throw new Error("Worktree identity is incomplete");
  const top = physicalPath(await gitIn(page.directory,["rev-parse","--show-toplevel"]));
  if (top !== page.directory || !fs.lstatSync(path.join(top,".git")).isFile()) throw new Error("Page is no longer the root of a linked worktree");
  const common = physicalPath(path.resolve(page.directory,await gitIn(page.directory,["rev-parse","--git-common-dir"])));
  const expected = physicalPath(path.resolve(page.repository,await gitIn(page.repository,["rev-parse","--git-common-dir"])));
  if (common !== expected || (await gitIn(page.directory,["branch","--show-current"])) !== page.branch) throw new Error("Page repository or branch changed; review its environment before continuing");
}
export async function pageChanges(page: WorkPage): Promise<string> {
  const status = await gitIn(page.directory, ["--no-optional-locks", "status", "--short"]);
  let base:string | undefined;
  try { base = await gitIn(page.directory,["rev-parse","--verify","--end-of-options",(page.baseCommit || "HEAD") + "^{commit}"]); }
  catch (error) { if (page.baseCommit) throw error; } // An unborn repository has no HEAD yet.
  const args = ["--no-optional-locks","diff","--no-ext-diff","--no-textconv","--no-color","--no-renames"];
  const summary = await gitIn(page.directory,[...args,"--stat",...(base ? [base] : ["--cached"]),"--"]);
  let patch:string;
  try {
    patch = await gitIn(page.directory,[...args,"--unified=3",...(base ? [base] : ["--cached"]),"--"]);
    if (!base) patch += "\n" + await gitIn(page.directory,[...args,"--unified=3","--"]);
    const lines = patch.split(/\r?\n/);
    if (lines.length > 1200 || patch.length > 160000) patch = lines.slice(0,1200).join("\n").slice(0,160000) + "\nPreview shortened. Review the full diff in your Git tool.";
  } catch { patch = "Patch preview unavailable or too large. Review changes in your Git tool. No files were changed."; }
  return "Working folder status (untracked file contents are not included):\n" + (status || "No uncommitted changes.") +
    "\n\n" + (page.baseCommit ? "Compared with the worktree creation commit" : base ? "Compared with HEAD (staged and unstaged changes)" : "New repository (staged and unstaged changes)") +
    "\n" + (summary || "No file differences.") + "\n\n" + patch;
}
export function pageIdentityHash(page: WorkPage): string {
  const identity:unknown[]=[page.id, physicalPath(page.directory), page.kind, page.repository, page.branch];
  if(page.requirementId!==undefined || page.requirementFile!==undefined)identity.push({requirementId:page.requirementId,requirementFile:page.requirementFile});
  return createHash("sha256").update(JSON.stringify(identity)).digest("hex");
}
