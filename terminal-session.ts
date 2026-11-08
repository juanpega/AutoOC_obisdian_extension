import { spawn } from "child_process";
import * as http from "http";
import * as path from "path";
import { randomBytes } from "crypto";
import type { Pty, IDisposable } from "./terminal-pty";
import type { TerminalSessionConfig } from "./terminal-session-host";

export interface IndependentTerminal extends Pty {
  readonly detached: boolean;
  detach(open: (url: string) => Promise<void>): Promise<void>;
  disconnect(): void;
}

/** A private, authenticated loopback client. The child owns the native PTY. */
export async function createTerminalSession(config: Omit<TerminalSessionConfig, "token">, signal?: AbortSignal): Promise<IndependentTerminal> {
  if (signal?.aborted) throw new Error("Terminal opening was cancelled.");
  const token = randomBytes(32).toString("hex");
  const env = { ...process.env };
  // A real Node executable is required; never run Obsidian.exe as a Node host.
  delete env.ELECTRON_RUN_AS_NODE;
  const child = spawn("node", [path.join(config.pluginDirectory, "autooc-runtime.cjs"), "--autooc-terminal-host"], {
    cwd: config.options.cwd, env, detached: true, windowsHide: true, stdio: ["ignore", "ignore", "ignore", "ipc"],
  });
  let detached = false;
  child.on("message", (message: any) => { if (message?.type === "retained") detached = true; });
  const cancel = () => { if (child.connected) child.send({ type: "cancel" }, () => {}); };
  const { port, pid } = await new Promise<{ port: number; pid: number }>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => finish(new Error("Terminal host did not confirm startup. Do not retry until its state is checked.")), 15000);
    const finish = (error?: Error, value?: { port: number; pid: number }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer); child.removeListener("message", onMessage); child.removeListener("exit", onExit);
      if (error) { if (child.connected) child.disconnect(); reject(error); } else resolve(value!);
    };
    const onMessage = (message: any) => {
      if (message?.type === "ready" && Number.isInteger(message.port) && message.port > 0 && message.port <= 65535 && Number.isInteger(message.pid) && message.pid > 0) finish(undefined, message);
      else if (message?.type === "failed") finish(new Error("Independent terminal host could not start. Check Node 18+ and installed terminal support."));
    };
    const onExit = () => finish(new Error("Independent terminal host exited before confirming startup."));
    child.on("message", onMessage); child.once("exit", onExit);
    child.once("error", error => finish(error));
    child.send({ ...config, token }, error => { if (error) finish(error); });
    signal?.addEventListener("abort", cancel, { once: true });
    if (signal?.aborted) cancel();
  }).finally(() => signal?.removeEventListener("abort", cancel));
  const call = (action: string, body: unknown = {}): Promise<any> => new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const request = http.request({ hostname: "127.0.0.1", port, path: `/${action}`, method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) } }, response => {
      let output = "";
      response.setEncoding("utf8");
      response.on("data", chunk => { output += chunk; if (output.length > 8 * 1024 * 1024) request.destroy(new Error("Terminal response too large")); });
      response.on("end", () => {
        try { if (response.statusCode !== 200) throw new Error("Terminal operation was not confirmed"); resolve(JSON.parse(output)); }
        catch (error) { reject(error); }
      });
      response.on("error", reject);
    });
    request.setTimeout(8000, () => request.destroy(new Error("Terminal host timeout; operation outcome is unconfirmed")));
    request.on("error", reject); request.end(data);
  });
  const dataListeners = new Set<(data: string) => void>();
  const exitListeners = new Set<(event: { exitCode: number }) => void>();
  let sequence = 0, exited = false, polling = false, disconnected = false;
  let transportWarning = false;
  let inputQueue = Promise.resolve();
  let detachPending: Promise<void> | undefined;
  const subscribe = <T>(set: Set<T>, listener: T): IDisposable => { set.add(listener); return { dispose: () => { set.delete(listener); } }; };
  const timer = setInterval(() => {
    if (polling || disconnected || exited) return;
    polling = true;
    void call("poll", { sequence }).then(state => {
      if (disconnected) return;
      if (transportWarning) for (const listener of dataListeners) listener("\r\n[Terminal host connection restored]\r\n");
      transportWarning = false;
      if (state.gap) for (const listener of dataListeners) listener("\r\n[Previous output truncated]\r\n");
      for (const entry of state.entries) {
        sequence = entry.sequence;
        for (const listener of dataListeners) listener(entry.data);
      }
      if (state.exited) {
        exited = true; clearInterval(timer);
        for (const listener of exitListeners) listener({ exitCode: state.exitCode });
      }
    }).catch(() => {
      // Transport loss is not evidence of process exit.
      if (!disconnected && !transportWarning) for (const listener of dataListeners) listener("\r\n[Terminal host connection lost. Process state is unknown; do not start a duplicate session.]\r\n");
      transportWarning = true;
    }).finally(() => { polling = false; });
  }, 100);
  const disconnect = () => {
    disconnected = true; clearInterval(timer); dataListeners.clear(); exitListeners.clear();
    if (child.connected) child.disconnect(); child.unref();
  };
  return {
    pid,
    get detached() { return detached; },
    write(data) {
      if (exited || detached) return;
      inputQueue = inputQueue.then(async () => {
        // Never replay input after a timeout: it may already have reached the PTY.
        // Bound requests without splitting surrogate pairs in pasted Unicode.
        for (const part of data.match(/[\s\S]{1,4096}/gu) || []) await call("input", { data: part });
      }).catch(() => {
        for (const listener of dataListeners) listener("\r\n[Input delivery unconfirmed. Input was not retried.]\r\n");
      });
    },
    resize(cols, rows) { if (!exited && !detached) void call("resize", { cols, rows }).catch(() => {}); },
    async kill() {
      if (!exited) await call("stop");
      // stop acknowledges native exit AND cleanup, not merely the request.
    },
    onData: listener => subscribe(dataListeners, listener),
    onExit: listener => subscribe(exitListeners, listener),
    detach(open) {
      if (detachPending) return detachPending;
      detachPending = (async () => {
        await open(`http://127.0.0.1:${port}/#${token}`);
        if (detached) return;
        // Opening a browser is not confirmation that the terminal connected.
        const deadline = Date.now() + 20000;
        while (Date.now() < deadline) {
          try { await call("detach"); detached = true; return; }
          catch { if (detached) return; }
          await new Promise(resolve => setTimeout(resolve, 250));
        }
        throw new Error("External terminal connection is unconfirmed. Keep Obsidian open and retry; no new agent was started.");
      })().finally(() => { detachPending = undefined; });
      return detachPending;
    },
    disconnect,
  };
}
