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
  transcript?: string;
  threadId: string;
  turnId: string;
  status: string;
  error?: string;
}

function codexResultOutput(messages: Array<{text:string;phase?:string;completed:boolean}>, status:string) {
  const transcript=messages.map(item=>item.text).filter(Boolean).join("\n\n").trim();
  const finals=messages.filter(item=>item.completed && item.phase==="final_answer");
  const output=status==="completed" && finals.length ? finals.map(item=>item.text).join("\n\n").trim() : transcript;
  return {output,...(output!==transcript?{transcript}:{})};
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

export function buildCodexThreadUrl(threadId: string): string {
  return `codex://threads/${encodeURIComponent(threadId)}`;
}

export function openCodexThread(threadId:string):Promise<void> {
  if(!threadId?.trim())throw new Error("Exact Codex thread identity is required");
  return openCodexUrl(buildCodexThreadUrl(threadId));
}

function openCodexUrl(url: string): Promise<void> {
  const launcher = process.platform === "win32"
    ? {
        bin: "powershell.exe",
        args: [
          "-NoLogo",
          "-NoProfile",
          "-NonInteractive",
          "-EncodedCommand",
          Buffer.from("$ErrorActionPreference = 'Stop'\nStart-Process -FilePath $env:AUTOOC_CODEX_URL", "utf16le").toString("base64"),
        ],
        env: { ...process.env, AUTOOC_CODEX_URL: url },
      }
    : process.platform === "darwin"
      ? { bin: "open", args: [url], env: process.env }
      : { bin: "xdg-open", args: [url], env: process.env };

  return new Promise((resolve, reject) => {
    const child = spawn(launcher.bin, launcher.args, {
      detached: false,
      stdio: "ignore",
      windowsHide: true,
      env: launcher.env,
    });
    let settled = false;
    child.once("error", (error) => {
      settled = true;
      reject(error);
    });
    child.once("close", (code) => {
      if (settled) return;
      if (code === 0) resolve();
      else reject(new Error(`ChatGPT/Codex URL launcher exited with code ${code ?? "unknown"}`));
    });
  });
}

export function openCodexNewThread(cwd: string, onError?: (error: Error) => void): void {
  const client = new CodexAppServerClient(resolveCodexBin(), cwd);
  const threadName = path.basename(path.resolve(cwd)) || cwd;
  void client.createThread(threadName)
    .then((threadId) => openCodexUrl(buildCodexThreadUrl(threadId)))
    .catch((error) => onError?.(error instanceof Error ? error : new Error(String(error))))
    .finally(() => client.dispose());
}

export class CodexAppServerClient {
  private child: ChildProcessWithoutNullStreams | null = null;
  private peer: JsonLineRpcPeer | null = null;
  private initialized = false;
  private disposed = false;
  private stderr = "";
  private output = "";
  private agentMessages = new Map<string, { text: string; phase?: string; completed: boolean }>();
  private threadId = "";
  private turnId = "";
  private completionResolve?: (result: CodexRunResult) => void;
  private completionReject?: (error: Error) => void;
  private approvals = new Map<string | number, CodexApprovalRequest>();
  private reconcileTimer: ReturnType<typeof setInterval> | null = null;
  private reconciling = false;

  constructor(
    private readonly bin: string,
    private readonly cwd: string,
    private readonly callbacks: {
      onOutput?: (output: string) => void;
      onApproval?: (approval: CodexApprovalRequest) => void;
      onDiagnostic?: (message: string) => void;
      onThreadCreated?: (ids: { threadId: string }) => Promise<void>;
      onStarted?: (ids: { threadId: string; turnId: string }) => void | Promise<void>;
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

  async createThread(name?: string): Promise<string> {
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
    if (name) {
      await this.peer!.request("thread/inject_items", {
        threadId,
        items: [{
          type: "message",
          role: "assistant",
          content: [{ type: "output_text", text: "" }],
        }],
      });
      await this.peer!.request("thread/name/set", { threadId, name });
    }
    return threadId;
  }

  async run(
    prompt: string,
    model?: string,
    effort?: string,
    approvalPolicy: "on-request" | "never" = "on-request",
  ): Promise<CodexRunResult> {
    await this.initialize();
    this.output = "";
    this.agentMessages.clear();
    this.turnId = "";
    const threadResponse = await this.peer!.request("thread/start", {
      cwd: this.cwd,
      model: model || null,
      approvalPolicy,
      sandbox: "workspace-write",
      ephemeral: false,
      serviceName: "AutoOC",
    });
    this.threadId = threadResponse?.thread?.id || "";
    if (!this.threadId) throw new Error("Codex did not return a thread id");
    // Persist identity before starting any agent effects. Failure stops here.
    await this.callbacks.onThreadCreated?.({ threadId: this.threadId });

    const completion = new Promise<CodexRunResult>((resolve, reject) => {
      this.completionResolve = resolve;
      this.completionReject = reject;
    });
    // A host may still be persisting identity when transport completion fails.
    void completion.catch(() => {});
    let turnResponse: any;
    try {
      turnResponse = await this.peer!.request("turn/start", {
        threadId: this.threadId,
        input: [{ type: "text", text: prompt }],
        model: model || null,
        effort: effort || null,
        approvalPolicy,
        cwd: this.cwd,
      });
    } catch (error) {
      this.completionResolve = undefined;
      this.completionReject = undefined;
      throw error;
    }
    this.turnId = turnResponse?.turn?.id || "";
    if (!this.turnId) throw new Error("Codex did not return a turn id");
    await this.callbacks.onStarted?.({ threadId: this.threadId, turnId: this.turnId });
    if (this.completionResolve) {
      this.reconcileTimer = setInterval(() => { void this.reconcileTurn(); }, 30_000);
      this.reconcileTimer.unref?.();
    }
    return completion;
  }

  private stopReconciliation(): void {
    if (this.reconcileTimer) clearInterval(this.reconcileTimer);
    this.reconcileTimer = null;
  }

  private async reconcileTurn(): Promise<void> {
    if (this.disposed || this.reconciling || !this.completionResolve || !this.peer || !this.turnId) return;
    this.reconciling = true;
    const threadId = this.threadId, turnId = this.turnId;
    try {
      const turn = await this.readExistingTurn(threadId, turnId);
      if (this.disposed || !this.completionResolve || threadId !== this.threadId || turnId !== this.turnId) return;
      if (!turn || !["completed", "failed", "interrupted"].includes(turn.status)) return;
      for (const item of turn.items || []) {
        if (item.type === "agentMessage") this.handleMessage({ method: "item/completed", params: { threadId, item } });
      }
      this.handleMessage({ method: "turn/completed", params: { threadId, turn } });
    } catch {
      // A transient read failure is not evidence that the agent has stopped.
      this.callbacks.onDiagnostic?.("[AutoOC] Could not reconcile Codex turn; retaining current state.\n");
    } finally {
      this.reconciling = false;
    }
  }

  // Read only: reconnecting must never create a new thread or start a turn.
  // Absence/mismatch is uncertainty, not evidence that effects did not occur.
  async readExistingTurn(threadId: string, turnId: string): Promise<any> {
    if (!threadId?.trim() || !turnId?.trim()) throw new Error("Exact Codex thread and turn identities are required");
    await this.initialize();
    const result = await this.peer!.request("thread/read", {threadId,includeTurns:true}, 15_000);
    if (result?.thread?.id !== threadId) throw new Error("Codex thread identity mismatch");
    const matches = result.thread.turns?.filter((turn:any) => turn.id === turnId);
    if (!Array.isArray(matches) || matches.length !== 1) throw new Error("Exact Codex turn is unavailable");
    return matches[0];
  }

  async readExistingResult(threadId:string,turnId:string):Promise<CodexRunResult> {
    const turn=await this.readExistingTurn(threadId,turnId);
    const messages=new Map<string,{text:string;phase?:string;completed:boolean}>();
    for(const item of turn.items || []) if(item.type==="agentMessage" && typeof item.text==="string") {
      messages.set(String(item.id || "legacy"),{text:item.text,phase:item.phase,completed:true});
    }
    const status=String(turn.status || "unknown");
    return {...codexResultOutput([...messages.values()],status),threadId,turnId,status,error:turn.error?.message || turn.error?.additionalDetails};
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
    this.stopReconciliation();
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
        const id = String(message.params?.itemId || "legacy");
        const item = this.agentMessages.get(id) || { text: "", completed: false };
        if (!item.completed) {
          item.text += delta;
          this.agentMessages.set(id, item);
          this.publishAgentMessages();
        }
      }
      return;
    }
    if (message.method === "item/started" || message.method === "item/completed") {
      const item = message.params?.item;
      if (item?.type === "agentMessage" && typeof item.text === "string") {
        const id = String(item.id || "legacy");
        const previous = this.agentMessages.get(id);
        const completed = message.method === "item/completed";
        // item/completed is authoritative, including when a stream was retried
        // or some deltas were missing. Never append its full text to a draft.
        this.agentMessages.set(id, {
          text: completed ? item.text : (previous?.text ?? item.text),
          phase: item.phase ?? previous?.phase,
          completed: completed || !!previous?.completed,
        });
        this.publishAgentMessages();
      }
      return;
    }
    if (message.method === "turn/completed") {
      const turn = message.params?.turn || {};
      if (message.params?.threadId && message.params.threadId !== this.threadId) return;
      if (this.turnId && turn.id && turn.id !== this.turnId) return;
      this.stopReconciliation();
      const status = String(turn.status || "completed");
      const error = turn.error?.message || turn.error?.additionalDetails || undefined;
      this.completionResolve?.({
        ...codexResultOutput([...this.agentMessages.values()],status),
        threadId: this.threadId,
        turnId: turn.id || this.turnId,
        status,
        error,
      });
      this.completionResolve = undefined;
      this.completionReject = undefined;
    }
  }

  private publishAgentMessages(): void {
    this.output = [...this.agentMessages.values()].map(item => item.text).filter(Boolean).join("\n\n");
    this.callbacks.onOutput?.(this.output);
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
    this.stopReconciliation();
    this.peer?.rejectAll(error);
    this.completionReject?.(error);
    this.completionReject = undefined;
    this.completionResolve = undefined;
  }
}
