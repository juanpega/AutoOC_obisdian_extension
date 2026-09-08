import { spawn, type ChildProcessWithoutNullStreams } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

export type CodexReasoningEffort = "minimal" | "low" | "medium" | "high" | "xhigh" | "max" | "ultra";

export interface CodexModelOption {
  value: string;
  label: string;
  defaultReasoningEffort?: string;
  supportedReasoningEfforts: string[];
  isDefault: boolean;
}

export interface CodexApprovalRequest {
  requestId: string | number;
  method: string;
  kind: "command" | "file-change" | "permissions";
  summary: string;
  params: Record<string, unknown>;
}

export interface CodexRunResult {
  output: string;
  threadId: string;
  turnId: string;
  status: string;
  error?: string;
}

interface JsonRpcMessage {
  id?: string | number;
  method?: string;
  params?: any;
  result?: any;
  error?: { code?: number; message?: string; data?: unknown };
}

interface PendingRequest {
  resolve: (value: any) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

/** Small JSON-lines peer used by Codex App Server's stdio transport. */
export class JsonLineRpcPeer {
  private buffer = "";
  private nextId = 1;
  private pending = new Map<string | number, PendingRequest>();

  constructor(
    private readonly writeLine: (line: string) => void,
    private readonly onMessage: (message: JsonRpcMessage) => void,
  ) {}

  feed(chunk: string | Buffer): void {
    this.buffer += chunk.toString();
    while (true) {
      const newline = this.buffer.indexOf("\n");
      if (newline < 0) return;
      const raw = this.buffer.slice(0, newline).trim();
      this.buffer = this.buffer.slice(newline + 1);
      if (!raw) continue;
      let message: JsonRpcMessage;
      try {
        message = JSON.parse(raw);
      } catch {
        continue;
      }
      if (message.id !== undefined && !message.method && (message.result !== undefined || message.error)) {
        const pending = this.pending.get(message.id);
        if (!pending) continue;
        this.pending.delete(message.id);
        clearTimeout(pending.timer);
        if (message.error) {
          pending.reject(new Error(message.error.message || `Codex RPC error ${message.error.code ?? "unknown"}`));
        } else {
          pending.resolve(message.result);
        }
        continue;
      }
      this.onMessage(message);
    }
  }

  request(method: string, params: Record<string, unknown> = {}, timeoutMs = 30_000): Promise<any> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Codex RPC request timed out: ${method}`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.writeLine(JSON.stringify({ id, method, params }) + "\n");
    });
  }

  notify(method: string, params: Record<string, unknown> = {}): void {
    this.writeLine(JSON.stringify({ method, params }) + "\n");
  }

  respond(id: string | number, result: unknown): void {
    this.writeLine(JSON.stringify({ id, result }) + "\n");
  }

  rejectAll(error: Error): void {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }
}

export function resolveCodexBin(configured = "codex"): string {
  if (configured.trim() && configured.trim() !== "codex") return configured.trim();
  const candidates: string[] = [];
  if (os.platform() === "win32") {
    const localAppData = process.env.LOCALAPPDATA || "";
    const desktopBinRoot = path.join(localAppData, "OpenAI", "Codex", "bin");
    try {
      const versionDirs = fs.readdirSync(desktopBinRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => path.join(desktopBinRoot, entry.name, "codex.exe"))
        .filter((candidate) => fs.existsSync(candidate))
        .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
      candidates.push(...versionDirs);
    } catch { /* installation is optional */ }
    candidates.push(
      path.join(localAppData, "OpenAI", "Codex", "codex.exe"),
      path.join(process.env.APPDATA || "", "npm", "codex.cmd"),
    );
  } else {
    const userHome = process.env.HOME || "";
    candidates.push(
      path.join(userHome, ".local", "bin", "codex"),
      path.join(userHome, ".npm-global", "bin", "codex"),
      "/opt/homebrew/bin/codex",
      "/usr/local/bin/codex",
    );
  }
  return candidates.find((candidate) => candidate && fs.existsSync(candidate)) || configured || "codex";
}

export function openCodexApp(bin: string, cwd: string, onError?: (error: Error) => void): void {
  const child = spawn(bin, ["app", cwd], {
    cwd,
    detached: true,
    stdio: "ignore",
    windowsHide: false,
  });
  child.on("error", (error) => onError?.(error));
  child.unref();
}

export function buildCodexNewThreadUrl(cwd: string): string {
  const url = new URL("codex://threads/new");
  url.searchParams.set("path", cwd);
  return url.toString();
}

export function buildCodexOpenProjectArg(cwd: string): string {
  return `--open-project=${cwd}`;
}

export function openCodexNewThread(cwd: string, onError?: (error: Error) => void): void {
  if (process.platform === "win32") {
    const script = [
      "$ErrorActionPreference = 'Stop'",
      "$package = Get-AppxPackage -Name OpenAI.Codex | Sort-Object Version -Descending | Select-Object -First 1",
      "if (-not $package) { throw 'The ChatGPT/Codex Windows app is not installed.' }",
      "$exe = Join-Path $package.InstallLocation 'app\\ChatGPT.exe'",
      "if (-not (Test-Path -LiteralPath $exe -PathType Leaf)) { throw 'ChatGPT.exe was not found in the installed Codex package.' }",
      "$profileRoot = [IO.Path]::GetFullPath((Join-Path ([IO.Path]::GetTempPath()) 'AutoOC\\ChatGPT'))",
      "$profile = Join-Path $profileRoot ([Guid]::NewGuid().ToString('N'))",
      "[void](New-Item -ItemType Directory -Path $profile -Force)",
      "$native = @'\nusing System;\nusing System.Runtime.InteropServices;\npublic static class AutoOCChatGPTWindow {\n  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);\n  [DllImport(\"user32.dll\")] private static extern bool EnumWindows(EnumWindowsProc callback, IntPtr lParam);\n  [DllImport(\"user32.dll\")] private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);\n  [DllImport(\"user32.dll\")] private static extern bool IsWindowVisible(IntPtr hWnd);\n  [DllImport(\"user32.dll\")] private static extern bool ShowWindowAsync(IntPtr hWnd, int command);\n  [DllImport(\"user32.dll\")] private static extern bool BringWindowToTop(IntPtr hWnd);\n  [DllImport(\"user32.dll\")] private static extern bool SetForegroundWindow(IntPtr hWnd);\n  [DllImport(\"user32.dll\")] private static extern IntPtr GetForegroundWindow();\n  [DllImport(\"user32.dll\")] private static extern uint GetWindowThreadProcessId(IntPtr hWnd, IntPtr processId);\n  [DllImport(\"kernel32.dll\")] private static extern uint GetCurrentThreadId();\n  [DllImport(\"user32.dll\")] private static extern bool AttachThreadInput(uint first, uint second, bool attach);\n  [DllImport(\"user32.dll\")] private static extern void keybd_event(byte virtualKey, byte scanCode, uint flags, UIntPtr extraInfo);\n  public static IntPtr FindVisibleWindow(uint targetProcessId) {\n    IntPtr result = IntPtr.Zero;\n    EnumWindows((window, unused) => { uint processId; GetWindowThreadProcessId(window, out processId); if (processId == targetProcessId && IsWindowVisible(window)) { result = window; return false; } return true; }, IntPtr.Zero);\n    return result;\n  }\n  public static bool Focus(IntPtr window) {\n    ShowWindowAsync(window, 9);\n    uint ignored;\n    uint foregroundThread = GetWindowThreadProcessId(GetForegroundWindow(), out ignored);\n    uint currentThread = GetCurrentThreadId();\n    AttachThreadInput(currentThread, foregroundThread, true);\n    keybd_event(0x12, 0, 0, UIntPtr.Zero);\n    keybd_event(0x12, 0, 2, UIntPtr.Zero);\n    BringWindowToTop(window);\n    SetForegroundWindow(window);\n    AttachThreadInput(currentThread, foregroundThread, false);\n    return GetForegroundWindow() == window;\n  }\n}\n'@",
      "Add-Type -TypeDefinition $native",
      "$process = Start-Process -FilePath $exe -ArgumentList @((\"--user-data-dir={0}\" -f $profile), $env:AUTOOC_CODEX_OPEN_PROJECT) -PassThru",
      "$window = [IntPtr]::Zero",
      "for ($i = 0; $i -lt 80 -and $window -eq [IntPtr]::Zero; $i++) { Start-Sleep -Milliseconds 250; $window = [AutoOCChatGPTWindow]::FindVisibleWindow([uint32]$process.Id) }",
      "if ($window -eq [IntPtr]::Zero) { throw 'A separate ChatGPT window did not appear.' }",
      "$focused = $false",
      "for ($i = 0; $i -lt 10 -and -not $focused; $i++) { $focused = [AutoOCChatGPTWindow]::Focus($window); if (-not $focused) { Start-Sleep -Milliseconds 200 } }",
      "if (-not $focused) { throw 'The new ChatGPT window could not be focused.' }",
      "Start-Sleep -Milliseconds 750",
      "$shell = New-Object -ComObject WScript.Shell",
      "$shell.SendKeys('^n')",
      "$cleanupProfile = $profile.Replace(\"'\", \"''\")",
      "$cleanupRoot = $profileRoot.Replace(\"'\", \"''\")",
      "$cleanup = \"`$profile = '$cleanupProfile'; `$root = '$cleanupRoot'; `$mainPid = $($process.Id); Start-Sleep -Seconds 30; while ((`$main = Get-Process -Id `$mainPid -ErrorAction SilentlyContinue) -and `$main.MainWindowHandle -ne 0) { Start-Sleep -Seconds 5 }; Get-CimInstance Win32_Process | Where-Object { `$_.Name -eq 'ChatGPT.exe' -and `$_.CommandLine -like ('*' + `$profile + '*') } | ForEach-Object { Stop-Process -Id `$_.ProcessId -Force -ErrorAction SilentlyContinue }; `$resolved = [IO.Path]::GetFullPath(`$profile); if (`$resolved.StartsWith(`$root + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath `$resolved)) { Remove-Item -LiteralPath `$resolved -Recurse -Force }\"",
      "$encodedCleanup = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($cleanup))",
      "Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', $encodedCleanup) -WindowStyle Hidden | Out-Null",
    ].join("\n");
    const child = spawn("powershell.exe", ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", script], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
      env: { ...process.env, AUTOOC_CODEX_OPEN_PROJECT: buildCodexOpenProjectArg(cwd) },
    });
    let reported = false;
    child.once("error", (error) => {
      reported = true;
      onError?.(error);
    });
    child.once("exit", (code) => {
      if (!reported && code !== 0) onError?.(new Error(`ChatGPT/Codex launcher exited with code ${code ?? "unknown"}`));
    });
    child.unref();
    return;
  }

  const url = buildCodexNewThreadUrl(cwd);
  const launcher = process.platform === "darwin"
    ? { bin: "open", args: [url] }
    : { bin: "xdg-open", args: [url] };
  const child = spawn(launcher.bin, launcher.args, {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  child.on("error", (error) => onError?.(error));
  child.unref();
}

export class CodexAppServerClient {
  private child: ChildProcessWithoutNullStreams | null = null;
  private peer: JsonLineRpcPeer | null = null;
  private initialized = false;
  private disposed = false;
  private stderr = "";
  private output = "";
  private threadId = "";
  private turnId = "";
  private completionResolve?: (result: CodexRunResult) => void;
  private completionReject?: (error: Error) => void;
  private approvals = new Map<string | number, CodexApprovalRequest>();

  constructor(
    private readonly bin: string,
    private readonly cwd: string,
    private readonly callbacks: {
      onOutput?: (output: string) => void;
      onApproval?: (approval: CodexApprovalRequest) => void;
      onDiagnostic?: (message: string) => void;
      onStarted?: (ids: { threadId: string; turnId: string }) => void;
    } = {},
  ) {}

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.child = spawn(this.bin, ["app-server"], {
      cwd: this.cwd,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    this.peer = new JsonLineRpcPeer(
      (line) => this.child?.stdin.write(line),
      (message) => void this.handleMessage(message),
    );
    this.child.stdout.on("data", (chunk) => this.peer?.feed(chunk));
    this.child.stderr.on("data", (chunk) => {
      this.stderr = (this.stderr + chunk.toString()).slice(-20_000);
      this.callbacks.onDiagnostic?.(chunk.toString());
    });
    this.child.on("error", (error) => this.fail(error));
    this.child.on("exit", (code, signal) => {
      if (!this.disposed) {
        const detail = this.stderr.trim();
        this.fail(new Error(`Codex App Server exited (${signal || (code ?? "unknown")})${detail ? `: ${detail}` : ""}`));
      }
    });
    await this.peer.request("initialize", {
      clientInfo: { name: "auto-oc", title: "AutoOC", version: "1.5.11" },
      capabilities: {},
    }, 15_000);
    this.peer.notify("initialized");
    this.initialized = true;
  }

  async listModels(): Promise<CodexModelOption[]> {
    await this.initialize();
    const response = await this.peer!.request("model/list", { limit: 100, includeHidden: false });
    return (response?.data || []).map((model: any) => ({
      value: model.model || model.id,
      label: model.displayName || model.model || model.id,
      defaultReasoningEffort: model.defaultReasoningEffort,
      supportedReasoningEfforts: (model.supportedReasoningEfforts || []).map((entry: any) => entry.reasoningEffort || entry.value || entry),
      isDefault: !!model.isDefault,
    }));
  }

  async createThread(): Promise<string> {
    await this.initialize();
    const response = await this.peer!.request("thread/start", {
      cwd: this.cwd,
      approvalPolicy: "on-request",
      sandbox: "workspace-write",
      ephemeral: false,
      serviceName: "AutoOC",
    });
    const threadId = response?.thread?.id || "";
    if (!threadId) throw new Error("Codex did not return a thread id");
    return threadId;
  }

  async run(prompt: string, model?: string, effort?: string): Promise<CodexRunResult> {
    await this.initialize();
    this.output = "";
    const threadResponse = await this.peer!.request("thread/start", {
      cwd: this.cwd,
      model: model || null,
      approvalPolicy: "on-request",
      sandbox: "workspace-write",
      ephemeral: false,
      serviceName: "AutoOC",
    });
    this.threadId = threadResponse?.thread?.id || "";
    if (!this.threadId) throw new Error("Codex did not return a thread id");

    const completion = new Promise<CodexRunResult>((resolve, reject) => {
      this.completionResolve = resolve;
      this.completionReject = reject;
    });
    let turnResponse: any;
    try {
      turnResponse = await this.peer!.request("turn/start", {
        threadId: this.threadId,
        input: [{ type: "text", text: prompt }],
        model: model || null,
        effort: effort || null,
        approvalPolicy: "on-request",
        cwd: this.cwd,
      });
    } catch (error) {
      this.completionResolve = undefined;
      this.completionReject = undefined;
      throw error;
    }
    this.turnId = turnResponse?.turn?.id || "";
    if (!this.turnId) throw new Error("Codex did not return a turn id");
    this.callbacks.onStarted?.({ threadId: this.threadId, turnId: this.turnId });
    return completion;
  }

  getIds(): { threadId: string; turnId: string } {
    return { threadId: this.threadId, turnId: this.turnId };
  }

  resolveApproval(requestId: string | number, approved: boolean): boolean {
    const approval = this.approvals.get(requestId);
    if (!approval || !this.peer) return false;
    this.approvals.delete(requestId);
    if (approval.kind === "permissions") {
      this.peer.respond(requestId, {
        permissions: approved ? (approval.params.permissions || {}) : {},
        scope: "turn",
      });
    } else {
      this.peer.respond(requestId, { decision: approved ? "accept" : "decline" });
    }
    return true;
  }

  async interrupt(): Promise<void> {
    if (this.peer && this.threadId && this.turnId) {
      try {
        await this.peer.request("turn/interrupt", { threadId: this.threadId, turnId: this.turnId }, 5_000);
      } catch { /* process termination below is the fallback */ }
    }
    this.dispose();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.peer?.rejectAll(new Error("Codex client closed"));
    this.completionReject?.(new Error("Codex client closed"));
    this.completionReject = undefined;
    this.completionResolve = undefined;
    this.child?.kill();
    this.child = null;
  }

  private handleMessage(message: JsonRpcMessage): void {
    if (message.id !== undefined && message.method) {
      const approval = this.toApproval(message);
      if (approval) {
        this.approvals.set(message.id, approval);
        this.callbacks.onApproval?.(approval);
      } else {
        this.peer?.respond(message.id, {});
      }
      return;
    }
    if (message.method === "item/agentMessage/delta") {
      const delta = String(message.params?.delta || "");
      if (delta) {
        this.output += delta;
        this.callbacks.onOutput?.(this.output);
      }
      return;
    }
    if (message.method === "item/completed" && !this.output) {
      const item = message.params?.item;
      if (item?.type === "agentMessage" && typeof item.text === "string") {
        this.output = item.text;
        this.callbacks.onOutput?.(this.output);
      }
      return;
    }
    if (message.method === "turn/completed") {
      const turn = message.params?.turn || {};
      const status = String(turn.status || "completed");
      const error = turn.error?.message || turn.error?.additionalDetails || undefined;
      this.completionResolve?.({
        output: this.output.trim(),
        threadId: this.threadId,
        turnId: turn.id || this.turnId,
        status,
        error,
      });
      this.completionResolve = undefined;
      this.completionReject = undefined;
    }
  }

  private toApproval(message: JsonRpcMessage): CodexApprovalRequest | null {
    const method = message.method || "";
    const params = (message.params || {}) as Record<string, unknown>;
    let kind: CodexApprovalRequest["kind"];
    if (method === "item/commandExecution/requestApproval") kind = "command";
    else if (method === "item/fileChange/requestApproval") kind = "file-change";
    else if (method === "item/permissions/requestApproval") kind = "permissions";
    else return null;
    const summary = String(params.reason || params.command || (
      kind === "command" ? "Codex wants to run a command" :
      kind === "file-change" ? "Codex wants to change files" :
      "Codex requests additional permissions"
    ));
    return { requestId: message.id!, method, kind, summary, params };
  }

  private fail(error: Error): void {
    this.peer?.rejectAll(error);
    this.completionReject?.(error);
    this.completionReject = undefined;
    this.completionResolve = undefined;
  }
}
