import { executeCode, type CodeExecutionOptions } from "./code-runtime";

// Preserve the plugin's Code-task contract: code falls back to prompt;
// workflow context is not implicitly evaluated or injected as source code.
export function executeCodeTask(options: Omit<CodeExecutionOptions, "code" | "exposePaths"> & {code?:string;prompt?:string}): string {
  const code = options.code || options.prompt || "";
  if (!code.trim()) throw new Error("Code task not launched: code is empty.");
  return executeCode({...options, code, exposePaths:false});
}
