var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// main.ts
var main_exports = {};
__export(main_exports, {
  VIEW_TYPE: () => VIEW_TYPE,
  default: () => AutoOCPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");
var import_child_process = require("child_process");
var os = __toESM(require("os"));
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));
function resolveOpencodeBin(configured) {
  if (configured && configured !== "opencode") return configured;
  if (os.platform() === "win32") {
    const candidate = `${process.env.APPDATA}\\npm\\opencode.cmd`;
    try {
      const { existsSync: existsSync2 } = require("fs");
      if (existsSync2(candidate)) return candidate;
    } catch (e) {
    }
  }
  return configured || "opencode";
}
function psSingleQuoted(value) {
  return `'${value.replace(/'/g, "''")}'`;
}
function commandPreviewArg(value) {
  return /^[A-Za-z0-9_@%+=:,./\\-]+$/.test(value) ? value : `"${value.replace(/"/g, '\\"')}"`;
}
function openOpencodeCli(bin, cwd) {
  if (process.platform === "win32") {
    const command2 = `Set-Location -LiteralPath ${psSingleQuoted(cwd)}; & ${psSingleQuoted(bin)}`;
    const launcher2 = (0, import_child_process.spawn)(
      "cmd.exe",
      ["/c", "start", "OpenCode CLI", "/D", cwd, "powershell.exe", "-NoLogo", "-NoExit", "-Command", command2],
      { detached: true, stdio: "ignore", windowsHide: false }
    );
    launcher2.unref();
    return;
  }
  if (process.platform === "darwin") {
    const escapedCwd = cwd.replace(/(["\\$`])/g, "\\$1");
    const escapedBin = bin.replace(/(["\\$`])/g, "\\$1");
    const script = `tell application "Terminal" to do script "cd ${escapedCwd} && ${escapedBin}"`;
    const launcher2 = (0, import_child_process.spawn)("osascript", ["-e", script], { detached: true, stdio: "ignore" });
    launcher2.unref();
    return;
  }
  const command = `cd ${JSON.stringify(cwd)} && ${JSON.stringify(bin)}`;
  const launcher = (0, import_child_process.spawn)("x-terminal-emulator", ["-e", "sh", "-lc", command], { detached: true, stdio: "ignore" });
  launcher.unref();
}
function launchHiddenPS(psScriptFile) {
  const fs2 = require("fs");
  const path2 = require("path");
  const vbsFile = psScriptFile.replace(/\.ps1$/, ".vbs");
  const vbs = `Set sh = CreateObject("WScript.Shell")\r
sh.Run "powershell.exe -NoLogo -NonInteractive -WindowStyle Hidden -File """ & "${psScriptFile.replace(/"/g, '""')}" & """", 0, False\r
`;
  fs2.writeFileSync(vbsFile, vbs, "utf8");
  const { spawn: spawn2 } = require("child_process");
  const ws = spawn2("wscript.exe", [vbsFile], { detached: true, stdio: "ignore", windowsHide: true });
  ws.unref();
  setTimeout(() => {
    try {
      fs2.unlinkSync(vbsFile);
    } catch (e) {
    }
  }, 1e4);
}
function writeUtf8BomFile(filePath, content) {
  fs.writeFileSync(filePath, Buffer.concat([Buffer.from([239, 187, 191]), Buffer.from(content, "utf8")]));
}
function psUtf8Prelude() {
  return [
    `$utf8NoBom = New-Object System.Text.UTF8Encoding($false)`,
    `[Console]::OutputEncoding = $utf8NoBom`,
    `$OutputEncoding = $utf8NoBom`
  ];
}
var FALLBACK_MODELS = [];
var FALLBACK_AGENTS = [
  { value: "build", label: "build" },
  { value: "plan", label: "plan" }
];
function stripAnsi(text) {
  return text.replace(/\x1b\[[0-9;]*m/g, "");
}
function isValidAgentName(name) {
  return /^[A-Za-z0-9_-]+$/.test(name);
}
function listGitBranches(cwd) {
  const { execFileSync } = require("child_process");
  const out = execFileSync("git", ["branch", "--format=%(refname:short)"], {
    cwd,
    timeout: 8e3,
    encoding: "utf8",
    windowsHide: true
  });
  return out.split("\n").map((b) => b.trim()).filter(Boolean);
}
function fetchModelsSync(opencodePath) {
  const { execSync } = require("child_process");
  const bin = resolveOpencodeBin(opencodePath);
  try {
    const out = execSync(`"${bin}" models`, { timeout: 8e3, encoding: "utf8" });
    return out.split("\n").map((l) => l.trim()).filter((l) => l.length > 0 && l.includes("/")).map((l) => ({ value: l, label: l }));
  } catch (e) {
    return [];
  }
}
function fetchAgentsSync(opencodePath, cwd) {
  const { execSync } = require("child_process");
  const bin = resolveOpencodeBin(opencodePath);
  try {
    const out = execSync(`"${bin}" agent list`, {
      timeout: 8e3,
      encoding: "utf8",
      cwd: cwd || void 0,
      windowsHide: true
    });
    const agents = stripAnsi(out).split("\n").map((l) => l.trim()).filter((l) => /^\S+\s+\(primary\)/.test(l)).map((l) => {
      var _a, _b;
      const name = (_b = (_a = l.match(/^(\S+)\s+\(/)) == null ? void 0 : _a[1]) != null ? _b : l.split(" ")[0];
      return { value: name, label: name };
    }).filter((a) => isValidAgentName(a.value));
    return agents.length > 0 ? agents : FALLBACK_AGENTS;
  } catch (e) {
    return FALLBACK_AGENTS;
  }
}
var DEFAULT_SETTINGS = {
  tasks: [],
  workflows: [],
  opencodePath: "opencode",
  defaultModel: "",
  defaultAgent: "build",
  workingDirectory: "",
  // {opencode} = binary path, {model} = provider/model, {prompt} = escaped prompt
  cmdTemplate: '{opencode} run --model {model} -- "{prompt}"',
  taskTimeoutSeconds: 7200,
  // 2 h por defecto
  logsEnabled: true,
  maxLogsPerTask: 50,
  logRetentionDays: 30
};
var VIEW_TYPE = "auto-oc-view";
var DAY_NAMES = ["Dom", "Lun", "Mar", "Mi\xE9", "Jue", "Vie", "S\xE1b"];
var INITIAL_DUE_CHECK_DELAY_MS = 3e4;
var DUE_LAUNCH_GAP_MS = 1e4;
var DEFAULT_TASK_TIMEOUT_SECONDS = 7200;
function isDayScheduleDue(now, scheduleTime, lastRun) {
  const [hh, mm] = scheduleTime.split(":").map(Number);
  const todayTarget = new Date(now);
  todayTarget.setHours(hh, mm, 0, 0);
  if (now < todayTarget) return false;
  if (!lastRun) return true;
  return new Date(lastRun).toDateString() !== now.toDateString();
}
function parseMonthDays(input) {
  const trimmed = input.trim();
  if (!trimmed) return [];
  const parts = trimmed.split(/[;,\s]+/).filter(Boolean);
  const days = parts.map((part) => Number(part));
  if (days.some((day) => !Number.isInteger(day) || day < 1 || day > 31)) return null;
  return [...new Set(days)].sort((a, b) => a - b);
}
function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
function preventBackdropClose(modal) {
  const contentEl = modal.contentEl;
  const modalContainer = contentEl.parentElement;
  if (modalContainer) {
    const modalBg = modalContainer.querySelector(".modal-bg");
    if (modalBg) {
      modalBg.addEventListener("click", (e) => {
        e.stopImmediatePropagation();
        e.preventDefault();
      }, true);
    }
  }
}
function setupModalX(modal) {
  preventBackdropClose(modal);
}
function setAutoOCModalSize(modal, widthPx) {
  const modalEl = modal.modalEl;
  if (modalEl) {
    modalEl.style.width = `min(${widthPx}px, calc(100vw - 72px))`;
    modalEl.style.maxWidth = "calc(100vw - 72px)";
    modalEl.style.maxHeight = "calc(100vh - 72px)";
    modalEl.style.overflow = "hidden";
  }
  modal.contentEl.style.width = "100%";
  modal.contentEl.style.maxWidth = "100%";
  modal.contentEl.style.overflowX = "hidden";
  modal.contentEl.style.overflowY = "auto";
}
var GITHUB_REPO = "juanpega/AutoOC_obisdian_extension";
var GITHUB_BRANCH = "main";
var REMOTE_MANIFEST_URL = `https://raw.githubusercontent.com/${GITHUB_REPO}/${GITHUB_BRANCH}/manifest.json`;
var REMOTE_FILE_URLS = {
  mainJs: `https://raw.githubusercontent.com/${GITHUB_REPO}/${GITHUB_BRANCH}/main.js`,
  manifest: `https://raw.githubusercontent.com/${GITHUB_REPO}/${GITHUB_BRANCH}/manifest.json`,
  styles: `https://raw.githubusercontent.com/${GITHUB_REPO}/${GITHUB_BRANCH}/styles.css`
};
function noCacheUrl(url) {
  return `${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}`;
}
function compareVersions(a, b) {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
function formatDateTime(iso) {
  if (!iso) return "\u2014";
  const d = new Date(iso);
  return d.toLocaleDateString("es-ES") + " " + d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}
function padTwo(n) {
  return String(n).padStart(2, "0");
}
function todayString() {
  const now = /* @__PURE__ */ new Date();
  return `${now.getFullYear()}-${padTwo(now.getMonth() + 1)}-${padTwo(now.getDate())}`;
}
function nowTimeString() {
  const now = /* @__PURE__ */ new Date();
  return `${padTwo(now.getHours())}:${padTwo(now.getMinutes())}`;
}
function normalizeCommandOutput(text) {
  if (!text) return "";
  let cleaned = text.replace(/\x1B\[[0-9;]*[A-Za-z]/g, "");
  if (/[ÃÂâ€œâ€|â€|â€|â„¢|â€“|â€”]/.test(cleaned)) {
    try {
      cleaned = Buffer.from(cleaned, "latin1").toString("utf8");
    } catch (e) {
    }
  }
  return cleaned.trim();
}
function extractTouchedFiles(trace) {
  const files = /* @__PURE__ */ new Set();
  for (const line of trace.split(/\r?\n/)) {
    const match = line.match(/^[←→]\s+(?:Edit|Write|Read)\s+(.+)$/) || line.match(/^Index:\s+(.+)$/);
    if (match == null ? void 0 : match[1]) files.add(match[1].trim());
  }
  return [...files];
}
function formatTaskOutput(stdout, stderr) {
  const cleanStdout = normalizeCommandOutput(stdout);
  const cleanStderr = normalizeCommandOutput(stderr);
  const parts = [];
  if (cleanStdout) {
    parts.push(`## Respuesta

${cleanStdout}`);
  }
  const touchedFiles = extractTouchedFiles(cleanStderr);
  if (touchedFiles.length > 0) {
    parts.push(`## Archivos tocados

${touchedFiles.map((f) => `- ${f}`).join("\n")}`);
  }
  if (cleanStderr) {
    parts.push(`## OpenCode trace

\`\`\`text
${cleanStderr}
\`\`\``);
  }
  return parts.join("\n\n---\n\n").trim();
}
function extractSection(output, title) {
  const match = output.match(new RegExp(`^## ${title}\\s*\\n\\s*([\\s\\S]*?)(?:\\n\\n---\\n\\n## |$)`, "m"));
  return match ? match[1].trim() : "";
}
function cleanWorkflowContext(output) {
  if (!output) return "";
  return output.replace(/\[código de salida:.*?\]/g, "").replace(/\[iniciando proceso desacoplado…\]/g, "").replace(/\[Workflow evaluation[^\]]*?\].*?(?=\n|$)/g, "").replace(/\[Workflow (failed|stopped)[^\]]*?\]/g, "").replace(/\.{3,}/g, "").replace(/\n{3,}/g, "\n\n").trim();
}
function extractContextForHandoff(output) {
  const cleaned = cleanWorkflowContext(output);
  if (!cleaned) return "";
  const response = extractSection(cleaned, "Respuesta");
  const touchedFiles = extractSection(cleaned, "Archivos tocados");
  const trace = extractSection(cleaned, "OpenCode trace").replace(/^```text\s*/, "").replace(/```$/, "").trim();
  const parts = [];
  if (response) parts.push(`Response: ${response}`);
  if (touchedFiles) parts.push(`Touched files: ${touchedFiles}`);
  if (trace) parts.push(`OpenCode trace: ${trace}`);
  return (parts.length > 0 ? parts.join("\n\n") : cleaned).slice(0, 6e3).trim();
}
function formatLogContent(text) {
  if (!text) return "";
  return normalizeCommandOutput(text).replace(/\r\n/g, "\n");
}
function countReplacementChars(text) {
  return (text.match(/�/g) || []).length;
}
function decodeCp850(bytes) {
  var _a;
  const map = {
    128: "\xC7",
    129: "\xFC",
    130: "\xE9",
    131: "\xE2",
    132: "\xE4",
    133: "\xE0",
    134: "\xE5",
    135: "\xE7",
    136: "\xEA",
    137: "\xEB",
    138: "\xE8",
    139: "\xEF",
    140: "\xEE",
    141: "\xEC",
    142: "\xC4",
    143: "\xC5",
    144: "\xC9",
    145: "\xE6",
    146: "\xC6",
    147: "\xF4",
    148: "\xF6",
    149: "\xF2",
    150: "\xFB",
    151: "\xF9",
    152: "\xFF",
    153: "\xD6",
    154: "\xDC",
    155: "\xF8",
    156: "\xA3",
    157: "\xD8",
    158: "\xD7",
    159: "\u0192",
    160: "\xE1",
    161: "\xED",
    162: "\xF3",
    163: "\xFA",
    164: "\xF1",
    165: "\xD1",
    166: "\xAA",
    167: "\xBA",
    168: "\xBF",
    169: "\xAE",
    170: "\xAC",
    171: "\xBD",
    172: "\xBC",
    173: "\xA1",
    174: "\xAB",
    175: "\xBB"
  };
  let out = "";
  for (const byte of bytes) {
    if (byte < 128) out += String.fromCharCode(byte);
    else out += (_a = map[byte]) != null ? _a : String.fromCharCode(byte);
  }
  return out;
}
function decodeWindows1252(bytes) {
  var _a;
  const map = {
    128: "\u20AC",
    130: "\u201A",
    131: "\u0192",
    132: "\u201E",
    133: "\u2026",
    134: "\u2020",
    135: "\u2021",
    136: "\u02C6",
    137: "\u2030",
    138: "\u0160",
    139: "\u2039",
    140: "\u0152",
    142: "\u017D",
    145: "\u2018",
    146: "\u2019",
    147: "\u201C",
    148: "\u201D",
    149: "\u2022",
    150: "\u2013",
    151: "\u2014",
    152: "\u02DC",
    153: "\u2122",
    154: "\u0161",
    155: "\u203A",
    156: "\u0153",
    158: "\u017E",
    159: "\u0178"
  };
  let out = "";
  for (const byte of bytes) {
    if (byte < 128 || byte >= 160) out += String.fromCharCode(byte);
    else out += (_a = map[byte]) != null ? _a : "";
  }
  return out;
}
function decodeCommandBuffer(bytes) {
  if (bytes.length >= 2) {
    if (bytes[0] === 255 && bytes[1] === 254) return bytes.toString("utf16le");
    if (bytes[0] === 254 && bytes[1] === 255) return Buffer.from(bytes).swap16().toString("utf16le");
  }
  if (bytes.length > 4) {
    let oddNulls = 0;
    let evenNulls = 0;
    for (let i = 0; i < bytes.length; i++) {
      if (bytes[i] === 0) {
        if (i % 2 === 0) evenNulls++;
        else oddNulls++;
      }
    }
    const nullRatio = (oddNulls + evenNulls) / bytes.length;
    if (nullRatio > 0.2 && oddNulls > evenNulls * 4) return bytes.toString("utf16le");
    if (nullRatio > 0.2 && evenNulls > oddNulls * 4) return Buffer.from(bytes).swap16().toString("utf16le");
  }
  const utf8 = bytes.toString("utf8");
  if (countReplacementChars(utf8) === 0) return utf8;
  const win1252 = decodeWindows1252(bytes);
  const cp850 = decodeCp850(bytes);
  return countReplacementChars(win1252) <= countReplacementChars(cp850) ? win1252 : cp850;
}
function getOpencodeConfigPath() {
  return path.join(os.homedir(), ".config", "opencode", "opencode.json");
}
function getRalphStateFilePath(vaultBasePath) {
  return path.join(vaultBasePath, ".opencode", "ralph-loop.local.md");
}
function getTaskLogDir(vaultBasePath, taskId) {
  return path.join(vaultBasePath, ".opencode", "logs", taskId);
}
function formatTimestampForLog() {
  const now = /* @__PURE__ */ new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
}
function formatLogFilenameTimestamp(fileName) {
  const match = fileName.match(/^(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})\.log$/);
  if (!match) return fileName.replace(/\.log$/, "");
  const [, year, month, day, hour, minute, second] = match;
  return `${day}/${month}/${year} ${hour}:${minute}:${second}`;
}
function saveLogToFile(vaultBasePath, taskId, output) {
  if (!output || !output.trim()) return null;
  const logDir = getTaskLogDir(vaultBasePath, taskId);
  try {
    fs.mkdirSync(logDir, { recursive: true });
  } catch (e) {
  }
  const timestamp = formatTimestampForLog();
  const logFile = path.join(logDir, `${timestamp}.log`);
  try {
    fs.writeFileSync(logFile, output, "utf8");
    const latestFile = path.join(logDir, "latest.log");
    fs.writeFileSync(latestFile, output, "utf8");
    return logFile;
  } catch (e) {
    return null;
  }
}
function getLogHistory(vaultBasePath, taskId) {
  const logDir = getTaskLogDir(vaultBasePath, taskId);
  try {
    if (!fs.existsSync(logDir)) return [];
    const files = fs.readdirSync(logDir).filter((f) => f.endsWith(".log") && f !== "latest.log").sort().reverse();
    return files.map((f) => ({
      file: path.join(logDir, f),
      timestamp: formatLogFilenameTimestamp(f)
    }));
  } catch (e) {
    return [];
  }
}
function readLogFile(filePath) {
  try {
    return formatLogContent(fs.readFileSync(filePath, "utf8"));
  } catch (e) {
    return "(error reading log file)";
  }
}
function cleanupOldLogs(vaultBasePath, taskId, maxLogs) {
  if (maxLogs <= 0) return;
  const logDir = getTaskLogDir(vaultBasePath, taskId);
  try {
    if (!fs.existsSync(logDir)) return;
    const files = fs.readdirSync(logDir).filter((f) => f.endsWith(".log") && f !== "latest.log").sort();
    while (files.length > maxLogs) {
      const oldFile = files.shift();
      if (oldFile) {
        try {
          fs.unlinkSync(path.join(logDir, oldFile));
        } catch (e) {
        }
      }
    }
  } catch (e) {
  }
}
function cleanupLogsByAge(vaultBasePath, taskId, retentionDays) {
  if (retentionDays <= 0) return;
  const logDir = getTaskLogDir(vaultBasePath, taskId);
  try {
    if (!fs.existsSync(logDir)) return;
    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1e3;
    const files = fs.readdirSync(logDir).filter((f) => f.endsWith(".log") && f !== "latest.log");
    for (const f of files) {
      const match = f.match(/^(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})\.log$/);
      if (match) {
        const [, y, m, d, h, min, s] = match;
        const fileDate = /* @__PURE__ */ new Date(`${y}-${m}-${d}T${h}:${min}:${s}`);
        if (fileDate.getTime() < cutoff) {
          try {
            fs.unlinkSync(path.join(logDir, f));
          } catch (e) {
          }
        }
      }
    }
  } catch (e) {
  }
}
function clearTaskLogs(vaultBasePath, taskId) {
  const logDir = getTaskLogDir(vaultBasePath, taskId);
  try {
    if (!fs.existsSync(logDir)) return;
    const files = fs.readdirSync(logDir);
    for (const f of files) {
      try {
        fs.unlinkSync(path.join(logDir, f));
      } catch (e) {
      }
    }
    try {
      fs.rmdirSync(logDir);
    } catch (e) {
    }
  } catch (e) {
  }
}
function clearAllLogs(vaultBasePath) {
  const logsDir = path.join(vaultBasePath, ".opencode", "logs");
  try {
    if (!fs.existsSync(logsDir)) return;
    const dirs = fs.readdirSync(logsDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
    for (const dir of dirs) {
      clearTaskLogs(vaultBasePath, dir);
    }
    try {
      fs.rmdirSync(logsDir);
    } catch (e) {
    }
  } catch (e) {
  }
}
function deleteSingleLogFile(filePath) {
  try {
    fs.unlinkSync(filePath);
  } catch (e) {
  }
}
function isTaskDue(task) {
  if (task.status === "running") return false;
  if (task.scheduleType === "manual") return false;
  const now = /* @__PURE__ */ new Date();
  if (task.scheduleType === "once") {
    if (task.status !== "pending") return false;
    const target = /* @__PURE__ */ new Date(`${task.scheduleDate}T${task.scheduleTime}:00`);
    return now >= target;
  }
  if (task.scheduleType === "daily") {
    return isDayScheduleDue(now, task.scheduleTime, task.lastRun);
  }
  if (task.scheduleType === "weekly") {
    if (!task.scheduleDays.includes(now.getDay())) return false;
    return isDayScheduleDue(now, task.scheduleTime, task.lastRun);
  }
  if (task.scheduleType === "monthly") {
    const monthDays = task.scheduleMonthDays || [];
    if (!monthDays.includes(now.getDate())) return false;
    return isDayScheduleDue(now, task.scheduleTime, task.lastRun);
  }
  return false;
}
function isWorkflowDue(wf) {
  if (wf.status === "running") return false;
  if (wf.steps.length === 0) return false;
  if (wf.scheduleType === "manual") return false;
  const now = /* @__PURE__ */ new Date();
  if (wf.scheduleType === "once") {
    if (wf.status !== "pending") return false;
    const target = /* @__PURE__ */ new Date(`${wf.scheduleDate || ""}T${wf.scheduleTime || "00:00"}:00`);
    return now >= target;
  }
  if (wf.scheduleType === "daily") {
    return isDayScheduleDue(now, wf.scheduleTime || "00:00", wf.lastRun);
  }
  if (wf.scheduleType === "weekly") {
    const days = wf.scheduleDays || [];
    if (!days.includes(now.getDay())) return false;
    return isDayScheduleDue(now, wf.scheduleTime || "00:00", wf.lastRun);
  }
  if (wf.scheduleType === "monthly") {
    const monthDays = wf.scheduleMonthDays || [];
    if (!monthDays.includes(now.getDate())) return false;
    return isDayScheduleDue(now, wf.scheduleTime || "00:00", wf.lastRun);
  }
  return false;
}
var AutoOCPlugin = class extends import_obsidian.Plugin {
  constructor() {
    super(...arguments);
    this.availableModels = FALLBACK_MODELS;
    this.availableAgents = FALLBACK_AGENTS;
    // Map taskId -> child process, so we can kill running tasks
    this.runningProcesses = /* @__PURE__ */ new Map();
    this.dueCheckInProgress = false;
    // Update-check state
    this.latestVersion = null;
    this.updateAvailable = false;
    this.updateCheckError = null;
    this.updateInProgress = false;
  }
  async onload() {
    await this.loadSettings();
    setTimeout(() => {
      this.refreshModels();
      this.refreshAgents();
    }, 2e3);
    this.registerView(VIEW_TYPE, (leaf) => {
      this.view = new AutoOCView(leaf, this);
      return this.view;
    });
    this.addRibbonIcon("workflow", "AutoOC \u2014 Task Scheduler", () => {
      this.toggleView();
    });
    this.addCommand({
      id: "open-auto-oc",
      name: "Open AutoOC Task Scheduler",
      callback: () => this.activateView()
    });
    this.addCommand({
      id: "create-task",
      name: "Create new OpenCode task",
      callback: () => new CreateTaskModal(this.app, this).open()
    });
    this.addCommand({
      id: "check-tasks-now",
      name: "Check due tasks now",
      callback: async () => {
        await this.runDueAll();
        new import_obsidian.Notice("AutoOC: check completed.");
      }
    });
    this.addCommand({
      id: "diagnose",
      name: "AutoOC: Diagnostic \u2014 test opencode command",
      callback: () => new DiagnosticModal(this.app, this).open()
    });
    this.addCommand({
      id: "install-ralph-loop",
      name: "AutoOC: Ralph Loop Assistant (install/activate)",
      callback: async () => {
        const result = await this.ensureRalphLoopPluginEnabled();
        new import_obsidian.Notice(
          result.changed ? `AutoOC: Ralph Loop enabled at ${result.configPath}. Restart OpenCode.` : `AutoOC: Ralph Loop was already active at ${result.configPath}.`
        );
      }
    });
    this.addSettingTab(new AutoOCSettingTab(this.app, this));
    this.registerInterval(
      window.setInterval(() => this.runDueAll(), 6e4)
    );
    this.app.workspace.onLayoutReady(() => {
      const startupTimer = window.setTimeout(() => this.runDueAll(), INITIAL_DUE_CHECK_DELAY_MS);
      this.register(() => window.clearTimeout(startupTimer));
    });
    setTimeout(() => this.checkForUpdates(true), 3e3);
  }
  async onunload() {
    for (const [, proc] of this.runningProcesses) {
      proc.kill();
    }
    this.runningProcesses.clear();
    this.app.workspace.detachLeavesOfType(VIEW_TYPE);
  }
  refreshModels() {
    var _a;
    const models = fetchModelsSync(this.settings.opencodePath || "opencode");
    if (models.length > 0) {
      this.availableModels = models;
      if (!this.settings.defaultModel || !models.find((m) => m.value === this.settings.defaultModel)) {
        this.settings.defaultModel = models[0].value;
        void this.saveSettings();
      }
      (_a = this.view) == null ? void 0 : _a.refresh();
    }
  }
  getAgentsForDirectory(cwd) {
    return fetchAgentsSync(this.settings.opencodePath || "opencode", cwd);
  }
  refreshAgents(cwd) {
    var _a;
    const agents = this.getAgentsForDirectory(cwd);
    if (agents.length > 0) {
      this.availableAgents = agents;
      if (!this.settings.defaultAgent || !agents.find((a) => a.value === this.settings.defaultAgent)) {
        this.settings.defaultAgent = agents[0].value;
        void this.saveSettings();
      }
      (_a = this.view) == null ? void 0 : _a.refresh();
    }
  }
  getEffectiveAgent(agent) {
    var _a;
    const requested = agent || this.settings.defaultAgent;
    if (requested && this.availableAgents.find((a) => a.value === requested)) return requested;
    if (this.settings.defaultAgent && this.availableAgents.find((a) => a.value === this.settings.defaultAgent)) return this.settings.defaultAgent;
    return ((_a = this.availableAgents[0]) == null ? void 0 : _a.value) || "build";
  }
  getEffectiveDefaultModel() {
    var _a, _b;
    if (this.settings.defaultModel) return this.settings.defaultModel;
    return (_b = (_a = this.availableModels[0]) == null ? void 0 : _a.value) != null ? _b : "";
  }
  async activateView() {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE);
    if (existing.length > 0) {
      this.app.workspace.revealLeaf(existing[0]);
      return;
    }
    const leaf = this.app.workspace.getRightLeaf(false);
    if (leaf) {
      await leaf.setViewState({ type: VIEW_TYPE, active: true });
      this.app.workspace.revealLeaf(leaf);
    }
  }
  toggleView() {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE);
    if (existing.length > 0) {
      this.app.workspace.detachLeavesOfType(VIEW_TYPE);
      return;
    }
    this.activateView();
  }
  async loadSettings() {
    var _a, _b;
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    delete this.settings.chatHistory;
    delete this.settings.chatModel;
    let changed = false;
    for (const task of this.settings.tasks) {
      if (task.status === "running") {
        task.status = "failed";
        task.output = `${task.output || ""}
[stale running state cleared on plugin load]`;
        changed = true;
      }
      if (!Array.isArray(task.scheduleMonthDays)) {
        task.scheduleMonthDays = [];
        changed = true;
      }
    }
    if (!this.settings.workflows) this.settings.workflows = [];
    for (const wf of this.settings.workflows) {
      if (wf.status === "running") {
        wf.status = "failed";
        changed = true;
      }
      if (!wf.scheduleType) {
        wf.scheduleType = "once";
        wf.scheduleTime = "00:00";
        wf.scheduleDate = "";
        wf.scheduleDays = [];
        wf.scheduleMonthDays = [];
        changed = true;
      }
      if (!Array.isArray(wf.scheduleMonthDays)) {
        wf.scheduleMonthDays = [];
        changed = true;
      }
      if (wf.handoffOutput !== true) {
        wf.handoffOutput = true;
        changed = true;
      }
    }
    if (!this.settings.defaultModel) {
      this.settings.defaultModel = (_b = (_a = this.availableModels[0]) == null ? void 0 : _a.value) != null ? _b : "";
      changed = true;
    }
    if (this.settings.taskTimeoutSeconds === void 0 || this.settings.taskTimeoutSeconds > 0 && this.settings.taskTimeoutSeconds < 1800) {
      this.settings.taskTimeoutSeconds = DEFAULT_TASK_TIMEOUT_SECONDS;
      changed = true;
    }
    if (changed) {
      await this.saveData(this.settings);
    }
  }
  isRalphLoopEnabled() {
    const configPath = getOpencodeConfigPath();
    if (!fs.existsSync(configPath)) return false;
    try {
      const raw = fs.readFileSync(configPath, "utf8");
      const data = JSON.parse(raw);
      return Array.isArray(data == null ? void 0 : data.plugin) && data.plugin.includes("opencode-ralph-loop");
    } catch (e) {
      return false;
    }
  }
  async ensureRalphLoopPluginEnabled() {
    const configPath = getOpencodeConfigPath();
    const configDir = path.dirname(configPath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    let data = {};
    if (fs.existsSync(configPath)) {
      try {
        const raw = fs.readFileSync(configPath, "utf8");
        data = raw.trim() ? JSON.parse(raw) : {};
      } catch (e) {
        throw new Error(`Could not read valid JSON from ${configPath}`);
      }
    }
    const plugins = Array.isArray(data.plugin) ? [...data.plugin] : [];
    if (plugins.includes("opencode-ralph-loop")) {
      return { changed: false, configPath };
    }
    plugins.push("opencode-ralph-loop");
    data.plugin = plugins;
    fs.writeFileSync(configPath, `${JSON.stringify(data, null, 2)}
`, "utf8");
    return { changed: true, configPath };
  }
  async saveSettings() {
    var _a;
    await this.saveData(this.settings);
    (_a = this.view) == null ? void 0 : _a.refresh();
  }
  // ── Version / update helpers ────────────────────────────────────────────────
  async checkForUpdates(silent = false) {
    var _a, _b;
    try {
      this.updateCheckError = null;
      const res = await fetch(noCacheUrl(REMOTE_MANIFEST_URL), { cache: "reload" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const remoteVersion = data == null ? void 0 : data.version;
      if (!remoteVersion || typeof remoteVersion !== "string") {
        throw new Error("Remote manifest has no version");
      }
      this.latestVersion = remoteVersion;
      this.updateAvailable = compareVersions(remoteVersion, this.manifest.version) > 0;
      (_a = this.view) == null ? void 0 : _a.refresh();
      if (!silent) {
        new import_obsidian.Notice(
          this.updateAvailable ? `AutoOC: update available v${remoteVersion}.` : `AutoOC: already up to date (v${this.manifest.version}).`
        );
      }
    } catch (e) {
      this.updateCheckError = String(e);
      (_b = this.view) == null ? void 0 : _b.refresh();
      if (!silent) new import_obsidian.Notice(`AutoOC: update check failed \u2014 ${String(e)}`);
    }
  }
  async updatePlugin() {
    var _a, _b;
    if (this.updateInProgress) return;
    if (!this.latestVersion) return;
    const shouldUpdate = confirm(
      `AutoOC will download v${this.latestVersion} and try to reload the plugin automatically.

If Obsidian cannot reload it automatically, you will need to run: Ctrl+Shift+P \u2192 Reload app without saving.

Continue?`
    );
    if (!shouldUpdate) return;
    this.updateInProgress = true;
    (_a = this.view) == null ? void 0 : _a.refresh();
    new import_obsidian.Notice("AutoOC: downloading update\u2026");
    try {
      const [mainJs, manifest, styles] = await Promise.all([
        fetch(noCacheUrl(REMOTE_FILE_URLS.mainJs), { cache: "reload" }).then((r) => {
          if (!r.ok) throw new Error(`main.js HTTP ${r.status}`);
          return r.text();
        }),
        fetch(noCacheUrl(REMOTE_FILE_URLS.manifest), { cache: "reload" }).then((r) => {
          if (!r.ok) throw new Error(`manifest.json HTTP ${r.status}`);
          return r.text();
        }),
        fetch(noCacheUrl(REMOTE_FILE_URLS.styles), { cache: "reload" }).then((r) => {
          if (!r.ok) throw new Error(`styles.css HTTP ${r.status}`);
          return r.text();
        })
      ]);
      const pluginDir = `.obsidian/plugins/${this.manifest.id}`;
      await this.app.vault.adapter.write(`${pluginDir}/main.js`, mainJs);
      await this.app.vault.adapter.write(`${pluginDir}/manifest.json`, manifest);
      await this.app.vault.adapter.write(`${pluginDir}/styles.css`, styles);
      new import_obsidian.Notice(`AutoOC: updated to v${this.latestVersion}. Reloading plugin\u2026`);
      try {
        await this.app.plugins.disablePlugin(this.manifest.id);
        await this.app.plugins.enablePlugin(this.manifest.id);
        new import_obsidian.Notice("AutoOC: plugin reloaded.");
      } catch (e) {
        new import_obsidian.Notice("AutoOC: update saved. Restart Obsidian to finish.");
      }
    } catch (e) {
      new import_obsidian.Notice(`AutoOC: update failed \u2014 ${String(e)}`);
    } finally {
      this.updateInProgress = false;
      (_b = this.view) == null ? void 0 : _b.refresh();
    }
  }
  // Keep CLI options before "--" so prompt text cannot be parsed as opencode flags.
  buildArgs(task) {
    let prompt = task.prompt;
    if (task.useRalphLoop) {
      prompt = `/ralph-loop ${prompt}`;
    }
    const bin = resolveOpencodeBin(this.settings.opencodePath);
    const agent = this.getEffectiveAgent(task.agent);
    return [bin, "run", "-m", task.model, "--agent", agent, "--dangerously-skip-permissions", "--", prompt];
  }
  // Human-readable command string for the preview modal
  buildCommand(task) {
    const args = this.buildArgs(task);
    return args.map(commandPreviewArg).join(" ");
  }
  // Quick evaluation via same detached PS + polling mechanism. Used for workflow
  // transition validation prompts.
  async evaluateWithOpencode(prompt, model, cwd) {
    return new Promise((resolve) => {
      const fs2 = require("fs");
      const path2 = require("path");
      const tmpDir = require("os").tmpdir();
      const evalId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const outFile = path2.join(tmpDir, `autooc-eval-${evalId}.txt`);
      const bin = resolveOpencodeBin(this.settings.opencodePath);
      const agent = this.getEffectiveAgent();
      const safeCwd = cwd.replace(/'/g, "''");
      const psScript = [
        ...psUtf8Prelude(),
        `$env:USERPROFILE = '${process.env.USERPROFILE}'`,
        `$env:APPDATA     = '${process.env.APPDATA}'`,
        `$env:LOCALAPPDATA= '${process.env.LOCALAPPDATA}'`,
        `$env:PATH        = '${process.env.PATH}'`,
        `$env:HOME        = '${process.env.USERPROFILE}'`,
        `Set-Location -LiteralPath '${safeCwd}'`,
        `$outTmp = [System.IO.Path]::GetTempFileName()`,
        `$errTmp = [System.IO.Path]::GetTempFileName()`,
        `$bin = ${psSingleQuoted(bin)}`,
        `$argList = @('run','-m',${psSingleQuoted(model)},'--agent',${psSingleQuoted(agent)},'--dangerously-skip-permissions','--',${psSingleQuoted(prompt)})`,
        `& $bin @argList > $outTmp 2> $errTmp`,
        `$exitCode = if ($null -ne $LASTEXITCODE) { $LASTEXITCODE } else { 0 }`,
        `$stdout = Get-Content $outTmp -Raw -Encoding UTF8 -ErrorAction SilentlyContinue`,
        `$stderr = Get-Content $errTmp -Raw -Encoding UTF8 -ErrorAction SilentlyContinue`,
        `Remove-Item $outTmp,$errTmp -ErrorAction SilentlyContinue`,
        `$combined = ($stdout + $(if($stderr){"
" + $stderr}else{""})).Trim()`,
        `[System.IO.File]::WriteAllText('${outFile.replace(/'/g, "''")}', "
DONE:" + $exitCode + "
" + $combined)`
      ].join("\n");
      const psFile = path2.join(tmpDir, `autooc-eval-${evalId}.ps1`);
      writeUtf8BomFile(psFile, psScript);
      launchHiddenPS(psFile);
      const startedAt = Date.now();
      const poll = setInterval(() => {
        if (Date.now() - startedAt > 18e4) {
          clearInterval(poll);
          try {
            fs2.unlinkSync(psFile);
          } catch (e) {
          }
          resolve({ output: "evaluation timeout", exitCode: -1 });
          return;
        }
        if (!fs2.existsSync(outFile)) return;
        clearInterval(poll);
        try {
          fs2.unlinkSync(psFile);
        } catch (e) {
        }
        const raw = fs2.readFileSync(outFile, "utf8");
        try {
          fs2.unlinkSync(outFile);
        } catch (e) {
        }
        const doneMatch = raw.match(/^[\s\S]*?\nDONE:(-?\d+)\n([\s\S]*)$/m);
        const exitCode = doneMatch ? parseInt(doneMatch[1], 10) : -1;
        const output = doneMatch ? doneMatch[2].trim() : raw.trim();
        resolve({ output: normalizeCommandOutput(output), exitCode });
      }, 2e3);
    });
  }
  // Runs opencode via a fully-detached PowerShell process to avoid Electron's
  // restricted environment killing the child. Output is written to a temp file
  // that the plugin polls every 3 s.
  async runTask(task, onComplete, overrides = {}) {
    var _a, _b, _c;
    const idx = this.settings.tasks.findIndex((t) => t.id === task.id);
    if (idx === -1) return;
    const effectiveTask = { ...this.settings.tasks[idx], ...overrides };
    if (!((_a = effectiveTask.prompt) == null ? void 0 : _a.trim())) {
      this.settings.tasks[idx].status = "failed";
      this.settings.tasks[idx].lastRun = (/* @__PURE__ */ new Date()).toISOString();
      this.settings.tasks[idx].output = "[AutoOC] Task not launched: prompt is empty.";
      await this.saveSettings();
      new import_obsidian.Notice(`AutoOC: "${task.name}" has an empty prompt.`);
      if (onComplete) await onComplete(this.settings.tasks[idx], -1);
      return;
    }
    if (!((_b = effectiveTask.model) == null ? void 0 : _b.trim())) {
      this.settings.tasks[idx].status = "failed";
      this.settings.tasks[idx].lastRun = (/* @__PURE__ */ new Date()).toISOString();
      this.settings.tasks[idx].output = "[AutoOC] Task not launched: model is empty.";
      await this.saveSettings();
      new import_obsidian.Notice(`AutoOC: "${task.name}" has no model selected.`);
      if (onComplete) await onComplete(this.settings.tasks[idx], -1);
      return;
    }
    const vaultBasePath = this.app.vault.adapter.basePath || ".";
    this.settings.tasks[idx].status = "running";
    this.settings.tasks[idx].lastRun = (/* @__PURE__ */ new Date()).toISOString();
    this.settings.tasks[idx].output = "[iniciando proceso desacoplado\u2026]\n";
    await this.saveSettings();
    new import_obsidian.Notice(`AutoOC: running "${task.name}"\u2026`);
    const args = this.buildArgs(effectiveTask);
    const bin = args[0];
    let prompt = effectiveTask.prompt;
    if (effectiveTask.useRalphLoop) {
      prompt = `/ralph-loop ${prompt}`;
    }
    const model = effectiveTask.model;
    const preparedPrompt = prompt.replace(/\r?\n+/g, " ").replace(/\s+/g, " ").trim();
    const tmpDir = require("os").tmpdir();
    const outFile = require("path").join(tmpDir, `autooc-${task.id}.txt`);
    const errFile = require("path").join(tmpDir, `autooc-${task.id}.err.txt`);
    const doneFile = require("path").join(tmpDir, `autooc-${task.id}.done.txt`);
    const pidFile = require("path").join(tmpDir, `autooc-${task.id}.pid`);
    const promptFile = require("path").join(tmpDir, `autooc-${task.id}.prompt.txt`);
    const fs2 = require("fs");
    try {
      fs2.unlinkSync(outFile);
    } catch (e) {
    }
    try {
      fs2.unlinkSync(errFile);
    } catch (e) {
    }
    try {
      fs2.unlinkSync(doneFile);
    } catch (e) {
    }
    try {
      fs2.unlinkSync(pidFile);
    } catch (e) {
    }
    try {
      fs2.unlinkSync(promptFile);
    } catch (e) {
    }
    fs2.writeFileSync(promptFile, preparedPrompt, "utf8");
    const taskCwd = effectiveTask.workingDirectory || this.settings.workingDirectory || (this.app.vault.adapter.basePath || ".");
    const safeCwd = taskCwd.replace(/'/g, "''");
    let gitCmds = "";
    if (effectiveTask.branch) {
      const safeBranch = effectiveTask.branch.replace(/'/g, "''");
      if (effectiveTask.createBranch) {
        gitCmds = `$timestamp = Get-Date -Format "yyyyMMdd-HHmm"; $branchName = "${safeBranch}-$timestamp"; git checkout -b $branchName 2>$null; if ($?) { echo "Created branch $branchName" } else { git checkout ${safeBranch} }`;
      } else {
        gitCmds = `git checkout ${safeBranch}`;
      }
    }
    const psScript = [
      ...psUtf8Prelude(),
      `$env:USERPROFILE = '${process.env.USERPROFILE}'`,
      `$env:APPDATA     = '${process.env.APPDATA}'`,
      `$env:LOCALAPPDATA= '${process.env.LOCALAPPDATA}'`,
      `$env:PATH        = '${process.env.PATH}'`,
      `$env:HOME        = '${process.env.USERPROFILE}'`,
      `Set-Location -LiteralPath '${safeCwd}'`,
      gitCmds ? gitCmds : "",
      `$prompt = Get-Content '${promptFile.replace(/'/g, "''")}' -Raw -Encoding UTF8`,
      `$bin = ${psSingleQuoted(bin)}`,
      `$argList = @('run','-m',${psSingleQuoted(model)},'--agent',${psSingleQuoted(this.getEffectiveAgent(effectiveTask.agent))},'--dangerously-skip-permissions','--',$prompt)`,
      `& $bin @argList > '${outFile.replace(/'/g, "''")}' 2> '${errFile.replace(/'/g, "''")}'`,
      `$exitCode = if ($null -ne $LASTEXITCODE) { $LASTEXITCODE } else { 0 }`,
      `[System.IO.File]::WriteAllText('${doneFile.replace(/'/g, "''")}', [string]$exitCode, [System.Text.Encoding]::UTF8)`
    ].filter((line) => line !== "").join("\n");
    const psScriptFile = require("path").join(tmpDir, `autooc-${task.id}.ps1`);
    writeUtf8BomFile(psScriptFile, psScript);
    launchHiddenPS(psScriptFile);
    this.runningProcesses.set(task.id, { kill: () => {
    } });
    const timeoutSeconds = (_c = this.settings.taskTimeoutSeconds) != null ? _c : DEFAULT_TASK_TIMEOUT_SECONDS;
    const timeoutEnabled = timeoutSeconds > 0;
    const timeoutMs = timeoutSeconds * 1e3;
    const startedAt = Date.now();
    let timeoutWarned = false;
    const pollHandle = setInterval(async () => {
      const t = this.settings.tasks.find((x) => x.id === task.id);
      if (!t) {
        clearInterval(pollHandle);
        return;
      }
      if (timeoutEnabled && !timeoutWarned && Date.now() - startedAt > timeoutMs) {
        timeoutWarned = true;
        t.output += `
[\u23F1 timeout warning: ${timeoutSeconds}s superados; sigo esperando el resultado final]`;
        await this.saveSettings();
        new import_obsidian.Notice(`AutoOC: \u23F1 "${task.name}" super\xF3 ${timeoutSeconds}s; sigo esperando.`);
      }
      if (!fs2.existsSync(doneFile)) {
        t.output += ".";
        await this.saveSettings();
        return;
      }
      clearInterval(pollHandle);
      this.runningProcesses.delete(task.id);
      try {
        fs2.unlinkSync(psScriptFile);
      } catch (e) {
      }
      try {
        fs2.unlinkSync(promptFile);
      } catch (e) {
      }
      const stdout = fs2.existsSync(outFile) ? decodeCommandBuffer(fs2.readFileSync(outFile)) : "";
      const stderr = fs2.existsSync(errFile) ? decodeCommandBuffer(fs2.readFileSync(errFile)) : "";
      const exitCodeRaw = fs2.readFileSync(doneFile, "utf8").trim();
      try {
        fs2.unlinkSync(outFile);
      } catch (e) {
      }
      try {
        fs2.unlinkSync(errFile);
      } catch (e) {
      }
      try {
        fs2.unlinkSync(doneFile);
      } catch (e) {
      }
      const exitCode = /^-?\d+$/.test(exitCodeRaw) ? parseInt(exitCodeRaw, 10) : -1;
      const normalized = formatTaskOutput(stdout, stderr);
      t.output = normalized || "(sin output)";
      if (exitCode !== 0) {
        t.status = "failed";
        t.output += `
[c\xF3digo de salida: ${exitCode}]`;
        new import_obsidian.Notice(`AutoOC: \u274C "${task.name}" fall\xF3 (c\xF3digo ${exitCode}).`);
      } else {
        t.status = task.scheduleType === "daily" || task.scheduleType === "weekly" || task.scheduleType === "monthly" ? "pending" : "completed";
        new import_obsidian.Notice(`AutoOC: \u2705 "${task.name}" completada.`);
      }
      if (this.settings.logsEnabled) {
        saveLogToFile(vaultBasePath, task.id, t.output);
        cleanupOldLogs(vaultBasePath, task.id, this.settings.maxLogsPerTask);
        cleanupLogsByAge(vaultBasePath, task.id, this.settings.logRetentionDays);
      }
      await this.saveSettings();
      if (onComplete) {
        await onComplete(t, exitCode);
      }
    }, 3e3);
  }
  async killTask(id) {
    const proc = this.runningProcesses.get(id);
    if (proc) {
      try {
        proc.kill();
      } catch (e) {
      }
      this.runningProcesses.delete(id);
    }
    const t = this.settings.tasks.find((x) => x.id === id);
    if (t) {
      t.status = "failed";
      t.output += "\n[task stopped manually]";
      if (this.settings.logsEnabled) {
        const vaultBasePath = this.app.vault.adapter.basePath || ".";
        saveLogToFile(vaultBasePath, id, t.output);
        cleanupOldLogs(vaultBasePath, id, this.settings.maxLogsPerTask);
        cleanupLogsByAge(vaultBasePath, id, this.settings.logRetentionDays);
      }
      await this.saveSettings();
    }
    new import_obsidian.Notice(`AutoOC: \u23F9 Task stopped.`);
  }
  async runDueAll() {
    if (this.dueCheckInProgress) return;
    this.dueCheckInProgress = true;
    try {
      await this.runDueTasks();
      await this.runDueWorkflows();
    } finally {
      this.dueCheckInProgress = false;
    }
  }
  async runDueTasks() {
    const dueTasks = this.settings.tasks.filter((task) => isTaskDue(task));
    for (let i = 0; i < dueTasks.length; i++) {
      await this.runTask(dueTasks[i]);
      if (i < dueTasks.length - 1) await delay(DUE_LAUNCH_GAP_MS);
    }
  }
  async runDueWorkflows() {
    const dueWorkflows = this.settings.workflows.filter((wf) => isWorkflowDue(wf));
    for (let i = 0; i < dueWorkflows.length; i++) {
      await this.runWorkflow(dueWorkflows[i]);
      if (i < dueWorkflows.length - 1) await delay(DUE_LAUNCH_GAP_MS);
    }
  }
  async deleteTask(id) {
    this.settings.tasks = this.settings.tasks.filter((t) => t.id !== id);
    await this.saveSettings();
  }
  async duplicateTask(task) {
    const copy = {
      ...task,
      id: generateId(),
      name: `${task.name} (copy)`,
      status: "pending",
      lastRun: "",
      output: "",
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.settings.tasks.push(copy);
    await this.saveSettings();
    new import_obsidian.Notice(`Task "${copy.name}" duplicated.`);
  }
  async clearTaskLogs(id) {
    const vaultBasePath = this.app.vault.adapter.basePath || ".";
    clearTaskLogs(vaultBasePath, id);
    new import_obsidian.Notice("Logs cleared for this task.");
  }
  async clearAllLogs() {
    const vaultBasePath = this.app.vault.adapter.basePath || ".";
    clearAllLogs(vaultBasePath);
    new import_obsidian.Notice("All logs cleared.");
  }
  async deleteWorkflow(id) {
    this.settings.workflows = this.settings.workflows.filter((w) => w.id !== id);
    await this.saveSettings();
  }
  async duplicateWorkflow(workflow) {
    const copy = {
      ...workflow,
      id: generateId(),
      name: `${workflow.name} (copy)`,
      steps: workflow.steps.map((step) => ({ ...step })),
      status: "pending",
      currentStep: -1,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      lastRun: void 0
    };
    this.settings.workflows.push(copy);
    await this.saveSettings();
    new import_obsidian.Notice(`Workflow "${copy.name}" duplicated.`);
  }
  async runWorkflow(workflow) {
    const idx = this.settings.workflows.findIndex((w) => w.id === workflow.id);
    if (idx === -1) return;
    const wf = this.settings.workflows[idx];
    if (wf.steps.length === 0) {
      new import_obsidian.Notice(`AutoOC: Workflow "${wf.name}" has no steps.`);
      return;
    }
    for (let i = 0; i < wf.steps.length; i++) {
      const step = wf.steps[i];
      const t = this.settings.tasks.find((t2) => t2.id === step.taskId);
      if (!t) {
        new import_obsidian.Notice(`AutoOC: Workflow "${wf.name}" \u2014 step ${i + 1} references a deleted task.`);
        return;
      }
    }
    wf.status = "running";
    wf.currentStep = 0;
    wf.lastRun = (/* @__PURE__ */ new Date()).toISOString();
    await this.saveSettings();
    new import_obsidian.Notice(`AutoOC: \u26A1 Starting workflow "${wf.name}" (${wf.steps.length} steps)...`);
    await this.runWorkflowStep(idx, 0);
  }
  async runWorkflowStep(wfIdx, stepIndex) {
    const wf = this.settings.workflows[wfIdx];
    if (!wf || wf.status !== "running") return;
    const step = wf.steps[stepIndex];
    const taskIdx = this.settings.tasks.findIndex((t) => t.id === step.taskId);
    if (taskIdx === -1) {
      wf.status = "failed";
      new import_obsidian.Notice(`AutoOC: Workflow "${wf.name}" failed \u2014 task not found at step ${stepIndex + 1}.`);
      await this.saveSettings();
      return;
    }
    const task = this.settings.tasks[taskIdx];
    const taskOverrides = {};
    if (stepIndex > 0) {
      const prevStep = wf.steps[stepIndex - 1];
      const prevTaskIdx = this.settings.tasks.findIndex((t) => t.id === prevStep.taskId);
      if (prevTaskIdx !== -1) {
        const prevTask = this.settings.tasks[prevTaskIdx];
        if (wf.handoffBranch && prevTask.branch) {
          taskOverrides.branch = prevTask.branch;
          taskOverrides.createBranch = false;
        }
        const handoffEnabled = true;
        if (handoffEnabled && prevTask.output && prevTask.output.trim()) {
          const cleanOutput = extractContextForHandoff(prevTask.output);
          if (cleanOutput) {
            const contextText = cleanOutput;
            const contextBlock = ` Previous task output from "${prevTask.name}" to use as context: ${contextText} End of previous task output.`;
            taskOverrides.prompt = `${task.prompt}${contextBlock}`;
            new import_obsidian.Notice(`AutoOC: \u21AA Passing context from "${prevTask.name}" to "${task.name}" (${contextText.length} chars)`);
          } else {
            new import_obsidian.Notice(`AutoOC: handoff skipped \u2014 previous output was empty after filtering.`);
          }
        }
      }
    }
    wf.currentStep = stepIndex;
    await this.saveSettings();
    await this.runTask(task, async (completedTask, exitCode) => {
      var _a, _b;
      const currentWf = this.settings.workflows[wfIdx];
      if (!currentWf || currentWf.status !== "running") return;
      const currentStep = currentWf.steps[stepIndex];
      const transitionMode = (_a = currentStep.transitionMode) != null ? _a : currentStep.forceContinue ? "force" : currentStep.evaluatePrompt !== void 0 ? "eval" : "default";
      if (stepIndex >= currentWf.steps.length - 1) {
        currentWf.status = exitCode === 0 && completedTask.status !== "failed" ? "completed" : "failed";
        currentWf.currentStep = stepIndex;
        new import_obsidian.Notice(
          currentWf.status === "completed" ? `AutoOC: \u2705 Workflow "${currentWf.name}" completed (${currentWf.steps.length}/${currentWf.steps.length} steps).` : `AutoOC: \u274C Workflow "${currentWf.name}" failed at final step ${stepIndex + 1}.`
        );
        await this.saveSettings();
        return;
      }
      let shouldContinue = false;
      if (transitionMode === "force") {
        shouldContinue = true;
      } else if (transitionMode === "eval") {
        new import_obsidian.Notice(`AutoOC: Evaluating step ${stepIndex + 1} \u2192 ${stepIndex + 2} for "${currentWf.name}"...`);
        try {
          const cwd = completedTask.workingDirectory || this.settings.workingDirectory || this.app.vault.adapter.basePath || ".";
          const prompt = ((_b = currentStep.evaluatePrompt) == null ? void 0 : _b.trim()) || "Did the previous task complete successfully? If it is safe to continue, reply YES. Otherwise reply NO.";
          const evalFullPrompt = `${prompt}

Previous task output:
---
${completedTask.output}
---

Reply ONLY with YES or NO.`;
          const evalResult = await this.evaluateWithOpencode(evalFullPrompt, completedTask.model, cwd);
          const isYes = /\bYES\b/i.test(evalResult.output) && !/\bNO\b/i.test(evalResult.output);
          shouldContinue = isYes;
          completedTask.output += `

[Workflow evaluation (step ${stepIndex + 1}\u2192${stepIndex + 2}): ${evalResult.output.trim().slice(0, 300)}]`;
        } catch (err) {
          completedTask.output += `

[Workflow evaluation error: ${String(err)}]`;
          shouldContinue = false;
        }
      } else {
        shouldContinue = exitCode === 0 && completedTask.status !== "failed";
      }
      if (shouldContinue) {
        currentWf.currentStep = stepIndex + 1;
        await this.saveSettings();
        new import_obsidian.Notice(`AutoOC: \u26A1 Workflow "${currentWf.name}" step ${stepIndex + 2}/${currentWf.steps.length}...`);
        setTimeout(() => {
          this.runWorkflowStep(wfIdx, stepIndex + 1);
        }, 500);
      } else {
        const failedByTask = transitionMode === "default" && (exitCode !== 0 || completedTask.status === "failed");
        currentWf.status = failedByTask ? "failed" : "completed";
        completedTask.output += failedByTask ? `
[Workflow failed at step ${stepIndex + 1}/${currentWf.steps.length}]` : `
[Workflow stopped at step ${stepIndex + 1}/${currentWf.steps.length}]`;
        new import_obsidian.Notice(
          failedByTask ? `AutoOC: \u274C Workflow "${currentWf.name}" failed at step ${stepIndex + 1}/${currentWf.steps.length}.` : `AutoOC: \u23F8 Workflow "${currentWf.name}" stopped at step ${stepIndex + 1}/${currentWf.steps.length}.`
        );
        await this.saveSettings();
      }
    }, taskOverrides);
  }
};
var AutoOCView = class extends import_obsidian.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.filterText = "";
    this.filterStatus = "all";
    this.currentTab = "tasks";
    this.plugin = plugin;
  }
  getViewType() {
    return VIEW_TYPE;
  }
  getDisplayText() {
    return "AutoOC Scheduler";
  }
  getIcon() {
    return "workflow";
  }
  async onOpen() {
    this.render();
  }
  async onClose() {
  }
  refresh() {
    this.render();
  }
  openCli() {
    new OpenCodeCliModal(this.app, this.plugin).open();
  }
  render() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass("auto-oc-view");
    const tabBar = containerEl.createDiv("auto-oc-tab-bar");
    const btnTasks = tabBar.createEl("button", {
      text: "\u{1F4CB} Tasks",
      cls: "auto-oc-tab-btn"
    });
    btnTasks.onclick = () => {
      this.currentTab = "tasks";
      this.render();
    };
    const btnWorkflows = tabBar.createEl("button", {
      text: "\u{1F517} Workflows",
      cls: "auto-oc-tab-btn"
    });
    btnWorkflows.onclick = () => {
      this.currentTab = "workflows";
      this.render();
    };
    const btnCli = tabBar.createEl("button", {
      text: "OpenCode CLI",
      cls: "auto-oc-tab-btn"
    });
    btnCli.onclick = () => this.openCli();
    if (this.currentTab === "tasks") btnTasks.addClass("active");
    else if (this.currentTab === "workflows") btnWorkflows.addClass("active");
    if (this.currentTab === "workflows") {
      this.renderWorkflows(containerEl);
    } else {
      this.renderTasks(containerEl);
    }
  }
  renderTasks(containerEl) {
    const header = containerEl.createDiv("auto-oc-header");
    const titleRow = header.createDiv("auto-oc-title-row");
    titleRow.createEl("h4", { text: "\u23F0 AutoOC Scheduler" });
    const versionWrap = titleRow.createDiv("auto-oc-version-wrap");
    versionWrap.createEl("span", {
      text: `v${this.plugin.manifest.version}`,
      cls: "auto-oc-version"
    });
    const btnCheckUpdates = versionWrap.createEl("button", {
      text: "Check updates",
      cls: "auto-oc-btn-check-update"
    });
    btnCheckUpdates.disabled = this.plugin.updateInProgress;
    btnCheckUpdates.title = "Check GitHub main/manifest.json for a newer AutoOC version";
    btnCheckUpdates.onclick = async () => {
      btnCheckUpdates.disabled = true;
      btnCheckUpdates.textContent = "Checking\u2026";
      await this.plugin.checkForUpdates(false);
      this.render();
    };
    if (this.plugin.updateInProgress) {
      versionWrap.createEl("span", {
        text: "\u23F3 Updating\u2026",
        cls: "auto-oc-update-status"
      });
    } else if (this.plugin.updateAvailable && this.plugin.latestVersion) {
      versionWrap.createEl("span", {
        text: `\u{1F680} v${this.plugin.latestVersion} available`,
        cls: "auto-oc-update-badge"
      });
      const btnUpdate = versionWrap.createEl("button", {
        text: "Update now",
        cls: "auto-oc-btn-update"
      });
      btnUpdate.onclick = () => this.plugin.updatePlugin();
    } else if (this.plugin.updateCheckError) {
      versionWrap.createEl("span", {
        text: "\u26A0\uFE0F update check failed",
        cls: "auto-oc-update-error",
        title: this.plugin.updateCheckError
      });
    }
    const btnRow = header.createDiv("auto-oc-btn-row");
    const btnNew = btnRow.createEl("button", {
      text: "+ New Task",
      cls: "auto-oc-btn-primary"
    });
    btnNew.onclick = () => new CreateTaskModal(this.app, this.plugin).open();
    const filterBar = containerEl.createDiv("auto-oc-filter-bar");
    const searchInput = filterBar.createEl("input", {
      type: "text",
      placeholder: "\u{1F50D} Search name or prompt...",
      cls: "auto-oc-search-input"
    });
    searchInput.value = this.filterText;
    searchInput.oninput = () => {
      this.filterText = searchInput.value.toLowerCase();
      this.render();
    };
    const statusSelect = filterBar.createEl("select", {
      cls: "auto-oc-status-select"
    });
    const statuses = ["all", "pending", "running", "completed", "failed"];
    statuses.forEach((s) => {
      const opt = statusSelect.createEl("option");
      opt.value = s;
      opt.text = s.charAt(0).toUpperCase() + s.slice(1);
    });
    statusSelect.value = this.filterStatus;
    statusSelect.onchange = () => {
      this.filterStatus = statusSelect.value;
      this.render();
    };
    const tasks = this.plugin.settings.tasks;
    const stats = containerEl.createDiv("auto-oc-stats");
    const pending = tasks.filter((t) => t.status === "pending").length;
    const running = tasks.filter((t) => t.status === "running").length;
    const completed = tasks.filter((t) => t.status === "completed").length;
    const failed = tasks.filter((t) => t.status === "failed").length;
    stats.createEl("span", { text: `${tasks.length} tasks` });
    if (running > 0) stats.createEl("span", { text: `\u{1F7E1} ${running} running`, cls: "auto-oc-stat-running" });
    if (failed > 0) stats.createEl("span", { text: `\u{1F534} ${failed} failed`, cls: "auto-oc-stat-failed" });
    if (completed > 0) stats.createEl("span", { text: `\u{1F7E2} ${completed} completed` });
    const filteredTasks = tasks.filter((t) => {
      const matchesText = t.name.toLowerCase().includes(this.filterText) || t.prompt.toLowerCase().includes(this.filterText);
      const matchesStatus = this.filterStatus === "all" || t.status === this.filterStatus;
      return matchesText && matchesStatus;
    });
    if (filteredTasks.length === 0) {
      containerEl.createEl("p", {
        text: this.filterText || this.filterStatus !== "all" ? "No tasks match your filters." : 'No tasks scheduled. Create one with "+New Task".',
        cls: "auto-oc-empty"
      });
      return;
    }
    const list = containerEl.createDiv("auto-oc-list");
    for (const task of [...filteredTasks].reverse()) {
      this.renderTaskCard(list, task);
    }
  }
  renderTaskCard(parent, task) {
    var _a, _b;
    const card = parent.createDiv(`auto-oc-card auto-oc-status-${task.status}`);
    const summary = card.createDiv("auto-oc-card-summary");
    const title = summary.createEl("span", { text: task.name, cls: "auto-oc-task-name" });
    const badge = summary.createEl("span", {
      text: task.status,
      cls: `auto-oc-badge auto-oc-badge-${task.status}`
    });
    if (task.status === "failed") {
      badge.addClass("auto-oc-badge-clickable");
      badge.title = "Click to reset to pending (will run on next schedule, or hit \u25B6 Run now)";
      badge.onclick = async (e) => {
        e.stopPropagation();
        task.status = "pending";
        await this.plugin.saveSettings();
        this.render();
        new import_obsidian.Notice(`AutoOC: "${task.name}" reset to pending.`);
      };
    }
    const details = card.createDiv("auto-oc-card-details");
    details.style.display = "none";
    const meta = details.createDiv("auto-oc-card-meta");
    const modelLabel = (_b = (_a = this.plugin.availableModels.find((m) => m.value === task.model)) == null ? void 0 : _a.label) != null ? _b : task.model;
    meta.createEl("span", { text: `\u{1F916} ${modelLabel}` });
    meta.createEl("span", { text: `\u2699\uFE0F ${this.plugin.getEffectiveAgent(task.agent)}` });
    let scheduleText = "";
    if (task.scheduleType === "manual") {
      scheduleText = "\u25B6 Manual only";
    } else if (task.scheduleType === "once") {
      scheduleText = `\u{1F4C5} ${task.scheduleDate} ${task.scheduleTime}`;
    } else if (task.scheduleType === "daily") {
      scheduleText = `\u{1F501} Every day at ${task.scheduleTime}`;
    } else if (task.scheduleType === "weekly") {
      const days = task.scheduleDays.map((d) => DAY_NAMES[d]).join(", ");
      scheduleText = `\u{1F501} ${days || "no days"} at ${task.scheduleTime}`;
    } else {
      const days = (task.scheduleMonthDays || []).join(", ");
      scheduleText = `\u{1F501} Day ${days || "no days"} of each month at ${task.scheduleTime}`;
    }
    meta.createEl("span", { text: scheduleText });
    if (task.lastRun) {
      meta.createEl("span", { text: `\u23F1 Last: ${formatDateTime(task.lastRun)}` });
    }
    if (task.useRalphLoop) {
      meta.createEl("span", { text: "\u267B\uFE0F Ralph Loop active", cls: "auto-oc-ralph-badge" });
    }
    const preview = details.createDiv("auto-oc-prompt-preview");
    preview.createEl("span", {
      text: task.prompt.slice(0, 140) + (task.prompt.length > 140 ? "\u2026" : "")
    });
    const actions = details.createDiv("auto-oc-card-actions");
    const btnRun = actions.createEl("button", {
      text: task.status === "running" ? "\u23F3 Running\u2026" : "\u25B6 Run",
      cls: "auto-oc-btn-run"
    });
    btnRun.disabled = task.status === "running";
    btnRun.onclick = (e) => {
      e.stopPropagation();
      this.plugin.runTask(task);
    };
    if (task.status === "running") {
      const btnStop = actions.createEl("button", {
        text: "\u23F9 Stop",
        cls: "auto-oc-btn-stop"
      });
      btnStop.title = "Terminate process now";
      btnStop.onclick = async (e) => {
        e.stopPropagation();
        btnStop.disabled = true;
        btnStop.textContent = "Stopping\u2026";
        await this.plugin.killTask(task.id);
      };
    }
    const btnLog = actions.createEl("button", {
      text: task.status === "running" ? "\u{1F4E1} Live Log" : "\u{1F4C4} Log",
      cls: task.status === "running" ? "auto-oc-btn-log-live" : "auto-oc-btn-output"
    });
    btnLog.disabled = !task.output && task.status !== "running";
    btnLog.title = task.output ? "" : "A\xFAn no hay output";
    btnLog.onclick = (e) => {
      e.stopPropagation();
      new LiveLogModal(this.app, task, this.plugin).open();
    };
    const btnHistory = actions.createEl("button", {
      text: "\u{1F4DC} History",
      cls: "auto-oc-btn-history"
    });
    btnHistory.onclick = (e) => {
      e.stopPropagation();
      try {
        new LogHistoryModal(this.app, task, this.plugin).open();
      } catch (err) {
        new import_obsidian.Notice(`AutoOC: could not open history \u2014 ${String(err)}`);
      }
    };
    const btnCmd = actions.createEl("button", {
      text: "\u{1F50D} Command",
      cls: "auto-oc-btn-cmd"
    });
    btnCmd.onclick = (e) => {
      e.stopPropagation();
      const cmd = this.plugin.buildCommand(task);
      new CommandPreviewModal(this.app, task.name, cmd).open();
    };
    const btnEdit = actions.createEl("button", {
      text: "\u270F\uFE0F Edit",
      cls: "auto-oc-btn-edit"
    });
    btnEdit.onclick = (e) => {
      e.stopPropagation();
      try {
        new CreateTaskModal(this.app, this.plugin, task).open();
      } catch (err) {
        new import_obsidian.Notice(`AutoOC: could not open task editor \u2014 ${String(err)}`);
      }
    };
    const btnDuplicate = actions.createEl("button", {
      text: "\u29C9 Duplicate",
      cls: "auto-oc-btn-duplicate"
    });
    btnDuplicate.onclick = async (e) => {
      e.stopPropagation();
      await this.plugin.duplicateTask(task);
      this.render();
    };
    const btnDelete = actions.createEl("button", {
      text: "\u{1F5D1}",
      cls: "auto-oc-btn-delete"
    });
    btnDelete.title = "Delete task";
    btnDelete.onclick = async (e) => {
      e.stopPropagation();
      if (confirm(`Delete task "${task.name}"?`)) {
        await this.plugin.deleteTask(task.id);
      }
    };
    summary.onclick = () => {
      const isHidden = details.style.display === "none";
      details.style.display = isHidden ? "block" : "none";
      card.classList.toggle("expanded", isHidden);
    };
  }
  // ── Workflows rendering ──────────────────────────────────────────────────
  renderWorkflows(containerEl) {
    const header = containerEl.createDiv("auto-oc-header");
    const titleRow = header.createDiv("auto-oc-title-row");
    titleRow.createEl("h4", { text: "\u{1F517} Workflows" });
    const btnRow = header.createDiv("auto-oc-btn-row");
    const btnNew = btnRow.createEl("button", {
      text: "+ New Workflow",
      cls: "auto-oc-btn-primary"
    });
    btnNew.onclick = () => new CreateWorkflowModal(this.app, this.plugin).open();
    const help = header.createDiv("auto-oc-workflow-panel-help");
    help.createSpan({
      text: "Workflows run tasks in order using their own schedule. Per-step transitions decide whether the next task starts: success, force, or AI decides."
    });
    const workflows = this.plugin.settings.workflows;
    const stats = containerEl.createDiv("auto-oc-stats");
    const completed = workflows.filter((w) => w.status === "completed").length;
    const running = workflows.filter((w) => w.status === "running").length;
    const failed = workflows.filter((w) => w.status === "failed").length;
    stats.createEl("span", { text: `${workflows.length} workflows` });
    if (running > 0) stats.createEl("span", { text: `\u{1F7E1} ${running} running`, cls: "auto-oc-stat-running" });
    if (failed > 0) stats.createEl("span", { text: `\u{1F534} ${failed} failed`, cls: "auto-oc-stat-failed" });
    if (completed > 0) stats.createEl("span", { text: `\u{1F7E2} ${completed} completed` });
    if (workflows.length === 0) {
      containerEl.createEl("p", {
        text: 'No workflows yet. Chain tasks together with "+ New Workflow".',
        cls: "auto-oc-empty"
      });
      return;
    }
    const list = containerEl.createDiv("auto-oc-list");
    for (const wf of [...workflows].reverse()) {
      this.renderWorkflowCard(list, wf);
    }
  }
  renderWorkflowCard(parent, workflow) {
    var _a, _b, _c;
    const card = parent.createDiv(`auto-oc-card auto-oc-status-${workflow.status}`);
    const summary = card.createDiv("auto-oc-card-summary");
    const nameEl = summary.createEl("span", {
      text: workflow.name,
      cls: "auto-oc-task-name"
    });
    const badge = summary.createEl("span", {
      text: workflow.status,
      cls: `auto-oc-badge auto-oc-badge-${workflow.status}`
    });
    if (workflow.status === "failed") {
      badge.addClass("auto-oc-badge-clickable");
      badge.title = "Click to reset to pending";
      badge.onclick = async (e) => {
        e.stopPropagation();
        workflow.status = "pending";
        await this.plugin.saveSettings();
        this.render();
        new import_obsidian.Notice(`Workflow "${workflow.name}" reset to pending.`);
      };
    }
    const details = card.createDiv("auto-oc-card-details");
    details.style.display = "none";
    if (workflow.description) {
      const desc = details.createDiv("auto-oc-prompt-preview");
      desc.createEl("span", { text: workflow.description.slice(0, 200) });
    }
    const stepsDiv = details.createDiv("auto-oc-workflow-steps-mini");
    for (let i = 0; i < workflow.steps.length; i++) {
      const step = workflow.steps[i];
      const task = this.plugin.settings.tasks.find((t) => t.id === step.taskId);
      const stepItem = stepsDiv.createDiv("auto-oc-workflow-task-detail");
      const isCurrent = workflow.status === "running" && workflow.currentStep === i;
      const isDone = workflow.currentStep > i || workflow.status === "completed" && workflow.currentStep >= i;
      const icon = isDone ? "\u2705" : isCurrent ? "\u23F3" : "\u2B1C";
      const stepHeader = stepItem.createDiv("auto-oc-workflow-task-header");
      stepHeader.createSpan({
        text: `${icon} Step ${i + 1}: ${task ? task.name : "(deleted task)"}`,
        cls: "auto-oc-workflow-task-title"
      });
      if (task) {
        stepHeader.createSpan({
          text: task.status,
          cls: `auto-oc-badge auto-oc-badge-${task.status}`
        });
      }
      if (i < workflow.steps.length - 1) {
        const transitionMode = (_a = step.transitionMode) != null ? _a : step.forceContinue ? "force" : step.evaluatePrompt !== void 0 ? "eval" : "default";
        stepHeader.createSpan({
          text: transitionMode === "force" ? " \u2192 [force]" : transitionMode === "eval" ? " \u2192 [eval]" : " \u2192 [default]",
          cls: "auto-oc-workflow-transition-label"
        });
      }
      if (!task) continue;
      const taskMeta = stepItem.createDiv("auto-oc-workflow-task-meta");
      const modelLabel = (_c = (_b = this.plugin.availableModels.find((m) => m.value === task.model)) == null ? void 0 : _b.label) != null ? _c : task.model;
      taskMeta.createSpan({ text: `\u{1F916} ${modelLabel || "(no model)"}` });
      taskMeta.createSpan({ text: `\u2699\uFE0F ${this.plugin.getEffectiveAgent(task.agent)}` });
      if (task.branch) taskMeta.createSpan({ text: `\u{1F33F} ${task.branch}${task.createBranch ? " (create)" : ""}` });
      if (task.workingDirectory) taskMeta.createSpan({ text: `\u{1F4C2} ${task.workingDirectory}` });
      if (task.lastRun) taskMeta.createSpan({ text: `\u23F1 ${formatDateTime(task.lastRun)}` });
      const promptPreview = stepItem.createDiv("auto-oc-workflow-task-prompt");
      promptPreview.createSpan({
        text: task.prompt.slice(0, 180) + (task.prompt.length > 180 ? "\u2026" : "")
      });
      const taskActions = stepItem.createDiv("auto-oc-workflow-task-actions");
      const btnLog = taskActions.createEl("button", {
        text: task.status === "running" ? "\u{1F4E1} Live Log" : "\u{1F4C4} Log",
        cls: task.status === "running" ? "auto-oc-btn-log-live" : "auto-oc-btn-output"
      });
      btnLog.disabled = !task.output && task.status !== "running";
      btnLog.onclick = (e) => {
        e.stopPropagation();
        new LiveLogModal(this.app, task, this.plugin).open();
      };
      const btnHistory = taskActions.createEl("button", {
        text: "\u{1F4DC} History",
        cls: "auto-oc-btn-history"
      });
      btnHistory.onclick = (e) => {
        e.stopPropagation();
        try {
          new LogHistoryModal(this.app, task, this.plugin).open();
        } catch (err) {
          new import_obsidian.Notice(`AutoOC: could not open history \u2014 ${String(err)}`);
        }
      };
      const btnCmd = taskActions.createEl("button", {
        text: "\u{1F50D} Command",
        cls: "auto-oc-btn-cmd"
      });
      btnCmd.onclick = (e) => {
        e.stopPropagation();
        new CommandPreviewModal(this.app, task.name, this.plugin.buildCommand(task)).open();
      };
      const btnEditTask = taskActions.createEl("button", {
        text: "\u270F\uFE0F Edit Task",
        cls: "auto-oc-btn-edit"
      });
      btnEditTask.onclick = (e) => {
        e.stopPropagation();
        try {
          new CreateTaskModal(this.app, this.plugin, task).open();
        } catch (err) {
          new import_obsidian.Notice(`AutoOC: could not open task editor \u2014 ${String(err)}`);
        }
      };
    }
    if (workflow.handoffBranch || workflow.handoffOutput) {
      const handoffDiv = details.createDiv("auto-oc-card-meta");
      if (workflow.handoffBranch) {
        handoffDiv.createEl("span", { text: "\u{1F504} Branch handoff enabled" });
      }
      if (workflow.handoffOutput) {
        handoffDiv.createEl("span", { text: "\u{1F4C4} Output context handoff enabled" });
      }
    }
    if (workflow.lastRun) {
      const meta = details.createDiv("auto-oc-card-meta");
      meta.createEl("span", { text: `\u23F1 Last run: ${formatDateTime(workflow.lastRun)}` });
    }
    const wfScheduleType = workflow.scheduleType || "once";
    const wfScheduleTime = workflow.scheduleTime || "00:00";
    const wfScheduleDate = workflow.scheduleDate || "";
    const wfScheduleDays = workflow.scheduleDays || [];
    const wfScheduleMonthDays = workflow.scheduleMonthDays || [];
    if (wfScheduleType === "manual" || wfScheduleType !== "once" || wfScheduleTime !== "00:00") {
      const schedMeta = details.createDiv("auto-oc-card-meta");
      if (wfScheduleType === "manual") {
        schedMeta.createEl("span", { text: "\u25B6 Manual only" });
      } else if (wfScheduleType === "once") {
        schedMeta.createEl("span", { text: `\u{1F4C5} ${wfScheduleDate} ${wfScheduleTime}` });
      } else if (wfScheduleType === "daily") {
        schedMeta.createEl("span", { text: `\u{1F501} Every day at ${wfScheduleTime}` });
      } else if (wfScheduleType === "weekly") {
        const days = wfScheduleDays.map((d) => DAY_NAMES[d]).join(", ");
        schedMeta.createEl("span", { text: `\u{1F501} ${days || "no days"} at ${wfScheduleTime}` });
      } else if (wfScheduleType === "monthly") {
        const days = wfScheduleMonthDays.join(", ");
        schedMeta.createEl("span", { text: `\u{1F501} Day ${days || "no days"} of each month at ${wfScheduleTime}` });
      }
    }
    const actions = details.createDiv("auto-oc-card-actions");
    const btnRun = actions.createEl("button", {
      text: workflow.status === "running" ? "\u23F3 Running\u2026" : "\u25B6 Run Workflow",
      cls: "auto-oc-btn-run"
    });
    btnRun.disabled = workflow.status === "running";
    btnRun.onclick = (e) => {
      e.stopPropagation();
      this.plugin.runWorkflow(workflow);
    };
    const btnEdit = actions.createEl("button", {
      text: "\u270F\uFE0F Edit",
      cls: "auto-oc-btn-edit"
    });
    btnEdit.onclick = (e) => {
      e.stopPropagation();
      new CreateWorkflowModal(this.app, this.plugin, workflow).open();
    };
    const btnDuplicate = actions.createEl("button", {
      text: "\u29C9 Duplicate",
      cls: "auto-oc-btn-duplicate"
    });
    btnDuplicate.onclick = async (e) => {
      e.stopPropagation();
      await this.plugin.duplicateWorkflow(workflow);
      this.render();
    };
    const btnDelete = actions.createEl("button", {
      text: "\u{1F5D1}",
      cls: "auto-oc-btn-delete"
    });
    btnDelete.title = "Delete workflow";
    btnDelete.onclick = async (e) => {
      e.stopPropagation();
      if (confirm(`Delete workflow "${workflow.name}"?`)) {
        await this.plugin.deleteWorkflow(workflow.id);
      }
    };
    summary.onclick = () => {
      const isHidden = details.style.display === "none";
      details.style.display = isHidden ? "block" : "none";
      card.classList.toggle("expanded", isHidden);
    };
  }
};
var CreateTaskModal = class extends import_obsidian.Modal {
  constructor(app, plugin, editTask) {
    super(app);
    this.plugin = plugin;
    this.editTask = editTask;
    this.draft = editTask ? { ...editTask } : {
      name: "",
      prompt: "",
      model: plugin.getEffectiveDefaultModel(),
      agent: plugin.getEffectiveAgent(),
      useRalphLoop: false,
      scheduleType: "manual",
      scheduleTime: nowTimeString(),
      scheduleDate: todayString(),
      scheduleDays: [],
      scheduleMonthDays: []
    };
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("auto-oc-modal");
    setAutoOCModalSize(this, 900);
    preventBackdropClose(this);
    const headerBar = contentEl.createDiv("auto-oc-modal-header");
    headerBar.createEl("h3", {
      text: this.editTask ? "Edit Task" : "New OpenCode Task"
    });
    new import_obsidian.Setting(contentEl).setName("Name").setDesc("Short task identifier").addText((text) => {
      var _a;
      text.inputEl.addClass("auto-oc-modal-input");
      text.setValue((_a = this.draft.name) != null ? _a : "").onChange((v) => this.draft.name = v);
      window.setTimeout(() => text.inputEl.focus(), 50);
    });
    new import_obsidian.Setting(contentEl).setName("Prompt / Goal").setDesc("Text to send to OpenCode").addTextArea((ta) => {
      var _a;
      ta.setValue((_a = this.draft.prompt) != null ? _a : "").onChange((v) => this.draft.prompt = v);
      ta.inputEl.addClass("auto-oc-modal-textarea");
      ta.inputEl.rows = 5;
      ta.inputEl.style.width = "100%";
      ta.inputEl.spellcheck = false;
    });
    contentEl.createDiv("auto-oc-modal-section-title").setText("\u{1F4C2} Workspace & Git");
    new import_obsidian.Setting(contentEl).setName("Project Path").setDesc("Absolute path to the project (empty = vault root)").addText((text) => {
      var _a;
      text.inputEl.addClass("auto-oc-modal-input");
      text.setPlaceholder(this.app.vault.adapter.basePath || "C:\\path\\to\\project").setValue((_a = this.draft.workingDirectory) != null ? _a : "").onChange((v) => this.draft.workingDirectory = v);
    });
    let branchInput = null;
    new import_obsidian.Setting(contentEl).setName("Git Branch").setDesc("Branch to work on").addText((text) => {
      var _a;
      branchInput = text.inputEl;
      text.inputEl.addClass("auto-oc-modal-input");
      text.setPlaceholder("main").setValue((_a = this.draft.branch) != null ? _a : "").onChange((v) => this.draft.branch = v);
    }).addButton(
      (btn) => btn.setButtonText("\u{1F50D} Discover").onClick(async () => {
        const taskCwd = this.draft.workingDirectory || this.plugin.settings.workingDirectory || this.app.vault.adapter.basePath || ".";
        new import_obsidian.Notice("AutoOC: Fetching branches...");
        try {
          const branches = listGitBranches(taskCwd);
          if (branches.length > 0) {
            const selected = await new BranchSelectorModal(this.app, branches).open();
            if (selected) {
              this.draft.branch = selected;
              if (branchInput) branchInput.value = selected;
              new import_obsidian.Notice(`AutoOC: Selected branch ${selected}`);
            }
          } else {
            new import_obsidian.Notice("AutoOC: No branches found.");
          }
        } catch (e) {
          new import_obsidian.Notice(`AutoOC: Could not list branches: ${String(e)}`);
        }
      })
    );
    new import_obsidian.Setting(contentEl).setName("Create Branch").setDesc("Automatically create the branch if it doesn't exist").addToggle((tog) => {
      var _a;
      tog.setValue((_a = this.draft.createBranch) != null ? _a : false);
      tog.onChange((v) => this.draft.createBranch = v);
    });
    const agentCwd = this.draft.workingDirectory || this.plugin.settings.workingDirectory || this.app.vault.adapter.basePath || ".";
    const projectAgents = this.plugin.availableAgents.filter((a) => isValidAgentName(a.value));
    new import_obsidian.Setting(contentEl).setName("Agent").setDesc(`AI agent personality to use (${projectAgents.length} loaded). Use Refresh Agents after changing Project Path.`).addDropdown((dd) => {
      var _a;
      projectAgents.forEach((a) => dd.addOption(a.value, a.label));
      const current = (_a = this.draft.agent) != null ? _a : this.plugin.getEffectiveAgent();
      if (!current && projectAgents.length === 0) {
        dd.addOption("", "(no agents; tap refresh)");
      } else if (current && !projectAgents.find((a) => a.value === current)) {
        dd.addOption(current, current);
      }
      dd.setValue(current || "");
      dd.onChange((v) => this.draft.agent = v);
    });
    new import_obsidian.Setting(contentEl).addButton(
      (btn) => btn.setButtonText("\u{1F504} Refresh Agents").onClick(() => {
        this.plugin.refreshAgents(agentCwd);
        new import_obsidian.Notice(`AutoOC: ${this.plugin.availableAgents.length} agents loaded from project/global config.`);
        this.contentEl.empty();
        this.onOpen();
      })
    );
    new import_obsidian.Setting(contentEl).setName("Model").setDesc("AI model to use").addDropdown((dd) => {
      var _a;
      const models = this.plugin.availableModels;
      models.forEach((m) => dd.addOption(m.value, m.label));
      const current = (_a = this.draft.model) != null ? _a : this.plugin.getEffectiveDefaultModel();
      if (!current && models.length === 0) {
        dd.addOption("", "(no models; tap refresh)");
      } else if (current && !models.find((m) => m.value === current)) {
        dd.addOption(current, current);
      }
      dd.setValue(current || "");
      dd.onChange((v) => this.draft.model = v);
    });
    new import_obsidian.Setting(contentEl).addButton(
      (btn) => btn.setButtonText("\u{1F504} Refresh Models").onClick(() => {
        this.plugin.refreshModels();
        new import_obsidian.Notice("AutoOC: models updated. Reopen dialog.");
      })
    );
    new import_obsidian.Setting(contentEl).setName("Ralph Loop").setDesc("Wrap prompt with /ralph-loop to auto-continue until DONE").addToggle((tog) => {
      var _a;
      tog.setValue((_a = this.draft.useRalphLoop) != null ? _a : false);
      tog.onChange((v) => this.draft.useRalphLoop = v);
    }).addButton(
      (btn) => btn.setButtonText("Installation Assistant").onClick(async () => {
        try {
          const result = await this.plugin.ensureRalphLoopPluginEnabled();
          new import_obsidian.Notice(
            result.changed ? `Ralph Loop enabled at ${result.configPath}. Restart OpenCode.` : `Ralph Loop was already active at ${result.configPath}.`
          );
        } catch (e) {
          new import_obsidian.Notice(`AutoOC: error enabling Ralph Loop: ${String(e)}`);
        }
      })
    );
    new import_obsidian.Setting(contentEl).setName("Schedule Type").addDropdown((dd) => {
      var _a;
      dd.addOption("manual", "Manual (run only when I press play)");
      dd.addOption("once", "Once (specific date and time)");
      dd.addOption("daily", "Daily (fixed time)");
      dd.addOption("weekly", "Weekdays");
      dd.addOption("monthly", "Monthly (days of month)");
      dd.setValue((_a = this.draft.scheduleType) != null ? _a : "manual");
      dd.onChange((v) => {
        this.draft.scheduleType = v;
        this.onOpen();
      });
    });
    if (this.draft.scheduleType === "once") {
      new import_obsidian.Setting(contentEl).setName("Date").setDesc("Format YYYY-MM-DD").addText((text) => {
        var _a;
        text.inputEl.addClass("auto-oc-modal-input");
        text.setPlaceholder(todayString()).setValue((_a = this.draft.scheduleDate) != null ? _a : "").onChange((v) => this.draft.scheduleDate = v);
      });
    }
    if (this.draft.scheduleType === "weekly") {
      const daySetting = new import_obsidian.Setting(contentEl).setName("Weekdays");
      daySetting.settingEl.style.flexWrap = "wrap";
      DAY_NAMES.forEach((name, idx) => {
        daySetting.addToggle((tog) => {
          var _a;
          tog.setValue(((_a = this.draft.scheduleDays) != null ? _a : []).includes(idx));
          tog.onChange((checked) => {
            var _a2;
            const days = [...(_a2 = this.draft.scheduleDays) != null ? _a2 : []];
            if (checked) {
              if (!days.includes(idx)) days.push(idx);
            } else {
              const pos = days.indexOf(idx);
              if (pos > -1) days.splice(pos, 1);
            }
            this.draft.scheduleDays = days;
          });
          tog.toggleEl.insertAdjacentHTML(
            "afterend",
            `<span class="auto-oc-day-label">${name}</span>`
          );
        });
      });
    }
    if (this.draft.scheduleType === "monthly") {
      new import_obsidian.Setting(contentEl).setName("Days of month").setDesc("Numbers from 1 to 31 separated by comma, semicolon, or spaces. Example: 1, 15, 31").addText((text) => {
        var _a;
        text.inputEl.addClass("auto-oc-modal-input");
        text.setPlaceholder("1, 15, 31").setValue(((_a = this.draft.scheduleMonthDays) != null ? _a : []).join(", ")).onChange((v) => {
          const parsed = parseMonthDays(v);
          this.draft.scheduleMonthDays = parsed != null ? parsed : [];
        });
      });
    }
    if (this.draft.scheduleType !== "manual") {
      new import_obsidian.Setting(contentEl).setName("Time").setDesc("Format HH:MM (24h)").addText((text) => {
        var _a;
        text.inputEl.addClass("auto-oc-modal-input");
        text.setPlaceholder("09:00").setValue((_a = this.draft.scheduleTime) != null ? _a : "").onChange((v) => this.draft.scheduleTime = v);
      });
    }
    new import_obsidian.Setting(contentEl).addButton(
      (btn) => btn.setButtonText(this.editTask ? "Save Changes" : "Create Task").setCta().onClick(async () => {
        var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l;
        if (!((_a = this.draft.name) == null ? void 0 : _a.trim())) {
          new import_obsidian.Notice("Name is required.");
          return;
        }
        if (!((_b = this.draft.prompt) == null ? void 0 : _b.trim())) {
          new import_obsidian.Notice("Prompt is required.");
          return;
        }
        if (!((_c = this.draft.model) != null ? _c : "").trim()) {
          new import_obsidian.Notice("You must select a model.");
          return;
        }
        if (this.draft.scheduleType !== "manual" && !/^\d{2}:\d{2}$/.test((_d = this.draft.scheduleTime) != null ? _d : "")) {
          new import_obsidian.Notice("Invalid time. Use HH:MM format.");
          return;
        }
        if (this.draft.scheduleType === "once" && !/^\d{4}-\d{2}-\d{2}$/.test((_e = this.draft.scheduleDate) != null ? _e : "")) {
          new import_obsidian.Notice("Invalid date. Use YYYY-MM-DD format.");
          return;
        }
        if (this.draft.scheduleType === "monthly" && ((_f = this.draft.scheduleMonthDays) != null ? _f : []).length === 0) {
          new import_obsidian.Notice("Enter one or more valid days of the month from 1 to 31, separated by comma or semicolon.");
          return;
        }
        if (this.editTask) {
          const idx = this.plugin.settings.tasks.findIndex(
            (t) => t.id === this.editTask.id
          );
          if (idx !== -1) {
            const wasRunning = this.editTask.status === "running";
            this.plugin.settings.tasks[idx] = {
              ...this.editTask,
              ...this.draft,
              status: wasRunning ? "running" : "pending"
            };
          }
        } else {
          const task = {
            id: generateId(),
            name: this.draft.name,
            prompt: this.draft.prompt,
            model: this.draft.model,
            agent: this.plugin.getEffectiveAgent(this.draft.agent),
            useRalphLoop: (_g = this.draft.useRalphLoop) != null ? _g : false,
            scheduleType: (_h = this.draft.scheduleType) != null ? _h : "manual",
            scheduleTime: (_i = this.draft.scheduleTime) != null ? _i : nowTimeString(),
            scheduleDate: (_j = this.draft.scheduleDate) != null ? _j : "",
            scheduleDays: (_k = this.draft.scheduleDays) != null ? _k : [],
            scheduleMonthDays: (_l = this.draft.scheduleMonthDays) != null ? _l : [],
            status: "pending",
            lastRun: "",
            output: "",
            createdAt: (/* @__PURE__ */ new Date()).toISOString(),
            workingDirectory: this.draft.workingDirectory,
            branch: this.draft.branch,
            createBranch: this.draft.createBranch
          };
          this.plugin.settings.tasks.push(task);
        }
        await this.plugin.saveSettings();
        new import_obsidian.Notice(`Task "${this.draft.name}" saved.`);
        this.close();
      })
    );
  }
  onClose() {
    this.contentEl.empty();
  }
};
var CreateWorkflowModal = class extends import_obsidian.Modal {
  constructor(app, plugin, editWorkflow) {
    var _a;
    super(app);
    this.plugin = plugin;
    this.editWorkflow = editWorkflow;
    this.draft = editWorkflow ? { ...editWorkflow } : { name: "", description: "", handoffBranch: false, handoffOutput: true, scheduleType: "manual", scheduleTime: nowTimeString(), scheduleDate: todayString(), scheduleDays: [], scheduleMonthDays: [] };
    this.selectedTaskIds = editWorkflow ? editWorkflow.steps.map((s) => s.taskId) : [];
    this.stepConfigs = {};
    if (editWorkflow) {
      for (const step of editWorkflow.steps) {
        this.stepConfigs[step.taskId] = {
          transitionMode: (_a = step.transitionMode) != null ? _a : step.forceContinue ? "force" : step.evaluatePrompt !== void 0 ? "eval" : "default",
          evaluatePrompt: step.evaluatePrompt,
          forceContinue: step.forceContinue
        };
      }
    }
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("auto-oc-modal");
    setAutoOCModalSize(this, 1100);
    preventBackdropClose(this);
    const headerBar = contentEl.createDiv("auto-oc-modal-header");
    headerBar.createEl("h3", {
      text: this.editWorkflow ? "Edit Workflow" : "New Workflow"
    });
    const guide = contentEl.createDiv("auto-oc-workflow-guide");
    guide.createEl("h4", { text: "How workflows work" });
    const guideList = guide.createEl("ol");
    guideList.createEl("li", { text: "A workflow has its own schedule. When it runs, it executes the selected tasks in order." });
    guideList.createEl("li", { text: "Task schedules are ignored inside a workflow. A task can be reused even if its own schedule is manual, once, daily, weekly, monthly, completed, or pending." });
    guideList.createEl("li", { text: "Each transition controls what happens after a step finishes: continue on success, force continue, or ask AI to decide." });
    guideList.createEl("li", { text: "AI decides sends the previous task output plus your transition prompt to OpenCode. It must answer YES to continue; any NO/unclear answer stops the workflow." });
    guide.createEl("p", {
      text: "Tip: configure the transition on the step that just finished, not on the next step. Example: Step 1 -> Step 2 means Step 1 decides whether Step 2 starts.",
      cls: "auto-oc-workflow-guide-tip"
    });
    new import_obsidian.Setting(contentEl).setName("Name").setDesc("Workflow identifier").addText((text) => {
      var _a;
      text.inputEl.addClass("auto-oc-modal-input");
      text.setValue((_a = this.draft.name) != null ? _a : "").onChange((v) => this.draft.name = v);
      window.setTimeout(() => text.inputEl.focus(), 50);
    });
    new import_obsidian.Setting(contentEl).setName("Description").setDesc("Optional description").addText((text) => {
      var _a;
      text.inputEl.addClass("auto-oc-modal-input");
      text.setValue((_a = this.draft.description) != null ? _a : "").onChange((v) => this.draft.description = v);
    });
    contentEl.createDiv("auto-oc-modal-section-title").setText("\u{1F504} Handoff between steps");
    contentEl.createEl("p", {
      text: "Handoff passes context from the task that just finished to the next task at runtime only. It does not edit the original task prompt.",
      cls: "setting-item-description auto-oc-workflow-section-help"
    });
    new import_obsidian.Setting(contentEl).setName("Pass Git Branch").setDesc("The next task checks out the same branch used by the previous task. Useful when one step creates/edits code and the next step reviews or tests it.").addToggle((tog) => {
      var _a;
      tog.setValue((_a = this.draft.handoffBranch) != null ? _a : false);
      tog.onChange((v) => this.draft.handoffBranch = v);
    });
    new import_obsidian.Setting(contentEl).setName("Pass Output Context").setDesc("The previous task output is appended to the next task prompt only for that workflow run. The saved task is not modified.").addToggle((tog) => {
      var _a;
      tog.setValue((_a = this.draft.handoffOutput) != null ? _a : false);
      tog.onChange((v) => this.draft.handoffOutput = v);
    });
    contentEl.createDiv("auto-oc-modal-section-title").setText("\u23F0 Schedule");
    contentEl.createEl("p", {
      text: "This schedule belongs to the workflow itself. The individual task schedules are not used while the workflow is running.",
      cls: "setting-item-description auto-oc-workflow-section-help"
    });
    new import_obsidian.Setting(contentEl).setName("Schedule Type").addDropdown((dd) => {
      var _a;
      dd.addOption("manual", "Manual (run only when I press play)");
      dd.addOption("once", "Once (specific date and time)");
      dd.addOption("daily", "Daily (fixed time)");
      dd.addOption("weekly", "Weekdays");
      dd.addOption("monthly", "Monthly (days of month)");
      dd.setValue((_a = this.draft.scheduleType) != null ? _a : "manual");
      dd.onChange((v) => {
        this.draft.scheduleType = v;
        this.onOpen();
      });
    });
    if (this.draft.scheduleType === "once") {
      new import_obsidian.Setting(contentEl).setName("Date").setDesc("Format YYYY-MM-DD").addText((text) => {
        var _a;
        text.inputEl.addClass("auto-oc-modal-input");
        text.setPlaceholder(todayString()).setValue((_a = this.draft.scheduleDate) != null ? _a : "").onChange((v) => this.draft.scheduleDate = v);
      });
    }
    if (this.draft.scheduleType === "weekly") {
      const daySetting = new import_obsidian.Setting(contentEl).setName("Weekdays");
      daySetting.settingEl.style.flexWrap = "wrap";
      DAY_NAMES.forEach((name, idx) => {
        daySetting.addToggle((tog) => {
          var _a;
          tog.setValue(((_a = this.draft.scheduleDays) != null ? _a : []).includes(idx));
          tog.onChange((checked) => {
            var _a2;
            const days = [...(_a2 = this.draft.scheduleDays) != null ? _a2 : []];
            if (checked) {
              if (!days.includes(idx)) days.push(idx);
            } else {
              const pos = days.indexOf(idx);
              if (pos > -1) days.splice(pos, 1);
            }
            this.draft.scheduleDays = days;
          });
          tog.toggleEl.insertAdjacentHTML(
            "afterend",
            `<span class="auto-oc-day-label">${name}</span>`
          );
        });
      });
    }
    if (this.draft.scheduleType === "monthly") {
      new import_obsidian.Setting(contentEl).setName("Days of month").setDesc("Numbers from 1 to 31 separated by comma, semicolon, or spaces. Example: 1, 15, 31").addText((text) => {
        var _a;
        text.inputEl.addClass("auto-oc-modal-input");
        text.setPlaceholder("1, 15, 31").setValue(((_a = this.draft.scheduleMonthDays) != null ? _a : []).join(", ")).onChange((v) => {
          const parsed = parseMonthDays(v);
          this.draft.scheduleMonthDays = parsed != null ? parsed : [];
        });
      });
    }
    if (this.draft.scheduleType !== "manual") {
      new import_obsidian.Setting(contentEl).setName("Time").setDesc("Format HH:MM (24h)").addText((text) => {
        var _a;
        text.inputEl.addClass("auto-oc-modal-input");
        text.setPlaceholder("09:00").setValue((_a = this.draft.scheduleTime) != null ? _a : "").onChange((v) => this.draft.scheduleTime = v);
      });
    }
    contentEl.createDiv("auto-oc-modal-section-title").setText("\u{1F4CB} Steps \u2014 Chain your tasks");
    contentEl.createEl("p", {
      text: "Add tasks in execution order. For every pair of steps, choose the transition rule that decides whether the next task starts.",
      cls: "setting-item-description auto-oc-workflow-section-help"
    });
    const stepsContainer = contentEl.createDiv("auto-oc-workflow-steps-container");
    this.renderStepsList(stepsContainer);
    new import_obsidian.Setting(contentEl).addButton(
      (btn) => btn.setButtonText(this.editWorkflow ? "Save Changes" : "Create Workflow").setCta().onClick(async () => {
        var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r, _s;
        if (!((_a = this.draft.name) == null ? void 0 : _a.trim())) {
          new import_obsidian.Notice("Name is required.");
          return;
        }
        if (this.selectedTaskIds.length < 2) {
          new import_obsidian.Notice("A workflow needs at least 2 tasks.");
          return;
        }
        if (this.draft.scheduleType !== "manual" && !/^\d{2}:\d{2}$/.test((_b = this.draft.scheduleTime) != null ? _b : "")) {
          new import_obsidian.Notice("Invalid time. Use HH:MM format.");
          return;
        }
        if (this.draft.scheduleType === "once" && !/^\d{4}-\d{2}-\d{2}$/.test((_c = this.draft.scheduleDate) != null ? _c : "")) {
          new import_obsidian.Notice("Invalid date. Use YYYY-MM-DD format.");
          return;
        }
        if (this.draft.scheduleType === "monthly" && ((_d = this.draft.scheduleMonthDays) != null ? _d : []).length === 0) {
          new import_obsidian.Notice("Enter one or more valid days of the month from 1 to 31, separated by comma or semicolon.");
          return;
        }
        const steps = this.selectedTaskIds.map((tid) => {
          var _a2, _b2, _c2;
          return {
            taskId: tid,
            transitionMode: ((_a2 = this.stepConfigs[tid]) == null ? void 0 : _a2.transitionMode) || "default",
            evaluatePrompt: ((_b2 = this.stepConfigs[tid]) == null ? void 0 : _b2.evaluatePrompt) || void 0,
            forceContinue: ((_c2 = this.stepConfigs[tid]) == null ? void 0 : _c2.forceContinue) || void 0
          };
        });
        if (this.editWorkflow) {
          const idx = this.plugin.settings.workflows.findIndex(
            (w) => w.id === this.editWorkflow.id
          );
          if (idx !== -1) {
            const wasRunning = this.editWorkflow.status === "running";
            this.plugin.settings.workflows[idx] = {
              ...this.editWorkflow,
              name: this.draft.name,
              description: this.draft.description,
              steps,
              handoffBranch: (_e = this.draft.handoffBranch) != null ? _e : false,
              handoffOutput: (_f = this.draft.handoffOutput) != null ? _f : false,
              status: wasRunning ? "running" : "pending",
              scheduleType: (_g = this.draft.scheduleType) != null ? _g : "manual",
              scheduleTime: (_h = this.draft.scheduleTime) != null ? _h : nowTimeString(),
              scheduleDate: (_i = this.draft.scheduleDate) != null ? _i : "",
              scheduleDays: (_j = this.draft.scheduleDays) != null ? _j : [],
              scheduleMonthDays: (_k = this.draft.scheduleMonthDays) != null ? _k : []
            };
          }
        } else {
          const workflow = {
            id: generateId(),
            name: this.draft.name,
            description: (_l = this.draft.description) != null ? _l : "",
            steps,
            status: "pending",
            currentStep: -1,
            createdAt: (/* @__PURE__ */ new Date()).toISOString(),
            handoffBranch: (_m = this.draft.handoffBranch) != null ? _m : false,
            handoffOutput: (_n = this.draft.handoffOutput) != null ? _n : false,
            scheduleType: (_o = this.draft.scheduleType) != null ? _o : "manual",
            scheduleTime: (_p = this.draft.scheduleTime) != null ? _p : nowTimeString(),
            scheduleDate: (_q = this.draft.scheduleDate) != null ? _q : todayString(),
            scheduleDays: (_r = this.draft.scheduleDays) != null ? _r : [],
            scheduleMonthDays: (_s = this.draft.scheduleMonthDays) != null ? _s : []
          };
          this.plugin.settings.workflows.push(workflow);
        }
        await this.plugin.saveSettings();
        new import_obsidian.Notice(`Workflow "${this.draft.name}" saved.`);
        this.close();
      })
    );
  }
  renderStepsList(container) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j;
    container.empty();
    if (this.selectedTaskIds.length === 0) {
      container.createEl("p", {
        text: "No steps added yet. Use 'Add Task to Chain' below.",
        cls: "auto-oc-empty"
      });
    }
    for (let i = 0; i < this.selectedTaskIds.length; i++) {
      const taskId = this.selectedTaskIds[i];
      const task = this.plugin.settings.tasks.find((t) => t.id === taskId);
      const config = this.stepConfigs[taskId] || {};
      const stepEl = container.createDiv("auto-oc-workflow-step-item");
      const isLast = i === this.selectedTaskIds.length - 1;
      const header = stepEl.createDiv("auto-oc-workflow-step-header");
      header.createEl("span", {
        text: `Step ${i + 1}`,
        cls: "auto-oc-workflow-step-num"
      });
      header.createEl("span", {
        text: task ? `\u{1F4CC} ${task.name}` : "\u274C Deleted task",
        cls: task ? "" : "auto-oc-workflow-step-err"
      });
      if (!isLast) {
        header.createEl("span", { text: "\u2192", cls: "auto-oc-workflow-step-arrow" });
        header.createEl("span", {
          text: `Step ${i + 2}`,
          cls: "auto-oc-workflow-step-num"
        });
        const nextTask = this.plugin.settings.tasks.find(
          (t) => t.id === this.selectedTaskIds[i + 1]
        );
        if (nextTask) {
          header.createEl("span", { text: `\u{1F4CC} ${nextTask.name}` });
        }
      }
      const btnRemove = header.createEl("button", {
        text: "\u2716",
        cls: "auto-oc-btn-delete-small"
      });
      btnRemove.style.marginLeft = "auto";
      btnRemove.onclick = () => {
        this.selectedTaskIds.splice(i, 1);
        delete this.stepConfigs[taskId];
        this.renderStepsList(container);
      };
      if (!isLast) {
        const transConfig = stepEl.createDiv("auto-oc-workflow-transition");
        const nextTask = this.plugin.settings.tasks.find((t) => t.id === this.selectedTaskIds[i + 1]);
        const transitionHeader = transConfig.createDiv("auto-oc-workflow-transition-header");
        transitionHeader.createSpan({
          text: `Transition: Step ${i + 1} \u2192 Step ${i + 2}`,
          cls: "auto-oc-workflow-transition-title"
        });
        transitionHeader.createSpan({
          text: `After \xAB${(_a = task == null ? void 0 : task.name) != null ? _a : "current task"}\xBB finishes, decide whether \xAB${(_b = nextTask == null ? void 0 : nextTask.name) != null ? _b : "next task"}\xBB starts.`,
          cls: "auto-oc-workflow-transition-help"
        });
        const modeDiv = transConfig.createDiv("auto-oc-workflow-mode");
        modeDiv.createSpan({
          text: "Decision mode:",
          cls: "auto-oc-workflow-label"
        });
        const modeSel = modeDiv.createEl("select", { cls: "auto-oc-status-select" });
        modeSel.style.marginLeft = "6px";
        const modes = [
          { val: "default", label: "Default \u2014 continue only if this step succeeds", desc: "Starts the next task only when the current task exits successfully." },
          { val: "force", label: "Force \u2014 always start next step", desc: "Starts the next task even if the current task fails." },
          { val: "eval", label: "AI decides \u2014 evaluate output", desc: "Runs your transition prompt against this step output. YES starts the next task; NO stops the workflow." }
        ];
        const defaultEvalPrompt = "Did the previous task complete successfully? Check the output for errors, failures, or unfinished work. If it is safe to continue, reply YES. Otherwise reply NO.";
        const currentMode = (_d = config.transitionMode) != null ? _d : ((_c = config.forceContinue) != null ? _c : false) ? "force" : config.evaluatePrompt !== void 0 ? "eval" : "default";
        for (const m of modes) {
          modeSel.createEl("option", { text: m.label }).value = m.val;
        }
        modeSel.value = currentMode;
        const modeDesc = modeDiv.createSpan({
          text: (_f = (_e = modes.find((m) => m.val === currentMode)) == null ? void 0 : _e.desc) != null ? _f : "",
          cls: "auto-oc-workflow-mode-desc"
        });
        modeSel.onchange = () => {
          var _a2;
          this.stepConfigs[taskId] = this.stepConfigs[taskId] || {};
          if (modeSel.value === "force") {
            this.stepConfigs[taskId].transitionMode = "force";
            this.stepConfigs[taskId].forceContinue = true;
            this.stepConfigs[taskId].evaluatePrompt = void 0;
          } else if (modeSel.value === "eval") {
            this.stepConfigs[taskId].transitionMode = "eval";
            this.stepConfigs[taskId].forceContinue = void 0;
            this.stepConfigs[taskId].evaluatePrompt = (_a2 = this.stepConfigs[taskId].evaluatePrompt) != null ? _a2 : defaultEvalPrompt;
          } else {
            this.stepConfigs[taskId].transitionMode = "default";
            this.stepConfigs[taskId].forceContinue = void 0;
            this.stepConfigs[taskId].evaluatePrompt = void 0;
          }
          this.renderStepsList(container);
        };
        if (currentMode === "eval") {
          const evalDiv = transConfig.createDiv("auto-oc-workflow-eval");
          const promptBox = evalDiv.createDiv("auto-oc-workflow-ai-prompt-box");
          promptBox.createSpan({
            text: `AI decides prompt: Step ${i + 1} \u2192 Step ${i + 2}`,
            cls: "auto-oc-workflow-ai-prompt-title"
          });
          promptBox.createSpan({
            text: `Write the condition here. OpenCode will receive this text plus the output of \xAB${(_g = task == null ? void 0 : task.name) != null ? _g : "current task"}\xBB. It must answer YES to start \xAB${(_h = nextTask == null ? void 0 : nextTask.name) != null ? _h : "next task"}\xBB.`,
            cls: "auto-oc-workflow-ai-prompt-help"
          });
          const evalTextarea = promptBox.createEl("textarea", {
            cls: "auto-oc-modal-textarea auto-oc-workflow-ai-textarea"
          });
          evalTextarea.rows = 4;
          evalTextarea.value = (_i = config.evaluatePrompt) != null ? _i : defaultEvalPrompt;
          evalTextarea.placeholder = "Example: Did the previous task complete successfully? Reply YES or NO.";
          const infoBox = evalDiv.createDiv("auto-oc-workflow-eval-info");
          infoBox.createSpan({
            text: `Evaluation contract: YES = continue to next step. NO or anything unclear = stop. The answer is saved in the previous task log as a workflow evaluation note.`
          });
          const presetsDiv = evalDiv.createDiv("auto-oc-workflow-presets");
          presetsDiv.createSpan({
            text: "Quick presets:",
            cls: "auto-oc-workflow-label"
          });
          const presets = [
            { label: "\xBFErrores?", prompt: "Did the previous task complete without errors or failures? Look for error messages, stack traces, or exit codes in the output. If no errors were found, reply YES. If there were errors, reply NO." },
            { label: "\xBFTests OK?", prompt: "Were all tests executed successfully? Check the output for test failures, assertion errors, or test suite crashes. If all tests passed, reply YES. If any test failed, reply NO." },
            { label: "\xBFBuild OK?", prompt: "Was the build successful? Check for compilation errors, linker errors, or build failures. If the build completed without errors, reply YES. Otherwise reply NO." },
            { label: "\xBFQueda trabajo?", prompt: "Based on the output, is there remaining work that requires a follow-up step? Look for TODO comments, unfinished tasks, or incomplete implementations. If more work is needed, reply YES. If the task is fully complete, reply NO." },
            { label: "Custom", prompt: "" }
          ];
          for (const p of presets) {
            const btn = presetsDiv.createEl("button", {
              text: p.label,
              cls: "auto-oc-btn-secondary"
            });
            btn.style.fontSize = "0.7rem";
            btn.style.padding = "2px 6px";
            btn.onclick = () => {
              var _a2;
              if (p.prompt) {
                evalTextarea.value = p.prompt;
                this.stepConfigs[taskId] = this.stepConfigs[taskId] || {};
                this.stepConfigs[taskId].evaluatePrompt = p.prompt;
                previewCode.textContent = `${p.prompt}

Previous task output:
---
[output of \xAB${(_a2 = task == null ? void 0 : task.name) != null ? _a2 : "?"}\xBB appears here]
---

Reply ONLY with YES or NO.`;
              }
            };
            if (config.evaluatePrompt === p.prompt && p.prompt) {
              btn.style.borderColor = "var(--interactive-accent)";
              btn.style.color = "var(--interactive-accent)";
            }
          }
          const previewDiv = evalDiv.createDiv("auto-oc-workflow-eval-preview");
          previewDiv.createSpan({
            text: "What will be sent to OpenCode:",
            cls: "auto-oc-workflow-label"
          });
          const previewCode = previewDiv.createEl("pre", {
            cls: "auto-oc-workflow-eval-preview-code"
          });
          const currentEvalText = config.evaluatePrompt || "(your prompt)";
          previewCode.textContent = `${currentEvalText}

Previous task output:
---
[output of \xAB${(_j = task == null ? void 0 : task.name) != null ? _j : "?"}\xBB appears here]
---

Reply ONLY with YES or NO.`;
          evalTextarea.oninput = () => {
            var _a2;
            this.stepConfigs[taskId] = this.stepConfigs[taskId] || {};
            this.stepConfigs[taskId].evaluatePrompt = evalTextarea.value;
            previewCode.textContent = `${evalTextarea.value || "(your prompt)"}

Previous task output:
---
[output of \xAB${(_a2 = task == null ? void 0 : task.name) != null ? _a2 : "?"}\xBB appears here]
---

Reply ONLY with YES or NO.`;
          };
        }
      }
      if (!isLast) {
        stepEl.createDiv("auto-oc-workflow-connector");
      }
    }
    const addDiv = container.createDiv("auto-oc-workflow-add-step");
    const tasks = this.plugin.settings.tasks.filter(
      (t) => !this.selectedTaskIds.includes(t.id)
    );
    const btnCreateTask = addDiv.createEl("button", {
      text: "\u2795 Create New Task",
      cls: "auto-oc-btn-secondary"
    });
    btnCreateTask.title = "Create a fresh task and auto-add it to this chain";
    btnCreateTask.onclick = async () => {
      const prevCount = this.plugin.settings.tasks.length;
      const prevIds = new Set(this.plugin.settings.tasks.map((t) => t.id));
      const taskModal = new CreateTaskModal(this.app, this.plugin);
      const origClose = taskModal.close.bind(taskModal);
      taskModal.close = () => {
        origClose();
        setTimeout(() => {
          const newTasks = this.plugin.settings.tasks.filter(
            (t) => !prevIds.has(t.id) && !this.selectedTaskIds.includes(t.id)
          );
          if (newTasks.length > 0) {
            const newest = newTasks[newTasks.length - 1];
            this.selectedTaskIds.push(newest.id);
            new import_obsidian.Notice(`AutoOC: Task "${newest.name}" added to workflow chain.`);
          }
          this.renderStepsList(container);
        }, 200);
      };
      taskModal.open();
    };
    if (tasks.length === 0) {
      addDiv.createEl("span", {
        text: "All existing tasks are already in the chain.",
        cls: "setting-item-description"
      });
    }
    if (tasks.length > 0) {
      const sel = addDiv.createEl("select", { cls: "auto-oc-status-select" });
      sel.createEl("option", { text: "-- Add existing task --" }).value = "";
      for (const t of tasks) {
        sel.createEl("option", { text: t.name }).value = t.id;
      }
      const addBtn = addDiv.createEl("button", {
        text: "Add",
        cls: "auto-oc-btn-secondary"
      });
      addBtn.style.marginLeft = "4px";
      addBtn.onclick = () => {
        if (sel.value) {
          this.selectedTaskIds.push(sel.value);
          this.renderStepsList(container);
        }
      };
    }
  }
  onClose() {
    this.contentEl.empty();
  }
};
var LiveLogModal = class extends import_obsidian.Modal {
  constructor(app, task, plugin) {
    super(app);
    this.renderEl = null;
    this.statusEl = null;
    this.intervalId = null;
    this.elapsedIntervalId = null;
    this.autoScroll = true;
    this.lastRenderedContent = "";
    this.task = task;
    this.plugin = plugin;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.addClass("auto-oc-output-modal");
    setupModalX(this);
    const header = contentEl.createDiv("auto-oc-log-header");
    header.createEl("h3", { text: `\u{1F4C4} Log: ${this.task.name}` });
    this.statusEl = header.createEl("p", { cls: "auto-oc-log-status" });
    const elapsedEl = header.createEl("p", { cls: "auto-oc-log-elapsed" });
    const updateElapsed = () => {
      if (!this.task.lastRun) {
        elapsedEl.textContent = "";
        return;
      }
      const secs = Math.floor((Date.now() - new Date(this.task.lastRun).getTime()) / 1e3);
      const min = Math.floor(secs / 60);
      const sec = secs % 60;
      elapsedEl.textContent = `\u23F1 Elapsed time: ${min}m ${sec}s`;
    };
    updateElapsed();
    this.elapsedIntervalId = window.setInterval(updateElapsed, 1e3);
    const toolbar = contentEl.createDiv("auto-oc-log-toolbar");
    const btnScroll = toolbar.createEl("button", {
      text: "\u2193 Auto-scroll: ON",
      cls: "auto-oc-btn-secondary"
    });
    btnScroll.onclick = () => {
      this.autoScroll = !this.autoScroll;
      btnScroll.textContent = `\u2193 Auto-scroll: ${this.autoScroll ? "ON" : "OFF"}`;
    };
    const btnCopy = toolbar.createEl("button", {
      text: "\u{1F4CB} Copy",
      cls: "auto-oc-btn-secondary"
    });
    btnCopy.onclick = () => {
      navigator.clipboard.writeText(this.lastRenderedContent);
      new import_obsidian.Notice("Log copied.");
    };
    const btnClear = toolbar.createEl("button", {
      text: "\u{1F5D1} Clear View",
      cls: "auto-oc-btn-secondary"
    });
    btnClear.onclick = () => {
      if (this.renderEl) this.renderEl.empty();
      this.lastRenderedContent = "";
    };
    this.renderEl = contentEl.createDiv("auto-oc-log-rendered markdown-rendered");
    this.refresh();
    this.intervalId = window.setInterval(() => this.refresh(), 1e3);
  }
  refresh() {
    const latest = this.plugin.settings.tasks.find((t) => t.id === this.task.id);
    if (!latest) return;
    this.task = latest;
    if (this.statusEl) {
      const isRunning = latest.status === "running";
      this.statusEl.textContent = `Estado: ${latest.status}` + (latest.lastRun ? `  |  Inicio: ${formatDateTime(latest.lastRun)}` : "") + (isRunning ? "  \u23F3" : "");
      this.statusEl.className = "auto-oc-log-status auto-oc-badge-" + latest.status;
    }
    if (this.renderEl) {
      const newContent = latest.output || "(sin output a\xFAn\u2026)";
      if (this.lastRenderedContent !== newContent) {
        this.lastRenderedContent = newContent;
        this.renderEl.empty();
        void import_obsidian.MarkdownRenderer.render(this.app, newContent, this.renderEl, "", this.plugin);
        if (this.autoScroll) {
          this.renderEl.scrollTop = this.renderEl.scrollHeight;
        }
      }
    }
    if (latest.status !== "running" && this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
  onClose() {
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.elapsedIntervalId !== null) {
      window.clearInterval(this.elapsedIntervalId);
      this.elapsedIntervalId = null;
    }
    this.contentEl.empty();
  }
};
var LogHistoryModal = class extends import_obsidian.Modal {
  constructor(app, task, plugin) {
    super(app);
    this.task = task;
    this.plugin = plugin;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.addClass("auto-oc-output-modal");
    setupModalX(this);
    const header = contentEl.createDiv("auto-oc-log-header");
    header.createEl("h3", { text: `\u{1F4DC} Log History: ${this.task.name}` });
    const vaultBasePath = this.app.vault.adapter.basePath || ".";
    const history = getLogHistory(vaultBasePath, this.task.id);
    if (history.length === 0) {
      contentEl.createEl("p", {
        text: "No historical logs found for this task.",
        cls: "auto-oc-empty"
      });
      return;
    }
    const toolbar = header.createDiv("auto-oc-log-toolbar");
    toolbar.createEl("span", {
      text: `${history.length} execution(s)`,
      cls: "setting-item-description"
    });
    const btnClearAll = toolbar.createEl("button", {
      text: "\u{1F9F9} Clear All",
      cls: "auto-oc-btn-secondary"
    });
    btnClearAll.onclick = async () => {
      if (confirm(`Delete ALL ${history.length} logs for "${this.task.name}"?`)) {
        clearTaskLogs(vaultBasePath, this.task.id);
        this.close();
        new import_obsidian.Notice("All logs cleared.");
      }
    };
    const list = contentEl.createDiv("auto-oc-log-history-list");
    for (const entry of history) {
      const item = list.createDiv("auto-oc-log-history-item");
      const label = item.createSpan({ text: `\u{1F550} ${entry.timestamp}`, cls: "auto-oc-log-history-timestamp" });
      label.onclick = () => {
        const content = readLogFile(entry.file);
        const previewModal = new LogPreviewModal(this.app, this.task.name, entry.timestamp, content, this.plugin);
        previewModal.open();
      };
      const btnDelete = item.createEl("button", {
        text: "\u{1F5D1}",
        cls: "auto-oc-btn-delete-small"
      });
      btnDelete.title = "Delete this log";
      btnDelete.onclick = async (e) => {
        e.stopPropagation();
        if (confirm(`Delete log from ${entry.timestamp}?`)) {
          deleteSingleLogFile(entry.file);
          this.close();
          this.open();
        }
      };
    }
  }
  onClose() {
    this.contentEl.empty();
  }
};
var LogPreviewModal = class extends import_obsidian.Modal {
  constructor(app, taskName, timestamp, content, plugin) {
    super(app);
    this.taskName = taskName;
    this.timestamp = timestamp;
    this.content = content;
    this.plugin = plugin;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.addClass("auto-oc-output-modal");
    setupModalX(this);
    const header = contentEl.createDiv("auto-oc-log-header");
    header.createEl("h3", { text: `\u{1F4C4} Log: ${this.taskName}` });
    header.createEl("p", { text: `Execution: ${this.timestamp}`, cls: "auto-oc-log-status" });
    const toolbar = contentEl.createDiv("auto-oc-log-toolbar");
    const btnCopy = toolbar.createEl("button", {
      text: "\u{1F4CB} Copy",
      cls: "auto-oc-btn-secondary"
    });
    btnCopy.onclick = () => {
      navigator.clipboard.writeText(this.content);
      new import_obsidian.Notice("Log copied.");
    };
    const btnClose = toolbar.createEl("button", {
      text: "\u2716 Close",
      cls: "auto-oc-btn-secondary"
    });
    btnClose.onclick = () => this.close();
    const renderEl = contentEl.createDiv("auto-oc-log-rendered markdown-rendered");
    void import_obsidian.MarkdownRenderer.render(this.app, this.content, renderEl, "", this.plugin);
    renderEl.scrollTop = renderEl.scrollHeight;
  }
  onClose() {
    this.contentEl.empty();
  }
};
var BranchSelectorModal = class extends import_obsidian.Modal {
  constructor(app, branches) {
    super(app);
    this.selectedBranch = null;
    this.resolveSelection = null;
    this.branches = branches;
  }
  async open() {
    return new Promise((resolve) => {
      this.resolveSelection = resolve;
      super.open();
    });
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h3", { text: "Select Git Branch" });
    const list = contentEl.createDiv("branch-selector-list");
    list.style.maxHeight = "400px";
    list.style.overflowY = "auto";
    this.branches.forEach((branch) => {
      const item = list.createEl("div", { text: branch, cls: "branch-selector-item" });
      item.style.cursor = "pointer";
      item.style.padding = "4px 8px";
      item.onclick = () => {
        this.selectedBranch = branch;
        this.close();
      };
    });
  }
  onClose() {
    var _a;
    this.contentEl.empty();
    (_a = this.resolveSelection) == null ? void 0 : _a.call(this, this.selectedBranch);
    this.resolveSelection = null;
  }
};
var CommandPreviewModal = class extends import_obsidian.Modal {
  constructor(app, taskName, cmd) {
    super(app);
    this.taskName = taskName;
    this.cmd = cmd;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h3", { text: `Command: ${this.taskName}` });
    contentEl.createEl("p", {
      text: "This is the CLI command that will be executed:",
      cls: "setting-item-description"
    });
    const pre = contentEl.createEl("pre", { cls: "auto-oc-output-pre" });
    pre.textContent = this.cmd;
    new import_obsidian.Setting(contentEl).addButton(
      (btn) => btn.setButtonText("Copy").onClick(() => {
        navigator.clipboard.writeText(this.cmd);
        new import_obsidian.Notice("Command copied.");
      })
    );
  }
  onClose() {
    this.contentEl.empty();
  }
};
var OpenCodeCliModal = class extends import_obsidian.Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.addClass("auto-oc-cli-modal");
    setupModalX(this);
    contentEl.createEl("h3", { text: "OpenCode CLI Launcher" });
    contentEl.createEl("p", {
      text: "Choose where to open the OpenCode terminal.",
      cls: "setting-item-description"
    });
    const vaultCwd = this.app.vault.adapter.basePath || ".";
    const defaultCwd = this.plugin.settings.workingDirectory || vaultCwd;
    const buttons = contentEl.createDiv("auto-oc-cli-modal-buttons");
    const btnDefault = buttons.createEl("button", {
      text: "\u{1F4C2} Open in project / vault",
      cls: "auto-oc-btn-primary"
    });
    btnDefault.onclick = () => this.launch(defaultCwd);
    contentEl.createEl("p", {
      text: defaultCwd,
      cls: "setting-item-description auto-oc-cli-path"
    });
    const btnChoose = buttons.createEl("button", {
      text: "\u{1F5C0} Choose folder\u2026",
      cls: "auto-oc-btn-secondary"
    });
    btnChoose.onclick = async () => {
      const chosen = await this.chooseFolder();
      if (chosen) this.launch(chosen);
    };
    const btnCancel = buttons.createEl("button", {
      text: "Cancel",
      cls: "auto-oc-btn-secondary"
    });
    btnCancel.onclick = () => this.close();
  }
  launch(cwd) {
    try {
      const bin = resolveOpencodeBin(this.plugin.settings.opencodePath);
      openOpencodeCli(bin, cwd);
      new import_obsidian.Notice(`AutoCO: opened OpenCode CLI in ${cwd}`);
      this.close();
    } catch (e) {
      new import_obsidian.Notice(`AutoOC: could not open OpenCode CLI: ${String(e)}`);
    }
  }
  async chooseFolder() {
    try {
      const electron = window.require("electron");
      const result = await electron.remote.dialog.showOpenDialog({
        properties: ["openDirectory"],
        title: "Select folder for OpenCode CLI"
      });
      if (!result.canceled && result.filePaths.length > 0) {
        return result.filePaths[0];
      }
    } catch (e) {
      new import_obsidian.Notice(`AutoOC: folder picker failed \u2014 ${String(e)}`);
    }
    return null;
  }
  onClose() {
    this.contentEl.empty();
  }
};
var DiagnosticModal = class extends import_obsidian.Modal {
  constructor(app, plugin) {
    super(app);
    this.logEl = null;
    this.plugin = plugin;
  }
  onOpen() {
    const { contentEl } = this;
    setupModalX(this);
    contentEl.createEl("h3", { text: "\u{1F527} AutoOC Diagnostic" });
    contentEl.createEl("p", {
      text: "Test the opencode command directly from Obsidian.",
      cls: "setting-item-description"
    });
    const bin = resolveOpencodeBin(this.plugin.settings.opencodePath);
    contentEl.createEl("p", { text: `Detected binary: ${bin}`, cls: "setting-item-description" });
    contentEl.createEl("p", { text: `Default model: ${this.plugin.getEffectiveDefaultModel() || "(not configured)"}`, cls: "setting-item-description" });
    new import_obsidian.Setting(contentEl).addButton(
      (btn) => btn.setButtonText("\u25B6 Launch test: 'di hola'").setCta().onClick(() => {
        if (this.logEl) this.logEl.textContent = "[launching detached PowerShell process\u2026]\n";
        const bin2 = resolveOpencodeBin(this.plugin.settings.opencodePath);
        const model = this.plugin.getEffectiveDefaultModel();
        if (!model) {
          new import_obsidian.Notice("AutoOC: no model selected. Reload models in Settings.");
          return;
        }
        const fs2 = require("fs");
        const path2 = require("path");
        const osTmp = require("os").tmpdir();
        const outFile = path2.join(osTmp, "autooc-diag.txt");
        try {
          fs2.unlinkSync(outFile);
        } catch (e) {
        }
        const psScript = [
          ...psUtf8Prelude(),
          `$env:USERPROFILE = '${process.env.USERPROFILE}'`,
          `$env:APPDATA     = '${process.env.APPDATA}'`,
          `$env:LOCALAPPDATA= '${process.env.LOCALAPPDATA}'`,
          `$env:PATH        = '${process.env.PATH}'`,
          `$env:HOME        = '${process.env.USERPROFILE}'`,
          `$outTmp = [System.IO.Path]::GetTempFileName()`,
          `$errTmp = [System.IO.Path]::GetTempFileName()`,
          `$bin = ${psSingleQuoted(bin2)}`,
          `$argList = @('run','-m',${psSingleQuoted(model)},'--dangerously-skip-permissions','--','di hola')`,
          `& $bin @argList > $outTmp 2> $errTmp`,
          `$exitCode = if ($null -ne $LASTEXITCODE) { $LASTEXITCODE } else { 0 }`,
          `$out = (Get-Content $outTmp -Raw -Encoding UTF8 -ErrorAction SilentlyContinue).Trim()`,
          `Remove-Item $outTmp,$errTmp -ErrorAction SilentlyContinue`,
          `[System.IO.File]::WriteAllText('${outFile.replace(/'/g, "''")}', $out + "
DONE:" + $exitCode)`
        ].join("\n");
        const psFile = path2.join(osTmp, "autooc-diag.ps1");
        writeUtf8BomFile(psFile, psScript);
        if (this.logEl) this.logEl.textContent += `Script: ${psFile}

`;
        launchHiddenPS(psFile);
        const poll = setInterval(() => {
          if (!fs2.existsSync(outFile)) {
            if (this.logEl) this.logEl.textContent += ".";
            return;
          }
          clearInterval(poll);
          const raw = fs2.readFileSync(outFile, "utf8");
          try {
            fs2.unlinkSync(outFile);
            fs2.unlinkSync(psFile);
          } catch (e) {
          }
          const doneMatch = raw.match(/\nDONE:(-?\d+)\s*$/);
          const output = doneMatch ? raw.slice(0, doneMatch.index).trim() : raw.trim();
          const normalized = normalizeCommandOutput(output);
          const exitCode = doneMatch ? parseInt(doneMatch[1], 10) : -1;
          if (this.logEl) {
            this.logEl.textContent = normalized || "(sin output)";
            this.logEl.textContent += exitCode === 0 ? "\n\n[\u2705 completado]" : `

[\u274C c\xF3digo ${exitCode}]`;
          }
        }, 2e3);
      })
    );
    this.logEl = contentEl.createEl("pre", { cls: "auto-oc-output-pre auto-oc-log-pre" });
    this.logEl.textContent = "(aqu\xED aparecer\xE1 el output\u2026)";
  }
  onClose() {
    this.contentEl.empty();
  }
};
var AutoOCSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "AutoOC \u2014 Settings" });
    new import_obsidian.Setting(containerEl).setName("OpenCode CLI Path").setDesc(
      `Absolute path to executable. Empty = auto-detect.
Detected now: ${resolveOpencodeBin(this.plugin.settings.opencodePath)}`
    ).addText((text) => {
      text.setPlaceholder("auto-detect").setValue(this.plugin.settings.opencodePath).onChange(async (v) => {
        this.plugin.settings.opencodePath = v.trim();
        await this.plugin.saveSettings();
      });
      return text;
    }).addButton(
      (btn) => btn.setButtonText("\u{1F50D} Auto-detect").onClick(async () => {
        const { existsSync: existsSync2 } = require("fs");
        const candidates = [
          `${process.env.APPDATA}\\npm\\opencode.cmd`,
          `${process.env.APPDATA}\\npm\\opencode`,
          `${process.env.LOCALAPPDATA}\\npm\\opencode.cmd`,
          `${process.env.ProgramFiles}\\nodejs\\opencode.cmd`
        ].filter(Boolean);
        const found = candidates.find((c) => existsSync2(c));
        if (found) {
          this.plugin.settings.opencodePath = found;
          await this.plugin.saveSettings();
          new import_obsidian.Notice(`AutoOC: path configured \u2192 ${found}`);
          this.display();
        } else {
          new import_obsidian.Notice("AutoOC: opencode not found automatically. Enter the path manually.");
        }
      })
    );
    new import_obsidian.Setting(containerEl).setName("Working Directory").setDesc(
      "Directory from which to launch OpenCode (empty = vault's current directory)"
    ).addText(
      (text) => text.setPlaceholder("C:\\Users\\GiJu236\\projects\\mi-proyecto").setValue(this.plugin.settings.workingDirectory).onChange(async (v) => {
        this.plugin.settings.workingDirectory = v;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Task Timeout (seconds)").setDesc("Soft warning time. If OpenCode exceeds this time, AutoOC warns but keeps waiting for the final result. Default 7200 s (2 h). Use 0 to disable timeout warnings.").addText(
      (text) => {
        var _a;
        return text.setPlaceholder(String(DEFAULT_TASK_TIMEOUT_SECONDS)).setValue(String((_a = this.plugin.settings.taskTimeoutSeconds) != null ? _a : DEFAULT_TASK_TIMEOUT_SECONDS)).onChange(async (v) => {
          const n = parseInt(v, 10);
          if (!isNaN(n) && n >= 0) {
            this.plugin.settings.taskTimeoutSeconds = n;
            await this.plugin.saveSettings();
          }
        });
      }
    );
    containerEl.createEl("h3", { text: "Logging" });
    containerEl.createEl("p", {
      text: "Logs are saved to `.opencode/logs/{task-id}/` in your vault. Each execution creates a timestamped log file.",
      cls: "setting-item-description"
    });
    new import_obsidian.Setting(containerEl).setName("Enable Log Persistence").setDesc("Save task logs to files when execution completes").addToggle(
      (tog) => tog.setValue(this.plugin.settings.logsEnabled).onChange(async (v) => {
        this.plugin.settings.logsEnabled = v;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Max Logs Per Task").setDesc("Maximum number of log files to keep per task (0 = unlimited)").addText(
      (text) => {
        var _a;
        return text.setPlaceholder("50").setValue(String((_a = this.plugin.settings.maxLogsPerTask) != null ? _a : 50)).onChange(async (v) => {
          const n = parseInt(v, 10);
          if (!isNaN(n) && n >= 0) {
            this.plugin.settings.maxLogsPerTask = n;
            await this.plugin.saveSettings();
          }
        });
      }
    );
    new import_obsidian.Setting(containerEl).setName("Log Retention (days)").setDesc("Delete logs older than this many days (0 = no age limit)").addText(
      (text) => {
        var _a;
        return text.setPlaceholder("30").setValue(String((_a = this.plugin.settings.logRetentionDays) != null ? _a : 30)).onChange(async (v) => {
          const n = parseInt(v, 10);
          if (!isNaN(n) && n >= 0) {
            this.plugin.settings.logRetentionDays = n;
            await this.plugin.saveSettings();
          }
        });
      }
    );
    new import_obsidian.Setting(containerEl).setName("Clear All Logs").setDesc("Delete all log files for every task").addButton(
      (btn) => btn.setButtonText("\u{1F9F9} Clear All Logs").setWarning().onClick(async () => {
        if (confirm("Delete ALL log files for ALL tasks? This cannot be undone.")) {
          await this.plugin.clearAllLogs();
        }
      })
    );
    containerEl.createEl("h3", { text: "Ralph Loop" });
    containerEl.createEl("p", {
      text: "Enable opencode-ralph-loop in ~/.config/opencode/opencode.json to use auto-continuation with /ralph-loop.",
      cls: "setting-item-description"
    });
    containerEl.createEl("p", {
      text: `Current status: ${this.plugin.isRalphLoopEnabled() ? "enabled" : "not configured"}`,
      cls: "setting-item-description"
    });
    new import_obsidian.Setting(containerEl).setName("Ralph Loop Assistant").setDesc("Add opencode-ralph-loop to OpenCode configuration file").addButton(
      (btn) => btn.setButtonText("Install / Activate").setCta().onClick(async () => {
        try {
          const result = await this.plugin.ensureRalphLoopPluginEnabled();
          new import_obsidian.Notice(
            result.changed ? `AutoOC: Ralph Loop enabled at ${result.configPath}. Restart OpenCode.` : `AutoOC: Ralph Loop was already active at ${result.configPath}.`
          );
          this.display();
        } catch (e) {
          new import_obsidian.Notice(`AutoOC: error enabling Ralph Loop: ${String(e)}`);
        }
      })
    ).addButton(
      (btn) => btn.setButtonText("Show status path").onClick(() => {
        const basePath = this.app.vault.adapter.basePath || ".";
        const statePath = getRalphStateFilePath(basePath);
        new import_obsidian.Notice(`Ralph state file: ${statePath}`);
      })
    );
    new import_obsidian.Setting(containerEl).setName("Default Agent").setDesc(`Agent used by default (${this.plugin.availableAgents.length} loaded)`).addDropdown((dd) => {
      const agents = this.plugin.availableAgents;
      agents.forEach((a) => dd.addOption(a.value, a.label));
      const current = this.plugin.getEffectiveAgent();
      if (current && !agents.find((a) => a.value === current)) {
        dd.addOption(current, current);
      }
      dd.setValue(current);
      dd.onChange(async (v) => {
        this.plugin.settings.defaultAgent = v;
        await this.plugin.saveSettings();
      });
    });
    containerEl.createEl("h3", { text: "Available Agents" });
    const refreshAgentsBtn = containerEl.createEl("button", {
      text: "\u{1F504} Reload Agent List",
      cls: "auto-oc-btn-secondary"
    });
    refreshAgentsBtn.style.marginBottom = "8px";
    refreshAgentsBtn.onclick = () => {
      this.plugin.refreshAgents();
      new import_obsidian.Notice(`AutoOC: ${this.plugin.availableAgents.length} agents loaded.`);
      this.display();
    };
    containerEl.createEl("p", {
      text: `${this.plugin.availableAgents.length} agents loaded from \`opencode agent list\``,
      cls: "setting-item-description"
    });
    const agentsTable = containerEl.createEl("table", { cls: "auto-oc-models-table" });
    const agentsHead = agentsTable.createEl("thead");
    const agentsHeader = agentsHead.createEl("tr");
    agentsHeader.createEl("th", { text: "agent" });
    const agentsBody = agentsTable.createEl("tbody");
    this.plugin.availableAgents.forEach((a) => {
      const tr = agentsBody.createEl("tr");
      tr.createEl("td", { text: a.value, cls: "auto-oc-model-value" });
    });
    new import_obsidian.Setting(containerEl).setName("Default Model").addDropdown((dd) => {
      const models = this.plugin.availableModels;
      models.forEach((m) => dd.addOption(m.value, m.label));
      const current = this.plugin.getEffectiveDefaultModel();
      if (!current && models.length === 0) {
        dd.addOption("", "(no models; press reload)");
      } else if (current && !models.find((m) => m.value === current)) {
        dd.addOption(current, current);
      }
      dd.setValue(current || "");
      dd.onChange(async (v) => {
        this.plugin.settings.defaultModel = v;
        await this.plugin.saveSettings();
      });
    });
    containerEl.createEl("h3", { text: "Available Models" });
    const refreshBtn = containerEl.createEl("button", {
      text: "\u{1F504} Reload Model List",
      cls: "auto-oc-btn-secondary"
    });
    refreshBtn.style.marginBottom = "8px";
    refreshBtn.onclick = () => {
      this.plugin.refreshModels();
      new import_obsidian.Notice("AutoOC: models reloaded. Refresh this panel.");
      this.display();
    };
    containerEl.createEl("p", {
      text: `${this.plugin.availableModels.length} models loaded from \`opencode models\``,
      cls: "setting-item-description"
    });
    const table = containerEl.createEl("table", { cls: "auto-oc-models-table" });
    const thead = table.createEl("thead");
    const hr = thead.createEl("tr");
    hr.createEl("th", { text: "provider/model" });
    const tbody = table.createEl("tbody");
    this.plugin.availableModels.forEach((m) => {
      const tr = tbody.createEl("tr");
      tr.createEl("td", { text: m.value, cls: "auto-oc-model-value" });
    });
  }
};
