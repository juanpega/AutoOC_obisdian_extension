// Verbatim updatePlugin from Git d920f1e:main.js. Host/network dependencies are injected.
// Source SHA-256: 19fef0bdf9fe21f36ba452160889e12b812cad9bb8930fec31bc1c0b0ad340ee
// Method SHA-256: 384e230d4712bb687326341bbbf9a3917e37401d2e98627fee4a1e63a1080cf2
module.exports = function({confirm,fetch,import_obsidian,noCacheUrl,REMOTE_FILE_URLS}) {
  return ({
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
  }).updatePlugin;
};
