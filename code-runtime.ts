import * as fs from "fs";
import * as path from "path";
import * as vm from "vm";
import type { VaultMutation } from "./code-vault-mutations";

export interface CodeExecutionOptions {
  vaultBase: string;
  cwd: string;
  code: string;
  input?: unknown;
  outputs?: Record<string, string>;
  codeInputVar?: string;
  codeOutputVar?: string;
  codeAllowVault?: boolean;
  codeAllowFiles?: boolean;
  codeAllowTerminal?: boolean;
  exposePaths?: boolean;
  log?: (...args: unknown[]) => void;
  onVaultMutation?: (mutation: VaultMutation) => void;
}

// Same execution contract for tasks and steps. The caller owns status/history.
// Node vm is an execution context, not a security boundary for untrusted code.
export function executeCode(options: CodeExecutionOptions): string {
  const vaultBase = options.vaultBase;
  const defaultCwd = options.cwd;
    const resolveInVault = (p: string) => {
      const root = fs.realpathSync(vaultBase);
      const resolved = path.resolve(root, p || ".");
      if (resolved !== root && !resolved.startsWith(root + path.sep)) {
        throw new Error(`Path escapes vault: ${p}`);
      }
      // Lexical containment alone permits a junction/symlink to redirect the
      // vault capability outside its root. Inspect existing components even
      // when the final file does not exist yet. Reject dangling links too.
      let current = root;
      for (const component of path.relative(root, resolved).split(path.sep).filter(Boolean)) {
        current = path.join(current, component);
        try {
          if (fs.lstatSync(current).isSymbolicLink()) throw new Error("Linked vault paths are unsupported");
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === "ENOENT") break;
          throw error;
        }
      }
      return resolved;
    };
    const readText = (p: string) => fs.readFileSync(p, "utf8");
    const writeText = (p: string, content: any) => {
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, String(content), "utf8");
      return p;
    };
    const sandbox: Record<string, any> = {
      input: options.input ?? "",
      outputs: options.outputs || {},
      String, Number, Boolean, Array, Object, JSON, Math, Date, RegExp,
      console: { log: options.log || (() => {}) },
    };
    if (options.codeAllowVault) {
      sandbox.vault = {
        basePath: vaultBase,
        resolve: (p: string) => resolveInVault(p),
        read: (p: string) => readText(resolveInVault(p)),
        write: (p: string, content: any) => {
          const full = writeText(resolveInVault(p), content);
          options.onVaultMutation?.({path: full, operation: "write"});
          return full;
        },
        append: (p: string, content: any) => {
          const full = resolveInVault(p);
          fs.mkdirSync(path.dirname(full), { recursive: true });
          fs.appendFileSync(full, String(content), "utf8");
          options.onVaultMutation?.({path: full, operation: "append"});
          return full;
        },
        exists: (p: string) => fs.existsSync(resolveInVault(p)),
        list: (p = ".") => fs.readdirSync(resolveInVault(p)),
      };
    }
    if (options.codeAllowFiles) {
      sandbox.files = {
        cwd: defaultCwd,
        resolve: (p: string) => path.isAbsolute(p) ? path.resolve(p) : path.resolve(defaultCwd, p || "."),
        read: (p: string) => readText(path.isAbsolute(p) ? path.resolve(p) : path.resolve(defaultCwd, p)),
        write: (p: string, content: any) => writeText(path.isAbsolute(p) ? path.resolve(p) : path.resolve(defaultCwd, p), content),
        append: (p: string, content: any) => {
          const full = path.isAbsolute(p) ? path.resolve(p) : path.resolve(defaultCwd, p);
          fs.mkdirSync(path.dirname(full), { recursive: true });
          fs.appendFileSync(full, String(content), "utf8");
          return full;
        },
        exists: (p: string) => fs.existsSync(path.isAbsolute(p) ? path.resolve(p) : path.resolve(defaultCwd, p)),
        list: (p = ".") => fs.readdirSync(path.isAbsolute(p) ? path.resolve(p) : path.resolve(defaultCwd, p)),
      };
    }
    if (options.codeAllowTerminal) {
      const { execSync } = require("child_process");
      sandbox.terminal = {
        run: (command: string, options: { cwd?: string; timeoutMs?: number } = {}) => execSync(String(command), {
          cwd: options.cwd ? (path.isAbsolute(options.cwd) ? options.cwd : path.resolve(defaultCwd, options.cwd)) : defaultCwd,
          timeout: Math.min(Math.max(options.timeoutMs || 30_000, 1_000), 600_000),
          encoding: "utf8",
        }),
      };
    }

  // Standalone code tasks historically do not expose these path helpers.
  if (options.exposePaths === false) {
    if (sandbox.vault) { delete sandbox.vault.basePath; delete sandbox.vault.resolve; }
    if (sandbox.files) { delete sandbox.files.cwd; delete sandbox.files.resolve; }
  }
  const inputVar = options.codeInputVar || "input";
  const outputVar = options.codeOutputVar || "output";
  const preamble = `var ${inputVar} = input; var ${outputVar} = "";`;
  const result = vm.runInNewContext(preamble + "\n" + options.code + "\n;" + outputVar, sandbox, {timeout:900_000});
  return String(result == null ? "" : result);
}
