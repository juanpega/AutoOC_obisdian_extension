import * as fs from "fs";
import * as path from "path";
import { physicalPath, isWithinPhysicalPath } from "./path-identity";
import type { PreparedWorkflow } from "./workflow-definition";
import { validateBranchOptions, branchRepository } from "./workflow-branch";

// Validate all steps before the journal or first Code effect. The installed
// catalog is trusted input, but an explicit vault does not authorize other roots.
export function preflightInstalledWorkflow(definition:PreparedWorkflow,vault:string) {
  const root = physicalPath(vault);
  const checkDirectory = (value:unknown) => {
    if (value !== undefined && typeof value !== "string") throw new Error("Invalid working directory");
    const configured = value || root;
    if (!path.isAbsolute(configured as string)) throw new Error("Working directory must be absolute");
    const directory = physicalPath(configured as string);
    if (!isWithinPhysicalPath(root,directory)) throw new Error("Working directory is outside the selected vault");
    if (!fs.statSync(directory).isDirectory()) throw new Error("Working directory is unavailable");
  };
  checkDirectory(definition.settings.workingDirectory);
  for (const item of [definition.workflow,...definition.workflow.steps,...definition.tasks] as Record<string,any>[]) {
    if (item.requiresAutoOCSecrets !== undefined && typeof item.requiresAutoOCSecrets !== "boolean") throw new Error("Invalid AutoOC secrets dependency declaration");
    if (item.requiresAutoOCSecrets === true) throw new Error("AutoOC secret store is unavailable in the shared runtime; use the supported Obsidian path");
    if (item.workingDirectory !== undefined) checkDirectory(item.workingDirectory);
    if(item.interactiveTerminal!==undefined && typeof item.interactiveTerminal!=="boolean")throw new Error("interactiveTerminal must be boolean");
    if(item.taskKind==="code" && item.interactiveTerminal===true)throw new Error("Code tasks cannot be interactive");
    validateBranchOptions(item);
    if(item.branch?.trim() || definition.workflow.handoffBranch) branchRepository(item.workingDirectory || definition.settings.workingDirectory || root,root);
  }
  for (const task of definition.tasks) {
    if(task.taskKind==='code') continue;
    if(typeof task.prompt!=='string' || !task.prompt.trim()) throw new Error("Task prompt must be nonempty before execution");
    if((!task.taskKind || task.taskKind==='opencode') && !(task.model || definition.settings.defaultModel)?.trim()) throw new Error("OpenCode model must be selected before execution");
  }
}
