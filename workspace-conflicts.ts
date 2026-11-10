import * as path from "path";
import { execFileSync } from "child_process";
import { physicalPath, samePhysicalPath, isWithinPhysicalPath } from "./path-identity";

/** A cooperation boundary for scoped writers, not a filesystem sandbox.
 * Only actual, registered Git working roots qualify. Probe failures keep the lock.
 */
export function independentGitWorkspaces(a: string, b: string): boolean {
  try {
    a = physicalPath(a); b = physicalPath(b);
    if (samePhysicalPath(a, b)) return false;
    const git = (cwd: string, ...args: string[]) => execFileSync("git",
      ["-c", "safe.directory=" + cwd.replace(/\\/g,"/"), ...args],
      {cwd, encoding:"utf8", windowsHide:true, timeout:5000, stdio:["ignore","pipe","pipe"]}).trim();
    const identity = (cwd: string) => ({
      root: physicalPath(git(cwd,"rev-parse","--show-toplevel")),
      common: physicalPath(path.resolve(cwd,git(cwd,"rev-parse","--git-common-dir"))),
      gitDir: physicalPath(path.resolve(cwd,git(cwd,"rev-parse","--git-dir")))
    });
    const left = identity(a), right = identity(b);
    if (!samePhysicalPath(a,left.root) || !samePhysicalPath(b,right.root) ||
        !samePhysicalPath(left.common,right.common) || samePhysicalPath(left.gitDir,right.gitDir)) return false;
    const roots = git(a,"worktree","list","--porcelain","-z").split("\0")
      .filter(field=>field.startsWith("worktree ")).map(field=>field.slice(9));
    if (![a,b].every(root=>roots.some(entry=>samePhysicalPath(entry,root)))) return false;
    const parent = isWithinPhysicalPath(a,b) ? a : isWithinPhysicalPath(b,a) ? b : undefined;
    if (parent) {
      const child = parent === a ? b : a;
      // A parent Git operation must not discover/stage the nested working tree.
      git(parent,"check-ignore","--quiet","--",path.relative(parent,child).replace(/\\/g,"/") + "/");
    }
    return true;
  } catch { return false; }
}
