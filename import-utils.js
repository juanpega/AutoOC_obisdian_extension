function isValidGitBranchName(branch) {
  if (typeof branch !== "string" || !branch || branch === "@" || branch.startsWith("-")) return false;
  if (/[\x00-\x20~^:?*\[\\]/.test(branch)) return false;
  if (branch.includes("..") || branch.includes("@{") || branch.startsWith("/") || branch.endsWith("/") || branch.endsWith(".")) return false;

  return !branch.split("/").some((component) => (
    !component || component === "." || component === ".." || component.startsWith(".") || component.endsWith(".lock")
  ));
}

function applyLegacyLinearTransitions(steps) {
  for (let index = 0; index < steps.length - 1; index++) {
    const step = steps[index];
    if (step.transitions !== undefined) continue;

    step.transitions = [{
      toStepId: steps[index + 1].id,
      mode: step.transitionMode || "default",
      evaluatePrompt: step.evaluatePrompt,
      forceContinue: step.forceContinue,
    }];
  }
}

module.exports = { applyLegacyLinearTransitions, isValidGitBranchName };
