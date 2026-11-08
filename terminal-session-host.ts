import * as http from "http";
import { loadTerminalPty, type TerminalPtyOptions } from "./terminal-pty";
import { completeAuxiliaryDirectory } from "./execution-files";

declare const AUTOOC_TERMINAL_JS: string;
declare const AUTOOC_TERMINAL_FIT_JS: string;
declare const AUTOOC_TERMINAL_CSS: string;

function notifyParent(message: object): void {
  // The parent can disappear between connected and send. That is not a reason
  // to crash a released session with an unhandled IPC error.
  if (process.connected) process.send?.(message, () => {});
}

export interface TerminalSessionConfig {
  pluginDirectory: string;
  file: string;
  args: string[];
  options: TerminalPtyOptions;
  token: string;
  auxiliaryDirectory?: string;
}

// No remote resources, token in URL fragment (not HTTP history/logs on the server).
const page = `<!doctype html><html lang="es"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>AutoOC · Terminal independiente</title><link rel="stylesheet" href="/terminal.css">
<style>html,body{height:100%;margin:0;background:#181818;color:#eee;font:14px system-ui}
body{display:flex;flex-direction:column}header{padding:10px;display:flex;gap:16px;align-items:center}
#terminal{flex:1;min-height:0;padding:8px}button{font:inherit}#status{flex:1}</style>
<header><span id="status" role="status">Conectando…</span><button id="stop">Detener sesión</button></header>
<div id="terminal" aria-label="Terminal AutoOC"></div>
<script src="/terminal.js"></script><script src="/fit.js"></script><script src="/client.js"></script></html>`;

const browserClient = `"use strict";
const token = location.hash.slice(1);
const status = document.getElementById('status');
const terminal = new Terminal({cursorBlink:true,screenReaderMode:true,scrollback:5000});
const fit = new FitAddon.FitAddon(); terminal.loadAddon(fit); terminal.open(document.getElementById('terminal'));
let sequence=0, exited=false, busy=false;
let inputQueue=Promise.resolve();
async function command(action, body={}) {
  const response=await fetch('/'+action,{method:'POST',headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(8000)});
  if(!response.ok)throw Error(await response.text()); return response.json();
}
function resize(){fit.fit();void command('resize',{cols:terminal.cols,rows:terminal.rows}).catch(()=>{});}
new ResizeObserver(resize).observe(document.getElementById('terminal'));
terminal.onData(data=>{if(!exited)inputQueue=inputQueue.then(async()=>{
  for(const part of data.match(/[\\s\\S]{1,4096}/gu)||[])await command('input',{data:part});
}).catch(()=>status.textContent='Envío de entrada no confirmado; no se ha reintentado.');});
document.getElementById('stop').onclick=async()=>{
  if(!confirm('¿Detener la ejecución? Cerrar esta pestaña solo desconecta la vista.'))return;
  try{await command('stop');}catch(error){status.textContent=error.message;}
};
async function poll(){
  if(busy||exited)return;busy=true;
  try{
    const state=await command('poll',{sequence});
    if(state.gap)terminal.write('\\r\\n[Salida anterior truncada]\\r\\n');
    for(const entry of state.entries){terminal.write(entry.data);sequence=entry.sequence;}
    exited=state.exited;
    if(exited){terminal.write('\\r\\n[Proceso finalizado: '+state.exitCode+']\\r\\n');status.textContent='Sesión finalizada';}
    else{await command('external-ready');status.textContent=state.retained?'Independiente de Obsidian · cerrar esta pestaña no detiene la sesión':'Conectada · esperando confirmación de AutoOC';}
  }catch(error){status.textContent='Sin conexión: '+error.message;}finally{busy=false;}
}
resize();terminal.focus();void poll();setInterval(poll,100);
`;

export async function runTerminalSessionHost(config: TerminalSessionConfig): Promise<void> {
  if (!/^[a-f0-9]{64}$/.test(config.token)) throw new Error("Invalid terminal session token");
  let cancelled = false;
  process.on("message", (message: any) => { if (message?.type === "cancel") cancelled = true; });
  const backend = await loadTerminalPty(config.pluginDirectory);
  if (cancelled || !process.connected) {
    if (config.auxiliaryDirectory) completeAuxiliaryDirectory(config.auxiliaryDirectory, "interactive");
    throw new Error("Terminal startup cancelled before spawn");
  }
  // Keep ownership in this process; never create another PTY on reconnect.
  const pty = backend.spawn(config.file, config.args, config.options);
  let retained = false, exited = false, exitCode: number | undefined, sequence = 0, bytes = 0;
  let externalReady = 0;
  const entries: { sequence: number; data: string }[] = [];
  const remember = (data: string) => {
    // Bounded replay; sequence numbers make loss explicit to clients.
    for (let offset = 0; offset < data.length; offset += 16384) {
      const part = data.slice(offset, offset + 16384);
      entries.push({ sequence: ++sequence, data: part }); bytes += part.length;
    }
    while (bytes > 1024 * 1024 && entries.length > 1) bytes -= entries.shift()!.data.length;
  };
  pty.onData(remember);
  pty.onExit(event => {
    exited = true; exitCode = event.exitCode;
    if (config.auxiliaryDirectory) completeAuxiliaryDirectory(config.auxiliaryDirectory, "interactive");
    // Give clients time to read final output before disposing this host.
    setTimeout(() => process.exit(0), 30000);
  });
  process.on("disconnect", () => {
    if (!retained) void pty.kill().catch(() => {
      // Keep evidence/process alive on uncertain cleanup, never kill by PID.
      console.error("AutoOC terminal cleanup is unconfirmed");
    });
  });
  const server = http.createServer(async (request, response) => {
    const address = server.address();
    const authority = typeof address === "object" && address ? `127.0.0.1:${address.port}` : "";
    const reply = (code: number, body: unknown) => {
      response.writeHead(code, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      response.end(JSON.stringify(body));
    };
    if (request.headers.host !== authority || (request.headers.origin && request.headers.origin !== `http://${authority}`)) {
      reply(403, "Forbidden origin"); return;
    }
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Referrer-Policy", "no-referrer");
    response.setHeader("Content-Security-Policy", "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
    const assets: Record<string, [string, string]> = {
      "/": ["text/html; charset=utf-8", page],
      "/client.js": ["text/javascript", browserClient],
      "/terminal.js": ["text/javascript", AUTOOC_TERMINAL_JS],
      "/fit.js": ["text/javascript", AUTOOC_TERMINAL_FIT_JS],
      "/terminal.css": ["text/css", AUTOOC_TERMINAL_CSS],
    };
    if (request.method === "GET" && Object.prototype.hasOwnProperty.call(assets, request.url || "")) {
      const [type, body] = assets[request.url!];
      response.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store" }); response.end(body); return;
    }
    if (request.method !== "POST" || request.headers.authorization !== `Bearer ${config.token}`) {
      reply(403, "Forbidden"); return;
    }
    try {
      let body = "";
      request.setEncoding("utf8");
      for await (const chunk of request) {
        body += chunk.toString();
        if (Buffer.byteLength(body) > 65536) { reply(413, "Request too large"); return; }
      }
      const value = JSON.parse(body);
      switch (request.url) {
        case "/poll": {
          if (!Number.isSafeInteger(value.sequence) || value.sequence < 0) throw new Error("Invalid sequence");
          reply(200, { entries: entries.filter(entry => entry.sequence > value.sequence), exited, exitCode, retained,
            gap: entries.length > 0 && value.sequence < entries[0].sequence - 1 }); return;
        }
        case "/input":
          if (typeof value.data !== "string" || value.data.length > 32768) throw new Error("Invalid input");
          if (!exited) pty.write(value.data); break;
        case "/resize":
          if (![value.cols, value.rows].every(n => Number.isInteger(n) && n > 0 && n <= 32767)) throw new Error("Invalid size");
          if (!exited) pty.resize(value.cols, value.rows); break;
        case "/external-ready": externalReady = Date.now(); break;
        case "/detach":
          if (exited || Date.now() - externalReady > 5000) { reply(409, "External terminal is not connected"); return; }
          retained = true;
          notifyParent({ type: "retained" });
          break;
        case "/stop": await pty.kill(); break;
        default: reply(404, "Not found"); return;
      }
      reply(200, { retained });
    } catch { reply(400, "Terminal operation failed; do not assume the process stopped"); }
  });
  server.requestTimeout = 10000;
  server.headersTimeout = 10000;
  server.maxConnections = 32;
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address() as import("net").AddressInfo;
  notifyParent({ type: "ready", port: address.port, pid: pty.pid });
}

export function startTerminalSessionHost(): void {
  process.once("message", (config: TerminalSessionConfig) => {
    void runTerminalSessionHost(config).catch(() => {
      notifyParent({ type: "failed" });
      // A native spawn may have happened: do not claim confirmed cleanup.
      process.exitCode = 1;
      if (process.connected) process.disconnect();
    });
  });
}
