// Exact compiled SettingsWriter and Dashboard callbacks from GUI-tested 1.6.1.
// Bundle SHA256: 9d743e3b8036e8038a99ba9c8137be7dcc07a7da414e6e2a9a760b4ff9081022
// Extracted without edits; Obsidian UI construction is the test boundary.
const __toESM = value => value;
const path17 = require('node:path');
// settings-writer.ts
var fs2 = __toESM(require("fs"));
var path2 = __toESM(require("path"));
var import_crypto = require("crypto");
var SettingsWriter = class {
  constructor() {
    this.tail = Promise.resolve();
    this.observed = /* @__PURE__ */ new Map();
  }
  // Read exactly the version against which subsequent writes are compared.
  // A missing file is distinct from an existing empty/null configuration.
  load(file) {
    const value = readSettingsVersion(file);
    this.observed.set(path2.resolve(file), value);
    return value === null ? null : JSON.parse(value);
  }
  save(file, snapshot) {
    const operation = this.tail.then(async () => {
      file = path2.resolve(file);
      await fs2.promises.mkdir(path2.dirname(file), { recursive: true });
      const lock = file + ".write-lock";
      const token = (0, import_crypto.randomUUID)();
      const descriptor = fs2.openSync(lock, "wx", 384);
      try {
        fs2.writeFileSync(descriptor, token);
        fs2.fsyncSync(descriptor);
      } finally {
        fs2.closeSync(descriptor);
      }
      try {
        const current = readSettingsVersion(file);
        if (this.observed.has(file) && this.observed.get(file) !== current) {
          throw new Error("AutoOC configuration changed externally; reload before saving");
        }
        const serialized = JSON.stringify(snapshot());
        if (serialized === void 0) throw new Error("Settings are not serializable");
        await atomicSettingsWrite(file, JSON.parse(serialized));
        this.observed.set(file, serialized);
      } finally {
        if (fs2.lstatSync(lock).isSymbolicLink() || fs2.readFileSync(lock, "utf8") !== token) {
          throw new Error("Settings write lock ownership changed");
        }
        fs2.unlinkSync(lock);
      }
    });
    this.tail = operation.catch(() => {
    });
    return operation;
  }
};
function readSettingsVersion(file) {
  try {
    const stat = fs2.lstatSync(file);
    if (stat.isSymbolicLink() || !stat.isFile()) throw new Error("Configuration must be a regular file");
    try {
      return JSON.stringify(JSON.parse(fs2.readFileSync(file, "utf8")));
    } catch (e) {
      throw new Error("Cannot read valid AutoOC configuration");
    }
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}
async function atomicSettingsWrite(file, data, io = fs2.promises) {
  const text = JSON.stringify(data, null, 2);
  if (text === void 0) throw new Error("Settings are not serializable");
  const temp = `${file}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`;
  await io.mkdir(path2.dirname(file), { recursive: true });
  let handle;
  try {
    handle = await io.open(temp, "wx", 384);
    await handle.writeFile(text, "utf8");
    await handle.sync();
    await handle.close();
    handle = void 0;
    const baseline = await io.readFile(file).catch((error) => {
      if (error.code === "ENOENT") return null;
      throw error;
    });
    for (let attempt = 0; ; attempt++) {
      try {
        await io.rename(temp, file);
        break;
      } catch (error) {
        if (process.platform !== "win32" || !["EPERM", "EBUSY"].includes(error.code || "") || attempt >= 4) throw error;
        await new Promise((resolve6) => setTimeout(resolve6, 50 * (attempt + 1)));
        const current = await io.readFile(file).catch((readError) => {
          if (readError.code === "ENOENT") return null;
          throw readError;
        });
        if (baseline === null ? current !== null : current === null || !baseline.equals(current)) {
          throw new Error("AutoOC configuration changed during replacement; reload before saving");
        }
      }
    }
  } finally {
    if (handle) await handle.close().catch(() => {
    });
    await io.unlink(temp).catch(() => {
    });
  }
}

module.exports = {SettingsWriter, plugin: {
  async saveSettings(refreshView = true) {
    var _a;
    const basePath = this.app.vault.adapter.basePath;
    if (basePath) {
      const file = path17.join(basePath, this.app.vault.configDir, "plugins", this.manifest.id, "data.json");
      await this.settingsWriter.save(file, () => this.settings);
    } else {
      await this.saveData(this.settings);
    }
    if (refreshView) (_a = this.view) == null ? void 0 : _a.refresh();
  }
}, view: {
  async persistDashboardPositions() {
    const obj = {};
    this.dashboardPositions.forEach((pos, key) => {
      obj[key] = pos;
    });
    this.plugin.settings.dashboardPositions = obj;
    await this.plugin.saveSettings(false);
  },
  async onClose() {
    var _a, _b, _c;
    (_a = this.unsubscribeTaskUpdated) == null ? void 0 : _a.call(this);
    (_b = this.unsubscribeWorkflowUpdated) == null ? void 0 : _b.call(this);
    this.unsubscribeTaskUpdated = void 0;
    this.unsubscribeWorkflowUpdated = void 0;
    await this.persistDashboardPositions();
    (_c = this.dashboardResizeObserver) == null ? void 0 : _c.disconnect();
    this.dashboardResizeObserver = null;
    this.sinkIntervals.forEach((iv) => clearInterval(iv));
    this.sinkIntervals.clear();
    this.dashboardTaskDriftDirection.clear();
  }
}};
