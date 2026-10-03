var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
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

// visualBuilderHtml.generated.ts
var visualBuilderHtml_generated_exports = {};
__export(visualBuilderHtml_generated_exports, {
  visualBuilderHtml: () => visualBuilderHtml
});
var visualBuilderHtml;
var init_visualBuilderHtml_generated = __esm({
  "visualBuilderHtml.generated.ts"() {
    visualBuilderHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>AutoOC \u2014 Visual Workflow Builder</title>
  <style>
    :root {
      --bg: #15171c;
      --bg-2: #1b1e25;
      --bg-3: #232730;
      --bg-4: #2c313c;
      --bg-5: #383e4a;
      --border: #2c313c;
      --border-soft: #232730;
      --text: #d8dde6;
      --text-muted: #8a93a3;
      --text-dim: #5d6371;
      --accent: #6f9eff;
      --accent-2: #4a7dff;
      --accent-soft: rgba(111, 158, 255, 0.16);
      --ok: #6ec27c;
      --warn: #d8a657;
      --err: #e06c75;
      --info: #5fb3d4;
      --purple: #b07ad9;
      --delay: #d8a657;
      --code: #e879b3;
      --grid: rgba(255, 255, 255, 0.04);
      --grid-major: rgba(255, 255, 255, 0.08);
      --shadow-1: 0 1px 3px rgba(0, 0, 0, 0.3);
      --shadow-2: 0 4px 14px rgba(0, 0, 0, 0.5);
      --shadow-3: 0 12px 40px rgba(0, 0, 0, 0.55);
    }
    [data-theme="light"] {
      --bg: #f4f5f7;
      --bg-2: #ffffff;
      --bg-3: #f0f1f4;
      --bg-4: #e3e6ec;
      --bg-5: #d6dae2;
      --border: #d8dce4;
      --border-soft: #e8eaf0;
      --text: #1a1d24;
      --text-muted: #5f6776;
      --text-dim: #9ba1ad;
      --accent: #2d5fe6;
      --accent-2: #1a47b8;
      --accent-soft: rgba(45, 95, 230, 0.12);
      --ok: #2e8b3a;
      --warn: #b3802a;
      --err: #c43c47;
      --info: #2b86a8;
      --purple: #7e3eb1;
      --delay: #b3802a;
      --code: #c43c75;
      --grid: rgba(0, 0, 0, 0.05);
      --grid-major: rgba(0, 0, 0, 0.1);
      --shadow-1: 0 1px 3px rgba(0, 0, 0, 0.08);
      --shadow-2: 0 4px 14px rgba(0, 0, 0, 0.1);
      --shadow-3: 0 12px 40px rgba(0, 0, 0, 0.18);
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0; padding: 0; height: 100%;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", system-ui, sans-serif;
      font-size: 13px; color: var(--text); background: var(--bg);
      overflow: hidden;
    }
    button {
      font-family: inherit; font-size: 12px; color: var(--text);
      background: var(--bg-3); border: 1px solid var(--border); border-radius: 5px;
      padding: 5px 10px; cursor: pointer;
      transition: background 0.12s, border-color 0.12s, color 0.12s;
      display: inline-flex; align-items: center; gap: 5px;
    }
    button:hover { background: var(--bg-4); border-color: var(--accent); }
    button:active { transform: translateY(0.5px); }
    button.primary {
      background: var(--accent); color: #fff; border-color: var(--accent); font-weight: 600;
    }
    button.primary:hover { background: var(--accent-2); border-color: var(--accent-2); }
    button.ghost { background: transparent; border-color: transparent; color: var(--text-muted); }
    button.ghost:hover { color: var(--text); background: var(--bg-3); border-color: var(--border); }
    button.danger:hover { border-color: var(--err); color: var(--err); }
    button.tiny { padding: 2px 6px; font-size: 11px; border-radius: 4px; }
    input, select, textarea {
      font-family: inherit; font-size: 12px; color: var(--text);
      background: var(--bg-2); border: 1px solid var(--border); border-radius: 4px;
      padding: 5px 8px; width: 100%;
      transition: border-color 0.12s, box-shadow 0.12s;
    }
    input:focus, select:focus, textarea:focus {
      outline: none; border-color: var(--accent);
      box-shadow: 0 0 0 2px var(--accent-soft);
    }
    input[type="checkbox"] { width: auto; }
    textarea { resize: vertical; min-height: 60px; font-family: ui-monospace, "Cascadia Code", Consolas, monospace; }
    label {
      display: block; font-size: 11px; color: var(--text-muted);
      margin-bottom: 3px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em;
    }
    .field { margin-bottom: 10px; }
    .row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .hint-inline { font-size: 11px; color: var(--text-muted); margin-top: 4px; line-height: 1.4; }
    .checkbox-row {
      display: flex; align-items: center; gap: 6px; padding: 4px 0;
      font-size: 12px; text-transform: none; letter-spacing: 0;
      font-weight: 400; color: var(--text); cursor: pointer;
    }
    .app {
      display: grid;
      grid-template-rows: 38px 1fr 22px;
      grid-template-columns: 240px 1fr;
      grid-template-areas: "tabs tabs" "sidebar main" "status status";
      height: 100vh;
    }
    .tabs {
      grid-area: tabs; background: var(--bg-2);
      border-bottom: 1px solid var(--border);
      display: flex; align-items: flex-end; gap: 1px;
      padding: 0 8px; overflow-x: auto; scrollbar-width: thin;
    }
    .tab {
      display: flex; align-items: center; gap: 6px;
      padding: 7px 12px 6px; font-size: 12px; color: var(--text-muted);
      background: transparent; border: 1px solid transparent;
      border-bottom: none; border-top-left-radius: 6px; border-top-right-radius: 6px;
      cursor: pointer; white-space: nowrap; max-width: 220px;
      position: relative; transition: color 0.12s, background 0.12s;
    }
    .tab:hover { color: var(--text); background: var(--bg-3); }
    .tab.active { color: var(--text); background: var(--bg); border-color: var(--border); }
    .tab.active::after {
      content: ""; position: absolute;
      left: 0; right: 0; bottom: -1px; height: 1px; background: var(--bg);
    }
    .tab .tab-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; background: var(--purple); }
    .tab .tab-name { overflow: hidden; text-overflow: ellipsis; max-width: 160px; }
    .tab .tab-close { opacity: 0.5; padding: 0 4px; border-radius: 3px; }
    .tab .tab-close:hover { opacity: 1; background: var(--bg-4); }
    .tab-add {
      padding: 7px 10px 6px; color: var(--text-muted); cursor: pointer;
      border-radius: 6px 6px 0 0; font-size: 12px;
    }
    .tab-add:hover { color: var(--text); background: var(--bg-3); }
    .sidebar {
      grid-area: sidebar; background: var(--bg-2);
      border-right: 1px solid var(--border);
      display: flex; flex-direction: column; overflow: hidden;
    }
    .sb-section { display: flex; flex-direction: column; overflow: hidden; }
    .sb-section.flex-grow { flex: 1; min-height: 0; }
    .sb-head {
      padding: 8px 10px; display: flex; align-items: center; gap: 6px;
      border-bottom: 1px solid var(--border-soft);
    }
    .sb-head h3 { margin: 0; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); flex: 1; }
    .sb-body { flex: 1; overflow-y: auto; padding: 8px; min-height: 0; }
    .sb-search { padding: 8px 10px 4px; }
    .sb-search input { font-size: 12px; }
    .lib-item {
      background: var(--bg-3); border: 1px solid var(--border);
      border-radius: 5px; padding: 6px 8px; margin-bottom: 5px;
      cursor: grab; transition: border-color 0.12s, background 0.12s;
    }
    .lib-item:hover { border-color: var(--accent); background: var(--bg-4); }
    .lib-item:active { cursor: grabbing; }
    .lib-item .lib-title { font-weight: 600; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .lib-item .lib-meta { font-size: 10.5px; color: var(--text-muted); display: flex; flex-wrap: wrap; gap: 4px; margin-top: 2px; }
    .lib-item .lib-meta .chip { background: var(--bg-2); padding: 1px 4px; border-radius: 3px; }
    .lib-empty { text-align: center; color: var(--text-muted); font-size: 11.5px; padding: 16px 8px; border: 1px dashed var(--border); border-radius: 5px; line-height: 1.5; }
    .lib-special {
      display: flex; align-items: center; gap: 8px;
      padding: 8px 10px; border-radius: 5px; margin-bottom: 5px;
      background: var(--bg-3); border: 1px solid var(--border);
      cursor: grab; transition: border-color 0.12s, background 0.12s;
    }
    .lib-special:hover { border-color: var(--accent); background: var(--bg-4); }
    .lib-special .lib-icon {
      width: 22px; height: 22px; display: flex; align-items: center; justify-content: center;
      border-radius: 4px; background: var(--bg-2); font-size: 13px; flex-shrink: 0;
    }
    .lib-special .lib-icon.delay { color: var(--delay); }
    .lib-special .lib-icon.code { color: var(--code); }
    .lib-special .lib-name { font-weight: 600; font-size: 12px; }
    .lib-special .lib-sub { font-size: 10.5px; color: var(--text-muted); }
    .canvas-wrap { grid-area: main; position: relative; background: var(--bg); overflow: hidden; }
    .canvas { position: absolute; inset: 0; cursor: grab; }
    .canvas.panning { cursor: grabbing; }
    .canvas.space-pan { cursor: grab; }
    .canvas.space-pan.panning { cursor: grabbing; }
    .canvas.connecting { cursor: crosshair; }
    .grid-bg {
      position: absolute; inset: -2000px; pointer-events: none;
      background-image:
        linear-gradient(to right, var(--grid) 1px, transparent 1px),
        linear-gradient(to bottom, var(--grid) 1px, transparent 1px),
        linear-gradient(to right, var(--grid-major) 1px, transparent 1px),
        linear-gradient(to bottom, var(--grid-major) 1px, transparent 1px);
      background-size: 20px 20px, 20px 20px, 100px 100px, 100px 100px;
      z-index: 0;
    }
    .canvas-content { position: absolute; inset: 0; transform-origin: 0 0; z-index: 1; }
    .canvas svg.edges { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; overflow: visible; }
    .canvas svg.edges .edge-hit { pointer-events: stroke; cursor: pointer; }
    .node {
      position: absolute; width: 220px; background: var(--bg-2);
      border: 1.5px solid var(--border); border-radius: 8px;
      box-shadow: var(--shadow-1);
      transition: box-shadow 0.12s, border-color 0.12s, transform 0.12s;
      z-index: 2; user-select: none;
    }
    .node:hover { box-shadow: var(--shadow-2); }
    .node.selected { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent), var(--shadow-2); z-index: 3; }
    .node.dragging { box-shadow: var(--shadow-3); transform: scale(1.02); z-index: 4; }
    .node.invalid { border-color: var(--err); }
    .node.warn { border-color: var(--warn); }
    .node-head {
      padding: 6px 10px 5px; border-bottom: 1px solid var(--border-soft);
      display: flex; align-items: center; gap: 6px;
      background: var(--bg-3); border-top-left-radius: 7px; border-top-right-radius: 7px;
      cursor: grab;
    }
    .node.dragging .node-head { cursor: grabbing; }
    .node-kind {
      font-size: 9px; font-weight: 700; letter-spacing: 0.05em;
      text-transform: uppercase; padding: 1px 5px; border-radius: 3px;
      background: var(--bg-2); color: var(--text-muted);
      flex-shrink: 0;
    }
    .node-kind.task { color: var(--accent); }
    .node-kind.delay { color: var(--delay); }
    .node-kind.code { color: var(--code); }
    .node-name { font-weight: 600; font-size: 12px; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .node-id { font-size: 10px; color: var(--text-dim); font-family: ui-monospace, monospace; flex-shrink: 0; }
    .node-body { padding: 8px 10px 9px; min-height: 32px; }
    .node-body .node-detail { font-size: 11px; color: var(--text-muted); line-height: 1.4; }
    .node-body .node-detail.empty { color: var(--err); font-style: italic; }
    .node-body .node-meta { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; font-size: 10px; color: var(--text-muted); }
    .node-body .node-meta .chip { background: var(--bg-3); padding: 1px 5px; border-radius: 3px; border: 1px solid var(--border-soft); }
    .node-body .node-meta .chip.code-lang { color: var(--code); border-color: var(--code); }
    .node-body .node-meta .chip.delay-unit { color: var(--delay); border-color: var(--delay); }
    .node-port {
      position: absolute; width: 14px; height: 14px; border-radius: 50%;
      background: var(--bg-2); border: 2px solid var(--port-color, var(--accent));
      top: 50%; transform: translateY(-50%);
      cursor: crosshair; z-index: 3;
    }
    .node-port.in { left: -8px; --port-color: var(--port-in, var(--accent)); }
    .node-port.out { right: -8px; --port-color: var(--port-out, var(--ok)); }
    .node-port:hover { background: var(--port-color); transform: translateY(-50%) scale(1.3); box-shadow: 0 0 0 4px var(--accent-soft); }
    .node-port.connecting { background: var(--port-color); transform: translateY(-50%) scale(1.3); }
    .node-add-port {
      position: absolute; right: -8px; top: calc(50% + 24px);
      width: 14px; height: 14px; border-radius: 50%;
      background: var(--bg-2); border: 2px dashed var(--accent);
      color: var(--accent); font-size: 10px; line-height: 10px;
      text-align: center; cursor: pointer; z-index: 3;
      display: flex; align-items: center; justify-content: center;
    }
    .node-add-port:hover { background: var(--accent); color: #fff; }
    .edge-path { fill: none; stroke-width: 2; transition: stroke-width 0.12s; }
    .edge-path.default { stroke: var(--ok); }
    .edge-path.force { stroke: var(--accent); stroke-width: 2.5; }
    .edge-path.eval { stroke: var(--warn); stroke-dasharray: 6 4; }
    .edge-path.conditional { stroke: var(--code); stroke-dasharray: 2 3; stroke-width: 2.5; }
    .edge-hit { fill: none; stroke: transparent; stroke-width: 18; cursor: pointer; }
    .edge-group.selected .edge-path { stroke-width: 4; }
    .edge-group.selected .edge-hit { stroke: rgba(111, 158, 255, 0.15); stroke-width: 24; }
    .edge-ghost { fill: none; stroke: var(--accent); stroke-width: 2.5; stroke-dasharray: 4 4; pointer-events: none; }
    .edge-label {
      fill: var(--text); font-size: 10px; font-weight: 600;
      text-anchor: middle; pointer-events: none;
      paint-order: stroke; stroke: var(--bg); stroke-width: 4; stroke-linejoin: round;
    }
    .panel-overlay {
      position: absolute; right: 0; top: 0; bottom: 0;
      width: 320px; background: var(--bg-2); border-left: 1px solid var(--border);
      display: none; flex-direction: column; z-index: 20;
      box-shadow: var(--shadow-2);
    }
    .panel-overlay.open { display: flex; }
    .panel-overlay header {
      padding: 8px 12px; border-bottom: 1px solid var(--border);
      display: flex; align-items: center; gap: 8px; background: var(--bg-3);
    }
    .panel-overlay header .panel-tag {
      font-size: 9.5px; padding: 1px 6px; border-radius: 3px;
      font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase;
    }
    .panel-overlay header .panel-tag.task { background: var(--accent); color: #fff; }
    .panel-overlay header .panel-tag.workflow { background: var(--purple); color: #fff; }
    .panel-overlay header .panel-tag.step { background: var(--ok); color: #0e2a13; }
    .panel-overlay header .panel-tag.edge { background: var(--warn); color: #2a1f0a; }
    .panel-overlay header .panel-tag.delay { background: var(--delay); color: #2a1f0a; }
    .panel-overlay header .panel-tag.code { background: var(--code); color: #2a0a1a; }
    .panel-overlay header .panel-title { font-weight: 700; font-size: 13px; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .panel-overlay header button { padding: 2px 6px; }
    .panel-overlay .body { flex: 1; overflow-y: auto; padding: 12px; }
    .panel-overlay .section { margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--border-soft); }
    .panel-overlay .section:first-child { margin-top: 0; padding-top: 0; border-top: none; }
    .panel-overlay .section h4 { margin: 0 0 8px 0; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); }
    .panel-overlay footer { padding: 8px 12px; border-top: 1px solid var(--border); display: flex; gap: 6px; justify-content: flex-end; background: var(--bg-3); }
    .statusbar {
      grid-area: status; background: var(--bg-2);
      border-top: 1px solid var(--border);
      display: flex; align-items: center; gap: 12px;
      padding: 0 10px; font-size: 11px; color: var(--text-muted);
    }
    .statusbar .pill { background: var(--bg-3); padding: 1px 8px; border-radius: 10px; border: 1px solid var(--border-soft); }
    .statusbar .pill.err { color: var(--err); border-color: var(--err); }
    .canvas-controls {
      position: absolute; right: 12px; bottom: 12px;
      display: flex; flex-direction: column; gap: 4px;
      background: var(--bg-2); border: 1px solid var(--border);
      border-radius: 8px; padding: 4px; box-shadow: var(--shadow-1); z-index: 10;
    }
    .canvas-controls button { padding: 4px 6px; }
    .canvas-actions {
      position: absolute; left: 12px; top: 12px;
      display: flex; gap: 4px; z-index: 10;
    }
    .canvas-actions button { background: var(--bg-2); border: 1px solid var(--border); box-shadow: var(--shadow-1); }
    .minimap-wrap {
      position: absolute; right: 12px; top: 12px;
      background: var(--bg-2); border: 1px solid var(--border);
      border-radius: 6px; box-shadow: var(--shadow-1);
      overflow: hidden; z-index: 10;
    }
    .minimap-head {
      display: flex; align-items: center; gap: 4px;
      padding: 4px 8px; font-size: 10px; font-weight: 600;
      text-transform: uppercase; letter-spacing: 0.06em;
      color: var(--text-muted); border-bottom: 1px solid var(--border-soft);
      background: var(--bg-3);
    }
    .minimap svg { display: block; }
    .toast {
      position: fixed; bottom: 32px; left: 50%;
      transform: translateX(-50%) translateY(8px);
      background: var(--bg-3); color: var(--text);
      border: 1px solid var(--border); border-left: 3px solid var(--accent);
      padding: 8px 14px; border-radius: 5px; font-size: 12px;
      z-index: 300; box-shadow: var(--shadow-2);
      opacity: 0; pointer-events: none; transition: opacity 0.18s, transform 0.18s;
    }
    .toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }
    .toast.error { border-left-color: var(--err); }
    .toast.ok { border-left-color: var(--ok); }
    .toast.warn { border-left-color: var(--warn); }
    .ctx-menu {
      position: fixed; background: var(--bg-2);
      border: 1px solid var(--border); border-radius: 6px;
      box-shadow: var(--shadow-2); padding: 4px;
      min-width: 200px; z-index: 100; font-size: 12px;
    }
    .ctx-item {
      display: flex; align-items: center; gap: 8px;
      padding: 5px 8px; border-radius: 4px; cursor: pointer; color: var(--text);
    }
    .ctx-item:hover { background: var(--accent-soft); }
    .ctx-item.danger { color: var(--err); }
    .ctx-divider { height: 1px; background: var(--border-soft); margin: 4px 0; }
    .modal-backdrop {
      position: fixed; inset: 0; background: rgba(0, 0, 0, 0.55);
      display: none; align-items: center; justify-content: center; z-index: 150;
    }
    .modal-backdrop.open { display: flex; }
    .modal {
      background: var(--bg-2); border: 1px solid var(--border);
      border-radius: 8px; padding: 16px 18px;
      width: 520px; max-width: 95vw; box-shadow: var(--shadow-3);
    }
    .modal h3 { margin: 0 0 12px 0; font-size: 14px; }
    .modal pre {
      background: var(--bg); border: 1px solid var(--border);
      border-radius: 4px; padding: 8px; font-size: 11px;
      max-height: 320px; overflow: auto; white-space: pre-wrap; word-break: break-all;
    }
    .modal .row { display: flex; gap: 6px; justify-content: flex-end; margin-top: 14px; }
    ::-webkit-scrollbar { width: 8px; height: 8px; }
    ::-webkit-scrollbar-thumb { background: var(--bg-4); border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: var(--bg-5); }
    ::-webkit-scrollbar-track { background: transparent; }
    .validation-icon {
      display: inline-flex; align-items: center; justify-content: center;
      width: 16px; height: 16px; border-radius: 50%;
      font-size: 11px; font-weight: 700; color: #fff; flex-shrink: 0;
    }
    .validation-icon.err { background: var(--err); }
    .validation-icon.warn { background: var(--warn); color: #2a1f0a; }
    .node-seq {
      position: absolute; top: -10px; left: -10px;
      width: 22px; height: 22px; border-radius: 50%;
      background: var(--accent); color: #fff; font-size: 11px; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
      z-index: 5; box-shadow: var(--shadow-1);
    }
    .branch-badge {
      position: absolute; right: -6px; top: -6px;
      min-width: 18px; height: 18px; border-radius: 9px;
      background: var(--code); color: #fff; font-size: 10px; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
      z-index: 5; box-shadow: var(--shadow-1); padding: 0 5px;
    }
    .help-banner {
      position: absolute; left: 12px; bottom: 12px;
      max-width: 340px; padding: 8px 12px;
      background: var(--bg-2); border: 1px solid var(--border);
      border-radius: 6px; font-size: 11.5px; line-height: 1.5;
      color: var(--text-muted); z-index: 10; box-shadow: var(--shadow-1);
    }
    .help-banner b { color: var(--text); }
    .help-banner .close { float: right; cursor: pointer; opacity: 0.6; }
    .help-banner .close:hover { opacity: 1; }
  </style>
</head>
<body>
  <div class="app" id="app">
    <div class="tabs" id="tabs">
      <div class="tab-add" id="tabAdd">+ new</div>
    </div>
    <aside class="sidebar">
      <div class="sb-section flex-grow">
        <div class="sb-head">
          <h3>Workflows</h3>
          <button class="tiny ghost" id="sbAddWf" title="New workflow">+</button>
        </div>
        <div class="sb-body" id="wfList" style="padding:6px 8px"></div>
      </div>
      <div class="sb-section flex-grow" style="border-top:1px solid var(--border)">
        <div class="sb-head">
          <h3>Add step</h3>
        </div>
        <div class="sb-body" id="stepList">
          <div class="lib-special" data-kind="task" draggable="true" title="Drag onto the canvas to add a task step">
            <div class="lib-icon" style="color:var(--accent)">\u26A1</div>
            <div><div class="lib-name">Task</div><div class="lib-sub">Run an AI task</div></div>
          </div>
          <div class="lib-special" data-kind="delay" draggable="true" title="Drag onto the canvas to add a delay step">
            <div class="lib-icon delay">\u23F1</div>
            <div><div class="lib-name">Delay</div><div class="lib-sub">Wait N seconds/minutes/hours</div></div>
          </div>
          <div class="lib-special" data-kind="code" draggable="true" title="Drag onto the canvas to add a programmable step">
            <div class="lib-icon code">{ }</div>
            <div><div class="lib-name">Code</div><div class="lib-sub">Run JavaScript, pass input/output</div></div>
          </div>
        </div>
      </div>
      <div class="sb-section flex-grow" style="border-top:1px solid var(--border)">
        <div class="sb-head">
          <h3>Task library</h3>
          <button class="tiny ghost" id="sbAddTask" title="New task">+</button>
        </div>
        <div class="sb-search">
          <input type="text" id="libSearch" placeholder="Search tasks..." />
        </div>
        <div class="sb-body" id="taskList"></div>
      </div>
    </aside>

    <div class="canvas-wrap" id="canvasWrap">
      <div class="canvas" id="canvas">
        <div class="grid-bg"></div>
        <div class="canvas-content" id="canvasContent">
          <svg class="edges" id="edges"></svg>
          <div id="nodesLayer"></div>
        </div>
      </div>
      <div class="canvas-actions">
        <button class="ghost" id="btnAutoLayout" title="Auto-arrange steps (left to right)">Auto-layout</button>
        <button class="ghost" id="btnFit" title="Fit to view (F)">Fit</button>
        <button class="ghost" id="btnValidate" title="Validate workflow">Validate</button>
        <button class="ghost" id="btnTrace" title="Show execution order">Trace</button>
        <button class="primary" id="btnApply" title="Save changes back to AutoOC">Apply to AutoOC</button>
      </div>
      <div class="canvas-controls">
        <button class="ghost icon" id="btnZoomIn" title="Zoom in (+)">+</button>
        <button class="ghost icon" id="btnZoomReset" title="Reset zoom">\xB7</button>
        <button class="ghost icon" id="btnZoomOut" title="Zoom out (-)">\u2212</button>
      </div>
      <div class="minimap-wrap" id="minimap" style="display:none">
        <div class="minimap-head">Minimap</div>
        <svg id="mmSvg" width="180" height="100" viewBox="0 0 180 100" preserveAspectRatio="xMidYMid meet"></svg>
      </div>
      <div class="help-banner" id="helpBanner">
        <span class="close" id="helpClose">\u2715</span>
        <b>Visual Builder</b><br>
        Drag a <b>Task</b>, <b>Delay</b>, or <b>Code</b> from the left onto the canvas.
        Drag an <b>output port</b> to another node to connect. Click an edge to set its
        <b>transition mode</b> (default / force / AI eval / conditional JS). Use the
        <b>Apply to AutoOC</b> button to save changes back to the extension.
      </div>
    </div>

    <aside class="panel-overlay" id="panel">
      <header>
        <span class="panel-tag workflow" id="panelTag">workflow</span>
        <div class="panel-title" id="panelTitle">Workflow</div>
        <button class="ghost" id="panelClose">\u2715</button>
      </header>
      <div class="body" id="panelBody"></div>
      <footer>
        <button class="danger ghost" id="panelDelete">Delete</button>
        <div style="flex:1"></div>
        <button class="primary" id="panelOk">Done</button>
      </footer>
    </aside>

    <div class="statusbar">
      <span class="pill" id="statTasks">0 tasks</span>
      <span class="pill" id="statWorkflows">0 workflows</span>
      <span class="pill" id="statSteps">0 steps</span>
      <span id="statMsg">Connected to AutoOC</span>
      <div style="flex:1"></div>
      <span class="zoom-pct" id="zoomPct">100%</span>
    </div>
  </div>

  <div class="ctx-menu" id="ctxMenu" style="display:none"></div>

  <div class="modal-backdrop" id="validationModal">
    <div class="modal">
      <h3>Validation report</h3>
      <div id="validationReport" style="font-size:12px;line-height:1.6;max-height:380px;overflow-y:auto"></div>
      <div class="row">
        <button class="ghost" id="validationClose">Close</button>
      </div>
    </div>
  </div>

  <div class="toast" id="toast"></div>

  <script>
  /* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
     AutoOC Visual Builder (v1.4)
     - Designed to run as a standalone HTML file or inside the AutoOC
       Obsidian extension via an iframe.
     - When running inside the extension, it communicates with the parent
       through postMessage: the extension posts {type:"load", state},
       the builder edits it, and posts {type:"apply", state} when the user
       clicks "Apply to AutoOC".
     - When running standalone, the state is kept in localStorage and can
       also be exported/imported as JSON.
     \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */
  "use strict";

  // \u2500\u2500 State \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  const state = { tasks: [], workflows: [] };
  const meta = { availableAgents: [], availableModels: [], availableCodexModels: [], defaultAiEngine: "opencode", defaultCopilotModel: "", defaultCodexModel: "", defaultCodexReasoningEffort: "medium" };
  let ui = {
    activeWorkflowId: null,
    selection: { type: null, ref: null }, // { type: "task"|"step"|"edge"|"workflow", ref }
    view: { pan: { x: 0, y: 0 }, zoom: 1 },
    snap: true,
    traceOn: false,
  };
  let spaceHeld = false;
  let connectState = null;
  let inExtension = false;
  let isDirty = false;

  // \u2500\u2500 Constants \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  const SCHEDULE_TYPES = [
    { v: "manual", l: "Manual" },
    { v: "once", l: "Once" },
    { v: "daily", l: "Daily" },
    { v: "weekly", l: "Weekly" },
    { v: "monthly", l: "Monthly" },
    { v: "interval", l: "Every X time" },
  ];
  const INTERVAL_UNITS = [
    { v: "seconds", l: "seconds" },
    { v: "minutes", l: "minutes" },
    { v: "hours", l: "hours" },
  ];
  const TRANSITION_MODES = [
    { v: "default",     l: "Default",                    desc: "Continue to the next step only if the previous one succeeded." },
    { v: "force",       l: "Force continue",             desc: "Always follow this edge, even if the previous step failed." },
    { v: "eval",        l: "AI decides",                desc: "Send the previous output to the model and let it decide whether to follow this edge." },
    { v: "conditional", l: "Conditional (JavaScript)",   desc: "Evaluate a JavaScript expression against the runtime context. True \u2192 follow." },
  ];
  const AGENT_PRESETS = ["build", "plan"];
  const MODEL_PRESETS = [
    "opencode/deepseek-v4-flash-free",
    "opencode/glm-5-free",
    "opencode/gpt-5",
    "opencode/claude-sonnet-4-5",
  ];
  const GRID_SIZE = 20;
  const NODE_W = 220;
  const NODE_H_TASK = 100;
  const NODE_H_DELAY = 80;
  const NODE_H_CODE = 120;
  const MIN_ZOOM = 0.25;
  const MAX_ZOOM = 2.5;

  // \u2500\u2500 Utilities \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const uid = () => "id-" + Date.now().toString(36) + Math.random().toString(36).slice(2,7);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

  function defaultTask() {
    const taskKind = ["codex", "copilot"].includes(meta.defaultAiEngine) ? meta.defaultAiEngine : "opencode";
    const defaultModel = taskKind === "copilot" ? meta.defaultCopilotModel || "" : taskKind === "codex" ? (meta.defaultCodexModel || optionValue(meta.availableCodexModels[0]) || "") : (optionValue(meta.availableModels[0]) || "");
    const defaultAgent = optionValue(meta.availableAgents[0]) || "build";
    return {
      id: uid(), taskKind, name: "New task", prompt: "", model: defaultModel, agent: defaultAgent,
      reasoningEffort: taskKind === "codex" ? meta.defaultCodexReasoningEffort || "medium" : undefined,
      copilotAllowAllTools: taskKind === "copilot" ? false : undefined,
      useRalphLoop: false, forceModel: false, scheduleType: "manual", scheduleTime: "09:00",
      scheduleDate: "", scheduleDays: [], scheduleMonthDays: [],
      scheduleIntervalValue: 10, scheduleIntervalUnit: "minutes",
      status: "pending", lastRun: "", output: "", createdAt: new Date().toISOString(),
      workingDirectory: "", branch: "", createBranch: false, color: "#4a7dff", icon: "\u26A1",
    };
  }
  function defaultWorkflow() {
    return {
      id: uid(), name: "New workflow", description: "",
      scheduleType: "manual", scheduleTime: "09:00", scheduleDate: "",
      scheduleDays: [], scheduleMonthDays: [],
      scheduleIntervalValue: 10, scheduleIntervalUnit: "minutes",
      handoffBranch: false, handoffOutput: true, steps: [], color: "#b07ad9",
    };
  }
  function defaultStepForTask(taskId) {
    return {
      id: uid(), stepKind: "task", taskId,
      transitions: [], position: { x: 0, y: 0 },
    };
  }
  function defaultStepForDelay(value = 5, unit = "minutes") {
    return {
      id: uid(), stepKind: "delay",
      delayValue: value, delayUnit: unit,
      transitions: [], position: { x: 0, y: 0 },
    };
  }
  function defaultStepForCode() {
    return {
      id: uid(), stepKind: "code",
      code: "// input is the previous step's output\\n// Set 'output' to the value passed to the next step\\noutput = String(input).toUpperCase();",
      codeLang: "javascript",
      codeInputVar: "input",
      codeOutputVar: "output",
      transitions: [], position: { x: 0, y: 0 },
    };
  }
  const findTask = (id) => state.tasks.find(t => t.id === id);
  const findWorkflow = (id) => state.workflows.find(w => w.id === id);
  const activeWorkflow = () => findWorkflow(ui.activeWorkflowId);
  const stepTask = (s) => s && s.taskId ? findTask(s.taskId) : null;
  const snap = (v) => ui.snap ? Math.round(v / GRID_SIZE) * GRID_SIZE : v;
  const optionValue = (x) => typeof x === "string" ? x : (x && x.value) || "";
  const optionLabel = (x) => typeof x === "string" ? x : (x && x.label) || optionValue(x);
  const uniqueOptions = (primary, fallback, current) => {
    const seen = new Set();
    const out = [];
    [...(primary || []), ...(fallback || []), current].forEach((item) => {
      const value = optionValue(item);
      if (!value || seen.has(value)) return;
      seen.add(value);
      out.push({ value, label: optionLabel(item) });
    });
    return out;
  };
  const dataListHtml = (id, options) => '<datalist id="' + id + '">' + options.map(o => '<option value="' + esc(o.value) + '">' + esc(o.label) + '</option>').join("") + '</datalist>';

  // \u2500\u2500 Toast \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  let toastTimer;
  function toast(msg, kind = "ok") {
    const el = $("#toast");
    el.textContent = msg;
    el.className = "toast show " + kind;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.className = "toast " + kind; }, 2400);
  }

  // \u2500\u2500 PostMessage protocol (extension integration) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  function setupPostMessage() {
    window.addEventListener("message", (ev) => {
      const data = ev.data;
      if (!data || typeof data !== "object") return;
      if (data.type === "load") {
        // Replace the state with the extension's state.
        state.tasks = (data.state.tasks || []).map(migrateTask);
        state.workflows = (data.state.workflows || []).map(migrateWorkflow);
        meta.availableAgents = (data.state.meta && data.state.meta.availableAgents) || [];
        meta.availableModels = (data.state.meta && data.state.meta.availableModels) || [];
        meta.availableCodexModels = (data.state.meta && data.state.meta.availableCodexModels) || [];
        meta.defaultAiEngine = (data.state.meta && data.state.meta.defaultAiEngine) || "opencode";
        meta.defaultCopilotModel = (data.state.meta && data.state.meta.defaultCopilotModel) || "";
        meta.defaultCodexModel = (data.state.meta && data.state.meta.defaultCodexModel) || "";
        meta.defaultCodexReasoningEffort = (data.state.meta && data.state.meta.defaultCodexReasoningEffort) || "medium";
        // Ensure all steps have an id and a position.
        for (const w of state.workflows) {
          for (let i = 0; i < w.steps.length; i++) {
            const s = w.steps[i];
            if (!s.id) s.id = uid();
            if (!s.stepKind) s.stepKind = "task";
            if (!s.position) s.position = { x: 60 + i * 280, y: 60 };
            if (!Array.isArray(s.transitions)) s.transitions = [];
          }
        }
        if (state.workflows.length > 0 && !ui.activeWorkflowId) {
          ui.activeWorkflowId = state.workflows[0].id;
        }
        if (ui.activeWorkflowId) {
          ui.selection = { type: "workflow", ref: ui.activeWorkflowId };
        }
        inExtension = true;
        $("#helpBanner").style.display = "none";
        renderAll();
        fitToView();
        toast("Loaded from AutoOC", "ok");
      } else if (data.type === "meta") {
        meta.availableAgents = (data.meta && data.meta.availableAgents) || [];
        meta.availableModels = (data.meta && data.meta.availableModels) || [];
        meta.availableCodexModels = (data.meta && data.meta.availableCodexModels) || [];
        meta.defaultAiEngine = (data.meta && data.meta.defaultAiEngine) || meta.defaultAiEngine;
        meta.defaultCopilotModel = (data.meta && data.meta.defaultCopilotModel) || "";
        meta.defaultCodexModel = (data.meta && data.meta.defaultCodexModel) || "";
        meta.defaultCodexReasoningEffort = (data.meta && data.meta.defaultCodexReasoningEffort) || "medium";
        renderPanel();
        renderStatus();
        toast("Model/agent lists updated", "ok");
      } else if (data.type === "request-apply") {
        applyToExtension();
      } else if (data.type === "ping") {
        // No-op for now
      }
    });
    // Tell the parent we're ready.
    try { window.parent.postMessage({ type: "ready" }, "*"); } catch (e) {}
  }

  function applyToExtension(skipValidation = false) {
    if (!inExtension) {
      toast("Running standalone \u2014 use Export to save as JSON", "warn");
      return;
    }
    if (!skipValidation) {
      const validation = validateAll();
      const errorCount = validation.reduce((count, group) => count + group.issues.filter(i => i.kind === "err").length, 0);
      if (errorCount > 0 && !confirm("Visual Builder found " + errorCount + " blocking issue(s). Apply anyway?")) {
        showValidation();
        return;
      }
    }
    // Send back the current state.
    const payload = {
      type: "apply",
      state: {
        tasks: state.tasks,
        workflows: state.workflows.map((w) => ({
          ...w,
          steps: w.steps.map((s) => ({
            id: s.id,
            stepKind: s.stepKind || "task",
            taskId: s.taskId,
            transitionMode: s.transitionMode,
            evaluatePrompt: s.evaluatePrompt,
            forceContinue: s.forceContinue,
            delayValue: s.delayValue,
            delayUnit: s.delayUnit,
            code: s.code,
            codeLang: s.codeLang,
            codeInputVar: s.codeInputVar,
            codeOutputVar: s.codeOutputVar,
            codeAllowVault: s.codeAllowVault,
            codeAllowFiles: s.codeAllowFiles,
            codeAllowTerminal: s.codeAllowTerminal,
            transitions: s.transitions,
            position: s.position,
          })),
        })),
      },
    };
    try {
      window.parent.postMessage(payload, "*");
      isDirty = false;
      toast("Applied to AutoOC", "ok");
    } catch (e) {
      toast("Could not apply: " + e.message, "error");
    }
  }

  // Migration: take an object from the extension and fill in any missing
  // fields so the builder has a complete, well-formed state.
  function migrateTask(t) {
    return Object.assign(defaultTask(), t, {
      id: t.id || uid(),
      taskKind: t.taskKind || "opencode",
      copilotAllowAllTools: t.taskKind === "copilot" ? t.copilotAllowAllTools === true : undefined,
      reasoningEffort: t.taskKind === "codex" ? t.reasoningEffort || meta.defaultCodexReasoningEffort : undefined,
      scheduleMonthDays: t.scheduleMonthDays || [],
      scheduleDays: t.scheduleDays || [],
    });
  }
  function migrateWorkflow(w) {
    const dw = defaultWorkflow();
    const out = Object.assign(dw, w, {
      id: w.id || uid(),
      steps: (w.steps || []).map((s) => Object.assign({
        id: s.id || uid(),
        stepKind: s.stepKind || "task",
        transitions: s.transitions || [],
        position: s.position || { x: 0, y: 0 },
      }, s)),
    });
    return out;
  }

  // \u2500\u2500 Top-level render \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  function renderAll() {
    renderTabs();
    renderSidebar();
    renderCanvas();
    renderPanel();
    renderStatus();
    renderMinimap();
  }

  // \u2500\u2500 Tabs \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  function renderTabs() {
    const root = $("#tabs");
    root.innerHTML = "";
    state.workflows.forEach(w => {
      const el = document.createElement("div");
      el.className = "tab" + (w.id === ui.activeWorkflowId ? " active" : "");
      el.dataset.id = w.id;
      el.innerHTML = \`
        <span class="tab-dot" style="background:\${esc(w.color || "#b07ad9")}"></span>
        <span class="tab-name" title="\${esc(w.name)}">\${esc(w.name || "(unnamed)")}</span>
        <span class="tab-close" data-act="close" title="Close">\u2715</span>
      \`;
      el.addEventListener("click", (e) => {
        if (e.target.dataset.act === "close") { e.stopPropagation(); closeWorkflow(w.id); return; }
        setActiveWorkflow(w.id);
      });
      el.addEventListener("dblclick", () => {
        const n = prompt("Rename workflow", w.name);
        if (n && n.trim()) { w.name = n.trim(); renderAll(); }
      });
      root.appendChild(el);
    });
    const add = document.createElement("div");
    add.className = "tab-add";
    add.textContent = "+ new";
    add.addEventListener("click", newWorkflow);
    root.appendChild(add);
  }
  function setActiveWorkflow(id) {
    ui.activeWorkflowId = id;
    ui.selection = { type: "workflow", ref: id };
    renderAll();
    fitToView();
  }

  // \u2500\u2500 Sidebar \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  function renderSidebar() {
    const wfRoot = $("#wfList");
    if (state.workflows.length === 0) {
      wfRoot.innerHTML = '<div class="lib-empty">No workflows yet.<br>Click <b>+</b> above to create one.</div>';
    } else {
      wfRoot.innerHTML = state.workflows.map(w => {
        const taskCount = w.steps.length;
        return \`
          <div class="wf-list-item \${w.id === ui.activeWorkflowId ? "active" : ""}" data-id="\${w.id}">
            <span class="wf-dot" style="background:\${esc(w.color || "#b07ad9")}"></span>
            <span class="wf-name">\${esc(w.name || "(unnamed)")}</span>
            <span class="wf-count">\${taskCount} step\${taskCount === 1 ? "" : "s"}</span>
          </div>
        \`;
      }).join("");
      $$(".wf-list-item", wfRoot).forEach(el => el.addEventListener("click", () => setActiveWorkflow(el.dataset.id)));
    }
    renderTaskLibrary();
  }
  function renderTaskLibrary() {
    const root = $("#taskList");
    const q = ($("#libSearch").value || "").trim().toLowerCase();
    const filtered = state.tasks.filter(t => {
      if (!q) return true;
      return (t.name || "").toLowerCase().includes(q) || (t.prompt || "").toLowerCase().includes(q) || (t.agent || "").toLowerCase().includes(q);
    });
    if (filtered.length === 0) {
      root.innerHTML = '<div class="lib-empty">' + (state.tasks.length === 0 ? 'No tasks yet.<br>Click <b>+</b> to create one.' : 'No tasks match &quot;' + esc(q) + '&quot;') + '</div>';
      return;
    }
    root.innerHTML = filtered.map(t => \`
      <div class="lib-item" data-id="\${t.id}" draggable="true" title="Drag onto the canvas to add a task step">
        <div class="lib-title" style="display:flex;align-items:center;gap:6px">
          <span style="color:\${esc(t.color || "#4a7dff")}">\${esc(t.icon || "\u26A1")}</span>
          <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1">\${esc(t.name || "(unnamed)")}</span>
        </div>
        <div class="lib-meta">
          <span class="chip">\${t.taskKind === "copilot" ? "GitHub Copilot CLI" : t.taskKind === "code" ? "Code" : t.taskKind === "codex" ? (t.interactiveTerminal ? "ChatGPT / Codex" : "Codex") : (t.interactiveTerminal ? "OpenCode CLI" : "OpenCode")}</span>
          \${t.taskKind === "copilot" ? '<span class="chip">' + (t.copilotAllowAllTools ? "Tools allowed" : "Read-only") + '</span>' : t.taskKind === "code" ? "" : t.taskKind === "codex" ? '<span class="chip">' + esc(t.reasoningEffort || "medium") + '</span>' : '<span class="chip">' + esc(t.agent || "build") + '</span>'}
          \${t.taskKind === "opencode" && t.useRalphLoop ? '<span class="chip" style="color:var(--warn)">ralph</span>' : ""}
        </div>
      </div>
    \`).join("");
    $$(".lib-item", root).forEach(el => {
      el.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", JSON.stringify({ kind: "lib-task", taskId: el.dataset.id }));
        e.dataTransfer.effectAllowed = "copy";
      });
      el.addEventListener("click", () => {
        ui.selection = { type: "task", ref: el.dataset.id };
        renderPanel();
      });
    });
  }

  // \u2500\u2500 Canvas: nodes & edges \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  function renderCanvas() {
    const wf = activeWorkflow();
    const layer = $("#nodesLayer");
    const edges = $("#edges");
    if (!wf) {
      layer.innerHTML = '<div style="position:absolute;left:50%;top:40%;transform:translate(-50%,-50%);text-align:center;color:var(--text-muted);font-size:14px;line-height:1.6;width:340px"><div style="font-size:48px;opacity:0.25;margin-bottom:12px">\u2295</div><b style="color:var(--text)">No workflow open</b><br>Click <b>+ new</b> in the tab bar to create one.</div>';
      edges.innerHTML = "";
      return;
    }
    if (wf.steps.length === 0) {
      layer.innerHTML = '<div style="position:absolute;left:50%;top:38%;transform:translate(-50%,-50%);text-align:center;color:var(--text-muted);font-size:13px;line-height:1.6;pointer-events:none"><div style="font-size:48px;opacity:0.25;margin-bottom:12px">\u{1F4E6}</div><b style="color:var(--text)">' + esc(wf.name) + '</b><br>Drag a <b>Task</b>, <b>Delay</b>, or <b>Code</b> from the left onto the canvas to add a step.</div>';
      edges.innerHTML = "";
      return;
    }
    layer.innerHTML = wf.steps.map((s, i) => renderNodeHtml(s, i, wf)).join("");
    wf.steps.forEach((s, i) => {
      const el = $(\`.node[data-idx="\${i}"]\`, layer);
      if (el) attachNodeEvents(el, i, wf);
    });
    renderEdges(wf);
    applyTransform();
  }

  function nodeHeight(s) {
    if (s.stepKind === "delay") return NODE_H_DELAY;
    if (s.stepKind === "code") return NODE_H_CODE;
    return NODE_H_TASK;
  }

  function renderNodeHtml(s, i, wf) {
    const kind = s.stepKind || "task";
    const selected = (ui.selection.type === "step" && ui.selection.ref && ui.selection.ref.wfId === wf.id && ui.selection.ref.idx === i);
    const seqHtml = ui.traceOn ? '<div class="node-seq">' + (i + 1) + '</div>' : "";
    const branchHtml = (s.transitions && s.transitions.length > 1) ? '<div class="branch-badge">' + s.transitions.length + '</div>' : "";

    let body = "";
    if (kind === "task") {
      const t = stepTask(s);
      const tName = t ? t.name : "(missing task)";
      const color = (t && t.color) || "#4a7dff";
      const icon = (t && t.icon) || "\u26A1";
      body = \`
        <div class="node-head" style="border-top:3px solid \${esc(color)}">
          <span class="node-kind task">TASK</span>
          <span class="node-name">\${esc(icon)} \${esc(tName)}</span>
          <span class="node-id">#\${esc(s.id.slice(-4))}</span>
        </div>
        <div class="node-body">
          <div class="node-detail">\${t ? esc((t.prompt || "(no prompt)").slice(0, 90)) + ((t.prompt || "").length > 90 ? "\u2026" : "") : '<span class="empty">(task missing)</span>'}</div>
          <div class="node-meta">
            <span class="chip">\${t && t.taskKind === "copilot" ? "GitHub Copilot CLI" : t && t.taskKind === "code" ? "Code" : t && t.taskKind === "codex" ? (t.interactiveTerminal ? "ChatGPT / Codex" : "Codex") : (t && t.interactiveTerminal ? "OpenCode CLI" : "OpenCode")}</span>
            \${(t && t.taskKind === "copilot") ? '<span class="chip">' + (t.copilotAllowAllTools ? "Tools allowed" : "Read-only") + '</span>' : (t && t.taskKind === "code") ? "" : (t && t.taskKind === "codex") ? '<span class="chip">' + esc(t.reasoningEffort || "medium") + '</span>' : '<span class="chip">' + esc((t && t.agent) || "build") + '</span>'}
            \${(t && t.taskKind === "opencode" && t.useRalphLoop) ? '<span class="chip" style="color:var(--warn)">ralph</span>' : ""}
          </div>
        </div>
      \`;
    } else if (kind === "delay") {
      body = \`
        <div class="node-head" style="border-top:3px solid var(--delay)">
          <span class="node-kind delay">DELAY</span>
          <span class="node-name">\u23F1 Wait \${esc(String(s.delayValue || 0))} \${esc(s.delayUnit || "seconds")}</span>
          <span class="node-id">#\${esc(s.id.slice(-4))}</span>
        </div>
        <div class="node-body">
          <div class="node-detail">The workflow pauses for <b>\${esc(String(s.delayValue || 0))} \${esc(s.delayUnit || "seconds")}</b> before continuing.</div>
          <div class="node-meta">
            <span class="chip delay-unit">\${esc(s.delayUnit || "seconds")}</span>
          </div>
        </div>
      \`;
    } else if (kind === "code") {
      const lang = s.codeLang || "javascript";
      body = \`
        <div class="node-head" style="border-top:3px solid var(--code)">
          <span class="node-kind code">CODE</span>
          <span class="node-name">{ } JavaScript</span>
          <span class="node-id">#\${esc(s.id.slice(-4))}</span>
        </div>
        <div class="node-body">
          <div class="node-detail">\${esc((s.code || "").split("\\n").slice(0, 3).join(" / ").slice(0, 100))}\${(s.code || "").length > 100 ? "\u2026" : ""}</div>
          <div class="node-meta">
            <span class="chip code-lang">\${esc(lang)}</span>
            <span class="chip">\${esc(s.codeInputVar || "input")} \u2192 \${esc(s.codeOutputVar || "output")}</span>
          </div>
        </div>
      \`;
    }

    const h = nodeHeight(s);
    return \`
      <div class="node \${selected ? "selected" : ""}" data-idx="\${i}" style="left:\${s.position.x}px;top:\${s.position.y}px;height:\${h}px">
        \${seqHtml}\${branchHtml}
        \${body}
        <div class="node-port in" data-port="in" data-idx="\${i}" title="Input"></div>
        <div class="node-port out" data-port="out" data-idx="\${i}" title="Drag to another node to connect"></div>
        <div class="node-add-port" data-port="add" data-idx="\${i}" title="Add new outgoing transition">+</div>
      </div>
    \`;
  }

  function attachNodeEvents(el, idx, wf) {
    const s = wf.steps[idx];
    // Drag-to-move (start on .node-head).
    el.addEventListener("mousedown", (e) => {
      if (e.target.classList.contains("node-port")) return;
      if (e.target.classList.contains("node-add-port")) return;
      if (e.button !== 0) return;
      const startX = e.clientX, startY = e.clientY;
      const origPos = { ...s.position };
      let movedX = 0, movedY = 0, dragged = false;
      const onMove = (ev) => {
        movedX = ev.clientX - startX;
        movedY = ev.clientY - startY;
        if (!dragged && (Math.abs(movedX) > 3 || Math.abs(movedY) > 3)) { dragged = true; el.classList.add("dragging"); }
        s.position = { x: snap(origPos.x + movedX / ui.view.zoom), y: snap(origPos.y + movedY / ui.view.zoom) };
        el.style.left = s.position.x + "px";
        el.style.top  = s.position.y + "px";
        renderEdges(wf);
        renderMinimap();
      };
      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        el.classList.remove("dragging");
        ui.selection = { type: "step", ref: { wfId: wf.id, idx } };
        renderPanel();
        renderCanvas();
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });
    el.addEventListener("dblclick", (e) => {
      if (e.target.classList.contains("node-port")) return;
      if (e.target.classList.contains("node-add-port")) return;
      ui.selection = { type: "step", ref: { wfId: wf.id, idx } };
      renderPanel();
      renderCanvas();
    });
    el.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      showContextMenu(e.clientX, e.clientY, [
        { label: "Edit step", action: () => { ui.selection = { type: "step", ref: { wfId: wf.id, idx } }; renderAll(); } },
        { label: "Open task (if task step)", action: () => { if (s.taskId) { ui.selection = { type: "task", ref: s.taskId }; renderAll(); } } },
        { divider: true },
        { label: "Add transition from this step", action: () => {
          if (!s.transitions) s.transitions = [];
          const target = wf.steps.find((x, i) => i !== idx);
          if (target) {
            s.transitions.push({ toStepId: target.id, mode: "default" });
            renderAll();
          }
        }},
        { divider: true },
        { label: "Duplicate step", action: () => duplicateStep(wf.id, idx) },
        { label: "Delete step", danger: true, action: () => removeStep(wf.id, idx) },
      ]);
    });
    // Output port: start a connection drag.
    $$(".node-port.out", el).forEach(p => {
      p.addEventListener("mousedown", (e) => {
        e.stopPropagation(); e.preventDefault();
        startConnectionDrag(idx, e);
      });
    });
    // "+" port: open the add-transition menu.
    const addPort = $(".node-add-port", el);
    if (addPort) {
      addPort.addEventListener("mousedown", (e) => { e.stopPropagation(); e.preventDefault(); });
      addPort.addEventListener("click", (e) => {
        e.stopPropagation();
        const others = wf.steps.filter((x, i) => i !== idx);
        if (others.length === 0) { toast("No other steps to connect to", "warn"); return; }
        showContextMenu(e.clientX, e.clientY, [
          { label: "Connect to next step", action: () => {
            if (!s.transitions) s.transitions = [];
            const next = wf.steps[idx + 1] || wf.steps[0];
            s.transitions.push({ toStepId: next.id, mode: "default" });
            renderAll();
          }},
          { divider: true },
          ...others.map((o) => ({
            label: (o.stepKind === "delay" ? "\u23F1 " : o.stepKind === "code" ? "{ } " : "\u26A1 ") + (o.stepKind === "task" ? ((stepTask(o) || {}).name || "(task)") : o.stepKind === "delay" ? (o.delayValue + " " + o.delayUnit) : "JavaScript"),
            action: () => {
              if (!s.transitions) s.transitions = [];
              s.transitions.push({ toStepId: o.id, mode: "default" });
              renderAll();
            }
          })),
        ]);
      });
    }
    // Input port: also start a connection drag (rare but possible).
    const inPort = $(".node-port.in", el);
    if (inPort) {
      inPort.addEventListener("mousedown", (e) => { e.stopPropagation(); e.preventDefault(); });
    }
  }

  function startConnectionDrag(fromIdx, e) {
    const wf = activeWorkflow();
    if (!wf) return;
    const fromStep = wf.steps[fromIdx];
    if (!fromStep) return;
    const onMove = (ev) => {
      const rect = $("#canvasContent").getBoundingClientRect();
      const x = (ev.clientX - rect.left) / ui.view.zoom;
      const y = (ev.clientY - rect.top) / ui.view.zoom;
      const fp = fromStep.position;
      const x1 = fp.x + NODE_W, y1 = fp.y + nodeHeight(fromStep) / 2;
      $("#edges").innerHTML = \`<path class="edge-ghost" d="M \${x1} \${y1} C \${x1 + 60} \${y1} \${x - 60} \${y} \${x} \${y}" />\`;
    };
    const onUp = (ev) => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      $("#edges").innerHTML = "";
      // Try to find a target step (hovered node or input port).
      let targetStep = null;
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      if (el) {
        const port = el.closest(".node-port.in");
        const node = el.closest(".node");
        if (port) {
          const idx = parseInt(port.dataset.idx, 10);
          targetStep = wf.steps[idx];
        } else if (node) {
          const idx = parseInt(node.dataset.idx, 10);
          targetStep = wf.steps[idx];
        }
      }
      if (targetStep && targetStep.id !== fromStep.id) {
        if (!fromStep.transitions) fromStep.transitions = [];
        // Check for duplicate.
        if (!fromStep.transitions.find((t) => t.toStepId === targetStep.id)) {
          fromStep.transitions.push({ toStepId: targetStep.id, mode: "default" });
          renderAll();
          toast("Connection added", "ok");
        } else {
          toast("Connection already exists", "warn");
        }
      }
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  function renderEdges(wf) {
    const svg = $("#edges");
    if (wf.steps.length === 0) { svg.innerHTML = ""; return; }
    const parts = [];
    parts.push(\`
      <defs>
        <marker id="ah-default" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--ok)"/>
        </marker>
        <marker id="ah-force" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--accent)"/>
        </marker>
        <marker id="ah-eval" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--warn)"/>
        </marker>
        <marker id="ah-conditional" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--code)"/>
        </marker>
      </defs>
    \`);
    // For each step, draw an outgoing edge for each transition.
    for (let i = 0; i < wf.steps.length; i++) {
      const a = wf.steps[i];
      const trs = a.transitions || [];
      for (let tIdx = 0; tIdx < trs.length; tIdx++) {
        const t = trs[tIdx];
        const b = wf.steps.find((x) => x.id === t.toStepId);
        if (!b) continue;
        const ap = a.position, bp = b.position;
        const x1 = ap.x + NODE_W;
        const y1 = ap.y + nodeHeight(a) / 2;
        // Distribute target y based on transition index for branching clarity.
        const yOffset = (tIdx - (trs.length - 1) / 2) * 30;
        const x2 = bp.x;
        const y2 = bp.y + nodeHeight(b) / 2 + yOffset;
        const dx = Math.max(60, Math.abs(x2 - x1) * 0.5);
        const path = \`M \${x1} \${y1} C \${x1 + dx} \${y1} \${x2 - dx} \${y2} \${x2} \${y2}\`;
        const mode = t.mode || "default";
        const selected = (ui.selection.type === "edge" && ui.selection.ref && ui.selection.ref.wfId === wf.id && ui.selection.ref.fromId === a.id && ui.selection.ref.toId === b.id);
        const marker = mode === "force" ? "ah-force" : mode === "eval" ? "ah-eval" : mode === "conditional" ? "ah-conditional" : "ah-default";
        const labelText = mode === "default" ? "" : TRANSITION_MODES.find((m) => m.v === mode)?.l.split(" ")[0] || mode;
        const lx = (x1 + x2) / 2;
        const ly = (y1 + y2) / 2 - 8;
        parts.push(\`
          <g class="edge-group \${selected ? "selected" : ""}" data-from="\${a.id}" data-to="\${b.id}">
            <path class="edge-hit" d="\${path}"/>
            <path class="edge-path \${esc(mode)}" d="\${path}" marker-end="url(#\${marker})"/>
            \${labelText ? '<text class="edge-label" x="' + lx + '" y="' + ly + '">' + esc(labelText) + '</text>' : ""}
          </g>
        \`);
      }
    }
    svg.innerHTML = parts.join("");
    $$(".edge-group", svg).forEach(g => {
      const fromId = g.dataset.from;
      const toId = g.dataset.to;
      g.addEventListener("click", (e) => {
        e.stopPropagation();
        ui.selection = { type: "edge", ref: { wfId: wf.id, fromId, toId } };
        renderPanel();
        renderCanvas();
      });
    });
  }

  // \u2500\u2500 Canvas: pan, zoom, drop \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  function applyTransform() {
    const content = $("#canvasContent");
    content.style.transform = \`translate(\${ui.view.pan.x}px, \${ui.view.pan.y}px) scale(\${ui.view.zoom})\`;
    $("#zoomPct").textContent = Math.round(ui.view.zoom * 100) + "%";
  }
  function setupCanvasEvents() {
    const canvas = $("#canvas");
    canvas.addEventListener("mousedown", (e) => {
      const onNode = e.target.closest(".node");
      const onEdge = e.target.closest(".edge-group");
      const onPort = e.target.classList.contains("node-port");
      if (onNode || onEdge || onPort) return;
      if (e.button === 1 || (e.button === 0 && spaceHeld)) {
        startPan(e);
      } else if (e.button === 0) {
        ui.selection = ui.activeWorkflowId ? { type: "workflow", ref: ui.activeWorkflowId } : { type: null, ref: null };
        renderPanel(); renderCanvas();
      }
    });
    canvas.addEventListener("contextmenu", (e) => {
      if (e.target.closest(".node") || e.target.closest(".edge-group")) return;
      e.preventDefault();
      const wf = activeWorkflow();
      if (!wf) return;
      const me = $("#canvasContent").getBoundingClientRect();
      const x = snap((e.clientX - me.left) / ui.view.zoom - NODE_W / 2);
      const y = snap((e.clientY - me.top) / ui.view.zoom - 40);
      showContextMenu(e.clientX, e.clientY, [
        { label: "Add task step here", action: () => addStepAtPoint("task", x, y) },
        { label: "Add delay step here", action: () => addStepAtPoint("delay", x, y) },
        { label: "Add code step here", action: () => addStepAtPoint("code", x, y) },
        { divider: true },
        { label: "Auto-layout", action: autoLayout },
        { label: "Fit to view", action: fitToView, shortcut: "F" },
        { label: "Edit workflow", action: () => { ui.selection = { type: "workflow", ref: wf.id }; renderAll(); } },
      ]);
    });
    canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
        zoomAt(e.clientX, e.clientY, factor);
      } else {
        ui.view.pan.x -= e.deltaX;
        ui.view.pan.y -= e.deltaY;
        applyTransform();
      }
    }, { passive: false });
    canvas.addEventListener("dragover", (e) => {
      if (e.dataTransfer.types.includes("text/plain")) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        canvas.classList.add("drag-over");
      }
    });
    canvas.addEventListener("dragleave", () => canvas.classList.remove("drag-over"));
    canvas.addEventListener("drop", (e) => {
      e.preventDefault();
      canvas.classList.remove("drag-over");
      let payload;
      try { payload = JSON.parse(e.dataTransfer.getData("text/plain")); } catch { return; }
      const me = $("#canvasContent").getBoundingClientRect();
      const x = snap((e.clientX - me.left) / ui.view.zoom - NODE_W / 2);
      const y = snap((e.clientY - me.top) / ui.view.zoom - 30);
      if (payload.kind === "lib-task" && payload.taskId) {
        addStepAtPoint("task", x, y, { taskId: payload.taskId });
      } else if (payload.kind === "step-template") {
        addStepAtPoint(payload.stepKind, x, y);
      }
    });
  }
  function startPan(e) {
    const startX = e.clientX, startY = e.clientY;
    const startPan = { ...ui.view.pan };
    const canvas = $("#canvas");
    canvas.classList.add("panning");
    const onMove = (ev) => {
      ui.view.pan.x = startPan.x + (ev.clientX - startX);
      ui.view.pan.y = startPan.y + (ev.clientY - startY);
      applyTransform();
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      canvas.classList.remove("panning");
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }
  function zoomAt(clientX, clientY, factor) {
    const rect = $("#canvas").getBoundingClientRect();
    const cx = clientX - rect.left, cy = clientY - rect.top;
    const oldZoom = ui.view.zoom;
    const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, oldZoom * factor));
    const ratio = newZoom / oldZoom;
    ui.view.pan.x = cx - (cx - ui.view.pan.x) * ratio;
    ui.view.pan.y = cy - (cy - ui.view.pan.y) * ratio;
    ui.view.zoom = newZoom;
    applyTransform(); renderMinimap();
  }
  function fitToView() {
    const wf = activeWorkflow();
    if (!wf || wf.steps.length === 0) { ui.view.pan = { x: 60, y: 60 }; ui.view.zoom = 1; applyTransform(); return; }
    const xs = wf.steps.map(s => s.position.x);
    const ys = wf.steps.map(s => s.position.y);
    const widths = wf.steps.map(s => NODE_W);
    const heights = wf.steps.map(s => nodeHeight(s));
    const minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs.map((x, i) => x + widths[i]));
    const minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys.map((y, i) => y + heights[i]));
    const w = maxX - minX, h = maxY - minY;
    const rect = $("#canvas").getBoundingClientRect();
    const padding = 60;
    const sx = (rect.width - padding * 2) / w;
    const sy = (rect.height - padding * 2) / h;
    const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.min(sx, sy, 1)));
    ui.view.zoom = z;
    ui.view.pan.x = padding - minX * z + (rect.width - padding * 2 - w * z) / 2;
    ui.view.pan.y = padding - minY * z + (rect.height - padding * 2 - h * z) / 2;
    applyTransform();
  }
  function autoLayout() {
    const wf = activeWorkflow();
    if (!wf || wf.steps.length === 0) return;
    const gapX = 100;
    wf.steps.forEach((s, i) => { s.position = { x: 60 + i * (NODE_W + gapX), y: 60 }; });
    renderAll();
    fitToView();
    toast("Auto-layout applied", "ok");
  }

  // Add a step of the given kind at a given canvas position.
  function addStepAtPoint(kind, x, y, extra) {
    const wf = activeWorkflow();
    if (!wf) { toast("No active workflow", "error"); return; }
    let step;
    if (kind === "task") {
      if (extra && extra.taskId) step = defaultStepForTask(extra.taskId);
      else if (state.tasks.length > 0) step = defaultStepForTask(state.tasks[0].id);
      else { toast("Create a task first", "warn"); return; }
    } else if (kind === "delay") {
      step = defaultStepForDelay();
    } else if (kind === "code") {
      step = defaultStepForCode();
    } else {
      toast("Unknown step kind: " + kind, "error"); return;
    }
    step.position = { x: (x == null ? 60 : x), y: (y == null ? 60 : y) };
    wf.steps.push(step);
    renderAll();
    toast(kind[0].toUpperCase() + kind.slice(1) + " step added", "ok");
  }

  // \u2500\u2500 Minimap \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  function renderMinimap() {
    const wf = activeWorkflow();
    const mm = $("#minimap");
    if (!wf || wf.steps.length === 0) { mm.style.display = "none"; return; }
    mm.style.display = "block";
    const svg = $("#mmSvg");
    const W = 180, H = 100;
    const xs = wf.steps.map(s => s.position.x);
    const ys = wf.steps.map(s => s.position.y);
    const minX = Math.min.apply(null, xs), minY = Math.min.apply(null, ys);
    const maxX = Math.max.apply(null, wf.steps.map((s) => s.position.x + NODE_W));
    const maxY = Math.max.apply(null, wf.steps.map((s) => s.position.y + nodeHeight(s)));
    const w = maxX - minX || 1, h = maxY - minY || 1;
    const scale = Math.min((W - 8) / w, (H - 8) / h);
    const offX = 4 - minX * scale, offY = 4 - minY * scale;
    svg.innerHTML = \`<rect x="0" y="0" width="\${W}" height="\${H}" fill="var(--bg-3)"/>\` +
      wf.steps.map((s) => {
        const color = s.stepKind === "delay" ? "var(--delay)" :
                      s.stepKind === "code" ? "var(--code)" :
                      ((stepTask(s) || {}).color || "var(--accent)");
        return \`<rect x="\${s.position.x * scale + offX}" y="\${s.position.y * scale + offY}" width="\${NODE_W * scale}" height="\${nodeHeight(s) * scale}" rx="2" fill="\${color}"/>\`;
      }).join("");
  }

  // \u2500\u2500 Property panel \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  function renderPanel() {
    const sel = ui.selection;
    const panel = $("#panel");
    const tag = $("#panelTag");
    const title = $("#panelTitle");
    const body = $("#panelBody");
    if (!sel || !sel.type) { panel.classList.remove("open"); return; }
    panel.classList.add("open");
    if (sel.type === "workflow") {
      const w = findWorkflow(sel.ref);
      if (!w) { panel.classList.remove("open"); return; }
      tag.className = "panel-tag workflow"; tag.textContent = "workflow";
      title.textContent = w.name || "(unnamed)";
      body.innerHTML = editorWorkflowHtml(w);
    } else if (sel.type === "step") {
      const wf = findWorkflow(sel.ref.wfId);
      const s = wf && wf.steps[sel.ref.idx];
      if (!wf || !s) { panel.classList.remove("open"); return; }
      const kind = s.stepKind || "task";
      tag.className = "panel-tag " + kind; tag.textContent = kind;
      title.textContent = (kind === "task" ? "Task step" : kind === "delay" ? "Delay step" : "Code step") + " #" + (sel.ref.idx + 1);
      body.innerHTML = editorStepHtml(s, wf);
    } else if (sel.type === "edge") {
      const wf = findWorkflow(sel.ref.wfId);
      if (!wf) { panel.classList.remove("open"); return; }
      const fromStep = wf.steps.find((s) => s.id === sel.ref.fromId);
      const toStep = wf.steps.find((s) => s.id === sel.ref.toId);
      const t = (fromStep && fromStep.transitions || []).find((t) => t.toStepId === sel.ref.toId);
      if (!fromStep || !toStep || !t) { panel.classList.remove("open"); return; }
      tag.className = "panel-tag edge"; tag.textContent = "edge";
      title.textContent = "Transition";
      body.innerHTML = editorEdgeHtml(t, fromStep, toStep, wf);
    } else if (sel.type === "task") {
      const t = findTask(sel.ref);
      if (!t) { panel.classList.remove("open"); return; }
      tag.className = "panel-tag task"; tag.textContent = "task";
      title.textContent = t.name || "(unnamed)";
      body.innerHTML = editorTaskHtml(t);
    }
    wirePanelFields();
  }

  function editorTaskHtml(t) {
    const isCodex = t.taskKind === "codex";
    const isCopilot = t.taskKind === "copilot";
    const isCode = t.taskKind === "code";
    const taskMode = isCopilot ? "copilot" : isCode ? "code" : isCodex ? (t.interactiveTerminal ? "codex-app" : "codex") : (t.interactiveTerminal ? "opencode-cli" : "opencode");
    const modelOptions = uniqueOptions(isCodex ? meta.availableCodexModels : meta.availableModels, isCodex ? [] : MODEL_PRESETS, t.model);
    const agentOptions = uniqueOptions(meta.availableAgents, AGENT_PRESETS, t.agent);
    const modelSource = isCodex ? meta.availableCodexModels : meta.availableModels;
    const modelHint = modelSource.length ? modelSource.length + " model(s) loaded from AutoOC" : "No discovered models loaded yet";
    const agentHint = meta.availableAgents.length ? meta.availableAgents.length + " agent(s) loaded from AutoOC" : "No discovered agents loaded yet";
    const engineFields = isCopilot ? \`
      <div class="field"><label>Copilot model</label><input data-f="model" value="\${esc(t.model || "")}" placeholder="\${esc(meta.defaultCopilotModel || "Automatic")}" /><div class="hint-inline">Use a model ID available to your Copilot account. Empty uses the AutoOC default, then the CLI default.</div></div>
      <div class="field"><label class="checkbox-row"><input type="checkbox" data-f="copilotAllowAllTools" \${t.copilotAllowAllTools ? "checked" : ""} /> Allow tools automatically</label><div class="hint-inline">Allow file edits and commands without asking. Off exposes only file reading and search tools. Folder and URL permissions remain controlled by Copilot.</div></div>\` : isCode ? \`
      <div class="field"><label>JavaScript code</label><textarea data-f="code" rows="8">\${esc(t.code || t.prompt || "")}</textarea><div class="hint-inline">Code tasks run locally with their configured permissions.</div></div>\` : isCodex ? \`
      <div class="row-2">
        <div class="field"><label>Codex model</label><input data-f="model" list="dlModels" value="\${esc(t.model || "")}" placeholder="Automatic" />\${dataListHtml("dlModels", modelOptions)}<div class="hint-inline">\${esc(modelHint)}</div><button type="button" class="tiny btn-refresh-codex-models">\u{1F504} Refresh Codex Models</button></div>
        <div class="field"><label>Reasoning effort</label><select data-f="reasoningEffort">\${["minimal","low","medium","high","xhigh","max","ultra"].map(e => '<option value="' + e + '" ' + ((t.reasoningEffort || meta.defaultCodexReasoningEffort) === e ? "selected" : "") + '>' + e + '</option>').join("")}</select></div>
      </div>
      <div class="field"><label class="checkbox-row"><input type="checkbox" data-f="interactiveTerminal" \${t.interactiveTerminal ? "checked" : ""} /> Open ChatGPT / Codex when this task starts</label></div>\` : \`
      <div class="row-2">
        <div class="field"><label>OpenCode model</label><input data-f="model" list="dlModels" value="\${esc(t.model)}" placeholder="opencode/..." />\${dataListHtml("dlModels", modelOptions)}<div class="hint-inline">\${esc(modelHint)}</div><button type="button" class="tiny btn-refresh-models">\u{1F504} Refresh Models</button></div>
        <div class="field"><label>Agent</label><input data-f="agent" list="dlAgents" value="\${esc(t.agent)}" />\${dataListHtml("dlAgents", agentOptions)}<div class="hint-inline">\${esc(agentHint)}</div><button type="button" class="tiny btn-refresh-agents">\u{1F504} Refresh Agents</button></div>
      </div>
      <div class="field" style="background:var(--accent-soft);border:1px solid var(--accent);border-radius:4px;padding:6px 10px;margin-top:-2px"><label class="checkbox-row" style="margin:0"><input type="checkbox" data-f="forceModel" \${t.forceModel ? "checked" : ""} style="width:auto" /> <strong style="color:var(--accent)">Force model</strong> <span class="hint-inline">skip --agent; use exactly the selected model</span></label></div>
      <div class="field"><label class="checkbox-row"><input type="checkbox" data-f="interactiveTerminal" \${t.interactiveTerminal ? "checked" : ""} /> Open as an interactive OpenCode CLI task</label></div>
      <div class="field"><label class="checkbox-row"><input type="checkbox" data-f="useRalphLoop" \${t.useRalphLoop ? "checked" : ""} /> Use Ralph Loop</label></div>\`;
    return \`
      <div class="field"><label>Name *</label><input data-f="name" value="\${esc(t.name)}" /></div>
      <div class="field"><label>Task type</label><select data-f="taskMode"><option value="opencode" \${taskMode === "opencode" ? "selected" : ""}>OpenCode</option><option value="opencode-cli" \${taskMode === "opencode-cli" ? "selected" : ""}>OpenCode CLI</option><option value="codex" \${taskMode === "codex" ? "selected" : ""}>Codex (background)</option><option value="codex-app" \${taskMode === "codex-app" ? "selected" : ""}>ChatGPT / Codex</option><option value="copilot" \${taskMode === "copilot" ? "selected" : ""}>GitHub Copilot CLI</option><option value="code" \${taskMode === "code" ? "selected" : ""}>Local JavaScript</option></select></div>
      \${isCode ? "" : '<div class="field"><label>Prompt</label><textarea data-f="prompt" rows="5">' + esc(t.prompt) + '</textarea></div>'}
      \${engineFields}
      <div class="row-2">
        <div class="field"><label>Icon</label><select data-f="icon">\${["\u26A1","\u2728","\u{1F9E0}","\u{1F4DD}","\u{1F50D}","\u{1F4A1}","\u{1F6E0}","\u{1F4CA}","\u{1F4E5}","\u{1F4E4}","\u{1F504}","\u{1F680}","\u{1F916}","\u{1F4DA}","\u{1F9EA}","\u{1F514}"].map(i => '<option value="' + esc(i) + '" ' + (t.icon === i ? "selected" : "") + '>' + esc(i) + '</option>').join("")}</select></div>
        <div class="field"><label>Color</label><select data-f="color">\${["#4a7dff","#b07ad9","#6ec27c","#d8a657","#e879b3","#5fb3d4","#e06c75"].map(c => '<option value="' + esc(c) + '" ' + (t.color === c ? "selected" : "") + ' style="color:' + esc(c) + '">\u25CF ' + esc(c) + '</option>').join("")}</select></div>
      </div>
      <div class="section">
        <h4>Schedule</h4>
        <div class="row-2">
          <div class="field"><label>Type</label><select data-f="scheduleType">\${SCHEDULE_TYPES.map(s => '<option value="' + s.v + '" ' + (t.scheduleType === s.v ? "selected" : "") + '>' + s.l + '</option>').join("")}</select></div>
          <div class="field"><label>Time</label><input data-f="scheduleTime" value="\${esc(t.scheduleTime)}" /></div>
        </div>
        <div class="sched-once" style="\${t.scheduleType === "once" ? "" : "display:none"}"><div class="field"><label>Date</label><input data-f="scheduleDate" value="\${esc(t.scheduleDate)}" /></div></div>
        <div class="sched-weekly" style="\${t.scheduleType === "weekly" ? "" : "display:none"}"><div class="field"><label>Days</label><div style="display:flex;gap:4px;flex-wrap:wrap">\${["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d, i) => '<label class="checkbox-row" style="background:var(--bg-3);padding:3px 6px;border-radius:4px;font-size:11px"><input type="checkbox" data-f="scheduleDays" data-day="' + i + '" ' + (t.scheduleDays.includes(i) ? "checked" : "") + ' />' + d + '</label>').join("")}</div></div></div>
        <div class="sched-monthly" style="\${t.scheduleType === "monthly" ? "" : "display:none"}"><div class="field"><label>Days of month</label><input data-f="scheduleMonthDays" value="\${esc((t.scheduleMonthDays || []).join(","))}" /></div></div>
        <div class="sched-interval" style="\${t.scheduleType === "interval" ? "" : "display:none"}"><div class="row-2"><div class="field"><label>Every</label><input type="number" min="1" data-f="scheduleIntervalValue" value="\${t.scheduleIntervalValue || 10}" /></div><div class="field"><label>Unit</label><select data-f="scheduleIntervalUnit">\${INTERVAL_UNITS.map(u => '<option value="' + u.v + '" ' + (t.scheduleIntervalUnit === u.v ? "selected" : "") + '>' + u.l + '</option>').join("")}</select></div></div></div>
      </div>
      <div class="section">
        <h4>Git</h4>
        <div class="field"><label>Project path</label><input data-f="workingDirectory" value="\${esc(t.workingDirectory || "")}" placeholder="Empty = global setting / vault root" /></div>
        \${isCopilot || isCodex ? '<div class="hint-inline">This engine uses the branch currently checked out in this folder.</div>' : isCode ? "" : '<div class="field"><label>Branch</label><input data-f="branch" value="' + esc(t.branch) + '" /></div><div class="field"><label class="checkbox-row"><input type="checkbox" data-f="createBranch" ' + (t.createBranch ? "checked" : "") + ' /> Create branch if missing</label></div>'}
      </div>
      <div class="section">
        <h4>Usage</h4>
        <div class="hint-inline">\${(() => {
          const usedIn = state.workflows.filter(w => w.steps.some(s => s.taskId === t.id));
          if (usedIn.length === 0) return "Not used in any workflow yet.";
          return "Used in " + usedIn.length + " workflow" + (usedIn.length > 1 ? "s" : "") + ": " + usedIn.map(w => esc(w.name)).join(", ");
        })()}</div>
      </div>
    \`;
  }

  function editorWorkflowHtml(w) {
    return \`
      <div class="field"><label>Name *</label><input data-f="name" value="\${esc(w.name)}" /></div>
      <div class="field"><label>Description</label><textarea data-f="description" rows="2">\${esc(w.description)}</textarea></div>
      <div class="row-2">
        <div class="field"><label>Color</label><select data-f="color">\${["#b07ad9","#4a7dff","#6ec27c","#d8a657","#e879b3","#5fb3d4","#e06c75"].map(c => '<option value="' + esc(c) + '" ' + (w.color === c ? "selected" : "") + ' style="color:' + esc(c) + '">\u25CF ' + esc(c) + '</option>').join("")}</select></div>
        <div class="field"><label>Steps</label><div style="padding:6px 8px;background:var(--bg-3);border-radius:4px;font-size:12px">\${w.steps.length}</div></div>
      </div>
      <div class="section">
        <h4>Schedule</h4>
        <div class="row-2">
          <div class="field"><label>Type</label><select data-f="scheduleType">\${SCHEDULE_TYPES.map(s => '<option value="' + s.v + '" ' + (w.scheduleType === s.v ? "selected" : "") + '>' + s.l + '</option>').join("")}</select></div>
          <div class="field"><label>Time</label><input data-f="scheduleTime" value="\${esc(w.scheduleTime)}" /></div>
        </div>
        <div class="sched-once" style="\${w.scheduleType === "once" ? "" : "display:none"}"><div class="field"><label>Date</label><input data-f="scheduleDate" value="\${esc(w.scheduleDate)}" /></div></div>
        <div class="sched-weekly" style="\${w.scheduleType === "weekly" ? "" : "display:none"}"><div class="field"><label>Days</label><div style="display:flex;gap:4px;flex-wrap:wrap">\${["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d, i) => '<label class="checkbox-row" style="background:var(--bg-3);padding:3px 6px;border-radius:4px;font-size:11px"><input type="checkbox" data-f="scheduleDays" data-day="' + i + '" ' + (w.scheduleDays.includes(i) ? "checked" : "") + ' />' + d + '</label>').join("")}</div></div></div>
        <div class="sched-monthly" style="\${w.scheduleType === "monthly" ? "" : "display:none"}"><div class="field"><label>Days</label><input data-f="scheduleMonthDays" value="\${esc((w.scheduleMonthDays || []).join(","))}" /></div></div>
        <div class="sched-interval" style="\${w.scheduleType === "interval" ? "" : "display:none"}"><div class="row-2"><div class="field"><label>Every</label><input type="number" min="1" data-f="scheduleIntervalValue" value="\${w.scheduleIntervalValue || 10}" /></div><div class="field"><label>Unit</label><select data-f="scheduleIntervalUnit">\${INTERVAL_UNITS.map(u => '<option value="' + u.v + '" ' + (w.scheduleIntervalUnit === u.v ? "selected" : "") + '>' + u.l + '</option>').join("")}</select></div></div></div>
      </div>
      <div class="section">
        <h4>Handoffs</h4>
        <div class="field"><label class="checkbox-row"><input type="checkbox" data-f="handoffOutput" \${w.handoffOutput ? "checked" : ""} /> Pass output to next step</label></div>
        <div class="field"><label class="checkbox-row"><input type="checkbox" data-f="handoffBranch" \${w.handoffBranch ? "checked" : ""} /> Pass git branch between steps</label></div>
      </div>
    \`;
  }

  function editorStepHtml(s, wf) {
    const kind = s.stepKind || "task";
    let body = "";
    if (kind === "task") {
      const t = stepTask(s);
      const currentModel = t ? esc(t.model || "(no model)") : "(no task selected)";
      const checkedAttr = t && t.forceModel ? "checked" : "";
      body = \`
        <div class="field"><label>Task</label><select data-f="taskId">\${state.tasks.map(x => '<option value="' + x.id + '" ' + (x.id === s.taskId ? "selected" : "") + '>' + esc((x.icon || "\u26A1") + " " + (x.name || "(unnamed)")) + '</option>').join("")}</select></div>
        \${t ? '<div class="field"><label class="checkbox-row" style="margin-top:2px"><input type="checkbox" class="chk-step-force-model" ' + checkedAttr + ' /> <strong>Force model</strong> <span class="hint-inline">model: ' + currentModel + '</span></label></div>' : ""}
        \${t ? '<div class="hint-inline">' + esc((t.prompt || "(no prompt)").slice(0, 200)) + ((t.prompt || "").length > 200 ? "\u2026" : "") + '</div>' : ""}
      \`;
    } else if (kind === "delay") {
      body = \`
        <div class="row-2">
          <div class="field"><label>Wait value</label><input type="number" min="0" data-f="delayValue" value="\${esc(s.delayValue || 0)}" /></div>
          <div class="field"><label>Unit</label><select data-f="delayUnit">\${INTERVAL_UNITS.map(u => '<option value="' + u.v + '" ' + (s.delayUnit === u.v ? "selected" : "") + '>' + u.l + '</option>').join("")}</select></div>
        </div>
        <div class="hint-inline">The workflow pauses for the specified time before continuing to the next step.</div>
      \`;
    } else if (kind === "code") {
      body = \`
        <div class="row-2">
          <div class="field"><label>Input variable</label><input data-f="codeInputVar" value="\${esc(s.codeInputVar || "input")}" /></div>
          <div class="field"><label>Output variable</label><input data-f="codeOutputVar" value="\${esc(s.codeOutputVar || "output")}" /></div>
        </div>
        <div class="field"><label>JavaScript code</label><textarea data-f="code" rows="9" style="font-family:ui-monospace,Consolas,monospace;font-size:11.5px" placeholder="// input is the previous step's output as a string&#10;// set output to the value passed to the next step">\${esc(s.code || "")}</textarea></div>
        <div class="section"><h4>Permissions</h4>
          <div class="field"><label class="checkbox-row"><input type="checkbox" data-f="codeAllowVault" \${s.codeAllowVault ? "checked" : ""} /> Vault API (vault.read/write/list)</label></div>
          <div class="field"><label class="checkbox-row"><input type="checkbox" data-f="codeAllowFiles" \${s.codeAllowFiles ? "checked" : ""} /> Local files API (files.read/write/list)</label></div>
          <div class="field"><label class="checkbox-row"><input type="checkbox" data-f="codeAllowTerminal" \${s.codeAllowTerminal ? "checked" : ""} /> Terminal API (terminal.run)</label></div>
        </div>
        <div class="hint-inline">Available globals: <code>input</code>, <code>outputs</code> (map of stepId \u2192 output), <code>JSON</code>, <code>Math</code>, <code>Date</code>. The result of the expression assigned to <code>\${esc(s.codeOutputVar || "output")}</code> is passed to the next step.</div>
      \`;
    }
    return \`
      \${body}
      <div class="section">
        <h4>Outgoing transitions (\${(s.transitions || []).length})</h4>
        \${(s.transitions || []).map((t, i) => {
          const target = wf.steps.find((x) => x.id === t.toStepId);
          if (!target) return '<div class="hint-inline">\u26A0 Target step missing</div>';
          const targetName = target.stepKind === "task" ? ((stepTask(target) || {}).name || "(task)") :
                            target.stepKind === "delay" ? "\u23F1 " + target.delayValue + " " + target.delayUnit :
                            "{ } Code";
          return \`
            <div style="display:flex;align-items:center;gap:6px;padding:4px 0;border-bottom:1px solid var(--border-soft)">
              <span class="chip" style="background:var(--bg-3);font-size:10px">\${esc((TRANSITION_MODES.find(m => m.v === (t.mode || "default")) || {}).l || t.mode || "default")}</span>
              <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px">\u2192 \${esc(targetName)}</span>
              <button class="tiny btn-edit-edge" data-i="\${i}">\u2699</button>
              <button class="tiny btn-del-edge danger" data-i="\${i}">\u2715</button>
            </div>
          \`;
        }).join("") || '<div class="hint-inline">No outgoing transitions. Drag the output port to another node, or click the <b>+</b> on the node to add one.</div>'}
        <div style="margin-top:8px"><button class="tiny" id="btnAddTransition">+ Add transition</button></div>
      </div>
      <div class="section">
        <h4>Step id</h4>
        <div class="hint-inline" style="font-family:ui-monospace,monospace;font-size:10.5px">\${esc(s.id)}</div>
      </div>
    \`;
  }

  function editorEdgeHtml(t, fromStep, toStep, wf) {
    const fromName = fromStep.stepKind === "task" ? ((stepTask(fromStep) || {}).name || "(task)") :
                      fromStep.stepKind === "delay" ? "\u23F1 " + fromStep.delayValue + " " + fromStep.delayUnit :
                      "{ } Code";
    const toName = toStep.stepKind === "task" ? ((stepTask(toStep) || {}).name || "(task)") :
                    toStep.stepKind === "delay" ? "\u23F1 " + toStep.delayValue + " " + toStep.delayUnit :
                    "{ } Code";
    return \`
      <div class="hint-inline">From <b>\${esc(fromName)}</b> to <b>\${esc(toName)}</b></div>
      <div class="section">
        <h4>Transition mode</h4>
        <div class="field"><label>Mode</label><select data-f="mode">\${TRANSITION_MODES.map(m => '<option value="' + m.v + '" ' + (t.mode === m.v ? "selected" : "") + '>' + esc(m.l) + '</option>').join("")}</select></div>
        <div class="hint-inline" id="transDesc">\${esc((TRANSITION_MODES.find(m => m.v === t.mode) || {}).desc || "")}</div>
      </div>
      <div class="section sched-eval" style="\${t.mode === "eval" ? "" : "display:none"}">
        <h4>Evaluation prompt (AI)</h4>
        <div class="field"><label>Prompt</label><textarea data-f="evaluatePrompt" rows="3" placeholder="How should the AI decide?">\${esc(t.evaluatePrompt || "")}</textarea></div>
      </div>
      <div class="section sched-conditional" style="\${t.mode === "conditional" ? "" : "display:none"}">
        <h4>JavaScript condition</h4>
        <div class="field"><label>Expression (return truthy to follow)</label><textarea data-f="condition" rows="4" style="font-family:ui-monospace,Consolas,monospace;font-size:11.5px" placeholder="// input: previous step output as string&#10;// outputs: { stepId: output, ... }&#10;return input.includes('success');">\${esc(t.condition || "")}</textarea></div>
        <div class="hint-inline">Return truthy to follow this edge. Has access to: <code>input</code> (last output), <code>outputs</code> (map of stepId \u2192 output), <code>JSON</code>, <code>Math</code>, <code>Date</code>.</div>
      </div>
      <div class="section">
        <h4>Force continue</h4>
        <div class="field"><label class="checkbox-row"><input type="checkbox" data-f="forceContinue" \${t.forceContinue ? "checked" : ""} /> Skip all checks and always follow</label></div>
      </div>
    \`;
  }

  function wirePanelFields() {
    const body = $("#panelBody");
    const sel = ui.selection;
    if (!sel || !sel.type) return;
    $$("[data-f]", body).forEach(el => {
      el.addEventListener("input", onPanelField);
      el.addEventListener("change", onPanelField);
    });
    function onPanelField() {
      const target = getTarget();
      if (!target) return;
      const f = this.dataset.f;
      let v = this.type === "checkbox" ? this.checked : (this.type === "number" ? (parseInt(this.value, 10) || 0) : this.value);
      if (f === "scheduleDays") {
        const day = parseInt(this.dataset.day, 10);
        target.scheduleDays = target.scheduleDays || [];
        if (this.checked) { if (!target.scheduleDays.includes(day)) target.scheduleDays.push(day); }
        else target.scheduleDays = target.scheduleDays.filter(x => x !== day);
        target.scheduleDays.sort((a, b) => a - b);
      } else if (f === "scheduleMonthDays" && typeof v === "string") {
        target.scheduleMonthDays = v.split(/[;,\\s]+/).map(x => parseInt(x, 10)).filter(x => !isNaN(x) && x >= 1 && x <= 31);
      } else if (f !== "taskMode") {
        target[f] = v;
      }
      if (f === "code" && target.taskKind === "code") target.prompt = String(v);
      if (f === "taskMode" && sel.type === "task") {
        target.taskKind = v === "code" ? "code" : v === "copilot" ? "copilot" : (v === "codex" || v === "codex-app") ? "codex" : "opencode";
        target.interactiveTerminal = v === "opencode-cli" || v === "codex-app";
        if (target.taskKind !== "copilot") delete target.copilotAllowAllTools;
        if (target.taskKind === "codex") {
          target.model = "";
          target.agent = "";
          target.forceModel = false;
          target.useRalphLoop = false;
          target.reasoningEffort = meta.defaultCodexReasoningEffort || "medium";
          target.branch = "";
          target.createBranch = false;
        } else if (target.taskKind === "copilot") {
          target.model = meta.defaultCopilotModel || "";
          target.agent = "";
          target.forceModel = false;
          target.useRalphLoop = false;
          target.copilotAllowAllTools = false;
          target.branch = "";
          target.createBranch = false;
          delete target.reasoningEffort;
        } else if (target.taskKind === "opencode") {
          target.model = optionValue(meta.availableModels[0]) || "";
          target.agent = optionValue(meta.availableAgents[0]) || "build";
          delete target.reasoningEffort;
        } else {
          target.model = "";
          target.agent = "";
          target.code = target.code || target.prompt || "// Set output to pass data forward\\noutput = input;";
          target.prompt = target.code;
          target.forceModel = false;
          target.useRalphLoop = false;
          target.interactiveTerminal = false;
          delete target.reasoningEffort;
        }
      }
      if (f === "scheduleType") {
        body.querySelectorAll(".sched-once, .sched-weekly, .sched-monthly, .sched-interval").forEach(el => el.style.display = "none");
        const el = body.querySelector(".sched-" + target.scheduleType);
        if (el) el.style.display = "";
      }
      if (f === "transitionMode" || f === "mode") {
        const t = getTarget();
        const mode = t && t.mode;
        body.querySelectorAll(".sched-eval, .sched-conditional").forEach(el => el.style.display = "none");
        const el = mode && body.querySelector(".sched-" + mode);
        if (el) el.style.display = "";
        const desc = body.querySelector("#transDesc");
        if (desc) desc.textContent = (TRANSITION_MODES.find(m => m.v === mode) || {}).desc || "";
      }
      isDirty = true;
      if (f === "copilotAllowAllTools") renderTaskLibrary();
      if (sel.type === "step" || sel.type === "edge" || f === "name" || f === "icon" || f === "color" || f === "taskId" || f === "taskMode") renderAll();
      else renderCanvas();
    }
    function getTarget() {
      if (sel.type === "task") return findTask(sel.ref);
      if (sel.type === "workflow") return findWorkflow(sel.ref);
      if (sel.type === "step") {
        const wf = findWorkflow(sel.ref.wfId);
        return wf && wf.steps[sel.ref.idx];
      }
      if (sel.type === "edge") {
        const wf = findWorkflow(sel.ref.wfId);
        const from = wf && wf.steps.find(s => s.id === sel.ref.fromId);
        return from && from.transitions.find(t => t.toStepId === sel.ref.toId);
      }
      return null;
    }
    // Edit/Delete edge buttons inside step editor
    $$(".btn-edit-edge", body).forEach(b => b.addEventListener("click", () => {
      const i = parseInt(b.dataset.i, 10);
      const wf = findWorkflow(sel.ref.wfId);
      const s = wf && wf.steps[sel.ref.idx];
      if (!s || !s.transitions[i]) return;
      ui.selection = { type: "edge", ref: { wfId: wf.id, fromId: s.id, toId: s.transitions[i].toStepId } };
      renderAll();
    }));
    $$(".btn-del-edge", body).forEach(b => b.addEventListener("click", () => {
      const i = parseInt(b.dataset.i, 10);
      const wf = findWorkflow(sel.ref.wfId);
      const s = wf && wf.steps[sel.ref.idx];
      if (!s) return;
      s.transitions.splice(i, 1);
      renderAll();
    }));
    const addBtn = $("#btnAddTransition", body);
    if (addBtn) addBtn.addEventListener("click", () => {
      const wf = findWorkflow(sel.ref.wfId);
      const s = wf && wf.steps[sel.ref.idx];
      if (!s) return;
      const others = wf.steps.filter((x) => x.id !== s.id);
      if (others.length === 0) { toast("No other steps to connect to", "warn"); return; }
      showContextMenu(addBtn.getBoundingClientRect().left, addBtn.getBoundingClientRect().bottom, [
        ...others.map((o) => ({
          label: (o.stepKind === "delay" ? "\u23F1 " : o.stepKind === "code" ? "{ } " : "\u26A1 ") + (o.stepKind === "task" ? ((stepTask(o) || {}).name || "(task)") : o.stepKind === "delay" ? (o.delayValue + " " + o.delayUnit) : "JavaScript"),
          action: () => {
            if (!s.transitions) s.transitions = [];
            if (s.transitions.find(t => t.toStepId === o.id)) { toast("Already connected", "warn"); return; }
            s.transitions.push({ toStepId: o.id, mode: "default" });
            renderAll();
          }
        })),
      ]);
    });
    $$(".btn-refresh-models", body).forEach(b => b.addEventListener("click", () => requestMetaRefresh("models")));
    $$(".btn-refresh-codex-models", body).forEach(b => b.addEventListener("click", () => requestMetaRefresh("codex-models")));
    $$(".btn-refresh-agents", body).forEach(b => b.addEventListener("click", () => requestMetaRefresh("agents")));
    const stepForceChk = body.querySelector(".chk-step-force-model");
    if (stepForceChk) {
      stepForceChk.addEventListener("change", function() {
        if (sel.type !== "step") return;
        const wf = findWorkflow(sel.ref.wfId);
        const step = wf && wf.steps[sel.ref.idx];
        if (!step) return;
        const task = stepTask(step);
        if (task) {
          task.forceModel = this.checked;
          isDirty = true;
        }
      });
    }
  }

  function requestMetaRefresh(kind) {
    if (!inExtension) {
      toast("Refresh is available inside AutoOC", "warn");
      return;
    }
    try {
      const type = kind === "agents" ? "refresh-agents" : kind === "codex-models" ? "refresh-codex-models" : "refresh-models";
      window.parent.postMessage({ type }, "*");
      toast("Refreshing " + kind + "\u2026", "ok");
    } catch (e) {
      toast("Could not refresh " + kind + ": " + e.message, "error");
    }
  }

  // \u2500\u2500 Context menu \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  function showContextMenu(x, y, items) {
    const m = $("#ctxMenu");
    m.innerHTML = items.map((it, i) => {
      if (it.divider) return '<div class="ctx-divider"></div>';
      return '<div class="ctx-item ' + (it.danger ? "danger" : "") + '" data-i="' + i + '">' + esc(it.label) + (it.shortcut ? '<span class="ctx-shortcut">' + esc(it.shortcut) + '</span>' : "") + '</div>';
    }).join("");
    m.style.left = "0px"; m.style.top = "0px"; m.style.display = "block";
    const rect = m.getBoundingClientRect();
    let left = x, top = y;
    if (left + rect.width > window.innerWidth) left = window.innerWidth - rect.width - 4;
    if (top + rect.height > window.innerHeight) top = window.innerHeight - rect.height - 4;
    m.style.left = left + "px"; m.style.top = top + "px";
    $$(".ctx-item", m).forEach(el => el.addEventListener("click", () => {
      const it = items[+el.dataset.i];
      m.style.display = "none";
      if (it && it.action) it.action();
    }));
    const closeOnClick = (e) => { if (!m.contains(e.target)) { m.style.display = "none"; document.removeEventListener("mousedown", closeOnClick); } };
    setTimeout(() => document.addEventListener("mousedown", closeOnClick), 0);
  }

  // \u2500\u2500 Status bar \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  function renderStatus() {
    const totalSteps = state.workflows.reduce((acc, w) => acc + w.steps.length, 0);
    $("#statTasks").textContent = state.tasks.length + " tasks";
    $("#statWorkflows").textContent = state.workflows.length + " workflows";
    $("#statSteps").textContent = totalSteps + " steps";
    $("#statMsg").textContent = inExtension ? (isDirty ? "Modified \u2014 click Apply to save" : "Connected to AutoOC") : "Standalone mode";
  }

  // \u2500\u2500 High-level actions \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  function newTask() {
    const t = defaultTask();
    state.tasks.push(t);
    renderAll();
    ui.selection = { type: "task", ref: t.id };
    renderPanel();
  }
  function newWorkflow() {
    const w = defaultWorkflow();
    state.workflows.push(w);
    setActiveWorkflow(w.id);
  }
  function closeWorkflow(id) {
    const wf = findWorkflow(id);
    if (!confirm("Delete this workflow?")) return;
    if (wf) {
      const taskIds = [...new Set((wf.steps || []).map(s => s.taskId).filter(Boolean))];
      const taskIdsOnlyUsedHere = taskIds.filter(taskId => !state.workflows.some(other => other.id !== id && (other.steps || []).some(step => step.taskId === taskId)));
      if (taskIdsOnlyUsedHere.length > 0) {
        const sharedCount = taskIds.length - taskIdsOnlyUsedHere.length;
        const sharedNote = sharedCount > 0 ? "\\n\\n" + sharedCount + " task(s) are also used by other workflows and will be kept." : "";
        if (confirm("Also delete " + taskIdsOnlyUsedHere.length + " task(s) used only by this workflow?" + sharedNote)) {
          state.tasks = state.tasks.filter(t => !taskIdsOnlyUsedHere.includes(t.id));
        }
      }
    }
    const idx = state.workflows.findIndex(x => x.id === id);
    state.workflows.splice(idx, 1);
    if (ui.activeWorkflowId === id) {
      const newActive = state.workflows[Math.max(0, idx - 1)] || state.workflows[0];
      ui.activeWorkflowId = newActive ? newActive.id : null;
      ui.selection = newActive ? { type: "workflow", ref: newActive.id } : { type: null, ref: null };
    }
    isDirty = true;
    renderAll();
    if (inExtension) applyToExtension(true);
  }
  function duplicateStep(wfId, idx) {
    const wf = findWorkflow(wfId);
    if (!wf) return;
    const orig = wf.steps[idx];
    if (!orig) return;
    const copy = JSON.parse(JSON.stringify(orig));
    copy.id = uid();
    copy.position = { x: orig.position.x + 40, y: orig.position.y + 60 };
    wf.steps.splice(idx + 1, 0, copy);
    renderAll();
  }
  function removeStep(wfId, idx) {
    if (!confirm("Delete this step?")) return;
    const wf = findWorkflow(wfId);
    if (!wf) return;
    // Also clean up any transitions pointing to this step.
    const removed = wf.steps[idx];
    wf.steps.splice(idx, 1);
    if (removed) {
      for (const s of wf.steps) {
        if (s.transitions) s.transitions = s.transitions.filter(t => t.toStepId !== removed.id);
      }
    }
    renderAll();
  }

  // \u2500\u2500 Validation \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  function validateAll() {
    const issues = [];
    state.workflows.forEach(w => {
      const wIssues = [];
      if (w.steps.length === 0) wIssues.push({ kind: "warn", msg: "Workflow has no steps" });
      w.steps.forEach((s, i) => {
        if (s.stepKind === "task") {
          const t = findTask(s.taskId);
          if (!t) wIssues.push({ kind: "err", msg: "Step " + (i+1) + ": task no longer exists" });
          else if (!t.prompt || !t.prompt.trim()) wIssues.push({ kind: "err", msg: "Step " + (i+1) + " (" + t.name + "): task has no prompt" });
        }
        if (s.stepKind === "code" && (!s.code || !s.code.trim())) {
          wIssues.push({ kind: "err", msg: "Step " + (i+1) + " (code): code is empty" });
        }
        if (s.stepKind === "code" && s.transitions) {
          // Code steps with "eval" transition mode are not supported.
          for (const t of s.transitions) {
            if (t.mode === "eval") {
              wIssues.push({ kind: "warn", msg: "Step " + (i+1) + " (code): AI eval transition from a code step is unusual" });
            }
          }
        }
        if (s.transitions) {
          for (const t of s.transitions) {
            if (t.mode === "conditional" && (!t.condition || !t.condition.trim())) {
              wIssues.push({ kind: "warn", msg: "Step " + (i+1) + " \u2192 step: conditional transition has no expression" });
            }
            if (!wf.steps.find(x => x.id === t.toStepId)) {
              wIssues.push({ kind: "err", msg: "Step " + (i+1) + ": transition points to a missing step" });
            }
          }
        }
      });
      if (wIssues.length > 0) issues.push({ wf: w, issues: wIssues });
    });
    return issues;
  }
  function showValidation() {
    const issues = validateAll();
    const root = $("#validationReport");
    if (issues.length === 0) {
      root.innerHTML = '<div style="padding:24px 8px;text-align:center"><div style="font-size:36px;color:var(--ok)">\u2713</div><div style="font-weight:600;margin-top:8px">All workflows look good.</div></div>';
    } else {
      root.innerHTML = issues.map(({ wf, issues }) => {
        return '<div style="margin-bottom:14px"><div style="font-weight:600;margin-bottom:4px">' + esc(wf.name) + '</div><div style="padding-left:14px;border-left:2px solid var(--border-soft)">' +
          issues.map(i => '<div style="display:flex;gap:6px;align-items:flex-start;padding:3px 0"><span class="validation-icon ' + i.kind + '" style="width:14px;height:14px;font-size:9px;flex-shrink:0;margin-top:2px">' + (i.kind === "err" ? "!" : "?") + '</span><span style="font-size:12px">' + esc(i.msg) + '</span></div>').join("") +
          '</div></div>';
      }).join("");
    }
    $("#validationModal").classList.add("open");
  }

  // \u2500\u2500 Library drag (step templates) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  function setupLibraryDrag() {
    $$(".lib-special").forEach(el => {
      el.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", JSON.stringify({ kind: "step-template", stepKind: el.dataset.kind }));
        e.dataTransfer.effectAllowed = "copy";
      });
      el.addEventListener("click", () => {
        // Double-click or click: add at center of canvas
        const wf = activeWorkflow();
        if (!wf) { toast("Open or create a workflow first", "warn"); return; }
        const lastX = wf.steps.length ? Math.max.apply(null, wf.steps.map(s => s.position.x)) + NODE_W + 80 : 60;
        addStepAtPoint(el.dataset.kind, lastX, 60);
      });
    });
  }

  // \u2500\u2500 Wire everything \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  function bindEvents() {
    $("#btnApply").addEventListener("click", () => {
      if (inExtension) applyToExtension();
      else exportJson();
    });
    $("#btnAutoLayout").addEventListener("click", autoLayout);
    $("#btnFit").addEventListener("click", fitToView);
    $("#btnValidate").addEventListener("click", showValidation);
    $("#btnTrace").addEventListener("click", () => {
      ui.traceOn = !ui.traceOn;
      renderCanvas();
      toast(ui.traceOn ? "Trace on" : "Trace off", "ok");
    });
    $("#btnZoomIn").addEventListener("click", () => {
      const r = $("#canvas").getBoundingClientRect();
      zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1.2);
    });
    $("#btnZoomOut").addEventListener("click", () => {
      const r = $("#canvas").getBoundingClientRect();
      zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1 / 1.2);
    });
    $("#btnZoomReset").addEventListener("click", () => {
      const r = $("#canvas").getBoundingClientRect();
      zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1 / ui.view.zoom);
    });
    $("#sbAddTask").addEventListener("click", newTask);
    $("#sbAddWf").addEventListener("click", newWorkflow);
    $("#libSearch").addEventListener("input", renderTaskLibrary);
    $("#panelClose").addEventListener("click", () => { ui.selection = { type: null, ref: null }; renderAll(); });
    $("#panelOk").addEventListener("click", () => { ui.selection = { type: null, ref: null }; renderAll(); });
    $("#panelDelete").addEventListener("click", () => {
      const sel = ui.selection;
      if (sel.type === "task") {
        if (!confirm("Delete this task? It will be removed from every workflow that uses it.")) return;
        state.tasks = state.tasks.filter(t => t.id !== sel.ref);
        state.workflows.forEach(w => { w.steps = w.steps.filter(s => s.taskId !== sel.ref); });
      } else if (sel.type === "workflow") {
        closeWorkflow(sel.ref);
        return;
      } else if (sel.type === "step") {
        removeStep(sel.ref.wfId, sel.ref.idx);
        return;
      } else if (sel.type === "edge") {
        const wf = findWorkflow(sel.ref.wfId);
        const from = wf && wf.steps.find(s => s.id === sel.ref.fromId);
        if (from) from.transitions = (from.transitions || []).filter(t => t.toStepId !== sel.ref.toId);
      }
      ui.selection = { type: null, ref: null };
      renderAll();
    });
    $("#validationClose").addEventListener("click", () => $("#validationModal").classList.remove("open"));
    $("#helpClose").addEventListener("click", () => $("#helpBanner").style.display = "none");

    document.addEventListener("keydown", (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT") return;
      if (e.key === "Delete" || e.key === "Backspace") {
        const sel = ui.selection;
        if (sel.type === "step") { e.preventDefault(); removeStep(sel.ref.wfId, sel.ref.idx); return; }
        if (sel.type === "edge") {
          e.preventDefault();
          const wf = findWorkflow(sel.ref.wfId);
          const from = wf && wf.steps.find(s => s.id === sel.ref.fromId);
          if (from) from.transitions = (from.transitions || []).filter(t => t.toStepId !== sel.ref.toId);
          renderAll();
        }
      }
      if (e.key === "Escape") {
        ui.selection = ui.activeWorkflowId ? { type: "workflow", ref: ui.activeWorkflowId } : { type: null, ref: null };
        renderAll();
      }
      if (e.key === "f" || e.key === "F") { e.preventDefault(); fitToView(); }
      if (e.key === " ") { spaceHeld = true; $("#canvas").classList.add("space-pan"); }
    });
    document.addEventListener("keyup", (e) => { if (e.key === " ") { spaceHeld = false; $("#canvas").classList.remove("space-pan"); } });
  }

  // Use the same portable task/step references as the extension's export.
  function buildStandaloneExport() {
    const taskIds = new Map(state.tasks.map((task, i) => [task.id, "task-" + i]));
    const runtimeFields = ["id", "status", "lastRun", "output", "createdAt", "model", "lastCodexThreadId", "lastCodexTurnId", "pendingCodexApproval"];
    const tasks = state.tasks.map(task => {
      const exported = { ...task, exportId: taskIds.get(task.id) };
      runtimeFields.forEach(field => delete exported[field]);
      return exported;
    });
    const workflows = state.workflows.map((workflow, i) => {
      const exported = { ...workflow, exportId: "wf-" + i, steps: workflow.steps.map(step => {
        const portable = { ...step, taskExportId: taskIds.get(step.taskId) };
        ["taskId", "status", "lastRun", "output"].forEach(field => delete portable[field]);
        return portable;
      }) };
      [...runtimeFields, "currentStep"].forEach(field => delete exported[field]);
      return exported;
    });
    return {
      autoOCExport: {
        schemaVersion: tasks.some(task => task.taskKind === "copilot") ? "1.6.0" : "1.5.0",
        exportedAt: new Date().toISOString(),
        pluginVersion: meta.pluginVersion || "1.6.0",
        name: "Visual Builder export",
        description: "Exported from the standalone Visual Builder",
      },
      tasks,
      workflows,
    };
  }

  // Standalone export (when not running in the extension).
  function exportJson() {
    const data = buildStandaloneExport();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "autooc-visual-export-" + new Date().toISOString().slice(0, 10) + ".json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 100);
    toast("JSON downloaded", "ok");
  }

  // \u2500\u2500 Init \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  function init() {
    setupPostMessage();
    bindEvents();
    setupCanvasEvents();
    setupLibraryDrag();
    renderAll();
    $("#statMsg").textContent = "Waiting for AutoOC\u2026";
  }
  init();
  <\/script>
</body>
</html>
`;
  }
});

// import-utils.js
var require_import_utils = __commonJS({
  "import-utils.js"(exports, module2) {
    function isValidGitBranchName(branch) {
      if (typeof branch !== "string" || !branch || branch === "@" || branch.startsWith("-")) return false;
      if (/[\x00-\x20~^:?*\[\\]/.test(branch)) return false;
      if (branch.includes("..") || branch.includes("@{") || branch.startsWith("/") || branch.endsWith("/") || branch.endsWith(".")) return false;
      return !branch.split("/").some((component) => !component || component === "." || component === ".." || component.startsWith(".") || component.endsWith(".lock"));
    }
    function applyLegacyLinearTransitions(steps) {
      for (let index = 0; index < steps.length - 1; index++) {
        const step = steps[index];
        if (step.transitions !== void 0) continue;
        step.transitions = [{
          toStepId: steps[index + 1].id,
          mode: step.transitionMode || "default",
          evaluatePrompt: step.evaluatePrompt,
          forceContinue: step.forceContinue
        }];
      }
    }
    module2.exports = { applyLegacyLinearTransitions, isValidGitBranchName };
  }
});

// main.ts
var main_exports = {};
__export(main_exports, {
  VIEW_TYPE: () => VIEW_TYPE,
  default: () => AutoOCPlugin
});
module.exports = __toCommonJS(main_exports);

// cli-launchers.ts
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));
var os = __toESM(require("os"));
var crypto = __toESM(require("crypto"));
var import_child_process = require("child_process");
function resolveOpencodeBin(configured) {
  if (configured && configured !== "opencode") return configured;
  const candidates = [];
  if (os.platform() === "win32") {
    candidates.push(`${process.env.APPDATA}\\npm\\opencode.cmd`);
  } else {
    const home = process.env.HOME || "";
    candidates.push(
      `${home}/.bun/bin/opencode`,
      `${home}/.local/bin/opencode`,
      `${home}/.npm-global/bin/opencode`,
      `${home}/bin/opencode`,
      "/opt/homebrew/bin/opencode",
      "/usr/local/bin/opencode"
    );
  }
  const { accessSync, constants } = require("fs");
  for (const candidate of candidates) {
    try {
      accessSync(candidate, constants.X_OK);
      return candidate;
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
function shSingleQuoted(value) {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}
function buildPowerShellEnvLines(env) {
  return Object.entries(env).filter(([key]) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(key)).map(([key, value]) => `$env:${key} = ${psSingleQuoted(value)}`);
}
var SAFE_CLI_PROMPT_LENGTH = 7500;
function isWindows() {
  return process.platform === "win32";
}
function scriptExt() {
  return isWindows() ? ".ps1" : ".sh";
}
function buildShEnvLines(env) {
  return Object.entries(env).filter(([key]) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(key)).map(([key, value]) => `export ${key}=${shSingleQuoted(value)}`);
}
function buildPosixLaunchCommand(bin, cwd, env, args) {
  const envPrefix = Object.entries(env).filter(([key]) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(key)).map(([key, value]) => `${key}=${shSingleQuoted(value)}`).join(" ");
  return `cd ${shSingleQuoted(cwd)} && ${envPrefix ? `${envPrefix} ` : ""}${[bin, ...args].map(shSingleQuoted).join(" ")}`;
}
function appleScriptQuoted(value) {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}
var LINUX_TERMINAL_CANDIDATES = [
  { cmd: "x-terminal-emulator", args: ["-e"] },
  { cmd: "gnome-terminal", args: ["--"] },
  { cmd: "konsole", args: ["-e"] },
  { cmd: "xfce4-terminal", args: ["-e"] },
  { cmd: "lxterminal", args: ["-e"] },
  { cmd: "alacritty", args: ["-e"] },
  { cmd: "xterm", args: ["-e"] }
];
function commandExists(cmd) {
  try {
    const { execSync } = require("child_process");
    execSync(`command -v ${shSingleQuoted(cmd)}`, { stdio: "ignore", timeout: 5e3 });
    return true;
  } catch (e) {
    return false;
  }
}
function resolveLinuxTerminal(configured) {
  if (configured && configured.trim()) {
    const parts = configured.trim().split(/\s+/);
    const cmd = parts.shift();
    if (commandExists(cmd)) return { cmd, args: [...parts, "-e"] };
    return null;
  }
  for (const candidate of LINUX_TERMINAL_CANDIDATES) {
    if (commandExists(candidate.cmd)) return candidate;
  }
  return null;
}
function openOpencodeCli(bin, cwd, env = {}, args = [], options = {}) {
  var _a, _b, _c, _d, _e, _f;
  if (isWindows()) {
    const envScript = buildPowerShellEnvLines(env).join("; ");
    const runCommand = args.length > 0 ? `$bin = ${psSingleQuoted(bin)}; $argList = @(${args.map(psSingleQuoted).join(",")}); & $bin @argList` : `& ${psSingleQuoted(bin)}`;
    const command2 = `${envScript ? `${envScript}; ` : ""}Set-Location -LiteralPath ${psSingleQuoted(cwd)}; ${runCommand}`;
    const launcher = (0, import_child_process.spawn)(
      "cmd.exe",
      ["/c", "start", "OpenCode CLI", "/D", cwd, "powershell.exe", "-NoLogo", "-NoExit", "-Command", command2],
      { detached: true, stdio: "ignore", windowsHide: false }
    );
    (_a = launcher.on) == null ? void 0 : _a.call(launcher, "error", (error) => {
      var _a2;
      return (_a2 = options.onError) == null ? void 0 : _a2.call(options, error);
    });
    (_b = launcher.on) == null ? void 0 : _b.call(launcher, "spawn", () => {
      var _a2;
      return (_a2 = options.onLaunched) == null ? void 0 : _a2.call(options);
    });
    launcher.unref();
    return;
  }
  const command = buildPosixLaunchCommand(bin, cwd, env, args);
  if (process.platform === "darwin") {
    const script = `tell application "Terminal" to do script ${appleScriptQuoted(command)}`;
    const launcher = (0, import_child_process.spawn)("osascript", ["-e", script], { detached: true, stdio: "ignore" });
    (_c = launcher.on) == null ? void 0 : _c.call(launcher, "error", (error) => {
      var _a2;
      return (_a2 = options.onError) == null ? void 0 : _a2.call(options, error);
    });
    (_d = launcher.on) == null ? void 0 : _d.call(launcher, "spawn", () => {
      var _a2;
      return (_a2 = options.onLaunched) == null ? void 0 : _a2.call(options);
    });
    launcher.unref();
    return;
  }
  if (process.platform === "linux") {
    const terminal = resolveLinuxTerminal(options.linuxTerminal);
    if (!terminal) {
      throw new Error(
        "no supported Linux terminal emulator found (tried x-terminal-emulator, gnome-terminal, konsole, xfce4-terminal, lxterminal, alacritty, xterm)"
      );
    }
    const launcher = (0, import_child_process.spawn)(terminal.cmd, [...terminal.args, "sh", "-lc", command], { detached: true, stdio: "ignore" });
    (_e = launcher.on) == null ? void 0 : _e.call(launcher, "error", (error) => {
      var _a2;
      return (_a2 = options.onError) == null ? void 0 : _a2.call(options, error);
    });
    (_f = launcher.on) == null ? void 0 : _f.call(launcher, "spawn", () => {
      var _a2;
      return (_a2 = options.onLaunched) == null ? void 0 : _a2.call(options);
    });
    launcher.unref();
    return;
  }
}
function openOpencodeCliLongPromptWindows(bin, cwd, env, model, agent, prompt, options = {}) {
  var _a, _b, _c, _d;
  const promptFile = path.join(cwd, `.autooc-prompt-${crypto.randomBytes(8).toString("hex")}.txt`);
  fs.writeFileSync(promptFile, prompt, "utf8");
  (_b = (_a = setTimeout(() => {
    try {
      fs.unlinkSync(promptFile);
    } catch (e) {
    }
  }, 60 * 1e3)).unref) == null ? void 0 : _b.call(_a);
  const shortInstruction = `Read the full task prompt from ${promptFile} and follow it exactly.`;
  const envScript = buildPowerShellEnvLines(env).join("; ");
  const agentParts = agent ? `, "--agent", ${psSingleQuoted(agent)}` : "";
  const command = `${envScript ? `${envScript}; ` : ""}Set-Location -LiteralPath ${psSingleQuoted(cwd)}; $bin = ${psSingleQuoted(bin)}; $argList = @("-m", ${psSingleQuoted(model)}${agentParts}, "--prompt", ${psSingleQuoted(shortInstruction)}); & $bin @argList`;
  const launcher = (0, import_child_process.spawn)(
    "cmd.exe",
    ["/c", "start", "OpenCode CLI", "/D", cwd, "powershell.exe", "-NoLogo", "-NoExit", "-Command", command],
    { detached: true, stdio: "ignore", windowsHide: false }
  );
  (_c = launcher.on) == null ? void 0 : _c.call(launcher, "error", (error) => {
    var _a2;
    return (_a2 = options.onError) == null ? void 0 : _a2.call(options, error);
  });
  (_d = launcher.on) == null ? void 0 : _d.call(launcher, "spawn", () => {
    var _a2;
    return (_a2 = options.onLaunched) == null ? void 0 : _a2.call(options);
  });
  launcher.unref();
}
function launchHiddenPS(psScriptFile, pidFile) {
  var _a;
  const fs19 = require("fs");
  const launcherFile = psScriptFile.replace(/\.ps1$/, ".vbs");
  const effectivePidFile = pidFile || psScriptFile.replace(/\.ps1$/, ".pid");
  const quotedPsScriptFile = psScriptFile.replace(/"/g, '""');
  const launcherScript = `Set sh = CreateObject("WScript.Shell")\r
sh.Run "powershell.exe -NoLogo -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File ""${quotedPsScriptFile}""", 0, False\r
`;
  fs19.writeFileSync(launcherFile, launcherScript, "utf8");
  const { spawn: spawn5 } = require("child_process");
  const child = spawn5("wscript.exe", [launcherFile], { detached: true, stdio: "ignore", windowsHide: true });
  child.unref();
  const launcherTimer = setTimeout(() => {
    try {
      fs19.unlinkSync(launcherFile);
    } catch (e) {
    }
  }, 1e4);
  const scriptTimer = setTimeout(() => {
    try {
      fs19.unlinkSync(psScriptFile);
    } catch (e) {
    }
  }, 6e5);
  const cleanup = (removeScript = false) => {
    clearTimeout(launcherTimer);
    clearTimeout(scriptTimer);
    try {
      fs19.unlinkSync(launcherFile);
    } catch (e) {
    }
    if (removeScript) {
      try {
        fs19.unlinkSync(psScriptFile);
      } catch (e) {
      }
    }
  };
  const kill = () => {
    let killedChildTree = false;
    if (child.pid) {
      try {
        const killer = spawn5("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], { detached: true, stdio: "ignore", windowsHide: true });
        killer.unref();
        killedChildTree = true;
      } catch (e) {
      }
    }
    if (!killedChildTree) {
      try {
        child.kill();
      } catch (e) {
      }
    }
    try {
      const pid = fs19.existsSync(effectivePidFile) ? String(fs19.readFileSync(effectivePidFile, "utf8")).trim() : "";
      if (/^\d+$/.test(pid) && pid !== String(child.pid || "")) {
        const killer = spawn5("taskkill.exe", ["/PID", pid, "/T", "/F"], { detached: true, stdio: "ignore", windowsHide: true });
        killer.unref();
      }
    } catch (e) {
    }
    cleanup(true);
    try {
      fs19.unlinkSync(effectivePidFile);
    } catch (e) {
    }
  };
  const callbacks = [];
  let launchError = null;
  (_a = child.on) == null ? void 0 : _a.call(child, "error", (error) => {
    launchError = error;
    cleanup(true);
    callbacks.forEach((callback) => callback(error));
  });
  return {
    kill,
    cleanup,
    onError: (callback) => {
      if (launchError) callback(launchError);
      else callbacks.push(callback);
    }
  };
}
function launchHiddenSh(shScriptFile, pidFile) {
  var _a;
  const fs19 = require("fs");
  const { spawn: spawn5 } = require("child_process");
  const effectivePidFile = pidFile || shScriptFile.replace(/\.sh$/, ".pid");
  try {
    fs19.chmodSync(shScriptFile, 448);
  } catch (e) {
  }
  const child = spawn5("/bin/sh", [shScriptFile], { detached: true, stdio: "ignore" });
  child.unref();
  const scriptTimer = setTimeout(() => {
    try {
      fs19.unlinkSync(shScriptFile);
    } catch (e) {
    }
  }, 6e5);
  const cleanup = (removeScript = false) => {
    clearTimeout(scriptTimer);
    if (removeScript) {
      try {
        fs19.unlinkSync(shScriptFile);
      } catch (e) {
      }
    }
  };
  const kill = () => {
    let killedChildTree = false;
    if (child.pid) {
      try {
        process.kill(-child.pid, "SIGKILL");
        killedChildTree = true;
      } catch (e) {
      }
    }
    if (!killedChildTree) {
      try {
        child.kill("SIGKILL");
      } catch (e) {
      }
    }
    try {
      const pid = fs19.existsSync(effectivePidFile) ? String(fs19.readFileSync(effectivePidFile, "utf8")).trim() : "";
      if (/^\d+$/.test(pid) && pid !== String(child.pid || "")) {
        try {
          process.kill(-Number(pid), "SIGKILL");
        } catch (e) {
        }
        try {
          process.kill(Number(pid), "SIGKILL");
        } catch (e) {
        }
      }
    } catch (e) {
    }
    cleanup(true);
    try {
      fs19.unlinkSync(effectivePidFile);
    } catch (e) {
    }
  };
  const callbacks = [];
  let launchError = null;
  (_a = child.on) == null ? void 0 : _a.call(child, "error", (error) => {
    launchError = error;
    cleanup(true);
    callbacks.forEach((callback) => callback(error));
  });
  return {
    kill,
    cleanup,
    onError: (callback) => {
      if (launchError) callback(launchError);
      else callbacks.push(callback);
    }
  };
}
function launchHidden(scriptFile, pidFile) {
  return isWindows() ? launchHiddenPS(scriptFile, pidFile) : launchHiddenSh(scriptFile, pidFile);
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

// opencode-script.ts
function buildOpenCodeScript(options) {
  const { pidFile, secretEnv, safeCwd, gitCmds, bin, model, effectiveAgent, effectiveTask, promptFile, outFile, errFile, doneFile, taskCwd } = options;
  let launchScript;
  if (isWindows()) {
    launchScript = [
      `try {`,
      `$PID | Set-Content -LiteralPath ${psSingleQuoted(pidFile)} -Encoding ASCII`,
      ...psUtf8Prelude(),
      `$env:USERPROFILE = ${psSingleQuoted(process.env.USERPROFILE || "")}`,
      `$env:APPDATA     = ${psSingleQuoted(process.env.APPDATA || "")}`,
      `$env:LOCALAPPDATA= ${psSingleQuoted(process.env.LOCALAPPDATA || "")}`,
      `$env:PATH        = ${psSingleQuoted(process.env.PATH || "")}`,
      `$env:HOME        = ${psSingleQuoted(process.env.USERPROFILE || "")}`,
      ...buildPowerShellEnvLines(secretEnv),
      `Set-Location -LiteralPath '${safeCwd}' -ErrorAction Stop`,
      gitCmds ? gitCmds : "",
      `$bin = ${psSingleQuoted(bin)}`,
      `$binExt = [System.IO.Path]::GetExtension($bin)`,
      `$psShim = if ($binExt -ieq '.cmd') { [System.IO.Path]::ChangeExtension($bin, '.ps1') } else { '' }`,
      `$nodeScript = ''`,
      `if ($psShim -and [System.IO.File]::Exists($psShim)) {`,
      `$bin = $psShim`,
      `} elseif ($binExt -ieq '.cmd') {`,
      `$cmdText = Get-Content $bin -Raw -Encoding UTF8`,
      `if ($cmdText -match '"([^"]+\\.exe)"\\s+%\\*') {`,
      `$bin = $Matches[1]`,
      `} elseif ($cmdText -match '"%_prog%"\\s+"%dp0%\\\\([^"]+)"\\s+%\\*') {`,
      `$cmdDir = Split-Path -Parent $bin`,
      `$nodeCandidate = Join-Path $cmdDir 'node.exe'`,
      `$bin = if ([System.IO.File]::Exists($nodeCandidate)) { $nodeCandidate } else { 'node' }`,
      `$nodeScript = Join-Path $cmdDir $Matches[1]`,
      `} else {`,
      `throw "Cannot safely parse npm command shim '$bin' for shell-sensitive prompt text."`,
      `}`,
      `}`,
      `$model = ${psSingleQuoted(model)}`,
      `$agent = ${psSingleQuoted(effectiveAgent)}`,
      `$forceModel = ${effectiveTask.forceModel ? "$true" : "$false"}`,
      `$prompt = Get-Content '${promptFile.replace(/'/g, "''")}' -Raw -Encoding UTF8`,
      `$outFile = ${psSingleQuoted(outFile)}`,
      `$errFile = ${psSingleQuoted(errFile)}`,
      `$opencodeArgs = @()`,
      `if ($nodeScript) {`,
      `$opencodeArgs += $nodeScript`,
      `}`,
      `$opencodeArgs += @('run', '--print-logs', '--log-level', 'INFO', '--auto', '-m', $model)`,
      `if (-not $forceModel) {`,
      `$opencodeArgs += @('--agent', $agent)`,
      `}`,
      `$opencodeArgs += @('--dangerously-skip-permissions', '--', $prompt)`,
      `& $bin @opencodeArgs 1>> $outFile 2>> $errFile`,
      `$exitCode = if ($null -eq $LASTEXITCODE) { 0 } else { $LASTEXITCODE }`,
      `[System.IO.File]::WriteAllText('${doneFile.replace(/'/g, "''")}', [string]$exitCode, [System.Text.Encoding]::UTF8)`,
      `} catch {`,
      `[System.IO.File]::WriteAllText('${outFile.replace(/'/g, "''")}', '', [System.Text.Encoding]::UTF8)`,
      `[System.IO.File]::WriteAllText('${errFile.replace(/'/g, "''")}', $_.Exception.ToString(), [System.Text.Encoding]::UTF8)`,
      `[System.IO.File]::WriteAllText('${doneFile.replace(/'/g, "''")}', '-1', [System.Text.Encoding]::UTF8)`,
      `}`
    ].filter((line) => line !== "").join("\n");
  } else {
    const shEnv = {
      ...secretEnv,
      HOME: process.env.HOME || process.env.USERPROFILE || "",
      PATH: process.env.PATH || ""
    };
    const agentArg = effectiveTask.forceModel ? "" : ` --agent ${shSingleQuoted(effectiveAgent)}`;
    launchScript = [
      `echo $$ > ${shSingleQuoted(pidFile)}`,
      ...buildShEnvLines(shEnv),
      `cd ${shSingleQuoted(taskCwd)} || { printf '%s' '-1' > ${shSingleQuoted(doneFile)}; printf '%s' 'cd failed' > ${shSingleQuoted(errFile)}; exit 1; }`,
      gitCmds ? gitCmds : "",
      `bin=${shSingleQuoted(bin)}`,
      `prompt="$(cat ${shSingleQuoted(promptFile)} 2>/dev/null)"`,
      `set -- --print-logs --log-level INFO --auto -m ${shSingleQuoted(model)}${agentArg} --dangerously-skip-permissions -- "$prompt"`,
      `"$bin" run "$@" >> ${shSingleQuoted(outFile)} 2>> ${shSingleQuoted(errFile)}`,
      `exit_code=$?`,
      `printf '%s' "$exit_code" > ${shSingleQuoted(doneFile)}`
    ].filter((line) => line !== "").join("\n");
  }
  return launchScript;
}

// release-update.ts
var fs4 = __toESM(require("fs"));
var path4 = __toESM(require("path"));
var import_crypto3 = require("crypto");

// execution-journal.ts
var fs3 = __toESM(require("fs"));
var path3 = __toESM(require("path"));
var import_crypto2 = require("crypto");

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
        await new Promise((resolve5) => setTimeout(resolve5, 50 * (attempt + 1)));
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

// execution-journal.ts
var writes = /* @__PURE__ */ new Map();
function validateExecutionCheckpoint(value) {
  const validDate = (date) => date === void 0 || typeof date === "string" && Number.isFinite(Date.parse(date));
  if (!value || value.schemaVersion !== 1 || !/^[a-zA-Z0-9-]+$/.test(value.runId || "") || typeof value.workflowId !== "string" || !value.workflowId || !/^[a-f0-9]{64}$/.test(value.definitionHash || "") || !Number.isSafeInteger(value.revision) || value.revision < 0 || !["ready", "in_flight", "completed", "failed"].includes(value.phase) || !(value.nextStepId === null || typeof value.nextStepId === "string" && value.nextStepId.length > 0) || !Array.isArray(value.steps) || !validDate(value.createdAt)) throw new Error("Invalid execution checkpoint");
  for (const [index, step] of value.steps.entries()) {
    if ((step == null ? void 0 : step.branch) && (typeof step.branch.directory !== "string" || !path3.isAbsolute(step.branch.directory) || typeof step.branch.name !== "string" || !step.branch.name)) throw new Error("Invalid branch checkpoint");
    if ((step == null ? void 0 : step.result) && (typeof step.result.succeeded !== "boolean" || typeof step.result.output !== "string" || step.result.cancelled !== void 0 && (typeof step.result.cancelled !== "boolean" || step.result.cancelled && step.result.succeeded))) throw new Error("Invalid observed result");
    if ((step == null ? void 0 : step.evaluations) !== void 0 && (!step.result || !Array.isArray(step.evaluations) || new Set(step.evaluations.map((e) => e.key)).size !== step.evaluations.length || step.evaluations.some((e) => typeof e.key !== "string" || !["in_flight", "completed"].includes(e.status) || e.status === "completed" && typeof e.output !== "string"))) throw new Error("Invalid evaluation checkpoint");
    if ((step == null ? void 0 : step.approval) && (step.status !== "in_flight" || !/^[a-f0-9-]+$/.test(step.approval.token) || !/^[a-f0-9-]+$/.test(step.approval.ownerToken) || !["string", "number"].includes(typeof step.approval.requestId) || !["command", "file-change", "permissions"].includes(step.approval.kind) || typeof step.approval.summary !== "string")) throw new Error("Invalid approval checkpoint");
    if (!validDate(step == null ? void 0 : step.startedAt)) throw new Error("Invalid step timestamp");
    if (!validDate(step == null ? void 0 : step.finishedAt) || (step == null ? void 0 : step.finishedAt) !== void 0 && (step.status === "in_flight" || !step.startedAt || Date.parse(step.finishedAt) < Date.parse(step.startedAt))) throw new Error("Invalid step finish timestamp");
    if ((step == null ? void 0 : step.codexThreadId) !== void 0 && (typeof step.codexThreadId !== "string" || !step.codexThreadId.trim())) throw new Error("Invalid Codex identity");
    if ((step == null ? void 0 : step.codexTurnId) !== void 0 && (!step.codexThreadId || typeof step.codexTurnId !== "string" || !step.codexTurnId.trim())) throw new Error("Invalid Codex turn identity");
    if (!step || typeof step.stepId !== "string" || !step.stepId || !["in_flight", "completed", "failed"].includes(step.status) || step.status !== "in_flight" && typeof step.output !== "string" || step.status === "in_flight" && (index !== value.steps.length - 1 || step.output !== void 0))
      throw new Error("Invalid step checkpoint");
  }
  const last = value.steps[value.steps.length - 1];
  if (value.phase === "in_flight" !== ((last == null ? void 0 : last.status) === "in_flight") || value.phase === "in_flight" && value.nextStepId !== last.stepId || ["ready", "in_flight"].includes(value.phase) && value.nextStepId === null || ["completed", "failed"].includes(value.phase) && value.nextStepId !== null)
    throw new Error("Inconsistent execution checkpoint");
}
function readExecutionCheckpoint(directory, runId) {
  if (!/^[a-zA-Z0-9-]+$/.test(runId)) throw new Error("Invalid execution identity");
  const file = path3.join(directory, runId + ".json");
  const stat = fs3.lstatSync(file);
  if (stat.isSymbolicLink() || !stat.isFile()) throw new Error("Execution checkpoint must be a regular file");
  let state;
  try {
    state = JSON.parse(fs3.readFileSync(file, "utf8"));
  } catch (e) {
    throw new Error("Cannot read valid execution checkpoint");
  }
  validateExecutionCheckpoint(state);
  if (state.runId !== runId) throw new Error("Execution identity changed");
  return state;
}
var ExecutionJournal = class _ExecutionJournal {
  constructor(lease, file, state) {
    this.lease = lease;
    this.file = file;
    this.state = state;
  }
  static async create(lease, workflowId, definitionHash, entryStep) {
    lease.assertOwned();
    const state = { schemaVersion: 1, runId: (0, import_crypto2.randomUUID)(), workflowId, definitionHash, revision: 0, createdAt: (/* @__PURE__ */ new Date()).toISOString(), phase: "ready", nextStepId: entryStep, steps: [] };
    validateExecutionCheckpoint(state);
    const file = path3.join(lease.directory, state.runId + ".json");
    if (fs3.existsSync(file)) throw new Error("Execution identity already exists");
    await atomicSettingsWrite(file, state);
    lease.assertOwned();
    return new _ExecutionJournal(lease, file, state);
  }
  static open(lease, runId, definitionHash) {
    lease.assertOwned();
    if (!/^[a-zA-Z0-9-]+$/.test(runId)) throw new Error("Invalid execution identity");
    const file = path3.join(lease.directory, runId + ".json");
    if (fs3.lstatSync(file).isSymbolicLink()) throw new Error("Execution checkpoint cannot be a link");
    const state = readExecutionCheckpoint(lease.directory, runId);
    if (state.runId !== runId || state.definitionHash !== definitionHash) throw new Error("Execution identity or definition changed");
    return new _ExecutionJournal(lease, file, state);
  }
  snapshot() {
    return JSON.parse(JSON.stringify(this.state));
  }
  update(change) {
    const operation = (writes.get(this.file) || Promise.resolve()).then(async () => {
      this.lease.assertOwned();
      if (fs3.lstatSync(this.file).isSymbolicLink()) throw new Error("Execution checkpoint cannot be a link");
      const previous = fs3.readFileSync(this.file, "utf8");
      if (JSON.stringify(JSON.parse(previous)) !== JSON.stringify(this.state)) throw new Error("Execution checkpoint changed");
      const next = this.snapshot();
      change(next);
      next.revision++;
      validateExecutionCheckpoint(next);
      await atomicSettingsWrite(this.file, next);
      this.lease.assertOwned();
      this.state = next;
    });
    const settled = operation.catch(() => {
    });
    writes.set(this.file, settled);
    void settled.then(() => {
      if (writes.get(this.file) === settled) writes.delete(this.file);
    });
    return operation;
  }
  begin(stepId) {
    return this.update((state) => {
      if (state.phase !== "ready" || state.nextStepId !== stepId) throw new Error("Step is not ready; reconcile any interrupted execution first");
      state.phase = "in_flight";
      state.steps.push({ stepId, status: "in_flight", startedAt: (/* @__PURE__ */ new Date()).toISOString() });
    });
  }
  recordCodexThread(stepId, threadId, turnId) {
    return this.update((state) => {
      const step = state.steps[state.steps.length - 1];
      if (state.phase !== "in_flight" || (step == null ? void 0 : step.stepId) !== stepId) throw new Error("No matching step in flight");
      if (step.codexThreadId && step.codexThreadId !== threadId) throw new Error("Codex execution identity changed");
      step.codexThreadId = threadId;
      if (turnId !== void 0) {
        if (step.codexTurnId && step.codexTurnId !== turnId) throw new Error("Codex turn identity changed");
        step.codexTurnId = turnId;
      }
    });
  }
  finish(stepId, succeeded, redactedOutput, nextStepId) {
    return this.update((state) => {
      const step = state.steps[state.steps.length - 1];
      if (state.phase !== "in_flight" || (step == null ? void 0 : step.stepId) !== stepId) throw new Error("No matching step in flight");
      step.status = succeeded ? "completed" : "failed";
      step.output = redactedOutput;
      if (step.startedAt) step.finishedAt = new Date(Math.max(Date.now(), Date.parse(step.startedAt))).toISOString();
      delete step.approval;
      state.nextStepId = nextStepId;
      state.phase = nextStepId !== null ? "ready" : succeeded ? "completed" : "failed";
    });
  }
  recordBranch(branch) {
    return this.update((state) => {
      this.current(state).branch = branch;
    });
  }
  recordResult(result) {
    return this.update((state) => {
      const step = this.current(state);
      if (step.result) throw new Error("Result already observed");
      step.result = result;
      delete step.approval;
    });
  }
  recordEvaluation(key, output) {
    return this.update((state) => {
      const step = this.current(state);
      if (!step.result) throw new Error("Observe task result before evaluation");
      const entries = step.evaluations || (step.evaluations = []), entry = entries.find((e) => e.key === key);
      if (output === void 0) {
        if (entry) throw new Error("Evaluation already started");
        entries.push({ key, status: "in_flight" });
      } else {
        if (!entry || entry.status !== "in_flight") throw new Error("Evaluation is not in flight");
        entry.status = "completed";
        entry.output = output;
      }
    });
  }
  recordApproval(approval) {
    return this.update((state) => {
      const step = this.current(state);
      if (approval && step.approval) throw new Error("Approval already pending");
      step.approval = approval;
    });
  }
  current(state) {
    const step = state.steps[state.steps.length - 1];
    if (state.phase !== "in_flight" || (step == null ? void 0 : step.status) !== "in_flight") throw new Error("No step in flight");
    return step;
  }
};

// release-update.ts
var RELEASE_FILES = ["main.js", "manifest.json", "styles.css", "autooc-cli.cjs", "autooc-runtime.cjs", "skills/autooc-runtime/SKILL.md"];
var RELEASE_DESCRIPTOR = "release-integrity.json";
function verifyRelease(files, expectedVersion) {
  var _a;
  const descriptor = JSON.parse(((_a = files[RELEASE_DESCRIPTOR]) == null ? void 0 : _a.toString("utf8")) || "null");
  if ((descriptor == null ? void 0 : descriptor.schemaVersion) !== 1 || descriptor.version !== expectedVersion || !descriptor.sha256 || Object.keys(descriptor.sha256).sort().join() !== [...RELEASE_FILES].sort().join() || Object.keys(files).sort().join() !== [...RELEASE_FILES, RELEASE_DESCRIPTOR].sort().join()) {
    throw new Error("Incomplete or incompatible AutoOC release");
  }
  for (const file of RELEASE_FILES) {
    if (!Buffer.isBuffer(files[file]) || (0, import_crypto3.createHash)("sha256").update(files[file]).digest("hex") !== descriptor.sha256[file]) {
      throw new Error(`Release integrity mismatch: ${file}`);
    }
  }
  const manifest = JSON.parse(files["manifest.json"].toString("utf8"));
  if (manifest.id !== "auto-oc" || manifest.version !== expectedVersion) throw new Error("Release manifest identity mismatch");
}
async function downloadRelease(baseUrl, version, fetcher = fetch) {
  const entries = await Promise.all([...RELEASE_FILES, RELEASE_DESCRIPTOR].map(async (file) => {
    const response = await fetcher(`${baseUrl}/${file}?t=${Date.now()}`, { cache: "reload" });
    if (!response.ok) throw new Error(`${file} HTTP ${response.status}`);
    return [file, Buffer.from(await response.arrayBuffer())];
  }));
  const files = Object.fromEntries(entries);
  verifyRelease(files, version);
  return files;
}
function regularPath(root, relative4, create = false) {
  let current = root;
  const parts = relative4.split("/");
  for (let i = 0; i < parts.length; i++) {
    current = path4.join(current, parts[i]);
    let stat;
    try {
      stat = fs4.lstatSync(current);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    if (stat && (stat.isSymbolicLink() || (i < parts.length - 1 ? !stat.isDirectory() : !stat.isFile() || stat.nlink !== 1))) {
      throw new Error(`Unsafe release destination: ${relative4}`);
    }
    if (!stat && i < parts.length - 1 && create) fs4.mkdirSync(current);
  }
  return current;
}
function hasCompleteInstalledRelease(directory, version) {
  try {
    const root = fs4.realpathSync(directory);
    const files = Object.fromEntries([...RELEASE_FILES, RELEASE_DESCRIPTOR].map((name) => [name, fs4.readFileSync(regularPath(root, name))]));
    verifyRelease(files, version);
    return true;
  } catch (e) {
    return false;
  }
}
function installRelease(options) {
  const { files, version, lease } = options;
  verifyRelease(files, version);
  const directory = fs4.realpathSync(options.directory);
  if (fs4.lstatSync(options.directory).isSymbolicLink() || path4.join(directory, "runtime") !== lease.directory) throw new Error("Update lease belongs to another installation");
  lease.assertOwned();
  const marker = path4.join(lease.directory, "update-pending.json");
  if (fs4.existsSync(marker)) throw new Error("Previous update requires recovery");
  for (const name of fs4.readdirSync(lease.directory)) {
    if (!/^[a-f0-9-]+\.json$/.test(name)) continue;
    const state = readExecutionCheckpoint(lease.directory, name.slice(0, -5));
    if (!["completed", "failed"].includes(state.phase)) throw new Error("Unfinished execution blocks update");
  }
  const names = [...RELEASE_FILES, RELEASE_DESCRIPTOR];
  for (const name of names) regularPath(directory, name);
  const backup = path4.join(lease.directory, `update-backup-${(0, import_crypto3.randomUUID)()}`);
  fs4.mkdirSync(backup);
  const previous = /* @__PURE__ */ new Map();
  for (const name of names) {
    const source = regularPath(directory, name);
    const bytes = fs4.existsSync(source) ? fs4.readFileSync(source) : void 0;
    previous.set(name, bytes);
    if (bytes) {
      const target = path4.join(backup, name);
      fs4.mkdirSync(path4.dirname(target), { recursive: true });
      fs4.writeFileSync(target, bytes, { flag: "wx" });
    }
  }
  const record = { schemaVersion: 1, version, backup: path4.basename(backup), files: names, absent: names.filter((name) => !previous.has(name) || previous.get(name) === void 0) };
  fs4.writeFileSync(path4.join(backup, "recovery.json"), JSON.stringify(record));
  const fd = fs4.openSync(marker, "wx");
  try {
    fs4.writeFileSync(fd, JSON.stringify(record));
    fs4.fsyncSync(fd);
  } finally {
    fs4.closeSync(fd);
  }
  const written = [];
  try {
    for (const name of names) {
      lease.assertOwned();
      const target = regularPath(directory, name, true);
      written.push(name);
      fs4.writeFileSync(target, files[name]);
    }
    const installed = Object.fromEntries(names.map((name) => [name, fs4.readFileSync(regularPath(directory, name))]));
    verifyRelease(installed, version);
    fs4.unlinkSync(marker);
    return { version, backup, installed: names };
  } catch (error) {
    for (const name of written.reverse()) {
      const target = regularPath(directory, name);
      const bytes = previous.get(name);
      if (bytes !== void 0) fs4.writeFileSync(target, bytes);
      else if (fs4.existsSync(target)) fs4.unlinkSync(target);
    }
    fs4.unlinkSync(marker);
    throw error;
  }
}

// main.ts
var import_obsidian = require("obsidian");
var import_child_process5 = require("child_process");
var os4 = __toESM(require("os"));
var fs18 = __toESM(require("fs"));
var path16 = __toESM(require("path"));
var crypto2 = __toESM(require("crypto"));
var http = __toESM(require("http"));

// codex-client.ts
var import_child_process2 = require("child_process");
var fs5 = __toESM(require("fs"));
var os2 = __toESM(require("os"));
var path5 = __toESM(require("path"));
function codexResultOutput(messages, status) {
  const transcript = messages.map((item) => item.text).filter(Boolean).join("\n\n").trim();
  const finals = messages.filter((item) => item.completed && item.phase === "final_answer");
  const output = status === "completed" && finals.length ? finals.map((item) => item.text).join("\n\n").trim() : transcript;
  return { output, ...output !== transcript ? { transcript } : {} };
}
var JsonLineRpcPeer = class {
  constructor(writeLine, onMessage) {
    this.writeLine = writeLine;
    this.onMessage = onMessage;
    this.buffer = "";
    this.nextId = 1;
    this.pending = /* @__PURE__ */ new Map();
  }
  feed(chunk) {
    var _a;
    this.buffer += chunk.toString();
    while (true) {
      const newline = this.buffer.indexOf("\n");
      if (newline < 0) return;
      const raw = this.buffer.slice(0, newline).trim();
      this.buffer = this.buffer.slice(newline + 1);
      if (!raw) continue;
      let message;
      try {
        message = JSON.parse(raw);
      } catch (e) {
        continue;
      }
      if (message.id !== void 0 && !message.method && (message.result !== void 0 || message.error)) {
        const pending = this.pending.get(message.id);
        if (!pending) continue;
        this.pending.delete(message.id);
        clearTimeout(pending.timer);
        if (message.error) {
          pending.reject(new Error(message.error.message || `Codex RPC error ${(_a = message.error.code) != null ? _a : "unknown"}`));
        } else {
          pending.resolve(message.result);
        }
        continue;
      }
      this.onMessage(message);
    }
  }
  request(method, params = {}, timeoutMs = 3e4) {
    const id = this.nextId++;
    return new Promise((resolve5, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Codex RPC request timed out: ${method}`));
      }, timeoutMs);
      this.pending.set(id, { resolve: resolve5, reject, timer });
      this.writeLine(JSON.stringify({ id, method, params }) + "\n");
    });
  }
  notify(method, params = {}) {
    this.writeLine(JSON.stringify({ method, params }) + "\n");
  }
  respond(id, result) {
    this.writeLine(JSON.stringify({ id, result }) + "\n");
  }
  rejectAll(error) {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }
};
function resolveCodexBin(configured = "codex") {
  if (configured.trim() && configured.trim() !== "codex") return configured.trim();
  const candidates = [];
  if (os2.platform() === "win32") {
    const localAppData = process.env.LOCALAPPDATA || "";
    const desktopBinRoot = path5.join(localAppData, "OpenAI", "Codex", "bin");
    try {
      const versionDirs = fs5.readdirSync(desktopBinRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => path5.join(desktopBinRoot, entry.name, "codex.exe")).filter((candidate) => fs5.existsSync(candidate)).sort((a, b) => fs5.statSync(b).mtimeMs - fs5.statSync(a).mtimeMs);
      candidates.push(...versionDirs);
    } catch (e) {
    }
    candidates.push(
      path5.join(localAppData, "OpenAI", "Codex", "codex.exe"),
      path5.join(process.env.APPDATA || "", "npm", "codex.cmd")
    );
  } else {
    const userHome = process.env.HOME || "";
    candidates.push(
      path5.join(userHome, ".local", "bin", "codex"),
      path5.join(userHome, ".npm-global", "bin", "codex"),
      "/opt/homebrew/bin/codex",
      "/usr/local/bin/codex"
    );
  }
  return candidates.find((candidate) => candidate && fs5.existsSync(candidate)) || configured || "codex";
}
function openCodexApp(bin, cwd, onError) {
  const child = (0, import_child_process2.spawn)(bin, ["app", cwd], {
    cwd,
    detached: true,
    stdio: "ignore",
    windowsHide: false
  });
  child.on("error", (error) => onError == null ? void 0 : onError(error));
  child.unref();
}
function buildCodexThreadUrl(threadId) {
  return `codex://threads/${encodeURIComponent(threadId)}`;
}
function openCodexThread(threadId) {
  if (!(threadId == null ? void 0 : threadId.trim())) throw new Error("Exact Codex thread identity is required");
  return openCodexUrl(buildCodexThreadUrl(threadId));
}
function openCodexUrl(url) {
  const launcher = process.platform === "win32" ? {
    bin: "powershell.exe",
    args: [
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-EncodedCommand",
      Buffer.from("$ErrorActionPreference = 'Stop'\nStart-Process -FilePath $env:AUTOOC_CODEX_URL", "utf16le").toString("base64")
    ],
    env: { ...process.env, AUTOOC_CODEX_URL: url }
  } : process.platform === "darwin" ? { bin: "open", args: [url], env: process.env } : { bin: "xdg-open", args: [url], env: process.env };
  return new Promise((resolve5, reject) => {
    const child = (0, import_child_process2.spawn)(launcher.bin, launcher.args, {
      detached: false,
      stdio: "ignore",
      windowsHide: true,
      env: launcher.env
    });
    let settled = false;
    child.once("error", (error) => {
      settled = true;
      reject(error);
    });
    child.once("close", (code) => {
      if (settled) return;
      if (code === 0) resolve5();
      else reject(new Error(`ChatGPT/Codex URL launcher exited with code ${code != null ? code : "unknown"}`));
    });
  });
}
function openCodexNewThread(cwd, onError) {
  const client = new CodexAppServerClient(resolveCodexBin(), cwd);
  const threadName = path5.basename(path5.resolve(cwd)) || cwd;
  void client.createThread(threadName).then((threadId) => openCodexUrl(buildCodexThreadUrl(threadId))).catch((error) => onError == null ? void 0 : onError(error instanceof Error ? error : new Error(String(error)))).finally(() => client.dispose());
}
var CodexAppServerClient = class {
  constructor(bin, cwd, callbacks = {}) {
    this.bin = bin;
    this.cwd = cwd;
    this.callbacks = callbacks;
    this.child = null;
    this.peer = null;
    this.initialized = false;
    this.disposed = false;
    this.stderr = "";
    this.output = "";
    this.agentMessages = /* @__PURE__ */ new Map();
    this.threadId = "";
    this.turnId = "";
    this.approvals = /* @__PURE__ */ new Map();
    this.reconcileTimer = null;
    this.reconciling = false;
  }
  async initialize() {
    if (this.initialized) return;
    this.child = (0, import_child_process2.spawn)(this.bin, ["app-server"], {
      cwd: this.cwd,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true
    });
    this.peer = new JsonLineRpcPeer(
      (line) => {
        var _a;
        return (_a = this.child) == null ? void 0 : _a.stdin.write(line);
      },
      (message) => void this.handleMessage(message)
    );
    this.child.stdout.on("data", (chunk) => {
      var _a;
      return (_a = this.peer) == null ? void 0 : _a.feed(chunk);
    });
    this.child.stderr.on("data", (chunk) => {
      var _a, _b;
      this.stderr = (this.stderr + chunk.toString()).slice(-2e4);
      (_b = (_a = this.callbacks).onDiagnostic) == null ? void 0 : _b.call(_a, chunk.toString());
    });
    this.child.on("error", (error) => this.fail(error));
    this.child.on("exit", (code, signal) => {
      if (!this.disposed) {
        const detail = this.stderr.trim();
        this.fail(new Error(`Codex App Server exited (${signal || (code != null ? code : "unknown")})${detail ? `: ${detail}` : ""}`));
      }
    });
    await this.peer.request("initialize", {
      clientInfo: { name: "auto-oc", title: "AutoOC", version: "1.5.11" },
      capabilities: {}
    }, 15e3);
    this.peer.notify("initialized");
    this.initialized = true;
  }
  async listModels() {
    await this.initialize();
    const response = await this.peer.request("model/list", { limit: 100, includeHidden: false });
    return ((response == null ? void 0 : response.data) || []).map((model) => ({
      value: model.model || model.id,
      label: model.displayName || model.model || model.id,
      defaultReasoningEffort: model.defaultReasoningEffort,
      supportedReasoningEfforts: (model.supportedReasoningEfforts || []).map((entry) => entry.reasoningEffort || entry.value || entry),
      isDefault: !!model.isDefault
    }));
  }
  async createThread(name) {
    var _a;
    await this.initialize();
    const response = await this.peer.request("thread/start", {
      cwd: this.cwd,
      approvalPolicy: "on-request",
      sandbox: "workspace-write",
      ephemeral: false,
      serviceName: "AutoOC"
    });
    const threadId = ((_a = response == null ? void 0 : response.thread) == null ? void 0 : _a.id) || "";
    if (!threadId) throw new Error("Codex did not return a thread id");
    if (name) {
      await this.peer.request("thread/inject_items", {
        threadId,
        items: [{
          type: "message",
          role: "assistant",
          content: [{ type: "output_text", text: "" }]
        }]
      });
      await this.peer.request("thread/name/set", { threadId, name });
    }
    return threadId;
  }
  async run(prompt, model, effort, approvalPolicy = "on-request") {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    await this.initialize();
    this.output = "";
    this.agentMessages.clear();
    this.turnId = "";
    const threadResponse = await this.peer.request("thread/start", {
      cwd: this.cwd,
      model: model || null,
      approvalPolicy,
      sandbox: "workspace-write",
      ephemeral: false,
      serviceName: "AutoOC"
    });
    this.threadId = ((_a = threadResponse == null ? void 0 : threadResponse.thread) == null ? void 0 : _a.id) || "";
    if (!this.threadId) throw new Error("Codex did not return a thread id");
    await ((_c = (_b = this.callbacks).onThreadCreated) == null ? void 0 : _c.call(_b, { threadId: this.threadId }));
    const completion = new Promise((resolve5, reject) => {
      this.completionResolve = resolve5;
      this.completionReject = reject;
    });
    void completion.catch(() => {
    });
    let turnResponse;
    try {
      turnResponse = await this.peer.request("turn/start", {
        threadId: this.threadId,
        input: [{ type: "text", text: prompt }],
        model: model || null,
        effort: effort || null,
        approvalPolicy,
        cwd: this.cwd
      });
    } catch (error) {
      this.completionResolve = void 0;
      this.completionReject = void 0;
      throw error;
    }
    this.turnId = ((_d = turnResponse == null ? void 0 : turnResponse.turn) == null ? void 0 : _d.id) || "";
    if (!this.turnId) throw new Error("Codex did not return a turn id");
    await ((_f = (_e = this.callbacks).onStarted) == null ? void 0 : _f.call(_e, { threadId: this.threadId, turnId: this.turnId }));
    if (this.completionResolve) {
      this.reconcileTimer = setInterval(() => {
        void this.reconcileTurn();
      }, 3e4);
      (_h = (_g = this.reconcileTimer).unref) == null ? void 0 : _h.call(_g);
    }
    return completion;
  }
  stopReconciliation() {
    if (this.reconcileTimer) clearInterval(this.reconcileTimer);
    this.reconcileTimer = null;
  }
  async reconcileTurn() {
    var _a, _b;
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
    } catch (e) {
      (_b = (_a = this.callbacks).onDiagnostic) == null ? void 0 : _b.call(_a, "[AutoOC] Could not reconcile Codex turn; retaining current state.\n");
    } finally {
      this.reconciling = false;
    }
  }
  // Read only: reconnecting must never create a new thread or start a turn.
  // Absence/mismatch is uncertainty, not evidence that effects did not occur.
  async readExistingTurn(threadId, turnId) {
    var _a, _b;
    if (!(threadId == null ? void 0 : threadId.trim()) || !(turnId == null ? void 0 : turnId.trim())) throw new Error("Exact Codex thread and turn identities are required");
    await this.initialize();
    const result = await this.peer.request("thread/read", { threadId, includeTurns: true }, 15e3);
    if (((_a = result == null ? void 0 : result.thread) == null ? void 0 : _a.id) !== threadId) throw new Error("Codex thread identity mismatch");
    const matches = (_b = result.thread.turns) == null ? void 0 : _b.filter((turn) => turn.id === turnId);
    if (!Array.isArray(matches) || matches.length !== 1) throw new Error("Exact Codex turn is unavailable");
    return matches[0];
  }
  async readExistingResult(threadId, turnId) {
    var _a, _b;
    const turn = await this.readExistingTurn(threadId, turnId);
    const messages = /* @__PURE__ */ new Map();
    for (const item of turn.items || []) if (item.type === "agentMessage" && typeof item.text === "string") {
      messages.set(String(item.id || "legacy"), { text: item.text, phase: item.phase, completed: true });
    }
    const status = String(turn.status || "unknown");
    return { ...codexResultOutput([...messages.values()], status), threadId, turnId, status, error: ((_a = turn.error) == null ? void 0 : _a.message) || ((_b = turn.error) == null ? void 0 : _b.additionalDetails) };
  }
  getIds() {
    return { threadId: this.threadId, turnId: this.turnId };
  }
  resolveApproval(requestId, approved) {
    const approval = this.approvals.get(requestId);
    if (!approval || !this.peer) return false;
    this.approvals.delete(requestId);
    if (approval.kind === "permissions") {
      this.peer.respond(requestId, {
        permissions: approved ? approval.params.permissions || {} : {},
        scope: "turn"
      });
    } else {
      this.peer.respond(requestId, { decision: approved ? "accept" : "decline" });
    }
    return true;
  }
  async interrupt() {
    if (this.peer && this.threadId && this.turnId) {
      try {
        await this.peer.request("turn/interrupt", { threadId: this.threadId, turnId: this.turnId }, 5e3);
      } catch (e) {
      }
    }
    this.dispose();
  }
  dispose() {
    var _a, _b, _c;
    if (this.disposed) return;
    this.disposed = true;
    this.stopReconciliation();
    (_a = this.peer) == null ? void 0 : _a.rejectAll(new Error("Codex client closed"));
    (_b = this.completionReject) == null ? void 0 : _b.call(this, new Error("Codex client closed"));
    this.completionReject = void 0;
    this.completionResolve = void 0;
    (_c = this.child) == null ? void 0 : _c.kill();
    this.child = null;
  }
  handleMessage(message) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m;
    if (message.id !== void 0 && message.method) {
      const approval = this.toApproval(message);
      if (approval) {
        this.approvals.set(message.id, approval);
        (_b = (_a = this.callbacks).onApproval) == null ? void 0 : _b.call(_a, approval);
      } else {
        (_c = this.peer) == null ? void 0 : _c.respond(message.id, {});
      }
      return;
    }
    if (message.method === "item/agentMessage/delta") {
      const delta = String(((_d = message.params) == null ? void 0 : _d.delta) || "");
      if (delta) {
        const id = String(((_e = message.params) == null ? void 0 : _e.itemId) || "legacy");
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
      const item = (_f = message.params) == null ? void 0 : _f.item;
      if ((item == null ? void 0 : item.type) === "agentMessage" && typeof item.text === "string") {
        const id = String(item.id || "legacy");
        const previous = this.agentMessages.get(id);
        const completed = message.method === "item/completed";
        this.agentMessages.set(id, {
          text: completed ? item.text : (_g = previous == null ? void 0 : previous.text) != null ? _g : item.text,
          phase: (_h = item.phase) != null ? _h : previous == null ? void 0 : previous.phase,
          completed: completed || !!(previous == null ? void 0 : previous.completed)
        });
        this.publishAgentMessages();
      }
      return;
    }
    if (message.method === "turn/completed") {
      const turn = ((_i = message.params) == null ? void 0 : _i.turn) || {};
      if (((_j = message.params) == null ? void 0 : _j.threadId) && message.params.threadId !== this.threadId) return;
      if (this.turnId && turn.id && turn.id !== this.turnId) return;
      this.stopReconciliation();
      const status = String(turn.status || "completed");
      const error = ((_k = turn.error) == null ? void 0 : _k.message) || ((_l = turn.error) == null ? void 0 : _l.additionalDetails) || void 0;
      (_m = this.completionResolve) == null ? void 0 : _m.call(this, {
        ...codexResultOutput([...this.agentMessages.values()], status),
        threadId: this.threadId,
        turnId: turn.id || this.turnId,
        status,
        error
      });
      this.completionResolve = void 0;
      this.completionReject = void 0;
    }
  }
  publishAgentMessages() {
    var _a, _b;
    this.output = [...this.agentMessages.values()].map((item) => item.text).filter(Boolean).join("\n\n");
    (_b = (_a = this.callbacks).onOutput) == null ? void 0 : _b.call(_a, this.output);
  }
  toApproval(message) {
    const method = message.method || "";
    const params = message.params || {};
    let kind;
    if (method === "item/commandExecution/requestApproval") kind = "command";
    else if (method === "item/fileChange/requestApproval") kind = "file-change";
    else if (method === "item/permissions/requestApproval") kind = "permissions";
    else return null;
    const summary = String(params.reason || params.command || (kind === "command" ? "Codex wants to run a command" : kind === "file-change" ? "Codex wants to change files" : "Codex requests additional permissions"));
    return { requestId: message.id, method, kind, summary, params };
  }
  fail(error) {
    var _a, _b;
    this.stopReconciliation();
    (_a = this.peer) == null ? void 0 : _a.rejectAll(error);
    (_b = this.completionReject) == null ? void 0 : _b.call(this, error);
    this.completionReject = void 0;
    this.completionResolve = void 0;
  }
};

// copilot-client.ts
var import_child_process3 = require("child_process");
var fs6 = __toESM(require("fs"));
var os3 = __toESM(require("os"));
var path6 = __toESM(require("path"));
function resolveCopilotBin(configured = "copilot") {
  const value = configured.trim() || "copilot";
  const nativeFromShim = (shim) => {
    const npmRoot = path6.join(path6.dirname(shim), "node_modules", "@github");
    const packageName = `copilot-${process.platform}-${process.arch}`;
    const executable = process.platform === "win32" ? "copilot.exe" : "copilot";
    return [
      path6.join(npmRoot, "copilot", "node_modules", "@github", packageName, executable),
      path6.join(npmRoot, packageName, executable)
    ].find((candidate) => fs6.existsSync(candidate));
  };
  if (value !== "copilot") {
    return /\.(cmd|bat|ps1)$/i.test(value) ? nativeFromShim(value) || value : value;
  }
  const home = os3.homedir();
  const dirs = [
    ...(process.env.PATH || "").split(path6.delimiter),
    path6.join(home, ".local", "bin"),
    path6.join(home, ".npm-global", "bin"),
    ...process.platform === "win32" ? [path6.join(process.env.APPDATA || path6.join(home, "AppData", "Roaming"), "npm")] : ["/opt/homebrew/bin", "/usr/local/bin"]
  ];
  for (const dir of dirs.filter(Boolean)) {
    for (const extension of process.platform === "win32" ? [".exe", ".cmd", ".ps1"] : [""]) {
      const candidate = path6.join(dir.replace(/^"|"$/g, ""), `copilot${extension}`);
      if (fs6.existsSync(candidate)) return nativeFromShim(candidate) || candidate;
    }
  }
  return value;
}
function buildCopilotArgs(prompt, options = {}) {
  var _a;
  if (!prompt.trim()) throw new Error("Copilot task prompt is empty.");
  const args = ["--prompt", prompt, "--silent", "--stream", "on", "--no-color", "--no-ask-user", "--no-auto-update"];
  if ((_a = options.model) == null ? void 0 : _a.trim()) args.push("--model", options.model.trim());
  if (options.allowAllTools === true) {
    args.push("--allow-all-tools");
  } else {
    args.push("--available-tools", "view", "glob", "grep", "--allow-tool=read");
  }
  return args;
}
var CopilotCliClient = class {
  constructor(bin, cwd, onOutput = () => {
  }) {
    this.bin = bin;
    this.cwd = cwd;
    this.onOutput = onOutput;
    this.disposed = false;
  }
  run(prompt, options = {}) {
    if (this.disposed || this.child) return Promise.reject(new Error("Copilot client is no longer available."));
    if (process.platform === "win32" && /\.(cmd|bat|ps1)$/i.test(this.bin)) {
      return Promise.reject(new Error("Select the native copilot.exe executable, or reinstall @github/copilot with optional dependencies enabled."));
    }
    return new Promise((resolve5) => {
      let output = "";
      let error = "";
      let settled = false;
      let timer;
      let promptDir;
      const finish = (result) => {
        if (settled) return;
        settled = true;
        this.finish = void 0;
        if (timer) clearTimeout(timer);
        if (promptDir) {
          try {
            fs6.unlinkSync(path6.join(promptDir, "task.txt"));
            fs6.rmdirSync(promptDir);
          } catch (e) {
          }
        }
        resolve5(result);
      };
      this.finish = finish;
      try {
        let args;
        if (prompt.length > 12e3) {
          promptDir = fs6.mkdtempSync(path6.join(os3.tmpdir(), "autooc-copilot-"));
          const promptFile = path6.join(promptDir, "task.txt");
          fs6.writeFileSync(promptFile, prompt, { encoding: "utf8", mode: 384 });
          args = buildCopilotArgs(`Read the UTF-8 file ${JSON.stringify(promptFile)} and carry out the complete task instructions it contains.`, options);
          args.push("--add-dir", promptDir);
        } else {
          args = buildCopilotArgs(prompt, options);
        }
        this.child = (0, import_child_process3.spawn)(this.bin, args, {
          cwd: this.cwd,
          env: { ...process.env, ...options.env },
          stdio: "pipe",
          shell: false,
          windowsHide: true,
          detached: process.platform !== "win32"
        });
        this.child.stdout.setEncoding("utf8");
        this.child.stderr.setEncoding("utf8");
        this.child.stdout.on("data", (chunk) => {
          if (settled) return;
          output += chunk;
          this.onOutput(output);
        });
        this.child.stderr.on("data", (chunk) => {
          if (!settled) error += chunk;
        });
        this.child.once("error", (failure) => finish({ output, error: failure.message, exitCode: -1 }));
        this.child.once("close", (code) => finish({ output: output.trim(), error: error.trim(), exitCode: code != null ? code : -1 }));
        this.child.stdin.on("error", () => {
        });
        this.child.stdin.end();
        if (options.timeoutMs && options.timeoutMs > 0) {
          timer = setTimeout(() => {
            this.killTree();
            finish({ output, error: `Copilot task timed out after ${options.timeoutMs / 1e3} seconds.`, exitCode: -1 });
          }, options.timeoutMs);
        }
      } catch (failure) {
        finish({ output, error: String(failure), exitCode: -1 });
      }
    });
  }
  killTree() {
    const child = this.child;
    if (!(child == null ? void 0 : child.pid) || child.exitCode !== null) return;
    if (process.platform === "win32") {
      const killer = (0, import_child_process3.spawn)("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
      killer.on("error", () => {
        try {
          child.kill();
        } catch (e) {
        }
      });
    } else {
      try {
        process.kill(-child.pid, "SIGKILL");
      } catch (e) {
        try {
          child.kill("SIGKILL");
        } catch (e2) {
        }
      }
    }
  }
  dispose() {
    var _a;
    if (this.disposed) return;
    this.disposed = true;
    this.killTree();
    (_a = this.finish) == null ? void 0 : _a.call(this, { output: "", error: "Copilot task cancelled.", exitCode: -1 });
  }
};
function checkCopilotInstallation(bin, cwd) {
  return new Promise((resolve5, reject) => {
    const child = (0, import_child_process3.spawn)(bin, ["--version"], { cwd, windowsHide: true, shell: false, stdio: "pipe" });
    let output = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("Copilot version check timed out."));
    }, 15e3);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      output += chunk;
    });
    child.stderr.on("data", (chunk) => {
      output += chunk;
    });
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve5(output.trim());
      else reject(new Error(output.trim() || `Copilot exited with code ${code}.`));
    });
    child.stdin.end();
  });
}

// workflow-handoff.ts
function extractSection(output, title) {
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = output.match(
    new RegExp(`(?:^|\\r?\\n)## ${escaped}\\s*(?:\\r?\\n)+([\\s\\S]*?)(?=(?:\\r?\\n){2}---(?:\\r?\\n){2}## |$)`)
  );
  return match ? match[1].trim() : "";
}
function extractContextForHandoff(output) {
  const cleaned = output;
  if (!cleaned) return "";
  const response = cleaned.startsWith("## Response\n") || cleaned.startsWith("## Response\r\n") ? extractSection(cleaned, "Response") : "";
  const touchedFiles = extractSection(cleaned, "Touched files");
  const parts = [];
  if (response) {
    parts.push(`PRIMARY HANDOFF INPUT \u2014 use this as the main input for the current task:

${response}`);
    if (touchedFiles) {
      parts.push(`DIAGNOSTIC ONLY \u2014 touched files (do not re-read unless the current task explicitly asks):

${touchedFiles}`);
    }
  } else {
    const primary = cleaned;
    parts.push(`PRIMARY HANDOFF INPUT \u2014 use this as the main input for the current task:

${primary}`);
  }
  return parts.join("\n\n");
}
function workflowTaskPrompt(prompt, workflow, previous) {
  if (!workflow.handoffOutput || !previous) return prompt;
  const previousStep = workflow.steps.find((s) => s.id === previous.stepId);
  const sourceLine = previousStep ? `Source: step "${previousStep.name || previous.stepId}" (${previousStep.stepKind}${previousStep.taskId ? ` -> task ${previousStep.taskId}` : ""})` : `Source: step ${previous.stepId}`;
  const cleanOutput = extractContextForHandoff(String(previous.output || ""));
  const contextBlock = [
    "",
    "=== WORKFLOW HANDOFF CONTEXT ===",
    sourceLine,
    "The previous step's output below is the PRIMARY INPUT for this task.",
    "Touched files are DIAGNOSTIC ONLY \u2014 do not re-read them unless this task explicitly asks.",
    "",
    cleanOutput || String(previous.output || "").trim(),
    "=== END WORKFLOW HANDOFF CONTEXT ==="
  ].join("\n");
  return `${prompt}
${contextBlock}`;
}

// codex-execution.ts
async function executeCodexTask(client, request) {
  var _a;
  if (!((_a = request.prompt) == null ? void 0 : _a.trim())) throw new Error("Codex task prompt is empty");
  return await client.run(
    request.prompt,
    request.model || void 0,
    request.reasoningEffort || void 0,
    request.interactive ? "on-request" : "never"
  );
}

// code-runtime.ts
var fs7 = __toESM(require("fs"));
var path7 = __toESM(require("path"));
var vm = __toESM(require("vm"));
function executeCode(options) {
  var _a;
  const vaultBase = options.vaultBase;
  const defaultCwd = options.cwd;
  const resolveInVault = (p) => {
    const root = fs7.realpathSync(vaultBase);
    const resolved = path7.resolve(root, p || ".");
    if (resolved !== root && !resolved.startsWith(root + path7.sep)) {
      throw new Error(`Path escapes vault: ${p}`);
    }
    let current = root;
    for (const component of path7.relative(root, resolved).split(path7.sep).filter(Boolean)) {
      current = path7.join(current, component);
      try {
        if (fs7.lstatSync(current).isSymbolicLink()) throw new Error("Linked vault paths are unsupported");
      } catch (error) {
        if (error.code === "ENOENT") break;
        throw error;
      }
    }
    return resolved;
  };
  const readText = (p) => fs7.readFileSync(p, "utf8");
  const writeText = (p, content) => {
    fs7.mkdirSync(path7.dirname(p), { recursive: true });
    fs7.writeFileSync(p, String(content), "utf8");
    return p;
  };
  const sandbox = {
    input: (_a = options.input) != null ? _a : "",
    outputs: options.outputs || {},
    String,
    Number,
    Boolean,
    Array,
    Object,
    JSON,
    Math,
    Date,
    RegExp,
    console: { log: options.log || (() => {
    }) }
  };
  if (options.codeAllowVault) {
    sandbox.vault = {
      basePath: vaultBase,
      resolve: (p) => resolveInVault(p),
      read: (p) => readText(resolveInVault(p)),
      write: (p, content) => writeText(resolveInVault(p), content),
      append: (p, content) => {
        const full = resolveInVault(p);
        fs7.mkdirSync(path7.dirname(full), { recursive: true });
        fs7.appendFileSync(full, String(content), "utf8");
        return full;
      },
      exists: (p) => fs7.existsSync(resolveInVault(p)),
      list: (p = ".") => fs7.readdirSync(resolveInVault(p))
    };
  }
  if (options.codeAllowFiles) {
    sandbox.files = {
      cwd: defaultCwd,
      resolve: (p) => path7.isAbsolute(p) ? path7.resolve(p) : path7.resolve(defaultCwd, p || "."),
      read: (p) => readText(path7.isAbsolute(p) ? path7.resolve(p) : path7.resolve(defaultCwd, p)),
      write: (p, content) => writeText(path7.isAbsolute(p) ? path7.resolve(p) : path7.resolve(defaultCwd, p), content),
      append: (p, content) => {
        const full = path7.isAbsolute(p) ? path7.resolve(p) : path7.resolve(defaultCwd, p);
        fs7.mkdirSync(path7.dirname(full), { recursive: true });
        fs7.appendFileSync(full, String(content), "utf8");
        return full;
      },
      exists: (p) => fs7.existsSync(path7.isAbsolute(p) ? path7.resolve(p) : path7.resolve(defaultCwd, p)),
      list: (p = ".") => fs7.readdirSync(path7.isAbsolute(p) ? path7.resolve(p) : path7.resolve(defaultCwd, p))
    };
  }
  if (options.codeAllowTerminal) {
    const { execSync } = require("child_process");
    sandbox.terminal = {
      run: (command, options2 = {}) => execSync(String(command), {
        cwd: options2.cwd ? path7.isAbsolute(options2.cwd) ? options2.cwd : path7.resolve(defaultCwd, options2.cwd) : defaultCwd,
        timeout: Math.min(Math.max(options2.timeoutMs || 3e4, 1e3), 6e5),
        encoding: "utf8"
      })
    };
  }
  if (options.exposePaths === false) {
    if (sandbox.vault) {
      delete sandbox.vault.basePath;
      delete sandbox.vault.resolve;
    }
    if (sandbox.files) {
      delete sandbox.files.cwd;
      delete sandbox.files.resolve;
    }
  }
  const inputVar = options.codeInputVar || "input";
  const outputVar = options.codeOutputVar || "output";
  const preamble = `var ${inputVar} = input; var ${outputVar} = "";`;
  const result = vm.runInNewContext(preamble + "\n" + options.code + "\n;" + outputVar, sandbox, { timeout: 9e5 });
  return String(result == null ? "" : result);
}

// code-task.ts
function executeCodeTask(options) {
  const code = options.code || options.prompt || "";
  if (!code.trim()) throw new Error("Code task not launched: code is empty.");
  return executeCode({ ...options, code, exposePaths: false });
}

// execution-defaults.ts
var EXECUTION_DEFAULTS = Object.freeze({
  opencodePath: "opencode",
  codexPath: "codex",
  copilotPath: "copilot",
  defaultCopilotModel: "",
  defaultAiEngine: "opencode",
  defaultModel: "",
  defaultCodexModel: "",
  defaultCodexReasoningEffort: "medium",
  defaultAgent: "build",
  workingDirectory: "",
  cmdTemplate: '{opencode} run --model {model} -- "{prompt}"',
  taskTimeoutSeconds: 7200,
  defaultInteractiveTerminal: false,
  linuxTerminal: ""
});
function effectiveExecutionSettings(settings) {
  return Object.fromEntries(Object.entries(EXECUTION_DEFAULTS).map(([key, value]) => [key, settings[key] === void 0 ? value : settings[key]]));
}

// execution-lease.ts
var fs8 = __toESM(require("fs"));
var path8 = __toESM(require("path"));
var import_crypto4 = require("crypto");
function acquireExecutionLease(runtimeDirectory) {
  const root = fs8.realpathSync(runtimeDirectory);
  if (fs8.existsSync(path8.join(root, "update-pending.json"))) throw new Error("Incomplete plugin update requires recovery before execution");
  const recovery = path8.join(root, "lease-recovery.lock");
  if (fs8.existsSync(recovery)) throw new Error("Execution lease recovery is in progress");
  const lock = path8.join(root, "execution.lock");
  const ownerPath = path8.join(lock, "owner.json");
  const token = (0, import_crypto4.randomUUID)();
  fs8.mkdirSync(lock);
  if (fs8.existsSync(recovery)) {
    fs8.rmdirSync(lock);
    throw new Error("Execution lease recovery is in progress");
  }
  try {
    const fd = fs8.openSync(ownerPath, "wx", 384);
    try {
      fs8.writeFileSync(fd, JSON.stringify({ schemaVersion: 1, token, pid: process.pid, createdAt: (/* @__PURE__ */ new Date()).toISOString() }));
      fs8.fsyncSync(fd);
    } finally {
      fs8.closeSync(fd);
    }
  } catch (error) {
    throw error;
  }
  let released = false;
  const assertOwned = () => {
    if (released) throw new Error("Execution lease already released");
    if (fs8.lstatSync(lock).isSymbolicLink() || fs8.realpathSync(lock) !== lock) throw new Error("Execution lease directory changed");
    if (fs8.lstatSync(ownerPath).isSymbolicLink()) throw new Error("Execution lease owner changed");
    const owner = JSON.parse(fs8.readFileSync(ownerPath, "utf8"));
    if (owner.token !== token || owner.pid !== process.pid || owner.schemaVersion !== 1) throw new Error("Execution lease ownership changed");
  };
  return {
    directory: root,
    token,
    assertOwned,
    release() {
      assertOwned();
      fs8.unlinkSync(ownerPath);
      fs8.rmdirSync(lock);
      released = true;
    }
  };
}
function readExecutionLeaseOwner(runtimeDirectory) {
  const root = fs8.realpathSync(runtimeDirectory), lock = path8.join(root, "execution.lock"), file = path8.join(lock, "owner.json");
  if (fs8.lstatSync(lock).isSymbolicLink() || fs8.realpathSync(lock) !== lock || fs8.lstatSync(file).isSymbolicLink()) throw new Error("Invalid execution lease paths");
  let owner;
  try {
    owner = JSON.parse(fs8.readFileSync(file, "utf8"));
  } catch (e) {
    throw new Error("Incomplete execution lease owner; manual reconciliation required");
  }
  if ((owner == null ? void 0 : owner.schemaVersion) !== 1 || !/^[a-f0-9-]{36}$/.test(owner.token || "") || !Number.isSafeInteger(owner.pid) || owner.pid <= 0 || !Number.isFinite(Date.parse(owner.createdAt))) throw new Error("Invalid execution lease owner");
  return { schemaVersion: 1, token: owner.token, pid: owner.pid, createdAt: owner.createdAt };
}

// installed-workflow-host.ts
var fs17 = __toESM(require("fs"));
var path15 = __toESM(require("path"));

// workflow-definition.ts
var import_crypto5 = require("crypto");
var runtimeFields = /* @__PURE__ */ new Set(["status", "lastRun", "output", "createdAt", "currentStep", "lastCodexThreadId", "lastCodexTurnId", "pendingCodexApproval", "runtimeExecution"]);
function withoutRuntime(value) {
  return Object.fromEntries(Object.entries(value).filter(([key]) => !runtimeFields.has(key)));
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().filter((key) => value[key] !== void 0).map((key) => [key, canonical(value[key])]));
  return value;
}
function freeze(value) {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
function prepareWorkflowDefinition(workflow, tasks, settings) {
  if (!workflow.id || !workflow.steps.length || new Set(workflow.steps.map((s) => s.id)).size !== workflow.steps.length) throw new Error("Invalid workflow identity or steps");
  const refs = [...new Set(workflow.steps.filter((s) => s.stepKind === "task" || !s.stepKind && s.taskId).map((s) => s.taskId))];
  const selected = refs.map((id) => {
    const matches = tasks.filter((t) => t.id === id);
    if (!id || matches.length !== 1) throw new Error("Missing or ambiguous referenced task");
    return withoutRuntime(matches[0]);
  });
  const payload = canonical({ workflow: { ...withoutRuntime(workflow), steps: workflow.steps.map((s) => withoutRuntime(s)) }, tasks: selected, settings: effectiveExecutionSettings(settings) });
  const hash = (0, import_crypto5.createHash)("sha256").update(JSON.stringify(payload)).digest("hex");
  return freeze({ ...payload, hash });
}

// code-workflow-adapter.ts
function createCodeWorkflowAdapter(vaultBase, workingDirectory = vaultBase) {
  const supports = (task) => task.taskKind === "code";
  return {
    supports,
    async execute(task, _prompt, signal) {
      if (!supports(task)) throw new Error("Unsupported Code task");
      if (signal == null ? void 0 : signal.aborted) throw new Error("Code task cancelled before execution");
      if (!(task.code || task.prompt || "").trim()) return { succeeded: false, output: "[AutoOC] Code task not launched: code is empty." };
      let output = "[running code task...]\n";
      try {
        const result = executeCodeTask({
          ...task,
          vaultBase,
          cwd: task.workingDirectory || workingDirectory,
          log: (...args) => {
            output += args.map(String).join(" ") + "\n";
          }
        });
        output += result;
        return { succeeded: true, output };
      } catch (error) {
        return { succeeded: false, output: output + `[code error: ${String(error)}]` };
      }
    }
  };
}

// codex-workflow-adapter.ts
var fs9 = __toESM(require("fs"));
function codexWorkflowAdapter(createClient, defaults = {}) {
  return {
    supports: (task) => task.taskKind === "codex" && (task.interactiveTerminal === void 0 || typeof task.interactiveTerminal === "boolean"),
    async execute(task, prompt, signal, recordThread, interaction) {
      if (task.taskKind !== "codex") throw new Error("Unsupported autonomous Codex task");
      if (task.interactiveTerminal !== void 0 && typeof task.interactiveTerminal !== "boolean") throw new Error("interactiveTerminal must be boolean");
      if (task.interactiveTerminal && !interaction) throw new Error("Interactive Codex requires an approval channel");
      if (signal == null ? void 0 : signal.aborted) throw new Error("Codex execution cancelled before launch");
      const lifetime = new AbortController();
      let approvalError;
      const client = createClient(task, { onThreadCreated: async ({ threadId }) => {
        if (!recordThread) throw new Error("Durable Codex identity recorder is required");
        await recordThread(threadId);
      }, onStarted: async ({ threadId, turnId }) => {
        if (!recordThread) throw new Error("Durable Codex identity recorder is required");
        await recordThread(threadId, turnId);
      }, onApproval: async (request) => {
        var _a;
        try {
          const approved = task.interactiveTerminal ? await interaction.approve(request, lifetime.signal) : false;
          if (!lifetime.signal.aborted && !((_a = client.resolveApproval) == null ? void 0 : _a.call(client, request.requestId, approved))) throw new Error("Codex approval is no longer active");
        } catch (error) {
          approvalError = error;
          await client.interrupt();
        }
      } });
      const abort = () => {
        lifetime.abort();
        void client.interrupt().catch(() => {
        });
      };
      signal == null ? void 0 : signal.addEventListener("abort", abort, { once: true });
      try {
        const result = await executeCodexTask(client, {
          prompt,
          model: task.model || defaults.model,
          reasoningEffort: task.reasoningEffort || defaults.reasoningEffort || "medium",
          interactive: !!task.interactiveTerminal
        });
        if (approvalError) throw approvalError;
        if (signal == null ? void 0 : signal.aborted) throw new Error("Codex execution cancelled; reconcile its outcome");
        return { succeeded: result.status === "completed", output: result.output || result.error || "(no output)", ...result.status === "interrupted" ? { cancelled: true } : {} };
      } finally {
        lifetime.abort();
        signal == null ? void 0 : signal.removeEventListener("abort", abort);
        client.dispose();
      }
    }
  };
}
function createCodexWorkflowAdapter(definition, vaultBase) {
  const directory = (task) => {
    const cwd = fs9.realpathSync(task.workingDirectory || definition.settings.workingDirectory || vaultBase);
    if (!fs9.statSync(cwd).isDirectory()) throw new Error("Codex working directory is unavailable");
    return cwd;
  };
  const create = (task, callbacks) => {
    const bin = resolveCodexBin(definition.settings.codexPath);
    const client = new CodexAppServerClient(bin, directory(task), {
      ...callbacks,
      onStarted: async (ids) => {
        var _a;
        await ((_a = callbacks == null ? void 0 : callbacks.onStarted) == null ? void 0 : _a.call(callbacks, ids));
        if (task.interactiveTerminal) await openCodexThread(ids.threadId);
      },
      onApproval: (request) => {
        if (callbacks == null ? void 0 : callbacks.onApproval) callbacks.onApproval(request);
        else client.resolveApproval(request.requestId, false);
      }
    });
    return client;
  };
  const adapter = codexWorkflowAdapter(create, { model: definition.settings.defaultCodexModel, reasoningEffort: definition.settings.defaultCodexReasoningEffort });
  adapter.reconcile = async (task, threadId, turnId) => {
    const client = create(task, {});
    try {
      return await client.readExistingResult(threadId, turnId);
    } finally {
      client.dispose();
    }
  };
  return adapter;
}

// cli-workflow-adapters.ts
var fs10 = __toESM(require("fs"));
var path9 = __toESM(require("path"));

// command-output.ts
function normalizeCommandOutput(text) {
  if (!text) return "";
  const cleaned = text.replace(/\x1B\[[0-9;]*[A-Za-z]/g, "");
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
    parts.push(`## Response

${cleanStdout}`);
  }
  const touchedFiles = extractTouchedFiles(cleanStderr);
  if (touchedFiles.length > 0) {
    parts.push(`## Touched files

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

// cli-workflow-adapters.ts
function createCopilotWorkflowAdapter(definition, vault) {
  const supports = (task) => task.taskKind === "copilot" && !task.interactiveTerminal && !task.branch && !task.createBranch && (task.copilotAllowAllTools === void 0 || typeof task.copilotAllowAllTools === "boolean");
  return { supports, async execute(task, prompt, signal) {
    if (!supports(task)) throw new Error("Unsupported Copilot task");
    if (signal == null ? void 0 : signal.aborted) throw new Error("Copilot cancelled before launch");
    const client = new CopilotCliClient(resolveCopilotBin(definition.settings.copilotPath), task.workingDirectory || definition.settings.workingDirectory || vault);
    const abort = () => client.dispose();
    signal == null ? void 0 : signal.addEventListener("abort", abort, { once: true });
    try {
      const result = await client.run(prompt, { model: task.model || definition.settings.defaultCopilotModel, allowAllTools: task.copilotAllowAllTools === true, timeoutMs: Math.max(0, definition.settings.taskTimeoutSeconds) * 1e3 });
      if ((signal == null ? void 0 : signal.aborted) || /timed out/.test(result.error)) throw new Error("Copilot outcome is uncertain; reconcile before continuing");
      return { succeeded: result.exitCode === 0, output: result.output + (result.error ? `
[Copilot error: ${result.error}]` : "") };
    } finally {
      signal == null ? void 0 : signal.removeEventListener("abort", abort);
      client.dispose();
    }
  } };
}
function createOpenCodeWorkflowAdapter(definition, vault) {
  const supports = (task) => !task.taskKind || task.taskKind === "opencode";
  return { supports, async execute(task, prompt, signal) {
    if (!supports(task)) throw new Error("Unsupported OpenCode task");
    if (signal == null ? void 0 : signal.aborted) throw new Error("OpenCode cancelled before launch");
    const taskCwd = task.workingDirectory || definition.settings.workingDirectory || vault;
    const model = task.model || definition.settings.defaultModel;
    if (!prompt.trim() || !(model == null ? void 0 : model.trim())) return { succeeded: false, output: "[OpenCode requires a nonempty prompt and model]" };
    const bin = resolveOpencodeBin(definition.settings.opencodePath);
    const agent = task.agent || definition.settings.defaultAgent || "build";
    if (task.useRalphLoop) prompt = "/ralph-loop " + prompt;
    if (task.interactiveTerminal) {
      await new Promise((resolve5, reject) => {
        const options = { onLaunched: resolve5, onError: reject, linuxTerminal: definition.settings.linuxTerminal };
        if (process.platform === "win32") openOpencodeCliLongPromptWindows(bin, taskCwd, {}, model, task.forceModel ? "" : agent, prompt, options);
        else openOpencodeCli(bin, taskCwd, {}, ["-m", model, ...task.forceModel ? [] : ["--agent", agent], "--prompt", prompt], options);
      });
      return { succeeded: true, output: "[opened interactive OpenCode CLI with preloaded prompt; interactive task result is not observed]" };
    }
    const folder = fs10.mkdtempSync(path9.join(taskCwd, ".autooc-runtime-"));
    const outFile = path9.join(folder, "stdout.txt"), errFile = path9.join(folder, "stderr.txt"), doneFile = path9.join(folder, "done.txt");
    const pidFile = path9.join(folder, "process.pid"), promptFile = path9.join(folder, "instruction.txt"), full = path9.join(folder, "input.txt");
    const scriptFile = path9.join(folder, "launch" + scriptExt());
    fs10.writeFileSync(full, prompt, { encoding: "utf8", mode: 384 });
    fs10.writeFileSync(promptFile, `Read the complete task prompt and workflow context from the workspace file at ${full} and follow it exactly.`, { encoding: "utf8", mode: 384 });
    const script = buildOpenCodeScript({ pidFile, secretEnv: {}, safeCwd: taskCwd.replace(/'/g, "''"), gitCmds: "", bin, model, effectiveAgent: agent, effectiveTask: task, promptFile, outFile, errFile, doneFile, taskCwd });
    if (process.platform === "win32") writeUtf8BomFile(scriptFile, script);
    else fs10.writeFileSync(scriptFile, script, { mode: 384 });
    const handle = launchHidden(scriptFile, pidFile);
    let known = false;
    try {
      const result = await new Promise((resolve5, reject) => {
        let ended = false;
        const finish = (error) => {
          if (ended) return;
          ended = true;
          clearInterval(timer);
          signal == null ? void 0 : signal.removeEventListener("abort", abort);
          if (error) reject(error);
        };
        const abort = () => {
          handle.kill();
          finish(new Error("OpenCode interrupted; effects require reconciliation"));
        };
        const started = Date.now(), timeout = Number(definition.settings.taskTimeoutSeconds) * 1e3;
        const timer = setInterval(() => {
          try {
            if (timeout > 0 && Date.now() - started > timeout) {
              abort();
              return;
            }
            if (!fs10.existsSync(doneFile)) return;
            const exit = fs10.readFileSync(doneFile, "utf8").replace(/^\uFEFF/, "").trim();
            if (!/^-?\d+$/.test(exit)) throw new Error("Invalid OpenCode completion marker");
            const read = (file) => fs10.existsSync(file) ? decodeCommandBuffer(fs10.readFileSync(file)) : "";
            const output = formatTaskOutput(read(outFile), read(errFile));
            known = true;
            finish();
            resolve5({ succeeded: exit === "0", output: output || "(no output)" });
          } catch (error) {
            finish(error);
          }
        }, 100);
        handle.onError((error) => finish(error));
        signal == null ? void 0 : signal.addEventListener("abort", abort, { once: true });
        if (signal == null ? void 0 : signal.aborted) abort();
      });
      return result;
    } finally {
      handle.cleanup(known);
      if (known) {
        for (const file of [outFile, errFile, doneFile, pidFile, promptFile, full, scriptFile]) {
          try {
            fs10.unlinkSync(file);
          } catch (error) {
            if (error.code !== "ENOENT") throw error;
          }
        }
        fs10.rmdirSync(folder);
      }
    }
  } };
}

// workflow-task-adapters.ts
function combineWorkflowTaskAdapters(adapters) {
  const registered = [...adapters];
  const matches = (task) => registered.filter((adapter) => adapter.supports(task));
  const select = (task) => {
    const found = matches(task);
    if (found.length !== 1) throw new Error("Task requires exactly one supported executor");
    return found[0];
  };
  return {
    supports: (task) => matches(task).length === 1,
    execute: (task, prompt, signal, recordThread, interaction) => select(task).execute(task, prompt, signal, recordThread, interaction),
    async reconcile(task, threadId, turnId) {
      const adapter = select(task);
      if (!adapter.reconcile) throw new Error("Task executor cannot reconcile an interrupted execution");
      return await adapter.reconcile(task, threadId, turnId);
    }
  };
}
function createWorkflowTaskAdapter(definition, vaultBase) {
  return combineWorkflowTaskAdapters([
    createCodeWorkflowAdapter(vaultBase, definition.settings.workingDirectory || vaultBase),
    createCodexWorkflowAdapter(definition, vaultBase),
    createCopilotWorkflowAdapter(definition, vaultBase),
    createOpenCodeWorkflowAdapter(definition, vaultBase)
  ]);
}

// code-workflow-host.ts
var fs13 = __toESM(require("fs"));

// workflow-routing.ts
var vm2 = __toESM(require("vm"));
function workflowStepTransitions(steps, index) {
  var _a;
  const step = steps[index];
  if (!step) throw new Error("Workflow step is absent");
  if ((_a = step.transitions) == null ? void 0 : _a.length) return step.transitions;
  const next = steps[index + 1];
  if (!next) return [];
  if (step.stepKind === "code" || step.stepKind === "delay") return [{ toStepId: next.id, mode: "default" }];
  return [{ toStepId: next.id, mode: step.transitionMode || "default", evaluatePrompt: step.evaluatePrompt, forceContinue: step.forceContinue }];
}
function findWorkflowEntry(steps) {
  if (!steps.length) return null;
  const incoming = new Set(steps.flatMap((step) => (step.transitions || []).map((t) => t.toStepId)));
  const candidates = steps.filter((step) => !incoming.has(step.id));
  if (!candidates.length) return steps[0];
  return candidates.sort((a, b) => {
    var _a, _b, _c, _d;
    return ((_b = (_a = a.position) == null ? void 0 : _a.x) != null ? _b : 0) - ((_d = (_c = b.position) == null ? void 0 : _c.x) != null ? _d : 0);
  })[0];
}
function evaluateWorkflowCondition(expression, input, outputs) {
  if (!expression || !expression.trim()) return false;
  const sandbox = {
    input: input || "",
    outputs,
    String,
    Number,
    Boolean,
    Array,
    Object,
    JSON,
    Math,
    Date,
    RegExp,
    console: { log: () => {
    } }
  };
  const source = expression.trim().startsWith("return") ? `(function(){ ${expression} })()` : `(${expression})`;
  return !!vm2.runInNewContext(source, sandbox, { timeout: 500 });
}
async function resolveWorkflowTransition(steps, index, input, succeeded, transitions, outputs, host) {
  var _a;
  if (!(transitions == null ? void 0 : transitions.length)) {
    const next = steps[index + 1];
    return { nextStepId: (_a = next == null ? void 0 : next.id) != null ? _a : null, reason: next ? "linear" : "end" };
  }
  for (const transition of transitions) {
    const target = steps.find((step) => step.id === transition.toStepId);
    if (!target) continue;
    if (transition.mode === "force" || transition.forceContinue) return { nextStepId: target.id, reason: "force" };
    if (transition.mode === "default") {
      if (succeeded) return { nextStepId: target.id, reason: "default" };
    } else if (transition.mode === "eval") {
      try {
        const response = await host.evaluate(transition, target, input);
        if (/\bYES\b/i.test(response) && !/\bNO\b/i.test(response)) return { nextStepId: target.id, reason: "eval:yes" };
      } catch (error) {
        host.onError("eval", error);
      }
    } else if (transition.mode === "conditional") {
      try {
        if (evaluateWorkflowCondition(transition.condition || "", input, outputs)) return { nextStepId: target.id, reason: "conditional:true" };
      } catch (error) {
        host.onError("condition", error);
      }
    }
  }
  return { nextStepId: null, reason: "no-match" };
}

// workflow-session.ts
async function advanceWorkflowSession(journal, definition, host, options = {}) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i;
  const verified = prepareWorkflowDefinition(definition.workflow, definition.tasks, definition.settings);
  const checkpoint = journal.snapshot();
  if (verified.hash !== definition.hash || checkpoint.definitionHash !== verified.hash || checkpoint.workflowId !== verified.workflow.id) throw new Error("Workflow definition does not match execution checkpoint");
  const steps = verified.workflow.steps;
  if (new Set(steps.map((step) => step.id)).size !== steps.length) throw new Error("Duplicate workflow step identity");
  const limit = (_a = options.maxSteps) != null ? _a : 1e4;
  if (!Number.isSafeInteger(limit) || limit < 1) throw new Error("Invalid execution step limit");
  await ((_b = host.onCheckpoint) == null ? void 0 : _b.call(host, journal.snapshot()));
  for (let count = 0; count < limit; count++) {
    const state = journal.snapshot();
    const observed = state.phase === "in_flight" ? state.steps[state.steps.length - 1].result : void 0;
    if (state.phase === "in_flight" && !observed) throw new Error("Interrupted step requires reconciliation before continuation");
    if (!["ready", "in_flight"].includes(state.phase) || ((_c = options.signal) == null ? void 0 : _c.aborted)) return state;
    const index = steps.findIndex((step2) => step2.id === state.nextStepId);
    if (index < 0) throw new Error("Checkpoint step is absent from workflow definition");
    const step = steps[index];
    const outputs = /* @__PURE__ */ Object.create(null);
    for (const previous of state.steps) outputs[previous.stepId] = previous.output || "";
    const input = state.steps.length ? state.steps[state.steps.length - 1].output || "" : "";
    if (!observed) {
      await journal.begin(step.id);
      try {
        await ((_d = host.onCheckpoint) == null ? void 0 : _d.call(host, journal.snapshot()));
      } catch (error) {
        await journal.finish(step.id, false, "[progress publication failed before step effects]", null);
        throw error;
      }
      if ((_e = options.signal) == null ? void 0 : _e.aborted) {
        await journal.finish(step.id, false, "[cancelled before step effects]", null);
        await ((_f = host.onCheckpoint) == null ? void 0 : _f.call(host, journal.snapshot()));
        return journal.snapshot();
      }
    }
    const result = observed || await host.execute(step, input, outputs, options.signal);
    if (typeof result.succeeded !== "boolean" || typeof result.output !== "string") throw new Error("Invalid execution result");
    if (result.cancelled !== void 0 && (typeof result.cancelled !== "boolean" || result.cancelled && result.succeeded)) throw new Error("Invalid cancellation result");
    const output = observed ? result.output : host.redact(result.output);
    if (typeof output !== "string") throw new Error("Invalid redacted output");
    if (!observed) await journal.recordResult({ ...result, output });
    if (result.cancelled) {
      await journal.finish(step.id, false, output, null);
      await ((_g = host.onCheckpoint) == null ? void 0 : _g.call(host, journal.snapshot()));
      return journal.snapshot();
    }
    outputs[step.id] = output;
    const transitions = workflowStepTransitions(steps, index);
    const next = await resolveWorkflowTransition(steps, index, output, result.succeeded, transitions, outputs, {
      evaluate: async (transition, target, input2) => {
        var _a2, _b2;
        const key = String(transitions.indexOf(transition));
        const saved = (_a2 = journal.snapshot().steps.slice(-1)[0].evaluations) == null ? void 0 : _a2.find((entry) => entry.key === key);
        if ((saved == null ? void 0 : saved.status) === "completed") return saved.output;
        if (saved) throw new Error("Interrupted evaluation requires reconciliation; it cannot be replayed");
        await journal.recordEvaluation(key);
        await ((_b2 = host.onCheckpoint) == null ? void 0 : _b2.call(host, journal.snapshot()));
        const response = host.redact(await host.evaluate(transition, target, input2));
        await journal.recordEvaluation(key, response);
        return response;
      },
      onError: (kind, error) => {
        host.onTransitionError(kind, error);
        if (kind === "eval") throw error;
      }
    });
    if ((_h = options.signal) == null ? void 0 : _h.aborted) return journal.snapshot();
    await journal.finish(step.id, result.succeeded, output, next.nextStepId);
    await ((_i = host.onCheckpoint) == null ? void 0 : _i.call(host, journal.snapshot()));
  }
  return journal.snapshot();
}

// workflow-delay.ts
function workflowDelay(value = 0, unit = "seconds") {
  if (!Number.isFinite(value)) throw new Error("Invalid workflow delay");
  const amount = Math.max(0, value);
  const milliseconds = amount * (unit === "hours" ? 36e5 : unit === "minutes" ? 6e4 : 1e3);
  if (!Number.isSafeInteger(Math.ceil(milliseconds))) throw new Error("Workflow delay is too large");
  return { milliseconds, output: `[delay ${amount} ${unit}]` };
}
function waitForWorkflowDelay(milliseconds, signal) {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return Promise.reject(new Error("Invalid workflow delay"));
  return new Promise((resolve5, reject) => {
    let timer;
    let remaining = milliseconds;
    const cleanup = () => {
      clearTimeout(timer);
      signal == null ? void 0 : signal.removeEventListener("abort", abort);
    };
    const abort = () => {
      cleanup();
      const error = new Error("Workflow delay cancelled");
      error.name = "AbortError";
      reject(error);
    };
    const schedule = () => {
      const chunk = Math.min(remaining, 2147483647);
      remaining -= chunk;
      timer = setTimeout(() => {
        if (remaining > 0) schedule();
        else {
          cleanup();
          resolve5();
        }
      }, chunk);
    };
    if (signal == null ? void 0 : signal.aborted) {
      abort();
      return;
    }
    signal == null ? void 0 : signal.addEventListener("abort", abort, { once: true });
    schedule();
  });
}

// workflow-recovery.ts
async function reconcileWorkflowTask(journal, definition, read, host) {
  const state = journal.snapshot();
  const verified = prepareWorkflowDefinition(definition.workflow, definition.tasks, definition.settings);
  if (verified.hash !== definition.hash || state.definitionHash !== verified.hash || state.workflowId !== verified.workflow.id) throw new Error("Recovery definition mismatch");
  if (state.phase !== "in_flight") return state;
  const step = state.steps[state.steps.length - 1];
  if (!step.codexThreadId || !step.codexTurnId) throw new Error("Exact Codex identity is unavailable; manual reconciliation required");
  const result = await read(step.codexThreadId, step.codexTurnId);
  if (result.threadId !== step.codexThreadId || result.turnId !== step.codexTurnId) throw new Error("Recovery execution identity mismatch");
  if (!["completed", "failed", "interrupted"].includes(result.status)) return state;
  if (typeof result.output !== "string") throw new Error("Recovery output is unavailable");
  const index = verified.workflow.steps.findIndex((item) => item.id === step.stepId);
  if (index < 0) throw new Error("Recovery step is missing");
  const output = host.redact(result.output);
  if (typeof output !== "string") throw new Error("Invalid redacted recovery output");
  const outputs = /* @__PURE__ */ Object.create(null);
  for (const item of state.steps) outputs[item.stepId] = item.output || "";
  outputs[step.stepId] = output;
  const succeeded = result.status === "completed";
  await journal.recordResult({ succeeded, output, cancelled: result.status === "interrupted" });
  if (result.status === "interrupted") {
    await journal.finish(step.stepId, false, output, null);
    return journal.snapshot();
  }
  const transitions = workflowStepTransitions(verified.workflow.steps, index);
  if (transitions.some((t) => t.mode === "eval")) return journal.snapshot();
  const next = await resolveWorkflowTransition(
    verified.workflow.steps,
    index,
    output,
    succeeded,
    transitions,
    { ...outputs },
    { evaluate: async () => {
      throw new Error("Reconciliation cannot launch a model evaluation");
    }, onError: host.onTransitionError.bind(host) }
  );
  await journal.finish(step.stepId, succeeded, output, next.nextStepId);
  return journal.snapshot();
}

// workflow-branch.ts
var fs11 = __toESM(require("fs"));
var path10 = __toESM(require("path"));
var import_child_process4 = require("child_process");
function validateBranchOptions(task) {
  var _a, _b;
  if (task.branch !== void 0 && typeof task.branch !== "string") throw new Error("Branch must be a string");
  if (task.createBranch !== void 0 && typeof task.createBranch !== "boolean") throw new Error("createBranch must be boolean");
  if (task.createBranch && !((_a = task.branch) == null ? void 0 : _a.trim())) throw new Error("Creating a branch requires its name");
  if ((_b = task.branch) == null ? void 0 : _b.trim()) {
    try {
      (0, import_child_process4.execFileSync)("git", ["check-ref-format", "--branch", task.branch], { stdio: "ignore", windowsHide: true });
    } catch (e) {
      throw new Error("Invalid Git branch name");
    }
    if (task.branch.startsWith("-") || task.branch.includes("@{")) throw new Error("Invalid Git branch name");
  }
}
function git(cwd, args) {
  try {
    return (0, import_child_process4.execFileSync)("git", ["-c", `safe.directory=${cwd.replace(/\\/g, "/")}`, ...args], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], windowsHide: true }).trim();
  } catch (e) {
    throw new Error("Git branch operation failed; working tree preserved, no forced checkout or cleanup");
  }
}
function branchRepository(cwd, vault) {
  const directory = fs11.realpathSync(git(cwd, ["rev-parse", "--show-toplevel"]));
  const relative4 = path10.relative(fs11.realpathSync(vault), directory);
  if (relative4 === ".." || relative4.startsWith(".." + path10.sep) || path10.isAbsolute(relative4)) throw new Error("Git repository is outside the selected vault");
  const metadata = fs11.realpathSync(git(directory, ["rev-parse", "--absolute-git-dir"]));
  const metadataRelative = path10.relative(fs11.realpathSync(vault), metadata);
  if (metadataRelative === ".." || metadataRelative.startsWith(".." + path10.sep) || path10.isAbsolute(metadataRelative)) throw new Error("Git metadata is outside the selected vault");
  return directory;
}
async function prepareTaskBranch(journal, task, cwd, vault, handoff) {
  var _a, _b, _c;
  validateBranchOptions(task);
  const state = journal.snapshot();
  const previous = handoff ? (_a = [...state.steps].reverse().find((step) => step.branch)) == null ? void 0 : _a.branch : void 0;
  if (!previous && !((_b = task.branch) == null ? void 0 : _b.trim()) && !handoff) return;
  const directory = branchRepository(cwd, vault);
  if (previous) {
    if (previous.directory !== directory || git(directory, ["branch", "--show-current"]) !== previous.name) throw new Error("Workflow branch changed; reconcile before continuation");
  } else if ((_c = task.branch) == null ? void 0 : _c.trim()) {
    const name2 = task.createBranch ? `${task.branch}-${state.runId.slice(0, 8)}-${state.steps.length}` : task.branch;
    git(directory, task.createBranch ? ["checkout", "-b", name2] : ["checkout", name2]);
  }
  const name = git(directory, ["branch", "--show-current"]);
  if (!name) throw new Error("Workflow branch requires an attached Git branch");
  await journal.recordBranch({ directory, name });
}
function verifyWorkflowBranch(journal) {
  var _a;
  const branch = (_a = [...journal.snapshot().steps].reverse().find((step) => step.branch)) == null ? void 0 : _a.branch;
  if (branch && git(branch.directory, ["branch", "--show-current"]) !== branch.name) throw new Error("Workflow branch changed; reconcile before continuation");
}

// workflow-approval.ts
var fs12 = __toESM(require("fs"));
var path11 = __toESM(require("path"));
var import_crypto6 = require("crypto");
function responseFile(directory, runId, token) {
  if (!/^[a-f0-9-]+$/.test(token)) throw new Error("Invalid approval identity");
  return path11.join(directory, `${runId}-${token}.approval.json`);
}
function answerWorkflowApproval(directory, runId, token, approved) {
  var _a;
  if (typeof approved !== "boolean") throw new Error("Explicit approval decision required");
  const state = readExecutionCheckpoint(directory, runId), step = state.steps.slice(-1)[0];
  if (state.phase !== "in_flight" || ((_a = step == null ? void 0 : step.approval) == null ? void 0 : _a.token) !== token || step.result) throw new Error("Approval is no longer pending");
  const owner = readExecutionLeaseOwner(directory);
  if (owner.token !== step.approval.ownerToken) throw new Error("Approval owner changed; reconcile execution");
  try {
    process.kill(owner.pid, 0);
  } catch (e) {
    throw new Error("Approval owner is unavailable; reconcile execution");
  }
  fs12.writeFileSync(responseFile(directory, runId, token), JSON.stringify({ runId, token, approved }), { encoding: "utf8", flag: "wx", mode: 384 });
  return { runId, approval: token, decision: approved ? "approve" : "deny", recorded: true };
}
async function awaitWorkflowApproval(journal, directory, request, redact, signal, onCheckpoint) {
  const token = (0, import_crypto6.randomUUID)(), runId = journal.snapshot().runId;
  const ownerToken = readExecutionLeaseOwner(directory).token;
  await journal.recordApproval({ token, ownerToken, requestId: request.requestId, kind: request.kind, summary: redact(request.summary) });
  await (onCheckpoint == null ? void 0 : onCheckpoint(journal.snapshot()));
  const file = responseFile(directory, runId, token);
  const approved = await new Promise((resolve5, reject) => {
    const finish = (error, value) => {
      clearInterval(timer);
      signal == null ? void 0 : signal.removeEventListener("abort", abort);
      error ? reject(error) : resolve5(value);
    };
    const abort = () => finish(new Error("Approval interrupted; execution requires reconciliation"));
    const timer = setInterval(() => {
      try {
        if (!fs12.existsSync(file)) return;
        const stat = fs12.lstatSync(file);
        if (stat.isSymbolicLink() || !stat.isFile()) throw new Error("Invalid approval response file");
        const response = JSON.parse(fs12.readFileSync(file, "utf8"));
        if (response.runId !== runId || response.token !== token || typeof response.approved !== "boolean") throw new Error("Approval response identity mismatch");
        finish(void 0, response.approved);
      } catch (e) {
        finish(new Error("Cannot read matching approval response"));
      }
    }, 100);
    signal == null ? void 0 : signal.addEventListener("abort", abort, { once: true });
    if (signal == null ? void 0 : signal.aborted) abort();
  });
  await journal.recordApproval();
  await (onCheckpoint == null ? void 0 : onCheckpoint(journal.snapshot()));
  return approved;
}

// code-workflow-host.ts
var advancingLeases = /* @__PURE__ */ new WeakSet();
function supportsSharedWorkflow(definition, tasks) {
  return !definition.workflow.requiresAutoOCSecrets && !definition.tasks.some((task) => task.requiresAutoOCSecrets) && !definition.workflow.steps.some((step) => !["code", "delay", "task"].includes(step.stepKind || "task")) && definition.tasks.every((task) => !!(tasks == null ? void 0 : tasks.supports(task)));
}
async function runCodeWorkflowHost(options) {
  var _a, _b, _c;
  const definition = prepareWorkflowDefinition(options.definition.workflow, options.definition.tasks, options.definition.settings);
  if (definition.hash !== options.definition.hash) throw new Error("Workflow definition changed");
  if (options.reconcile && !options.resumeRunId) throw new Error("Reconciliation requires an existing run identity");
  if (options.maxSteps !== void 0 && (!Number.isSafeInteger(options.maxSteps) || options.maxSteps < 1)) throw new Error("Invalid execution step limit");
  const steps = definition.workflow.steps;
  if (definition.tasks.some((task) => {
    var _a2;
    return !((_a2 = options.tasks) == null ? void 0 : _a2.supports(task));
  })) throw new Error("No adapter for referenced workflow task");
  if (!supportsSharedWorkflow(definition, options.tasks)) throw new Error("Unsupported step, task or model evaluation in this host");
  if (steps.some((step) => {
    var _a2;
    return step.transitionMode === "eval" || ((_a2 = step.transitions) == null ? void 0 : _a2.some((t) => t.mode === "eval"));
  }) && !options.evaluate) throw new Error("Model evaluation adapter is required");
  const entry = findWorkflowEntry(steps);
  if (!entry) throw new Error("Workflow has no entry step");
  const lease = options.lease || acquireExecutionLease(options.runtimeDirectory);
  lease.assertOwned();
  if (fs13.realpathSync(options.runtimeDirectory) !== lease.directory) throw new Error("Execution lease belongs to another runtime");
  if (advancingLeases.has(lease)) throw new Error("Execution lease already has an advancing session");
  advancingLeases.add(lease);
  try {
    const resumed = options.resumeRunId === void 0 ? void 0 : ExecutionJournal.open(lease, options.resumeRunId, definition.hash);
    if (resumed && resumed.snapshot().workflowId !== definition.workflow.id) throw new Error("Execution belongs to another workflow");
    if ((resumed == null ? void 0 : resumed.snapshot().phase) === "in_flight" && !resumed.snapshot().steps.slice(-1)[0].result) {
      if (!options.reconcile || !((_a = options.tasks) == null ? void 0 : _a.reconcile)) throw new Error("Interrupted execution requires reconciliation; cannot replay effects");
      const step = steps.find((step2) => step2.id === resumed.snapshot().nextStepId);
      const task = definition.tasks.find((task2) => task2.id === (step == null ? void 0 : step.taskId));
      if (!task) throw new Error("Interrupted step has no recoverable task");
      const result = await reconcileWorkflowTask(resumed, definition, (thread, turn) => options.tasks.reconcile(task, thread, turn), {
        redact: options.redact,
        evaluate: options.evaluate || (async () => {
          throw new Error("Model evaluation unavailable");
        }),
        onTransitionError: () => {
        }
      });
      await ((_b = options.onCheckpoint) == null ? void 0 : _b.call(options, JSON.parse(JSON.stringify(result))));
      return result;
    }
    if (options.reconcile && resumed) {
      await ((_c = options.onCheckpoint) == null ? void 0 : _c.call(options, resumed.snapshot()));
      return resumed.snapshot();
    }
    for (const file of fs13.readdirSync(lease.directory)) {
      if (!/^[a-f0-9-]+\.json$/.test(file)) continue;
      if (fs13.lstatSync(lease.directory + "/" + file).isSymbolicLink()) throw new Error("Execution checkpoint cannot be a link");
      const prior = JSON.parse(fs13.readFileSync(lease.directory + "/" + file, "utf8"));
      ExecutionJournal.open(lease, file.slice(0, -5), prior.definitionHash);
      if (prior.runId !== options.resumeRunId && !["completed", "failed"].includes(prior.phase)) throw new Error("Previous execution requires continuation or reconciliation");
    }
    const journal = resumed || await ExecutionJournal.create(lease, definition.workflow.id, definition.hash, entry.id);
    return await advanceWorkflowSession(journal, definition, {
      async execute(step, input, outputs, signal) {
        if (definition.workflow.handoffBranch) verifyWorkflowBranch(journal);
        if (!step.stepKind || step.stepKind === "task") {
          const task = definition.tasks.find((task2) => task2.id === step.taskId);
          if (!task || !options.tasks) throw new Error("Workflow task adapter is unavailable");
          await prepareTaskBranch(journal, task, task.workingDirectory || definition.settings.workingDirectory || options.vaultBase, options.vaultBase, !!definition.workflow.handoffBranch);
          const completed = journal.snapshot().steps.filter((item) => item.status !== "in_flight");
          const previous = completed[completed.length - 1];
          const prompt = workflowTaskPrompt(
            task.prompt || "",
            definition.workflow,
            previous ? { stepId: previous.stepId, output: previous.output || "" } : void 0
          );
          return await options.tasks.execute(task, prompt, signal, async (threadId, turnId) => {
            var _a2;
            await journal.recordCodexThread(step.id, threadId, turnId);
            await ((_a2 = options.onCheckpoint) == null ? void 0 : _a2.call(options, journal.snapshot()));
          }, { approve: (request, lifetime) => awaitWorkflowApproval(journal, options.runtimeDirectory, request, options.redact, lifetime || signal, options.onCheckpoint) });
        }
        if (step.stepKind === "delay") {
          const spec = workflowDelay(step.delayValue, step.delayUnit);
          try {
            await waitForWorkflowDelay(spec.milliseconds, signal);
          } catch (error) {
            if ((signal == null ? void 0 : signal.aborted) && error.name === "AbortError") {
              return { succeeded: false, cancelled: true, output: "[delay cancelled; no external effects]" };
            }
            throw error;
          }
          return { succeeded: true, output: spec.output };
        }
        try {
          return { succeeded: true, output: executeCode({ ...step, code: step.code || "", vaultBase: options.vaultBase, cwd: definition.settings.workingDirectory || options.vaultBase, input, outputs }) };
        } catch (error) {
          return { succeeded: false, output: `[code error: ${String(error)}]` };
        }
      },
      evaluate: options.evaluate || (async () => {
        throw new Error("Model evaluation is not supported by this host");
      }),
      redact: options.redact,
      onTransitionError: () => {
      },
      onCheckpoint: options.onCheckpoint
    }, { signal: options.signal, maxSteps: options.maxSteps });
  } finally {
    advancingLeases.delete(lease);
    if (!options.lease) lease.release();
  }
}

// workflow-progress.ts
function projectWorkflowProgress(workflow, tasks, settings, checkpoint, expectedRunId, activelyExecuting = false) {
  var _a;
  validateExecutionCheckpoint(checkpoint);
  const definition = prepareWorkflowDefinition(workflow, tasks, settings);
  if (checkpoint.runId !== expectedRunId || checkpoint.workflowId !== workflow.id || checkpoint.definitionHash !== definition.hash) throw new Error("Progress identity or definition mismatch");
  const previous = workflow.runtimeExecution;
  if (previous && (previous.runId !== checkpoint.runId || previous.revision > checkpoint.revision)) throw new Error("Stale progress cannot replace current execution");
  const last = new Map(checkpoint.steps.map((step) => [step.stepId, step]));
  if (checkpoint.steps.some((step) => !workflow.steps.some((known) => known.id === step.stepId))) throw new Error("Progress contains an unknown step");
  if (checkpoint.nextStepId && !workflow.steps.some((known) => known.id === checkpoint.nextStepId)) throw new Error("Progress next step is absent");
  const target = checkpoint.nextStepId || ((_a = checkpoint.steps[checkpoint.steps.length - 1]) == null ? void 0 : _a.stepId);
  return {
    ...workflow,
    ...checkpoint.createdAt ? { lastRun: checkpoint.createdAt } : {},
    status: checkpoint.phase === "completed" ? "completed" : checkpoint.phase === "failed" ? "failed" : activelyExecuting ? "running" : "pending",
    currentStep: Math.max(0, workflow.steps.findIndex((step) => step.id === target)),
    runtimeExecution: { runId: checkpoint.runId, revision: checkpoint.revision, phase: checkpoint.phase, requiresReconciliation: checkpoint.phase === "in_flight" && !activelyExecuting },
    steps: workflow.steps.map((step) => {
      const observed = last.get(step.id);
      return { ...step, ...(observed == null ? void 0 : observed.startedAt) ? { lastRun: observed.startedAt } : {}, status: (observed == null ? void 0 : observed.status) === "in_flight" ? activelyExecuting ? "running" : "pending" : (observed == null ? void 0 : observed.status) || "pending", output: (observed == null ? void 0 : observed.output) || "" };
    })
  };
}

// standalone-task.ts
function standaloneTaskWorkflow(taskId) {
  if (!taskId) throw new Error("Explicit task identity required");
  return { id: `@task:${taskId}`, name: "Standalone task", steps: [{ id: "task", stepKind: "task", taskId }] };
}
function projectStandaloneTask(task, tasks, settings, checkpoint) {
  const workflow = { ...standaloneTaskWorkflow(task.id), runtimeExecution: task.runtimeExecution };
  const projected = projectWorkflowProgress(workflow, tasks, settings, checkpoint, task.runtimeExecution.runId);
  const observed = checkpoint.steps[checkpoint.steps.length - 1];
  return {
    ...task,
    status: projected.status,
    output: (observed == null ? void 0 : observed.output) || "",
    ...(observed == null ? void 0 : observed.startedAt) ? { lastRun: observed.startedAt } : {},
    ...(observed == null ? void 0 : observed.codexThreadId) ? { lastCodexThreadId: observed.codexThreadId } : {},
    ...(observed == null ? void 0 : observed.codexTurnId) ? { lastCodexTurnId: observed.codexTurnId } : {},
    runtimeExecution: { ...projected.runtimeExecution, workflowId: workflow.id, stepId: "task", finishedAt: observed == null ? void 0 : observed.finishedAt }
  };
}

// task-history.ts
var fs14 = __toESM(require("fs"));
var path12 = __toESM(require("path"));
function taskElapsedSeconds(task, now = Date.now()) {
  var _a;
  const start = Date.parse(task.lastRun);
  const end = task.status === "running" ? now : Date.parse((_a = task.runtimeExecution) == null ? void 0 : _a.finishedAt);
  return Number.isFinite(start) && Number.isFinite(end) ? Math.max(0, Math.floor((end - start) / 1e3)) : void 0;
}
function regularDirectory(directory) {
  if (!fs14.existsSync(directory)) fs14.mkdirSync(directory);
  const stat = fs14.lstatSync(directory);
  if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error("Task history requires regular directories");
}
function persistTaskHistory(vault, workflow, checkpoint, settings) {
  var _a, _b;
  if (settings.logsEnabled === false) return;
  const root = fs14.realpathSync(vault);
  const touched = /* @__PURE__ */ new Set();
  for (const [index, observed] of checkpoint.steps.entries()) {
    const step = workflow.steps.find((item) => item.id === observed.stepId);
    if (!(step == null ? void 0 : step.taskId) || step.stepKind && step.stepKind !== "task" || observed.status === "in_flight" || !observed.startedAt) continue;
    if (!/^[a-zA-Z0-9_-]+$/.test(step.taskId)) throw new Error("Unsafe task history identity");
    let directory = root;
    for (const part of [".opencode", "logs", step.taskId]) {
      directory = path12.join(directory, part);
      regularDirectory(directory);
    }
    const date = new Date(observed.startedAt), pad = (n) => String(n).padStart(2, "0");
    const timestamp = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}.${String(date.getMilliseconds()).padStart(3, "0")}`;
    const file = path12.join(directory, `${timestamp}_${checkpoint.runId}_${String(index).padStart(6, "0")}.log`);
    const content = `Run: ${checkpoint.runId}
Step: ${observed.stepId}
Status: ${observed.status}
Started: ${observed.startedAt}
Finished: ${observed.finishedAt || "unknown"}

${observed.output || "(no output)"}`;
    try {
      fs14.writeFileSync(file, content, { encoding: "utf8", flag: "wx" });
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      const stat = fs14.lstatSync(file);
      if (!stat.isFile() || stat.isSymbolicLink() || fs14.readFileSync(file, "utf8") !== content) throw new Error("Task history conflicts with durable output");
    }
    touched.add(directory);
  }
  for (const directory of touched) {
    const files = fs14.readdirSync(directory).filter((name) => name.endsWith(".log") && name !== "latest.log").sort();
    const max = (_a = settings.maxLogsPerTask) != null ? _a : 50, days = (_b = settings.logRetentionDays) != null ? _b : 30;
    const retained = [];
    for (const name of files) {
      const file = path12.join(directory, name), stat2 = fs14.lstatSync(file);
      if (!stat2.isFile() || stat2.isSymbolicLink()) throw new Error("Task history requires regular files");
      const match = name.match(/^(\d{4}-\d{2}-\d{2})_(\d{2})-(\d{2})-(\d{2})/);
      const date = match ? Date.parse(`${match[1]}T${match[2]}:${match[3]}:${match[4]}`) : NaN;
      if (days > 0 && date < Date.now() - days * 864e5) fs14.unlinkSync(file);
      else retained.push(name);
    }
    while (max > 0 && retained.length > max) fs14.unlinkSync(path12.join(directory, retained.shift()));
    const latest = path12.join(directory, "latest.log");
    const stat = fs14.lstatSync(latest, { throwIfNoEntry: false });
    if (stat) {
      if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("Task history latest must be a regular file");
    }
    if (retained.length) fs14.writeFileSync(latest, fs14.readFileSync(path12.join(directory, retained[retained.length - 1])));
  }
}

// workflow-catalog-progress.ts
async function persistWorkflowProgress(options) {
  var _a;
  const durable = readExecutionCheckpoint(options.runtimeDirectory, options.expectedRunId);
  if (JSON.stringify(durable) !== JSON.stringify(options.checkpoint)) {
    throw new Error("Catalog progress does not match the durable checkpoint");
  }
  const writer = new SettingsWriter();
  const config = writer.load(options.configurationFile);
  if (!config || !Array.isArray(config.tasks) || !Array.isArray(config.workflows)) {
    throw new Error("Invalid AutoOC catalog");
  }
  const virtual = options.taskId ? standaloneTaskWorkflow(options.taskId) : void 0;
  if (virtual && (virtual.id !== durable.workflowId || config.workflows.some((workflow2) => workflow2.id === virtual.id))) throw new Error("Standalone task identity mismatch");
  if (virtual && config.tasks.filter((task) => task.id === options.taskId).length !== 1) throw new Error("Missing or ambiguous task in catalog");
  const matches = virtual ? [virtual] : config.workflows.filter((workflow2) => workflow2.id === durable.workflowId);
  if (matches.length !== 1) throw new Error("Missing or ambiguous workflow in catalog");
  let workflow = matches[0];
  if (options.replaceCompletedRunId && ((_a = workflow.runtimeExecution) == null ? void 0 : _a.runId) === options.replaceCompletedRunId && durable.runId !== options.replaceCompletedRunId) {
    const previous = readExecutionCheckpoint(options.runtimeDirectory, options.replaceCompletedRunId);
    if (previous.workflowId !== durable.workflowId || !["completed", "failed"].includes(previous.phase)) {
      throw new Error("Cannot replace an unfinished execution");
    }
    workflow = { ...workflow };
    delete workflow.runtimeExecution;
  }
  const projected = projectWorkflowProgress(workflow, config.tasks, config, durable, options.expectedRunId);
  const observedTasks = /* @__PURE__ */ new Map();
  for (const observed of durable.steps) {
    const step = workflow.steps.find((item) => item.id === observed.stepId);
    if ((step == null ? void 0 : step.taskId) && (!step.stepKind || step.stepKind === "task")) {
      observedTasks.set(step.taskId, { stepId: step.id, observed });
    }
  }
  const tasks = config.tasks.map((task) => {
    const item = observedTasks.get(task.id);
    if (!item) return task;
    const previous = task.runtimeExecution;
    if ((previous == null ? void 0 : previous.runId) === durable.runId && previous.revision > durable.revision) throw new Error("Stale task progress");
    if (previous && previous.runId !== durable.runId) {
      if (item.observed.status !== "in_flight") return task;
      const prior = readExecutionCheckpoint(options.runtimeDirectory, previous.runId);
      if (!["completed", "failed"].includes(prior.phase)) throw new Error("Task belongs to an unfinished execution");
    }
    return {
      ...task,
      status: item.observed.status === "in_flight" ? "pending" : item.observed.status,
      ...item.observed.startedAt ? { lastRun: item.observed.startedAt } : {},
      output: item.observed.output || "",
      ...item.observed.codexThreadId ? { lastCodexThreadId: item.observed.codexThreadId } : {},
      ...item.observed.codexTurnId ? { lastCodexTurnId: item.observed.codexTurnId } : {},
      pendingCodexApproval: item.observed.approval ? { ...item.observed.approval, requestId: item.observed.approval.token } : void 0,
      runtimeExecution: {
        runId: durable.runId,
        workflowId: durable.workflowId,
        stepId: item.stepId,
        revision: durable.revision,
        finishedAt: item.observed.finishedAt,
        requiresReconciliation: item.observed.status === "in_flight"
      }
    };
  });
  const next = { ...config, tasks, workflows: virtual ? config.workflows : config.workflows.map((workflow2) => workflow2 === matches[0] ? projected : workflow2) };
  await writer.save(options.configurationFile, () => next);
  if (options.vaultBase) persistTaskHistory(options.vaultBase, workflow, durable, config);
}

// workflow-stop.ts
var fs15 = __toESM(require("fs"));
var path13 = __toESM(require("path"));
var import_crypto7 = require("crypto");
function readStopRequest(directory, runId) {
  if (!/^[a-zA-Z0-9-]+$/.test(runId)) throw new Error("Invalid execution identity");
  const file = path13.join(directory, runId + ".stop.json");
  try {
    const stat = fs15.lstatSync(file);
    if (stat.isSymbolicLink() || !stat.isFile()) throw new Error("Invalid stop request file");
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }
  let value;
  try {
    value = JSON.parse(fs15.readFileSync(file, "utf8"));
  } catch (e) {
    throw new Error("Invalid stop request");
  }
  if (value.schemaVersion !== 1 || value.runId !== runId || !/^[a-f0-9-]+$/.test(value.requestId || "")) throw new Error("Invalid stop request identity");
  return value.requestId;
}

// workflow-preflight.ts
var fs16 = __toESM(require("fs"));
var path14 = __toESM(require("path"));
function preflightInstalledWorkflow(definition, vault) {
  var _a, _b;
  const root = fs16.realpathSync(vault);
  const checkDirectory = (value) => {
    if (value !== void 0 && typeof value !== "string") throw new Error("Invalid working directory");
    const configured = value || root;
    if (!path14.isAbsolute(configured)) throw new Error("Working directory must be absolute");
    const directory = fs16.realpathSync(configured);
    const relative4 = path14.relative(root, directory);
    if (relative4 === ".." || relative4.startsWith(".." + path14.sep) || path14.isAbsolute(relative4)) throw new Error("Working directory is outside the selected vault");
    if (!fs16.statSync(directory).isDirectory()) throw new Error("Working directory is unavailable");
  };
  checkDirectory(definition.settings.workingDirectory);
  for (const item of [definition.workflow, ...definition.workflow.steps, ...definition.tasks]) {
    if (item.requiresAutoOCSecrets !== void 0 && typeof item.requiresAutoOCSecrets !== "boolean") throw new Error("Invalid AutoOC secrets dependency declaration");
    if (item.requiresAutoOCSecrets === true) throw new Error("AutoOC secret store is unavailable in the shared runtime; use the supported Obsidian path");
    if (item.workingDirectory !== void 0) checkDirectory(item.workingDirectory);
    if (item.interactiveTerminal !== void 0 && typeof item.interactiveTerminal !== "boolean") throw new Error("interactiveTerminal must be boolean");
    if (item.taskKind === "code" && item.interactiveTerminal === true) throw new Error("Code tasks cannot be interactive");
    validateBranchOptions(item);
    if (((_a = item.branch) == null ? void 0 : _a.trim()) || definition.workflow.handoffBranch) branchRepository(item.workingDirectory || definition.settings.workingDirectory || root, root);
  }
  for (const task of definition.tasks) {
    if (task.taskKind === "code") continue;
    if (typeof task.prompt !== "string" || !task.prompt.trim()) throw new Error("Task prompt must be nonempty before execution");
    if ((!task.taskKind || task.taskKind === "opencode") && !((_b = task.model || definition.settings.defaultModel) == null ? void 0 : _b.trim())) throw new Error("OpenCode model must be selected before execution");
  }
}

// workflow-evaluation.ts
function createWorkflowEvaluator(definition, vault, signal) {
  const adapter = createOpenCodeWorkflowAdapter(definition, vault);
  return async (transition, _target, input) => {
    var _a;
    const instruction = ((_a = transition.evaluatePrompt) == null ? void 0 : _a.trim()) || "Did the previous step complete successfully? If it is safe to continue, reply YES. Otherwise reply NO.";
    const result = await adapter.execute(
      {
        taskKind: "opencode",
        model: definition.settings.defaultModel || "opencode/default",
        agent: definition.settings.defaultAgent,
        workingDirectory: definition.settings.workingDirectory || vault
      },
      `${instruction}

Previous step output:
---
${input}
---

Reply ONLY with YES or NO.`,
      signal
    );
    if (!result.succeeded) throw new Error("Transition model evaluation failed; execution requires reconciliation");
    return result.output;
  };
}

// installed-workflow-host.ts
async function runInstalledWorkflow(options) {
  var _a, _b, _c, _d, _e;
  if (!path15.isAbsolute(options.vault) || !!options.workflowId === !!options.taskId) throw new Error("Explicit vault and exactly one workflow or task identity required");
  if (options.newExecution && (options.resumeRunId || options.reconcile)) throw new Error("New execution cannot also resume or reconcile");
  const vault = fs17.realpathSync(options.vault);
  let directory = vault;
  for (const part of [".obsidian", "plugins", "auto-oc"]) {
    directory = path15.join(directory, part);
    const stat = fs17.lstatSync(directory);
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error("Installation must use regular directories");
  }
  const configurationFile = path15.join(directory, "data.json");
  const config = new SettingsWriter().load(configurationFile);
  if (!config || !Array.isArray(config.tasks) || !Array.isArray(config.workflows)) throw new Error("Invalid AutoOC catalog");
  if (config.tasks.some((task) => task.status === "running") || config.workflows.some((workflow) => workflow.status === "running")) {
    throw new Error("Catalog has unresolved running activity; verify its owner before execution");
  }
  const virtual = options.taskId ? standaloneTaskWorkflow(options.taskId) : void 0;
  if (virtual && config.workflows.some((workflow) => workflow.id === virtual.id)) throw new Error("Reserved task identity conflicts with a workflow");
  const matches = virtual ? config.tasks.filter((task) => task.id === options.taskId) : config.workflows.filter((workflow) => workflow.id === options.workflowId);
  if (matches.length !== 1) throw new Error("Missing or ambiguous workflow identity");
  if (matches[0].runtimeExecution && matches[0].runtimeExecution.runId !== options.resumeRunId && !options.newExecution) {
    throw new Error("Workflow has a bound execution; select that identity explicitly");
  }
  const definition = prepareWorkflowDefinition(virtual || matches[0], config.tasks, config);
  preflightInstalledWorkflow(definition, vault);
  const runtimeDirectory = path15.join(directory, "runtime");
  if (!fs17.existsSync(runtimeDirectory)) fs17.mkdirSync(runtimeDirectory);
  const runtimeStat = fs17.lstatSync(runtimeDirectory);
  if (runtimeStat.isSymbolicLink() || !runtimeStat.isDirectory()) throw new Error("Invalid runtime directory");
  const replaceCompletedRunId = options.newExecution ? (_a = matches[0].runtimeExecution) == null ? void 0 : _a.runId : void 0;
  if (replaceCompletedRunId) {
    const previous = readExecutionCheckpoint(runtimeDirectory, replaceCompletedRunId);
    if (!virtual && previous.workflowId !== definition.workflow.id || !["completed", "failed"].includes(previous.phase)) {
      throw new Error("Cannot replace an unfinished execution");
    }
  }
  let activeRunId = options.resumeRunId;
  const acknowledged = activeRunId ? readStopRequest(runtimeDirectory, activeRunId) : void 0;
  const controller = new AbortController();
  const abort = () => controller.abort();
  (_b = options.signal) == null ? void 0 : _b.addEventListener("abort", abort, { once: true });
  if ((_c = options.signal) == null ? void 0 : _c.aborted) abort();
  let stopError;
  const checkStop = () => {
    if (!activeRunId) return;
    try {
      const request = readStopRequest(runtimeDirectory, activeRunId);
      if (request && request !== acknowledged) abort();
    } catch (error) {
      stopError = error;
      abort();
    }
  };
  const timer = setInterval(checkStop, 100);
  (_d = timer.unref) == null ? void 0 : _d.call(timer);
  try {
    const result = await runCodeWorkflowHost({
      definition,
      runtimeDirectory,
      vaultBase: vault,
      resumeRunId: options.resumeRunId,
      reconcile: options.reconcile,
      maxSteps: options.maxSteps,
      signal: controller.signal,
      redact: options.redact,
      lease: options.lease,
      tasks: createWorkflowTaskAdapter(definition, vault),
      evaluate: createWorkflowEvaluator(definition, vault, controller.signal),
      onCheckpoint: async (checkpoint) => {
        var _a2;
        activeRunId = checkpoint.runId;
        checkStop();
        await persistWorkflowProgress({ configurationFile, runtimeDirectory, checkpoint, expectedRunId: checkpoint.runId, replaceCompletedRunId, taskId: options.taskId, vaultBase: vault });
        await ((_a2 = options.onCheckpoint) == null ? void 0 : _a2.call(options, checkpoint));
      }
    });
    if (stopError) throw stopError;
    return result;
  } finally {
    clearInterval(timer);
    (_e = options.signal) == null ? void 0 : _e.removeEventListener("abort", abort);
  }
}

// main.ts
var visualBuilderHtml2 = (init_visualBuilderHtml_generated(), __toCommonJS(visualBuilderHtml_generated_exports)).visualBuilderHtml;
function setupCodeTextarea(textarea) {
  textarea.addClass("auto-oc-code-editor");
  textarea.spellcheck = false;
  textarea.addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    e.preventDefault();
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    textarea.value = textarea.value.slice(0, start) + "  " + textarea.value.slice(end);
    textarea.selectionStart = textarea.selectionEnd = start + 2;
    textarea.dispatchEvent(new Event("input"));
  });
}
function renderCodePreview(parent, code, maxChars = 600) {
  var _a;
  const pre = parent.createEl("pre", { cls: "auto-oc-code-preview" });
  const codeEl = pre.createEl("code");
  const src = (code || "// empty code").slice(0, maxChars);
  const pattern = /(\/\/.*|\/\*[\s\S]*?\*\/|`(?:\\.|[^`])*`|"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|\b(?:const|let|var|return|if|else|for|while|await|async|function|new|try|catch|throw|true|false|null|undefined)\b|\b\d+(?:\.\d+)?\b)/g;
  let last = 0;
  for (const match of src.matchAll(pattern)) {
    const text = match[0];
    const index = (_a = match.index) != null ? _a : 0;
    if (index > last) codeEl.appendChild(document.createTextNode(src.slice(last, index)));
    const span = codeEl.createSpan();
    span.setText(text);
    if (text.startsWith("//") || text.startsWith("/*")) span.addClass("auto-oc-code-token-comment");
    else if (text.startsWith("'") || text.startsWith('"') || text.startsWith("`")) span.addClass("auto-oc-code-token-string");
    else if (/^\d/.test(text)) span.addClass("auto-oc-code-token-number");
    else span.addClass("auto-oc-code-token-keyword");
    last = index + text.length;
  }
  if (last < src.length) codeEl.appendChild(document.createTextNode(src.slice(last)));
  if ((code || "").length > maxChars) codeEl.appendChild(document.createTextNode("\n..."));
}
var AUTOOC_WORKFLOW_PROMPT = `You are an expert AutoOC assistant. AutoOC is an Obsidian plugin that automates OpenCode, Codex and GitHub Copilot CLI tasks and visual workflows. Your goal is to generate valid import-ready AutoOC JSON for tasks and/or workflows.

Always output only one valid JSON object. Do not write explanations outside the final JSON.

Canonical complete export format:
{
  "autoOCExport": {
    "schemaVersion": "1.5.0",
    "exportedAt": "YYYY-MM-DDTHH:mm:ss.sssZ",
    "pluginVersion": "1.5.11",
    "name": "Package name",
    "description": "Short description"
  },
  "tasks": [],
  "workflows": []
}

For complete exports, schemaVersion must be exactly "1.0", "1.4.0", "1.5.0", or "1.6.0". Exports containing Copilot tasks must use "1.6.0"; other new exports should use "1.5.0". exportedAt must be an exact ISO-8601 UTC timestamp in the form YYYY-MM-DDTHH:mm:ss.sssZ.

Available modules:
AutoOC supports DAG workflows with three step kinds:
1. task: runs an OpenCode, Codex or GitHub Copilot CLI task prompt. A workflow may mix all three engines.
2. code: runs JavaScript in a sandbox.
3. delay: pauses the workflow.

Tasks:
A task is reusable and can be referenced by workflows.

Task fields:
- exportId: unique within the JSON, for example "task-0".
- taskKind: "opencode" by default, "codex" for Codex in ChatGPT, "copilot" for GitHub Copilot CLI, or "code" for a reusable JavaScript task.
- copilotAllowAllTools: optional boolean, only for taskKind "copilot". False or absent exposes only file reading and search tools. True allows tools to edit files and run commands automatically. Enable only when the user requests those permissions. Copilot runs in the background: interactiveTerminal must be false or absent. Copilot uses the branch currently checked out in the selected folder; branch, createBranch, agent, useRalphLoop and reasoningEffort do not apply.
- name: short name, preferably snake_case or kebab-case.
- area: optional grouping area.
- prompt: required, non-empty complete direct instruction for the selected engine. Every task must include it, including taskKind "code"; for code tasks, mirror the code here for compatibility.
- interactiveTerminal: true opens the interactive client for an AI task: OpenCode CLI for taskKind "opencode", or the ChatGPT/Codex app for taskKind "codex".
- reasoningEffort: optional for taskKind "codex"; use "minimal", "low", "medium", "high", "xhigh", "max", or "ultra" when requested.
- code, codeLang, codeInputVar, codeOutputVar, codeAllowVault, codeAllowFiles, codeAllowTerminal: only for taskKind "code".
- scheduleType: "manual" | "once" | "daily" | "weekly" | "monthly" | "interval".
- scheduleTime: "HH:MM", use "09:00" if not relevant.
- scheduleDate: "YYYY-MM-DD" or "".
- scheduleDays: array 0-6, Sunday=0.
- scheduleMonthDays: array 1-31.
- scheduleIntervalValue: number, usually 10.
- scheduleIntervalUnit: "seconds" | "minutes" | "hours", usually "minutes".
- useRalphLoop: true only when the task may need iterations until completion.
- agent: "build" by default, "plan" for analysis only, or a custom agent if requested.
- forceModel: true forces the selected model and does not apply the agent; otherwise false.
- branch: optional git branch, usually "".
- createBranch: true/false.
- workingDirectory: optional absolute path where this task should run.

Do not include model or forceModel in importable tasks unless the user explicitly asks for them. AutoOC will use the system default model on import.

Code steps and code tasks:
Code runs with vm.runInContext and must always assign output.

Use code for:
- filtering outputs before calling AI
- keyword checks
- JSON transformations
- deciding whether it is worth continuing
- reading/writing the Obsidian vault when permission is enabled
- saving tokens by avoiding large AI inputs

Code fields:
- stepKind: "code" for workflow steps.
- taskKind: "code" for reusable code tasks.
- name: optional display name.
- area: optional grouping area; use the workflow area when applicable.
- code: JavaScript source.
- codeLang: "javascript".
- codeInputVar: usually "input".
- codeOutputVar: usually "output".
- codeAllowVault: true/false.
- codeAllowFiles: true/false.
- codeAllowTerminal: true/false.
- transitions: recommended canonical array of transitions for workflow steps. Use [] explicitly for a terminal step that must remain terminal after export and import.

Always available in code:
- input: string output from the previous step.
- outputs: map of stepId to output.
- JSON, Math, Date, String, Number, Boolean, Array, Object, RegExp.
- console.log, but do not use it as the main output.

Code timeout is 10 seconds.

Important code rule:
Do not recursively scan an entire vault unless necessary. Large vaults can timeout. Prefer direct likely paths and bounded searches.

For daily notes, try direct paths first:
- Daily_notes/DD-MM-YYYY.md
- Daily Notes/DD-MM-YYYY.md
- Daily/DD-MM-YYYY.md
- Diario/DD-MM-YYYY.md
- Journal/DD-MM-YYYY.md
- DD-MM-YYYY.md

Optional Code APIs:

Vault API, enabled with codeAllowVault: true:
- vault.read("Daily_notes/01-07-2026.md")
- vault.write("path.md", "content")
- vault.append("path.md", "content")
- vault.exists("path.md")
- vault.list("folder")

The vault API is confined to the Obsidian vault.

Local Files API, enabled with codeAllowFiles: true:
- files.read("path")
- files.write("path", "content")
- files.append("path", "content")
- files.exists("path")
- files.list("path")

Use files only if the user explicitly needs access outside the vault.

Terminal API, enabled with codeAllowTerminal: true:
- terminal.run("command", { cwd: "optional", timeoutMs: 30000 })

Use terminal only if it adds clear value and the user allows it.

Delay steps:
{
  "id": "wait-5-min",
  "stepKind": "delay",
  "name": "Wait 5 minutes",
  "area": "Optional area",
  "delayValue": 5,
  "delayUnit": "minutes",
  "transitions": []
}

Workflows:
A workflow chains steps in order or with branching.

Workflow fields:
- exportId: for example "wf-0".
- name.
- area.
- description.
- scheduleType: "manual" | "once" | "daily" | "weekly" | "monthly" | "interval".
- scheduleTime.
- scheduleDate.
- scheduleDays.
- scheduleMonthDays.
- scheduleIntervalValue.
- scheduleIntervalUnit.
- handoffBranch: true if all steps should share a git branch.
- handoffOutput: normally true.
- steps: array of steps.

Task step example:
{
  "id": "step-ai",
  "stepKind": "task",
  "name": "AI analysis",
  "area": "Optional area",
  "taskExportId": "task-0",
  "transitions": []
}

taskExportId must match an existing task exportId.

Transitions:
The transitions array is the recommended canonical form. Include it on every generated workflow step, using [] for a terminal step that must remain terminal after export and import. The MCP validator validates transitions when provided. The UI importer also accepts a single transition object only for legacy compatibility.

If transitions is missing, it is treated as legacy compatibility: the UI importer uses the legacy transitionMode, evaluatePrompt, and forceContinue fields and fills the missing links as a linear chain in input order.

Fields:
- toStepId
- mode: "default" | "force" | "eval" | "conditional"
- evaluatePrompt: only for eval
- condition: only for conditional
- conditionLang: "javascript" when using condition

default: continue only if previous step succeeded.
force: always continue.
eval: ask the model to answer YES/NO.
conditional: evaluate JavaScript against input, outputs, JSON, Math, Date.

Conditional rule:
The condition must be a JavaScript expression without return.
Correct: JSON.parse(input).FOUND === "YES"
Incorrect: return JSON.parse(input).FOUND === "YES";

Generation recommendations for clear graphs (not restrictions enforced by the importer):
1. Decide whether the user needs one task or a workflow.
2. Use a workflow when there are multiple phases such as search -> filter -> AI -> write result.
3. Use code steps before AI to save tokens.
4. Do not send large files to AI when code can cheaply detect whether AI is needed.
5. Task prompts must be complete and direct.
6. If useRalphLoop is true, include clear completion criteria.
7. Every task referenced by a workflow must exist in tasks.
8. Every toStepId must exist in steps.
9. Every non-terminal step must have at least one transition.
10. Terminal steps must have "transitions": [].
11. For daily notes or large vaults, avoid full recursive searches.
12. If code needs to read or write the vault, set codeAllowVault: true.
13. If code needs terminal, set codeAllowTerminal: true.
14. If code needs files outside the vault, set codeAllowFiles: true.

Recommended pattern: detect a cheap condition before AI.
1. Code step: find keyword or condition.
2. Conditional transition: FOUND=YES -> AI task; FOUND!=YES -> noop terminal code step.
3. AI task: runs only when needed.
4. Code step: writes or summarizes result if needed.

Final output requirements:
- Output only valid JSON.
- No Markdown.
- No explanations.
- No comments.
- No trailing commas.

Minimal valid workflow example:
{
  "autoOCExport": {
    "schemaVersion": "1.5.0",
    "exportedAt": "2026-07-06T00:00:00.000Z",
    "pluginVersion": "1.5.11",
    "name": "Example package",
    "description": "Example AutoOC import"
  },
  "tasks": [
    {
      "exportId": "task-0",
      "taskKind": "opencode",
      "name": "ai_followup",
      "area": "Automation",
      "prompt": "Complete the requested follow-up using the previous step output as context. Finish only when the result is written or clearly reported.",
      "scheduleType": "manual",
      "scheduleTime": "09:00",
      "scheduleDate": "",
      "scheduleDays": [],
      "scheduleMonthDays": [],
      "scheduleIntervalValue": 10,
      "scheduleIntervalUnit": "minutes",
      "useRalphLoop": false,
      "interactiveTerminal": false,
      "agent": "build",
      "branch": "",
      "createBranch": false
    }
  ],
  "workflows": [
    {
      "exportId": "wf-0",
      "name": "conditional_workflow",
      "area": "Automation",
      "description": "Detects a keyword and only runs AI when needed.",
      "scheduleType": "manual",
      "scheduleTime": "09:00",
      "scheduleDate": "",
      "scheduleDays": [],
      "scheduleMonthDays": [],
      "scheduleIntervalValue": 10,
      "scheduleIntervalUnit": "minutes",
      "handoffBranch": false,
      "handoffOutput": true,
      "steps": [
        {
          "id": "step-0",
          "stepKind": "code",
          "name": "Detect keyword",
          "area": "Automation",
          "code": "output = JSON.stringify({ FOUND: input.includes('keyword') ? 'YES' : 'NO' });",
          "codeLang": "javascript",
          "codeInputVar": "input",
          "codeOutputVar": "output",
          "codeAllowVault": false,
          "codeAllowFiles": false,
          "codeAllowTerminal": false,
          "transitions": [
            {
              "toStepId": "step-1",
              "mode": "conditional",
              "condition": "JSON.parse(input).FOUND === "YES"",
              "conditionLang": "javascript"
            },
            {
              "toStepId": "step-noop",
              "mode": "conditional",
              "condition": "JSON.parse(input).FOUND !== "YES"",
              "conditionLang": "javascript"
            }
          ]
        },
        {
          "id": "step-1",
          "stepKind": "task",
          "name": "Run AI follow-up",
          "area": "Automation",
          "taskExportId": "task-0",
          "transitions": []
        },
        {
          "id": "step-noop",
          "stepKind": "code",
          "name": "No changes needed",
          "area": "Automation",
          "code": "output = input;",
          "codeLang": "javascript",
          "codeInputVar": "input",
          "codeOutputVar": "output",
          "codeAllowVault": false,
          "codeAllowFiles": false,
          "codeAllowTerminal": false,
          "transitions": []
        }
      ]
    }
  ]
}

Now write the objective for the AutoOC workflow or task you want to generate:`;
async function copyTextToClipboard(text) {
  var _a;
  if ((_a = navigator.clipboard) == null ? void 0 : _a.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}
function getConfiguredAreaNames(settings) {
  var _a, _b;
  const names = /* @__PURE__ */ new Set();
  for (const task of settings.tasks) {
    const area = (_a = task.area) == null ? void 0 : _a.trim();
    if (area) names.add(area);
  }
  for (const workflow of settings.workflows) {
    const area = (_b = workflow.area) == null ? void 0 : _b.trim();
    if (area) names.add(area);
  }
  return Array.from(names).sort((a, b) => a.localeCompare(b));
}
function renderAreaSuggestions(container, areaInput, areaNames, onSelect) {
  const wrapper = container.createDiv("auto-oc-area-suggestions");
  wrapper.createDiv("auto-oc-area-suggestions-title").setText(
    areaNames.length > 0 ? "Existing areas: click one, or type a new area above." : "No areas yet. Type a name above to create a new area."
  );
  if (areaNames.length === 0) return;
  const chips = wrapper.createDiv("auto-oc-area-suggestion-chips");
  for (const area of areaNames) {
    const chip = chips.createEl("button", {
      text: area,
      cls: "auto-oc-area-suggestion-chip"
    });
    chip.type = "button";
    chip.onclick = () => {
      areaInput.value = area;
      onSelect(area);
    };
  }
}
function getCopilotTaskValidationError(task) {
  if (task.copilotAllowAllTools !== void 0 && (task.taskKind !== "copilot" || typeof task.copilotAllowAllTools !== "boolean")) {
    return "copilotAllowAllTools must be a boolean and is only valid for Copilot tasks.";
  }
  if (task.taskKind === "copilot" && task.interactiveTerminal === true) {
    return "Copilot tasks run in the background; interactiveTerminal must be false.";
  }
  return null;
}
function addCopilotTaskSettings(container, draft, defaultModel) {
  new import_obsidian.Setting(container).setName("Copilot model").setDesc("Model ID available to your Copilot account. Empty uses the AutoOC default, then the CLI default.").addText((text) => text.setPlaceholder(defaultModel || "Automatic").setValue(draft.model || "").onChange((value) => {
    draft.model = value.trim();
  }));
  new import_obsidian.Setting(container).setName("Allow tools automatically").setDesc("Allow Copilot to edit files and run commands without asking. Off exposes only file reading and search tools. Folder and URL permissions remain controlled by Copilot.").addToggle((toggle) => toggle.setValue(draft.copilotAllowAllTools === true).onChange((value) => {
    draft.copilotAllowAllTools = value;
  }));
}
function addCopilotGlobalSettings(container, plugin) {
  container.createEl("h3", { text: "GitHub Copilot CLI" });
  new import_obsidian.Setting(container).setName("Copilot executable path").setDesc("Use copilot for auto-detection, or the absolute executable path. Sign in with copilot login in your terminal first.").addText((text) => text.setPlaceholder("copilot").setValue(plugin.settings.copilotPath || "copilot").onChange(async (value) => {
    plugin.settings.copilotPath = value.trim() || "copilot";
    await plugin.saveSettings();
  })).addButton((button) => button.setButtonText("Detect & test").onClick(async () => {
    try {
      const bin = resolveCopilotBin(plugin.settings.copilotPath);
      const cwd = plugin.settings.workingDirectory || plugin.app.vault.adapter.basePath || ".";
      const version = await checkCopilotInstallation(bin, cwd);
      new import_obsidian.Notice(`AutoOC: ${version}
${bin}
CLI detected. Account access is checked when a task runs.`, 1e4);
    } catch (error) {
      new import_obsidian.Notice(`AutoOC: could not start GitHub Copilot CLI \u2014 ${String(error)}`, 1e4);
    }
  }));
  new import_obsidian.Setting(container).setName("Default Copilot model").setDesc("Model ID available to your Copilot account. Empty uses the CLI default; see /model in Copilot for available models.").addText((text) => text.setPlaceholder("Automatic").setValue(plugin.settings.defaultCopilotModel || "").onChange(async (value) => {
    plugin.settings.defaultCopilotModel = value.trim();
    await plugin.saveSettings();
  }));
}
var SECRET_TYPES = ["token", "api_key", "username", "password", "cookie", "basic_auth", "custom"];
var SECRETS_SCHEMA_VERSION = 1;
var SECRETS_UNLOCK_MS = 5 * 60 * 1e3;
function normalizeEnvName(value) {
  const cleaned = value.trim().replace(/[^A-Za-z0-9_]+/g, "_").replace(/^_+|_+$/g, "").toUpperCase();
  const prefixed = cleaned.startsWith("AUTOOC_") ? cleaned : `AUTOOC_${cleaned || "SECRET"}`;
  return /^[A-Za-z_]/.test(prefixed) ? prefixed : `AUTOOC_${prefixed}`;
}
function hashSecretPin(pin, salt) {
  return crypto2.pbkdf2Sync(pin, salt, 12e4, 32, "sha256").toString("base64");
}
function timingSafeEqualText(a, b) {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  return aBuf.length === bBuf.length && crypto2.timingSafeEqual(aBuf, bBuf);
}
function tryGetSafeStorage() {
  var _a, _b;
  try {
    const electron = typeof window !== "undefined" && window.require ? window.require("electron") : require("electron");
    const safeStorage = (electron == null ? void 0 : electron.safeStorage) || ((_a = electron == null ? void 0 : electron.remote) == null ? void 0 : _a.safeStorage);
    if ((_b = safeStorage == null ? void 0 : safeStorage.isEncryptionAvailable) == null ? void 0 : _b.call(safeStorage)) return safeStorage;
  } catch (e) {
  }
  return null;
}
var SecretStore = class {
  constructor(vaultBasePath) {
    this.vaultBasePath = vaultBasePath;
    this.vault = { schemaVersion: SECRETS_SCHEMA_VERSION, secrets: [] };
    this.unlockedUntil = 0;
  }
  get filePath() {
    return path16.join(this.vaultBasePath, ".obsidian", "plugins", "auto-oc", "secrets.vault.json");
  }
  load() {
    const file = this.filePath;
    if (!fs18.existsSync(file)) {
      this.vault = { schemaVersion: SECRETS_SCHEMA_VERSION, secrets: [] };
      return;
    }
    const raw = fs18.readFileSync(file, "utf8");
    const parsed = raw.trim() ? JSON.parse(raw) : {};
    this.vault = {
      schemaVersion: parsed.schemaVersion || SECRETS_SCHEMA_VERSION,
      pin: parsed.pin,
      secrets: Array.isArray(parsed.secrets) ? parsed.secrets : []
    };
  }
  save() {
    const file = this.filePath;
    fs18.mkdirSync(path16.dirname(file), { recursive: true });
    fs18.writeFileSync(file, `${JSON.stringify(this.vault, null, 2)}
`, "utf8");
  }
  isSecureStorageAvailable() {
    return !!tryGetSafeStorage();
  }
  hasPin() {
    var _a;
    return !!((_a = this.vault.pin) == null ? void 0 : _a.enabled) && !!this.vault.pin.hash && !!this.vault.pin.salt;
  }
  isUnlocked() {
    return !this.hasPin() || Date.now() < this.unlockedUntil;
  }
  lock() {
    this.unlockedUntil = 0;
  }
  verifyPin(pin) {
    const pinData = this.vault.pin;
    if (!(pinData == null ? void 0 : pinData.enabled)) return true;
    const hash = hashSecretPin(pin, pinData.salt);
    const ok = timingSafeEqualText(hash, pinData.hash);
    if (ok) this.unlockedUntil = Date.now() + SECRETS_UNLOCK_MS;
    return ok;
  }
  setPin(pin) {
    const salt = crypto2.randomBytes(16).toString("base64");
    this.vault.pin = { enabled: true, salt, hash: hashSecretPin(pin, salt) };
    this.unlockedUntil = Date.now() + SECRETS_UNLOCK_MS;
    this.save();
  }
  resetPin() {
    delete this.vault.pin;
    this.unlockedUntil = 0;
    this.save();
  }
  list() {
    return [...this.vault.secrets].sort((a, b) => a.name.localeCompare(b.name));
  }
  encryptValue(value) {
    const safeStorage = tryGetSafeStorage();
    if (!safeStorage) throw new Error("Secure storage is not available on this system.");
    return Buffer.from(safeStorage.encryptString(value)).toString("base64");
  }
  decryptValue(record) {
    const safeStorage = tryGetSafeStorage();
    if (!safeStorage) throw new Error("Secure storage is not available on this system.");
    return safeStorage.decryptString(Buffer.from(record.encryptedValue, "base64"));
  }
  upsert(input) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const existing = input.id ? this.vault.secrets.find((s) => s.id === input.id) : void 0;
    if (existing) {
      existing.name = input.name.trim();
      existing.envName = normalizeEnvName(input.envName || input.name);
      existing.type = input.type;
      existing.profile = input.profile.trim() || "default";
      existing.notes = input.notes || "";
      existing.updatedAt = now;
      if (input.value !== void 0) existing.encryptedValue = this.encryptValue(input.value);
    } else {
      this.vault.secrets.push({
        id: generateId(),
        name: input.name.trim(),
        envName: normalizeEnvName(input.envName || input.name),
        type: input.type,
        profile: input.profile.trim() || "default",
        encryptedValue: this.encryptValue(input.value || ""),
        notes: input.notes || "",
        createdAt: now,
        updatedAt: now
      });
    }
    this.save();
  }
  delete(id) {
    this.vault.secrets = this.vault.secrets.filter((s) => s.id !== id);
    this.save();
  }
  getEnv(profile = "default") {
    const result = {};
    for (const secret of this.vault.secrets) {
      if (secret.profile && secret.profile !== "default" && secret.profile !== profile) continue;
      result[secret.envName] = this.decryptValue(secret);
    }
    return result;
  }
  getRedactionValues() {
    const values = [];
    for (const secret of this.vault.secrets) {
      try {
        const value = this.decryptValue(secret);
        if (value && value.length >= 4) values.push(value);
      } catch (e) {
      }
    }
    return values;
  }
};
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
  const { execFileSync: execFileSync2 } = require("child_process");
  const out = execFileSync2("git", ["branch", "--format=%(refname:short)"], {
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
  ...EXECUTION_DEFAULTS,
  tasks: [],
  workflows: [],
  logsEnabled: true,
  maxLogsPerTask: 50,
  logRetentionDays: 30,
  libraryUrl: "https://raw.githubusercontent.com/juanpega/AutoOC_obisdian_extension/main/library",
  dashboardPositions: {},
  dashboardTaskBubbleSize: "md"
};
var VIEW_TYPE = "auto-oc-view";
var DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
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
function intervalToMs(value, unit) {
  const multiplier = {
    seconds: 1e3,
    minutes: 60 * 1e3,
    hours: 60 * 60 * 1e3
  };
  return Math.max(1, value) * multiplier[unit];
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
  return new Promise((resolve5) => window.setTimeout(resolve5, ms));
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
function setAutoOCModalFullscreen(modal) {
  const modalEl = modal.modalEl;
  if (!modalEl) return;
  modalEl.style.width = "min(1400px, calc(100vw - 40px))";
  modalEl.style.height = "calc(100vh - 80px)";
  modalEl.style.maxWidth = "calc(100vw - 40px)";
  modalEl.style.maxHeight = "calc(100vh - 40px)";
  modalEl.style.overflow = "hidden";
  modalEl.addClass("auto-oc-fullscreen-modal");
  modal.contentEl.style.flex = "1 1 auto";
  modal.contentEl.style.minHeight = "0";
  modal.contentEl.style.width = "100%";
  modal.contentEl.style.height = "auto";
  modal.contentEl.style.maxWidth = "100%";
  modal.contentEl.style.padding = "0";
  modal.contentEl.style.overflow = "hidden";
  modal.contentEl.style.display = "flex";
  modal.contentEl.style.flexDirection = "column";
  modal.contentEl.style.boxSizing = "border-box";
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
function normalizeLibraryUrl(input) {
  if (!input) return DEFAULT_SETTINGS.libraryUrl;
  if (input.startsWith("https://raw.githubusercontent.com/")) return input;
  const match = input.match(
    /^https:\/\/github\.com\/([^/]+)\/([^/]+)(?:\/(?:tree|blob)\/([^/]+)(?:\/(.*))?)?\/?$/
  );
  if (match) {
    const [, owner, repo, branch = "main", subPath = "library"] = match;
    return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${subPath}`;
  }
  return input;
}
function getLibraryIndexUrl(baseUrl) {
  return `${normalizeLibraryUrl(baseUrl).replace(/\/$/, "")}/index.json`;
}
function getLibraryFileUrl(baseUrl, fileName) {
  return `${normalizeLibraryUrl(baseUrl).replace(/\/$/, "")}/${fileName}`;
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
function t_or_undef(incoming, fallback) {
  return incoming === void 0 ? fallback : incoming;
}
function toExportTask(task, exportId) {
  var _a, _b;
  return {
    exportId,
    taskKind: task.taskKind,
    copilotAllowAllTools: task.taskKind === "copilot" ? task.copilotAllowAllTools === true : void 0,
    requiresAutoOCSecrets: task.requiresAutoOCSecrets,
    name: task.name,
    area: task.area,
    prompt: task.prompt,
    code: task.code,
    codeLang: task.codeLang,
    codeInputVar: task.codeInputVar,
    codeOutputVar: task.codeOutputVar,
    codeAllowVault: task.codeAllowVault,
    codeAllowFiles: task.codeAllowFiles,
    codeAllowTerminal: task.codeAllowTerminal,
    interactiveTerminal: task.interactiveTerminal,
    reasoningEffort: task.reasoningEffort,
    scheduleType: task.scheduleType,
    scheduleTime: task.scheduleTime,
    scheduleDate: task.scheduleDate,
    scheduleDays: task.scheduleDays,
    scheduleMonthDays: task.scheduleMonthDays || [],
    scheduleIntervalValue: (_a = task.scheduleIntervalValue) != null ? _a : 10,
    scheduleIntervalUnit: (_b = task.scheduleIntervalUnit) != null ? _b : "minutes",
    useRalphLoop: task.useRalphLoop,
    forceModel: task.forceModel,
    agent: task.agent,
    branch: task.branch,
    createBranch: task.createBranch,
    workingDirectory: task.workingDirectory
  };
}
function toExportWorkflow(workflow, exportId, taskExportIdMap) {
  var _a, _b;
  return {
    exportId,
    name: workflow.name,
    area: workflow.area,
    description: workflow.description,
    scheduleType: workflow.scheduleType,
    scheduleTime: workflow.scheduleTime,
    scheduleDate: workflow.scheduleDate,
    scheduleDays: workflow.scheduleDays,
    scheduleMonthDays: workflow.scheduleMonthDays || [],
    scheduleIntervalValue: (_a = workflow.scheduleIntervalValue) != null ? _a : 10,
    scheduleIntervalUnit: (_b = workflow.scheduleIntervalUnit) != null ? _b : "minutes",
    handoffBranch: workflow.handoffBranch,
    handoffOutput: workflow.handoffOutput,
    steps: workflow.steps.map((step) => {
      var _a2;
      return {
        id: step.id,
        stepKind: step.stepKind || "task",
        name: step.name,
        area: step.area,
        taskExportId: step.taskId ? (_a2 = taskExportIdMap.get(step.taskId)) != null ? _a2 : "" : void 0,
        transitionMode: step.transitionMode,
        evaluatePrompt: step.evaluatePrompt,
        forceContinue: step.forceContinue,
        delayValue: step.delayValue,
        delayUnit: step.delayUnit,
        code: step.code,
        codeLang: step.codeLang,
        codeInputVar: step.codeInputVar,
        codeOutputVar: step.codeOutputVar,
        codeAllowVault: step.codeAllowVault,
        codeAllowFiles: step.codeAllowFiles,
        codeAllowTerminal: step.codeAllowTerminal,
        transitions: step.transitions !== void 0 ? step.transitions.map((t) => ({
          toStepId: t.toStepId,
          mode: t.mode,
          evaluatePrompt: t.evaluatePrompt,
          condition: t.condition,
          conditionLang: t.conditionLang,
          forceContinue: t.forceContinue
        })) : void 0,
        position: step.position
      };
    })
  };
}
function formatDateTime(iso) {
  if (!iso) return "\u2014";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US") + " " + d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
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
function getOpencodeConfigPath() {
  return path16.join(os4.homedir(), ".config", "opencode", "opencode.json");
}
function getUvCandidates() {
  return [
    path16.join(os4.homedir(), "AppData", "Local", "hermes", "bin", "uv.exe"),
    path16.join(os4.homedir(), ".local", "bin", process.platform === "win32" ? "uv.exe" : "uv"),
    path16.join(os4.homedir(), "AppData", "Roaming", "Python", "Scripts", "uv.exe")
  ];
}
function resolveUvBin() {
  for (const candidate of getUvCandidates()) {
    try {
      if (fs18.existsSync(candidate)) return candidate;
    } catch (e) {
    }
  }
  return null;
}
function getUvInstallCommand() {
  return process.platform === "win32" ? `powershell -ExecutionPolicy Bypass -c "irm https://astral.sh/uv/install.ps1 | iex"` : `curl -LsSf https://astral.sh/uv/install.sh | sh`;
}
function getUvHelpText() {
  return `uv is required to run autooc-mcp because the MCP server is a self-contained FastMCP Python script. Install uv with: ${getUvInstallCommand()}`;
}
function requireUvBin() {
  const uv = resolveUvBin();
  if (!uv) throw new Error(getUvHelpText());
  return uv;
}
function describeUvStatus() {
  const uv = resolveUvBin();
  return { available: !!uv, path: uv || void 0, installCommand: getUvInstallCommand() };
}
function resolveUvBinForDisplay() {
  return resolveUvBin() || (process.platform === "win32" ? "uv.exe" : "uv");
}
function getAutoOcMcpServerSource() {
  return String.raw`# /// script
# dependencies = ["mcp>=1.10.0"]
# ///
import json
import os
import re
from pathlib import Path
from typing import Any

from mcp.server.fastmcp import FastMCP

mcp = FastMCP("autooc-mcp")
SCRIPT_PATH = Path(__file__).resolve()
VAULT_PATH = Path(os.environ.get("AUTOOC_VAULT_PATH") or SCRIPT_PATH.parents[3])
SECRETS_PATH = VAULT_PATH / ".obsidian" / "plugins" / "auto-oc" / "secrets.vault.json"
PLUGIN_DIR = VAULT_PATH / ".obsidian" / "plugins" / "auto-oc"
BRIDGE_PATH = PLUGIN_DIR / "mcp-bridge.json"


def read_secrets_metadata() -> list[dict[str, Any]]:
    try:
        if not SECRETS_PATH.exists():
            return []
        data = json.loads(SECRETS_PATH.read_text(encoding="utf-8") or "{}")
        secrets = data.get("secrets") if isinstance(data, dict) else []
        if not isinstance(secrets, list):
            return []
        return [
            {
                "name": secret.get("name"),
                "envName": secret.get("envName"),
                "type": secret.get("type"),
                "profile": secret.get("profile") or "default",
                "updatedAt": secret.get("updatedAt"),
            }
            for secret in secrets
            if isinstance(secret, dict)
        ]
    except Exception as exc:
        return [{"error": str(exc)}]


def normalize_key(value: str | None) -> str:
    text = str(value or "").strip()
    text = re.sub(r"^https?://", "", text, flags=re.I)
    text = re.sub(r"^www\.", "", text, flags=re.I)
    text = text.split("/")[0].split(":")[0]
    text = re.sub(r"\.[^.]+$", "", text)
    text = re.sub(r"[^A-Za-z0-9]+", "_", text).strip("_")
    return text.upper()


def secret_value_for(secret: dict[str, Any] | None) -> str:
    if not secret:
        return ""
    env_name = secret.get("envName")
    return os.environ.get(str(env_name), "") if env_name else ""


def find_secret_by_name_or_env(name: str) -> dict[str, Any] | None:
    wanted = normalize_key(name)
    for secret in read_secrets_metadata():
        if normalize_key(secret.get("name")) == wanted or normalize_key(secret.get("envName")) == wanted:
            return secret
    return None


def find_web_credentials(site: str) -> dict[str, Any]:
    key = normalize_key(site)
    secrets = read_secrets_metadata()

    def is_for_site(secret: dict[str, Any]) -> bool:
        return key in normalize_key(secret.get("name")) or key in normalize_key(secret.get("envName"))

    def is_user(secret: dict[str, Any]) -> bool:
        name = normalize_key(secret.get("name"))
        env = normalize_key(secret.get("envName"))
        type_name = str(secret.get("type") or "").lower()
        return type_name == "username" or "USER" in name or "USER" in env

    def is_pass(secret: dict[str, Any]) -> bool:
        name = normalize_key(secret.get("name"))
        env = normalize_key(secret.get("envName"))
        type_name = str(secret.get("type") or "").lower()
        return type_name == "password" or "PASS" in name or "PASS" in env

    user = next((secret for secret in secrets if is_for_site(secret) and is_user(secret)), None)
    password = next((secret for secret in secrets if is_for_site(secret) and is_pass(secret)), None)
    username_value = secret_value_for(user)
    password_value = secret_value_for(password)
    return {
        "site": site,
        "usernameEnv": user.get("envName") if user else None,
        "passwordEnv": password.get("envName") if password else None,
        "username": username_value,
        "password": password_value,
        "found": bool(username_value and password_value),
    }


def bridge_post(endpoint: str, payload: dict[str, Any]) -> dict[str, Any]:
    if not BRIDGE_PATH.exists():
        return {"ok": False, "error": "AutoOC plugin is not running", "vaultPath": str(VAULT_PATH), "bridgePath": str(BRIDGE_PATH)}
    try:
        bridge = json.loads(BRIDGE_PATH.read_text(encoding="utf-8"))
        url = bridge.get("url")
        token = bridge.get("token")
        if not isinstance(url, str) or not isinstance(token, str):
            return {"ok": False, "error": "AutoOC plugin is not running"}
        from urllib.request import Request, urlopen
        request = Request(
            url.rstrip("/") + endpoint,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"},
            method="POST",
        )
        with urlopen(request, timeout=10) as response:
            result = json.loads(response.read().decode("utf-8"))
        return result if isinstance(result, dict) else {"ok": False, "error": "Invalid bridge response"}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


def vault_note_path(note_path: str) -> Path | None:
    try:
        candidate = (VAULT_PATH / note_path).resolve()
        vault = VAULT_PATH.resolve()
        if candidate != vault and vault not in candidate.parents:
            return None
        return candidate if candidate.suffix.lower() == ".md" else None
    except Exception:
        return None


@mcp.tool()
def secrets_status() -> dict[str, Any]:
    """Show AutoOC secrets vault status without revealing secret values."""
    secrets = [secret for secret in read_secrets_metadata() if "error" not in secret]
    return {"vaultPath": str(VAULT_PATH), "secretsPath": str(SECRETS_PATH), "secretsCount": len(secrets)}


@mcp.tool()
def list_secret_envs() -> list[dict[str, Any]]:
    """List AutoOC secret names and environment variable names without revealing values."""
    return read_secrets_metadata()


@mcp.tool()
def mcp_header_template() -> dict[str, Any]:
    """Return a headers template mapping AutoOC secret names to {env:...} references."""
    headers: dict[str, str] = {}
    for secret in read_secrets_metadata():
        name = secret.get("name")
        env_name = secret.get("envName")
        if name and env_name:
            headers[str(name)] = "{env:" + str(env_name) + "}"
    return {"headers": headers}


@mcp.tool()
def get_secret_value(name: str) -> dict[str, Any]:
    """Return one AutoOC secret value by secret name or env var. Use only when the task explicitly needs the credential."""
    secret = find_secret_by_name_or_env(name)
    if not secret:
        return {"found": False}
    value = secret_value_for(secret)
    return {"found": bool(value), "name": secret.get("name"), "envName": secret.get("envName"), "value": value}


@mcp.tool()
def get_web_credentials(site: str) -> dict[str, Any]:
    """Return username and password for a website from AutoOC secrets."""
    return find_web_credentials(site)


@mcp.tool()
def autooc_list(kind: str = "all") -> dict[str, Any]:
    """List AutoOC tasks and/or workflows. kind must be tasks, workflows, or all."""
    if kind not in {"tasks", "workflows", "all"}:
        return {"ok": False, "error": "kind must be tasks, workflows, or all"}
    return bridge_post("/list", {"kind": kind})


@mcp.tool()
def autooc_create(kind: str, payload: dict[str, Any]) -> dict[str, Any]:
    """Create an AutoOC task or workflow from an export object or export file payload."""
    if kind not in {"task", "workflow"}:
        return {"ok": False, "error": "kind must be task or workflow"}
    return bridge_post("/create", {"kind": kind, "payload": payload})


@mcp.tool()
def autooc_export(kind: str = "all", id_or_name: str | None = None) -> dict[str, Any]:
    """Export AutoOC tasks/workflows as reusable import JSON. kind: all, tasks, workflows, task, or workflow."""
    if kind not in {"all", "tasks", "workflows", "task", "workflow"}:
        return {"ok": False, "error": "kind must be all, tasks, workflows, task, or workflow"}
    return bridge_post("/export", {"kind": kind, "idOrName": id_or_name})


@mcp.tool()
def autooc_play(kind: str, id_or_name: str) -> dict[str, Any]:
    """Run an AutoOC task or workflow by id or name."""
    if kind not in {"task", "workflow"}:
        return {"ok": False, "error": "kind must be task or workflow"}
    return bridge_post("/play", {"kind": kind, "idOrName": id_or_name})


@mcp.tool()
def autooc_stop(kind: str, id_or_name: str) -> dict[str, Any]:
    """Stop an AutoOC task or workflow by id or name."""
    if kind not in {"task", "workflow"}:
        return {"ok": False, "error": "kind must be task or workflow"}
    return bridge_post("/stop", {"kind": kind, "idOrName": id_or_name})


@mcp.tool()
def obsidian_note(action: str, path: str | None = None, query: str | None = None) -> dict[str, Any]:
    """Read-only Obsidian markdown access. Supports list, read, and search."""
    try:
        vault = VAULT_PATH.resolve()
        if action == "list":
            notes = [str(note.relative_to(vault)) for note in vault.rglob("*.md") if ".obsidian" not in note.relative_to(vault).parts]
            return {"ok": True, "files": notes[:200], "truncated": len(notes) > 200}
        if action == "read":
            if not path:
                return {"ok": False, "error": "path is required"}
            note = vault_note_path(path)
            if not note or not note.is_file():
                return {"ok": False, "error": "Markdown note not found"}
            content = note.read_text(encoding="utf-8")[:200000]
            return {"ok": True, "path": str(note.relative_to(vault)), "content": content, "truncated": note.stat().st_size > len(content.encode("utf-8"))}
        if action == "search":
            if not query:
                return {"ok": False, "error": "query is required"}
            matches = []
            for note in vault.rglob("*.md"):
                if ".obsidian" in note.relative_to(vault).parts:
                    continue
                if query.lower() in note.read_text(encoding="utf-8").lower():
                    matches.append(str(note.relative_to(vault)))
                    if len(matches) == 200:
                        break
            return {"ok": True, "files": matches, "truncated": len(matches) == 200}
        return {"ok": False, "error": "action must be list, read, or search"}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


if __name__ == "__main__":
    mcp.run(transport="stdio")
`;
}
function getRalphStateFilePath(vaultBasePath) {
  return path16.join(vaultBasePath, ".opencode", "ralph-loop.local.md");
}
function getTaskLogDir(vaultBasePath, taskId) {
  return path16.join(vaultBasePath, ".opencode", "logs", taskId);
}
function formatTimestampForLog() {
  const now = /* @__PURE__ */ new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
}
function formatLogFilenameTimestamp(fileName) {
  const match = fileName.match(/^(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})(?:\.\d{3}_[a-zA-Z0-9-]+_\d+)?\.log$/);
  if (!match) return fileName.replace(/\.log$/, "");
  const [, year, month, day, hour, minute, second] = match;
  return `${day}/${month}/${year} ${hour}:${minute}:${second}`;
}
function saveLogToFile(vaultBasePath, taskId, output) {
  if (!output || !output.trim()) return null;
  const logDir = getTaskLogDir(vaultBasePath, taskId);
  try {
    fs18.mkdirSync(logDir, { recursive: true });
  } catch (e) {
  }
  const timestamp = formatTimestampForLog();
  const logFile = path16.join(logDir, `${timestamp}.log`);
  try {
    fs18.writeFileSync(logFile, output, "utf8");
    const latestFile = path16.join(logDir, "latest.log");
    fs18.writeFileSync(latestFile, output, "utf8");
    return logFile;
  } catch (e) {
    return null;
  }
}
function getLogHistory(vaultBasePath, taskId) {
  const logDir = getTaskLogDir(vaultBasePath, taskId);
  try {
    if (!fs18.existsSync(logDir)) return [];
    const files = fs18.readdirSync(logDir).filter((f) => f.endsWith(".log") && f !== "latest.log").sort().reverse();
    return files.map((f) => ({
      file: path16.join(logDir, f),
      timestamp: formatLogFilenameTimestamp(f)
    }));
  } catch (e) {
    return [];
  }
}
function readLogFile(filePath) {
  try {
    return formatLogContent(fs18.readFileSync(filePath, "utf8"));
  } catch (e) {
    return "(error reading log file)";
  }
}
function cleanupOldLogs(vaultBasePath, taskId, maxLogs) {
  if (maxLogs <= 0) return;
  const logDir = getTaskLogDir(vaultBasePath, taskId);
  try {
    if (!fs18.existsSync(logDir)) return;
    const files = fs18.readdirSync(logDir).filter((f) => f.endsWith(".log") && f !== "latest.log").sort();
    while (files.length > maxLogs) {
      const oldFile = files.shift();
      if (oldFile) {
        try {
          fs18.unlinkSync(path16.join(logDir, oldFile));
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
    if (!fs18.existsSync(logDir)) return;
    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1e3;
    const files = fs18.readdirSync(logDir).filter((f) => f.endsWith(".log") && f !== "latest.log");
    for (const f of files) {
      const match = f.match(/^(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})\.log$/);
      if (match) {
        const [, y, m, d, h, min, s] = match;
        const fileDate = /* @__PURE__ */ new Date(`${y}-${m}-${d}T${h}:${min}:${s}`);
        if (fileDate.getTime() < cutoff) {
          try {
            fs18.unlinkSync(path16.join(logDir, f));
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
    if (!fs18.existsSync(logDir)) return;
    const files = fs18.readdirSync(logDir);
    for (const f of files) {
      try {
        fs18.unlinkSync(path16.join(logDir, f));
      } catch (e) {
      }
    }
    try {
      fs18.rmdirSync(logDir);
    } catch (e) {
    }
  } catch (e) {
  }
}
function clearAllLogs(vaultBasePath) {
  const logsDir = path16.join(vaultBasePath, ".opencode", "logs");
  try {
    if (!fs18.existsSync(logsDir)) return;
    const dirs = fs18.readdirSync(logsDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
    for (const dir of dirs) {
      clearTaskLogs(vaultBasePath, dir);
    }
    try {
      fs18.rmdirSync(logsDir);
    } catch (e) {
    }
  } catch (e) {
  }
}
function deleteSingleLogFile(filePath) {
  try {
    fs18.unlinkSync(filePath);
  } catch (e) {
  }
}
function isTaskDue(task) {
  var _a, _b;
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
  if (task.scheduleType === "interval") {
    const value = (_a = task.scheduleIntervalValue) != null ? _a : 10;
    const unit = (_b = task.scheduleIntervalUnit) != null ? _b : "minutes";
    const ms = intervalToMs(value, unit);
    if (!task.lastRun) return true;
    return now.getTime() - new Date(task.lastRun).getTime() >= ms;
  }
  return false;
}
function isWorkflowDue(wf) {
  var _a, _b;
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
  if (wf.scheduleType === "interval") {
    const value = (_a = wf.scheduleIntervalValue) != null ? _a : 10;
    const unit = (_b = wf.scheduleIntervalUnit) != null ? _b : "minutes";
    const ms = intervalToMs(value, unit);
    if (!wf.lastRun) return true;
    return now.getTime() - new Date(wf.lastRun).getTime() >= ms;
  }
  return false;
}
var AutoOCPlugin = class extends import_obsidian.Plugin {
  constructor() {
    super(...arguments);
    this.settingsWriter = new SettingsWriter();
    this.availableModels = FALLBACK_MODELS;
    this.availableAgents = FALLBACK_AGENTS;
    this.availableCodexModels = [];
    this.visualBuilders = /* @__PURE__ */ new Set();
    this.taskUpdatedCallbacks = /* @__PURE__ */ new Set();
    this.workflowUpdatedCallbacks = /* @__PURE__ */ new Set();
    // Map taskId -> child process, so we can kill running tasks
    this.runningProcesses = /* @__PURE__ */ new Map();
    this.runningCodexClients = /* @__PURE__ */ new Map();
    this.dueCheckInProgress = false;
    // Workflows that have been manually stopped; checked in step callbacks to abort chaining
    this.stoppingWorkflows = /* @__PURE__ */ new Set();
    this.workflowDelayControllers = /* @__PURE__ */ new Map();
    this.mcpBridgeToken = "";
    // Update-check state
    this.latestVersion = null;
    this.updateAvailable = false;
    this.updateCheckError = null;
    this.updateInProgress = false;
  }
  async onload() {
    this.reservePluginExecution();
    try {
      await this.loadSettings();
    } catch (error) {
      this.releasePluginExecution(false);
      throw error;
    }
    void this.startMcpBridge().catch((error) => console.warn("AutoOC MCP bridge failed to start", error));
    setTimeout(() => {
      this.refreshModels();
      this.refreshAgents();
      void this.refreshCodexModels();
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
      id: "open-visual-builder",
      name: "Open AutoOC Visual Builder",
      callback: () => this.openVisualBuilder()
    });
    this.addCommand({
      id: "create-task",
      name: "Create new AI task",
      callback: () => new CreateTaskModal(this.app, this).open()
    });
    this.addCommand({
      id: "open-chatgpt-codex",
      name: "Open ChatGPT / Codex in project folder",
      callback: () => new CodexAppModal(this.app, this).open()
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
      window.setInterval(() => this.runDueAll(), 5e3)
    );
    this.app.workspace.onLayoutReady(() => {
      const startupTimer = window.setTimeout(() => this.runDueAll(), INITIAL_DUE_CHECK_DELAY_MS);
      this.register(() => window.clearTimeout(startupTimer));
    });
    setTimeout(() => this.checkForUpdates(true), 3e3);
  }
  async onunload() {
    var _a, _b, _c, _d, _e;
    const unresolved = !!this.sharedWorkflowExecution || this.runningProcesses.size > 0 || this.runningCodexClients.size > 0 || this.workflowDelayControllers.size > 0 || ((_b = (_a = this.settings) == null ? void 0 : _a.tasks) == null ? void 0 : _b.some((task) => task.status === "running")) || ((_d = (_c = this.settings) == null ? void 0 : _c.workflows) == null ? void 0 : _d.some((workflow) => workflow.status === "running"));
    (_e = this.sharedWorkflowExecution) == null ? void 0 : _e.controller.abort();
    for (const controller of this.workflowDelayControllers.values()) controller.abort();
    this.workflowDelayControllers.clear();
    await this.stopMcpBridge();
    for (const [, proc] of this.runningProcesses) {
      proc.kill();
    }
    this.runningProcesses.clear();
    for (const [, client] of this.runningCodexClients) client.dispose();
    this.runningCodexClients.clear();
    this.app.workspace.detachLeavesOfType(VIEW_TYPE);
    this.releasePluginExecution(!!unresolved);
  }
  // Reserve the vault for the whole plugin lifetime, including legacy tasks
  // whose asynchronous completion outlives runTask/runWorkflow. The external
  // host uses this same lease, so opening the plugin cannot race its effects.
  reservePluginExecution() {
    if (this.pluginExecutionLease) {
      this.pluginExecutionLease.assertOwned();
      return;
    }
    const base = this.app.vault.adapter.basePath;
    if (!base) throw new Error("AutoOC execution requires a local vault");
    let directory = fs18.realpathSync(base);
    for (const part of [this.app.vault.configDir, "plugins", this.manifest.id, "runtime"]) {
      directory = path16.join(directory, part);
      if (!fs18.existsSync(directory)) fs18.mkdirSync(directory);
      const stat = fs18.lstatSync(directory);
      if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error("AutoOC runtime must use regular directories");
    }
    this.pluginExecutionLease = acquireExecutionLease(directory);
  }
  releasePluginExecution(unresolved) {
    if (!this.pluginExecutionLease) return;
    if (unresolved) return;
    this.pluginExecutionLease.release();
    this.pluginExecutionLease = void 0;
  }
  isWorkflowExecuting(workflowId) {
    var _a;
    if (((_a = this.sharedWorkflowExecution) == null ? void 0 : _a.workflowId) === workflowId) return true;
    const workflow = this.settings.workflows.find((item) => item.id === workflowId);
    return !!workflow && !workflow.runtimeExecution && workflow.status === "running";
  }
  async recoverSharedWorkflow(workflowId, expectedRunId) {
    const workflow = this.settings.workflows.find((item) => item.id === workflowId);
    const execution = workflow == null ? void 0 : workflow.runtimeExecution;
    if (!execution || execution.runId !== expectedRunId) throw new Error("Recovery identity changed; reload the workflow");
    if (!["ready", "in_flight"].includes(execution.phase)) throw new Error("Execution does not require recovery");
    return await this.runSharedWorkflow(workflowId, expectedRunId, execution.phase === "in_flight");
  }
  async runSharedWorkflow(workflowId, resumeRunId, reconcile = false, newExecution = false, taskId) {
    var _a;
    if (this.updateInProgress) throw new Error("Plugin update is in progress");
    if (!this.pluginExecutionLease) throw new Error("Plugin execution reservation is required");
    if (this.sharedWorkflowExecution) throw new Error("A shared workflow is already executing");
    if (this.runningProcesses.size || this.runningCodexClients.size || this.workflowDelayControllers.size) {
      throw new Error("Legacy tasks must finish before shared execution");
    }
    const execution = { workflowId, taskId, controller: new AbortController() };
    this.sharedWorkflowExecution = execution;
    try {
      await this.saveSettings(false);
      return await runInstalledWorkflow({
        vault: this.app.vault.adapter.basePath,
        workflowId: taskId ? void 0 : workflowId,
        taskId,
        resumeRunId,
        reconcile,
        newExecution,
        lease: this.pluginExecutionLease,
        signal: execution.controller.signal,
        redact: (output) => this.redactSecrets(output),
        onCheckpoint: async () => {
          var _a2;
          await this.loadSettings();
          (_a2 = this.view) == null ? void 0 : _a2.refresh();
        }
      });
    } finally {
      if (this.sharedWorkflowExecution === execution) this.sharedWorkflowExecution = void 0;
      (_a = this.view) == null ? void 0 : _a.refresh();
    }
  }
  getMcpBridgePath() {
    const vaultBasePath = this.app.vault.adapter.basePath || ".";
    return path16.join(vaultBasePath, ".obsidian", "plugins", "auto-oc", "mcp-bridge.json");
  }
  async startMcpBridge() {
    await this.stopMcpBridge();
    this.mcpBridgeToken = crypto2.randomBytes(24).toString("hex");
    const server = http.createServer((request, response) => void this.handleMcpBridgeRequest(request, response));
    await new Promise((resolve5, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => {
        server.off("error", reject);
        resolve5();
      });
    });
    const address = server.address();
    if (!address || typeof address === "string") {
      server.close();
      throw new Error("Could not determine MCP bridge address");
    }
    try {
      const bridgePath = this.getMcpBridgePath();
      fs18.mkdirSync(path16.dirname(bridgePath), { recursive: true });
      fs18.writeFileSync(bridgePath, JSON.stringify({ url: `http://127.0.0.1:${address.port}`, token: this.mcpBridgeToken }), "utf8");
      this.mcpBridgeServer = server;
    } catch (error) {
      await new Promise((resolve5) => server.close(() => resolve5()));
      throw error;
    }
  }
  async stopMcpBridge() {
    const server = this.mcpBridgeServer;
    this.mcpBridgeServer = void 0;
    this.mcpBridgeToken = "";
    try {
      fs18.unlinkSync(this.getMcpBridgePath());
    } catch (e) {
    }
    if (server) await new Promise((resolve5) => server.close(() => resolve5()));
  }
  findTaskByIdOrName(idOrName) {
    return this.settings.tasks.find((task) => task.id === idOrName || task.name === idOrName);
  }
  isTaskActive(task) {
    var _a;
    if (((_a = this.sharedWorkflowExecution) == null ? void 0 : _a.taskId) === task.id) return true;
    const canonical2 = this.settings.tasks.find((t) => t.id === task.id);
    return (canonical2 == null ? void 0 : canonical2.status) === "running" || this.runningProcesses.has(task.id);
  }
  getMcpRawWorkflowReferenceError(payload) {
    if (!payload || typeof payload !== "object" || "autoOCExport" in payload) return null;
    const steps = payload.steps;
    if (!Array.isArray(steps)) return null;
    for (const step of steps) {
      if (!step || typeof step !== "object") continue;
      const s = step;
      const stepKind = typeof s.stepKind === "string" ? s.stepKind : "task";
      if (stepKind === "task") {
        return "Raw workflow payload task steps are not supported; send a full AutoOC export with task mappings.";
      }
    }
    return null;
  }
  isMcpObject(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
  }
  getMcpScheduleValidationError(prefix, payload) {
    const scheduleTypes = ["manual", "once", "daily", "weekly", "monthly", "interval"];
    const intervalUnits = ["seconds", "minutes", "hours"];
    if (payload.scheduleType !== void 0 && (typeof payload.scheduleType !== "string" || !scheduleTypes.includes(payload.scheduleType))) {
      return `${prefix}.scheduleType must be one of: ${scheduleTypes.join(", ")}.`;
    }
    if (payload.scheduleTime !== void 0 && typeof payload.scheduleTime !== "string") return `${prefix}.scheduleTime must be a string.`;
    if (payload.scheduleDate !== void 0 && typeof payload.scheduleDate !== "string") return `${prefix}.scheduleDate must be a string.`;
    if (payload.scheduleDays !== void 0 && (!Array.isArray(payload.scheduleDays) || payload.scheduleDays.some((day) => typeof day !== "number" || day < 0 || day > 6))) {
      return `${prefix}.scheduleDays must be an array of numbers from 0 to 6.`;
    }
    if (payload.scheduleMonthDays !== void 0 && (!Array.isArray(payload.scheduleMonthDays) || payload.scheduleMonthDays.some((day) => typeof day !== "number" || day < 1 || day > 31))) {
      return `${prefix}.scheduleMonthDays must be an array of numbers from 1 to 31.`;
    }
    if (payload.scheduleIntervalValue !== void 0 && (typeof payload.scheduleIntervalValue !== "number" || !Number.isFinite(payload.scheduleIntervalValue))) {
      return `${prefix}.scheduleIntervalValue must be a finite number.`;
    }
    if (payload.scheduleIntervalUnit !== void 0 && (typeof payload.scheduleIntervalUnit !== "string" || !intervalUnits.includes(payload.scheduleIntervalUnit))) {
      return `${prefix}.scheduleIntervalUnit must be one of: ${intervalUnits.join(", ")}.`;
    }
    return null;
  }
  getMcpRawTaskPayloadError(payload) {
    if ("steps" in payload) return 'Raw task payloads must not include workflow steps; use kind "workflow".';
    const taskKind = typeof payload.taskKind === "string" ? payload.taskKind : "opencode";
    if (!["opencode", "codex", "copilot", "code"].includes(taskKind)) return "payload.taskKind must be opencode, codex, copilot, or code.";
    const copilotError = getCopilotTaskValidationError(payload);
    if (copilotError) return copilotError;
    if (payload.reasoningEffort !== void 0 && (taskKind !== "codex" || typeof payload.reasoningEffort !== "string" || !payload.reasoningEffort.trim())) {
      return 'payload.reasoningEffort is only valid as a non-empty string for taskKind "codex".';
    }
    if (payload.interactiveTerminal !== void 0 && typeof payload.interactiveTerminal !== "boolean") return "payload.interactiveTerminal must be a boolean when provided.";
    if (taskKind === "code" && payload.interactiveTerminal === true) return "Code tasks cannot use interactiveTerminal.";
    if (typeof payload.name !== "string" || !payload.name.trim()) return "payload.name is required for raw task payloads.";
    if (taskKind === "code") {
      const hasCode = typeof payload.code === "string" && payload.code.trim();
      const hasPrompt = typeof payload.prompt === "string" && payload.prompt.trim();
      if (!hasCode && !hasPrompt) return "payload.code or payload.prompt is required for raw code task payloads.";
    } else if (typeof payload.prompt !== "string" || !payload.prompt.trim()) {
      return "payload.prompt is required for raw task payloads.";
    }
    return this.getMcpScheduleValidationError("payload", payload);
  }
  getMcpRawWorkflowPayloadError(payload) {
    if (typeof payload.name !== "string" || !payload.name.trim()) return "payload.name is required for raw workflow payloads.";
    if (!Array.isArray(payload.steps)) return "payload.steps must be a non-empty array for raw workflow payloads.";
    if (payload.steps.length === 0) return "payload.steps must contain at least one step.";
    const scheduleError = this.getMcpScheduleValidationError("payload", payload);
    if (scheduleError) return scheduleError;
    const stepIds = /* @__PURE__ */ new Set();
    let hasTransitions = false;
    for (let i = 0; i < payload.steps.length; i++) {
      const step = payload.steps[i];
      const prefix = `payload.steps[${i}]`;
      if (!this.isMcpObject(step)) return `${prefix} must be an object.`;
      if (typeof step.id === "string" && step.id.trim()) stepIds.add(step.id);
      const stepKind = typeof step.stepKind === "string" ? step.stepKind : "task";
      if (stepKind === "task") return "Raw workflow payload task steps are not supported; send a full AutoOC export with task mappings.";
      if (stepKind !== "delay" && stepKind !== "code") return `${prefix}.stepKind must be "delay" or "code" for raw workflow payloads.`;
      if (stepKind === "delay") {
        if (step.delayValue !== void 0 && (typeof step.delayValue !== "number" || !Number.isFinite(step.delayValue))) return `${prefix}.delayValue must be a finite number.`;
        if (step.delayUnit !== void 0 && (typeof step.delayUnit !== "string" || !["seconds", "minutes", "hours"].includes(step.delayUnit))) return `${prefix}.delayUnit must be one of: seconds, minutes, hours.`;
      }
      if (stepKind === "code" && (typeof step.code !== "string" || !step.code.trim())) return `${prefix}.code is required for raw code workflow steps.`;
      if (step.transitions !== void 0) {
        if (!Array.isArray(step.transitions)) return `${prefix}.transitions must be an array.`;
        if (step.transitions.length > 0) hasTransitions = true;
        for (let j = 0; j < step.transitions.length; j++) {
          const transition = step.transitions[j];
          const transitionPrefix = `${prefix}.transitions[${j}]`;
          if (!this.isMcpObject(transition)) return `${transitionPrefix} must be an object.`;
          if (typeof transition.toStepId !== "string" || !transition.toStepId.trim()) return `${transitionPrefix}.toStepId is required.`;
          if (transition.mode !== "default" && transition.mode !== "force" && transition.mode !== "eval" && transition.mode !== "conditional") {
            return `${transitionPrefix}.mode must be one of: default, force, eval, conditional.`;
          }
        }
      }
    }
    if (hasTransitions) {
      if (stepIds.size !== payload.steps.length) return "Raw workflow steps with transitions must each include a unique string id.";
      for (let i = 0; i < payload.steps.length; i++) {
        const step = payload.steps[i];
        for (const transition of step.transitions || []) {
          const toStepId = transition.toStepId;
          if (typeof toStepId === "string" && !stepIds.has(toStepId)) return `payload.steps[${i}].transitions references unknown step id "${toStepId}".`;
        }
      }
    }
    return null;
  }
  getMcpFullExportKindError(kind, payload) {
    if (!Array.isArray(payload.tasks)) return "Full AutoOC exports must include a tasks array.";
    if (!Array.isArray(payload.workflows)) return "Full AutoOC exports must include a workflows array.";
    if (kind === "task") {
      if (payload.tasks.length === 0) return "Full task exports must include at least one task.";
      if (payload.workflows.length > 0) return 'Full task exports must not include workflows; use kind "workflow" for workflow exports.';
    } else {
      if (payload.workflows.length === 0) return "Full workflow exports must include at least one workflow.";
    }
    return null;
  }
  getMcpCreatePayloadError(kind, payload) {
    if (!this.isMcpObject(payload)) return "Invalid payload: expected a JSON object.";
    if ("autoOCExport" in payload) return this.getMcpFullExportKindError(kind, payload);
    if (kind === "task") return this.getMcpRawTaskPayloadError(payload);
    const referenceError = this.getMcpRawWorkflowReferenceError(payload);
    return referenceError || this.getMcpRawWorkflowPayloadError(payload);
  }
  getMcpWorkflowPlayError(workflow) {
    const wf = this.settings.workflows.find((w) => w.id === workflow.id);
    if (!wf) return { status: 404, body: { ok: false, error: "workflow not found" } };
    if (wf.status === "running") {
      return { status: 409, body: { ok: false, id: wf.id, name: wf.name, status: "conflict", error: `Workflow "${wf.name}" is already running.` } };
    }
    if (wf.steps.length === 0) {
      return { status: 400, body: { ok: false, id: wf.id, name: wf.name, status: "invalid", error: `Workflow "${wf.name}" has no steps.` } };
    }
    const stepIds = /* @__PURE__ */ new Set();
    for (let i = 0; i < wf.steps.length; i++) {
      const step = wf.steps[i];
      if (typeof step.id !== "string" || !step.id.trim()) {
        return { status: 400, body: { ok: false, id: wf.id, name: wf.name, status: "invalid", error: `Workflow "${wf.name}" \u2014 step ${i + 1} must include a unique string id.` } };
      }
      if (stepIds.has(step.id)) {
        return { status: 400, body: { ok: false, id: wf.id, name: wf.name, status: "invalid", error: `Workflow "${wf.name}" \u2014 step ${i + 1} duplicates step id "${step.id}".` } };
      }
      stepIds.add(step.id);
      if (step.stepKind === "task" && !this.settings.tasks.find((task) => task.id === step.taskId)) {
        return { status: 404, body: { ok: false, id: wf.id, name: wf.name, status: "invalid", error: `Workflow "${wf.name}" \u2014 step ${i + 1} references a deleted task.` } };
      }
    }
    const incoming = /* @__PURE__ */ new Set();
    for (let i = 0; i < wf.steps.length; i++) {
      const step = wf.steps[i];
      for (const transition of step.transitions || []) {
        if (typeof transition.toStepId !== "string" || !transition.toStepId.trim()) {
          return { status: 400, body: { ok: false, id: wf.id, name: wf.name, status: "invalid", error: `Workflow "${wf.name}" \u2014 step ${i + 1} has a transition with a missing target step id.` } };
        }
        if (!stepIds.has(transition.toStepId)) {
          return { status: 400, body: { ok: false, id: wf.id, name: wf.name, status: "invalid", error: `Workflow "${wf.name}" \u2014 step ${i + 1} references unknown step id "${transition.toStepId}".` } };
        }
        incoming.add(transition.toStepId);
      }
    }
    if (!wf.steps.some((step) => !incoming.has(step.id))) {
      return { status: 400, body: { ok: false, id: wf.id, name: wf.name, status: "invalid", error: `Workflow "${wf.name}" has no reachable entry step.` } };
    }
    return null;
  }
  findWorkflowByIdOrName(idOrName) {
    return this.settings.workflows.find((workflow) => workflow.id === idOrName || workflow.name === idOrName);
  }
  wrapMcpCreatePayload(kind, payload) {
    if (!payload || typeof payload !== "object") return null;
    if ("autoOCExport" in payload) return payload;
    const autoOCExport = {
      schemaVersion: payload.taskKind === "copilot" ? "1.6.0" : "1.5.0",
      exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
      pluginVersion: this.manifest.version
    };
    return kind === "task" ? { autoOCExport, tasks: [{ ...payload, exportId: crypto2.randomUUID() }], workflows: [] } : { autoOCExport, tasks: [], workflows: [{ ...payload, exportId: crypto2.randomUUID() }] };
  }
  async handleMcpBridgeRequest(request, response) {
    const send = (status, body) => {
      response.writeHead(status, { "Content-Type": "application/json" });
      response.end(JSON.stringify(body));
    };
    if (request.method !== "POST") return send(405, { ok: false, error: "POST required" });
    if (request.headers.authorization !== `Bearer ${this.mcpBridgeToken}`) return send(401, { ok: false, error: "Unauthorized" });
    const chunks = [];
    let size = 0;
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size <= 1024 * 1024) chunks.push(chunk);
    });
    request.on("error", () => send(400, { ok: false, error: "Invalid request" }));
    request.on("end", async () => {
      if (size > 1024 * 1024) return send(413, { ok: false, error: "Request too large" });
      let body;
      try {
        body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      } catch (e) {
        return send(400, { ok: false, error: "Invalid JSON" });
      }
      if (!body || typeof body !== "object") return send(400, { ok: false, error: "Invalid request" });
      const input = body;
      const kind = input.kind;
      try {
        if (request.url === "/list") {
          if (kind !== "tasks" && kind !== "workflows" && kind !== "all") return send(400, { ok: false, error: "Invalid kind" });
          return send(200, {
            ok: true,
            ...kind !== "workflows" ? { tasks: this.settings.tasks } : {},
            ...kind !== "tasks" ? { workflows: this.settings.workflows } : {}
          });
        }
        if (request.url === "/create") {
          if (kind !== "task" && kind !== "workflow") return send(400, { ok: false, error: "Invalid kind" });
          const createPayloadError = this.getMcpCreatePayloadError(kind, input.payload);
          if (createPayloadError) return send(400, { ok: false, error: createPayloadError });
          const data = this.wrapMcpCreatePayload(kind, input.payload);
          if (!data) return send(400, { ok: false, error: "Invalid payload" });
          try {
            return send(200, { ok: true, ...await this.importFromData(data) });
          } catch (error) {
            return send(400, { ok: false, error: error instanceof Error ? error.message : String(error) });
          }
        }
        if (request.url === "/export") {
          if (kind !== "all" && kind !== "tasks" && kind !== "workflows" && kind !== "task" && kind !== "workflow") return send(400, { ok: false, error: "Invalid kind" });
          const idOrName = typeof input.idOrName === "string" && input.idOrName.trim() ? input.idOrName : void 0;
          let tasks = [];
          let workflows = [];
          if (kind === "task") {
            const task = idOrName ? this.findTaskByIdOrName(idOrName) : void 0;
            if (!task) return send(404, { ok: false, error: "task not found" });
            tasks = [task];
          } else if (kind === "workflow") {
            const workflow = idOrName ? this.findWorkflowByIdOrName(idOrName) : void 0;
            if (!workflow) return send(404, { ok: false, error: "workflow not found" });
            const payload = this.buildExportSelectionPayload(/* @__PURE__ */ new Set(), /* @__PURE__ */ new Set([workflow.id]));
            tasks = payload.tasks;
            workflows = payload.workflows;
          } else if (kind === "tasks") {
            tasks = this.settings.tasks;
          } else if (kind === "workflows") {
            const payload = this.buildExportSelectionPayload(/* @__PURE__ */ new Set(), new Set(this.settings.workflows.map((workflow) => workflow.id)));
            tasks = payload.tasks;
            workflows = payload.workflows;
          } else {
            tasks = this.settings.tasks;
            workflows = this.settings.workflows;
          }
          const json = this.buildExportJson(tasks, workflows, idOrName || `AutoOC ${kind} export`);
          return send(200, { ok: true, export: JSON.parse(json) });
        }
        if (kind !== "task" && kind !== "workflow") return send(400, { ok: false, error: "Invalid kind" });
        if (typeof input.idOrName !== "string") return send(400, { ok: false, error: "idOrName is required" });
        const item = kind === "task" ? this.findTaskByIdOrName(input.idOrName) : this.findWorkflowByIdOrName(input.idOrName);
        if (!item) return send(404, { ok: false, error: `${kind} not found` });
        if (request.url === "/play") {
          if (kind === "task") {
            if (this.isTaskActive(item)) {
              return send(409, { ok: false, id: item.id, name: item.name, status: "conflict", error: `Task "${item.name}" is already running.` });
            }
            void this.runTask(item);
          } else {
            const workflowPlayError = this.getMcpWorkflowPlayError(item);
            if (workflowPlayError) return send(workflowPlayError.status, workflowPlayError.body);
            void this.runWorkflow(item);
          }
          return send(200, { ok: true, id: item.id, name: item.name, status: "started" });
        }
        if (request.url === "/stop") {
          if (kind === "task") await this.killTask(item.id);
          else await this.killWorkflow(item.id);
          return send(200, { ok: true, id: item.id, name: item.name, status: "stopped" });
        }
        return send(404, { ok: false, error: "Unknown endpoint" });
      } catch (error) {
        console.warn("AutoOC MCP bridge request failed", error);
        return send(500, { ok: false, error: "Bridge request failed" });
      }
    });
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
  async refreshCodexModels(showNotice = false) {
    var _a;
    const vaultBasePath = this.app.vault.adapter.basePath || ".";
    const cwd = this.settings.workingDirectory || vaultBasePath;
    const client = new CodexAppServerClient(resolveCodexBin(this.settings.codexPath), cwd);
    try {
      const models = await client.listModels();
      this.availableCodexModels = models;
      const preferred = models.find((model) => model.isDefault) || models[0];
      if (!this.settings.defaultCodexModel || !models.some((model) => model.value === this.settings.defaultCodexModel)) {
        this.settings.defaultCodexModel = (preferred == null ? void 0 : preferred.value) || "";
      }
      const selected = models.find((model) => model.value === this.settings.defaultCodexModel) || preferred;
      if ((selected == null ? void 0 : selected.supportedReasoningEfforts.length) && !selected.supportedReasoningEfforts.includes(this.settings.defaultCodexReasoningEffort)) {
        this.settings.defaultCodexReasoningEffort = selected.defaultReasoningEffort || selected.supportedReasoningEfforts[0];
      }
      await this.saveSettings(false);
      (_a = this.view) == null ? void 0 : _a.refresh();
      this.syncVisualBuilders();
      if (showNotice) new import_obsidian.Notice(`AutoOC: ${models.length} Codex models loaded.`);
    } catch (error) {
      if (showNotice) new import_obsidian.Notice(`AutoOC: could not connect to Codex \u2014 ${String(error)}`);
    } finally {
      client.dispose();
    }
  }
  getEffectiveCodexModel(model) {
    var _a, _b;
    return model || this.settings.defaultCodexModel || ((_a = this.availableCodexModels.find((entry) => entry.isDefault)) == null ? void 0 : _a.value) || ((_b = this.availableCodexModels[0]) == null ? void 0 : _b.value) || "";
  }
  getCodexReasoningEfforts(model) {
    const selected = this.availableCodexModels.find((entry) => entry.value === (model || this.settings.defaultCodexModel));
    return (selected == null ? void 0 : selected.supportedReasoningEfforts.length) ? selected.supportedReasoningEfforts : ["minimal", "low", "medium", "high", "xhigh"];
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
  // Open the visual builder as a centered, near-fullscreen modal. The
  // visual builder is a standalone HTML/JS app that we host in an
  // iframe; it communicates with the plugin through postMessage so the
  // user can edit visually and apply changes back to the settings.
  openVisualBuilder() {
    new VisualBuilderModal(this.app, this).open();
  }
  registerVisualBuilder(modal) {
    this.visualBuilders.add(modal);
  }
  unregisterVisualBuilder(modal) {
    this.visualBuilders.delete(modal);
  }
  syncVisualBuilders() {
    for (const modal of this.visualBuilders) modal.sendState();
  }
  onTaskUpdated(callback) {
    this.taskUpdatedCallbacks.add(callback);
    return () => this.taskUpdatedCallbacks.delete(callback);
  }
  onWorkflowUpdated(callback) {
    this.workflowUpdatedCallbacks.add(callback);
    return () => this.workflowUpdatedCallbacks.delete(callback);
  }
  emitTaskUpdated(task) {
    for (const callback of this.taskUpdatedCallbacks) callback(task);
    this.syncVisualBuilders();
  }
  emitWorkflowUpdated(workflow) {
    for (const callback of this.workflowUpdatedCallbacks) callback(workflow);
    this.syncVisualBuilders();
  }
  async loadSettings() {
    var _a, _b, _c, _d, _e;
    const vaultBasePath = this.app.vault.adapter.basePath || ".";
    const localFile = this.app.vault.adapter.basePath && this.app.vault.configDir && ((_a = this.manifest) == null ? void 0 : _a.id) ? path16.join(vaultBasePath, this.app.vault.configDir, "plugins", this.manifest.id, "data.json") : null;
    this.settings = Object.assign({}, DEFAULT_SETTINGS, localFile ? this.settingsWriter.load(localFile) : await this.loadData());
    this.secretStore = new SecretStore(vaultBasePath);
    try {
      this.secretStore.load();
    } catch (e) {
      new import_obsidian.Notice(`AutoOC: could not load secrets vault \u2014 ${String(e)}`);
      this.secretStore = new SecretStore(vaultBasePath);
    }
    if (((_b = this.settings.workflows) == null ? void 0 : _b.some((wf) => wf.runtimeExecution)) || ((_c = this.settings.tasks) == null ? void 0 : _c.some((task) => task.runtimeExecution))) {
      const runtime = path16.join(vaultBasePath, ".obsidian", "plugins", "auto-oc", "runtime");
      for (let current = runtime; current !== path16.resolve(vaultBasePath); current = path16.dirname(current)) {
        const stat = fs18.lstatSync(current);
        if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error("AutoOC runtime must use regular directories");
        if (path16.dirname(current) === current) throw new Error("Invalid AutoOC runtime location");
      }
      const recovered = this.settings.workflows.map((wf) => {
        const binding = wf.runtimeExecution;
        if (!binding) return wf;
        const checkpoint = readExecutionCheckpoint(runtime, binding.runId);
        return projectWorkflowProgress(wf, this.settings.tasks, this.settings, checkpoint, binding.runId);
      });
      this.settings.workflows = recovered;
      this.settings.tasks = this.settings.tasks.map((task) => {
        const binding = task.runtimeExecution;
        if (!binding || binding.workflowId !== standaloneTaskWorkflow(task.id).id) return task;
        return projectStandaloneTask(task, this.settings.tasks, this.settings, readExecutionCheckpoint(runtime, binding.runId));
      });
      return;
    }
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
      if (task.pendingCodexApproval) {
        delete task.pendingCodexApproval;
        changed = true;
      }
      if (!Array.isArray(task.scheduleMonthDays)) {
        task.scheduleMonthDays = [];
        changed = true;
      }
      if (task.scheduleIntervalValue === void 0) {
        task.scheduleIntervalValue = 10;
        changed = true;
      }
      if (task.scheduleIntervalUnit === void 0) {
        task.scheduleIntervalUnit = "minutes";
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
      if (wf.scheduleIntervalValue === void 0) {
        wf.scheduleIntervalValue = 10;
        changed = true;
      }
      if (wf.scheduleIntervalUnit === void 0) {
        wf.scheduleIntervalUnit = "minutes";
        changed = true;
      }
      if (wf.handoffOutput !== true) {
        wf.handoffOutput = true;
        changed = true;
      }
      if (Array.isArray(wf.steps)) {
        for (let i = 0; i < wf.steps.length; i++) {
          const s = wf.steps[i];
          if (!s.id) {
            s.id = generateId();
            changed = true;
          }
          if (!s.stepKind) {
            s.stepKind = "task";
            changed = true;
          }
          if (!s.position) {
            s.position = { x: 40 + i * 280, y: 60 };
            changed = true;
          }
          if (!s.transitions || s.transitions.length === 0) {
            const next = wf.steps[i + 1];
            if (next) {
              s.transitions = [{
                toStepId: next.id,
                mode: s.transitionMode || "default",
                evaluatePrompt: s.evaluatePrompt,
                forceContinue: s.forceContinue
              }];
              changed = true;
            }
          }
        }
      }
    }
    if (!this.settings.defaultModel) {
      this.settings.defaultModel = (_e = (_d = this.availableModels[0]) == null ? void 0 : _d.value) != null ? _e : "";
      changed = true;
    }
    if (!["codex", "opencode", "copilot"].includes(this.settings.defaultAiEngine)) {
      this.settings.defaultAiEngine = "opencode";
      changed = true;
    }
    if (this.settings.taskTimeoutSeconds === void 0 || this.settings.taskTimeoutSeconds > 0 && this.settings.taskTimeoutSeconds < 1800) {
      this.settings.taskTimeoutSeconds = DEFAULT_TASK_TIMEOUT_SECONDS;
      changed = true;
    }
    if (!this.settings.libraryUrl) {
      this.settings.libraryUrl = DEFAULT_SETTINGS.libraryUrl;
      changed = true;
    }
    if (!this.settings.dashboardPositions || typeof this.settings.dashboardPositions !== "object") {
      this.settings.dashboardPositions = {};
      changed = true;
    }
    if (changed) {
      await this.saveSettings(false);
    }
  }
  isRalphLoopEnabled() {
    const configPath = getOpencodeConfigPath();
    if (!fs18.existsSync(configPath)) return false;
    try {
      const raw = fs18.readFileSync(configPath, "utf8");
      const data = JSON.parse(raw);
      return Array.isArray(data == null ? void 0 : data.plugin) && data.plugin.includes("opencode-ralph-loop");
    } catch (e) {
      return false;
    }
  }
  async ensureRalphLoopPluginEnabled() {
    const configPath = getOpencodeConfigPath();
    const configDir = path16.dirname(configPath);
    if (!fs18.existsSync(configDir)) {
      fs18.mkdirSync(configDir, { recursive: true });
    }
    let data = {};
    if (fs18.existsSync(configPath)) {
      try {
        const raw = fs18.readFileSync(configPath, "utf8");
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
    fs18.writeFileSync(configPath, `${JSON.stringify(data, null, 2)}
`, "utf8");
    return { changed: true, configPath };
  }
  getAutoOcMcpPaths() {
    const vaultBasePath = this.app.vault.adapter.basePath || ".";
    return {
      vaultBasePath,
      mcpPath: path16.join(vaultBasePath, ".obsidian", "plugins", "auto-oc", "autooc-mcp.py")
    };
  }
  getAutoOcMcpConfigBlock(requireAvailableUv = false) {
    const { vaultBasePath, mcpPath } = this.getAutoOcMcpPaths();
    const uvBin = requireAvailableUv ? requireUvBin() : resolveUvBinForDisplay();
    return {
      type: "local",
      command: [uvBin, "run", "--script", mcpPath],
      enabled: true,
      env: {
        AUTOOC_VAULT_PATH: vaultBasePath
      }
    };
  }
  ensureAutoOcMcpServerFile() {
    const { mcpPath } = this.getAutoOcMcpPaths();
    fs18.mkdirSync(path16.dirname(mcpPath), { recursive: true });
    fs18.writeFileSync(mcpPath, getAutoOcMcpServerSource(), "utf8");
    return mcpPath;
  }
  async ensureAutoOcMcpEnabled() {
    const configPath = getOpencodeConfigPath();
    const configDir = path16.dirname(configPath);
    if (!fs18.existsSync(configDir)) {
      fs18.mkdirSync(configDir, { recursive: true });
    }
    const mcpPath = this.ensureAutoOcMcpServerFile();
    let data = {};
    if (fs18.existsSync(configPath)) {
      try {
        const raw = fs18.readFileSync(configPath, "utf8");
        data = raw.trim() ? JSON.parse(raw) : {};
      } catch (e) {
        throw new Error(`Could not read valid JSON from ${configPath}`);
      }
    }
    const nextBlock = this.getAutoOcMcpConfigBlock(true);
    const mcp = data.mcp && typeof data.mcp === "object" && !Array.isArray(data.mcp) ? { ...data.mcp } : {};
    const current = mcp["autooc-mcp"];
    const changed = JSON.stringify(current) !== JSON.stringify(nextBlock);
    if (changed) {
      mcp["autooc-mcp"] = nextBlock;
      data.mcp = mcp;
      if (!data.$schema) data.$schema = "https://opencode.ai/config.json";
      fs18.writeFileSync(configPath, `${JSON.stringify(data, null, 2)}
`, "utf8");
    }
    return { changed, configPath, mcpPath };
  }
  async saveSettings(refreshView = true) {
    var _a;
    const basePath = this.app.vault.adapter.basePath;
    if (basePath) {
      const file = path16.join(basePath, this.app.vault.configDir, "plugins", this.manifest.id, "data.json");
      await this.settingsWriter.save(file, () => this.settings);
    } else {
      await this.saveData(this.settings);
    }
    if (refreshView) (_a = this.view) == null ? void 0 : _a.refresh();
  }
  getSecretsEnv(profile = "default") {
    var _a;
    if (!((_a = this.secretStore) == null ? void 0 : _a.isSecureStorageAvailable())) return {};
    try {
      return this.secretStore.getEnv(profile);
    } catch (e) {
      new import_obsidian.Notice(`AutoOC: could not load secrets for environment \u2014 ${String(e)}`);
      return {};
    }
  }
  redactSecrets(text) {
    var _a;
    if (!text || !((_a = this.secretStore) == null ? void 0 : _a.isSecureStorageAvailable())) return text;
    let redacted = text;
    for (const value of this.secretStore.getRedactionValues()) {
      redacted = redacted.split(value).join("[secret:redacted]");
    }
    return redacted;
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
      const comparison = compareVersions(remoteVersion, this.manifest.version);
      const incomplete = this.pluginExecutionLease && !hasCompleteInstalledRelease(path16.dirname(this.pluginExecutionLease.directory), this.manifest.version);
      this.updateAvailable = comparison > 0 || comparison === 0 && !!incomplete;
      (_a = this.view) == null ? void 0 : _a.refresh();
      if (!silent) {
        new import_obsidian.Notice(
          this.updateAvailable ? `AutoOC: install or repair the complete v${remoteVersion} package.` : `AutoOC: already up to date (v${this.manifest.version}).`
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
    if (!this.pluginExecutionLease || this.sharedWorkflowExecution || this.runningProcesses.size || this.runningCodexClients.size || this.workflowDelayControllers.size || this.settings.tasks.some((task) => task.status === "running") || this.settings.workflows.some((workflow) => workflow.status === "running")) {
      new import_obsidian.Notice("AutoOC: finish or reconcile executions before updating.");
      return;
    }
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
      const files = await downloadRelease(`https://raw.githubusercontent.com/${GITHUB_REPO}/${GITHUB_BRANCH}`, this.latestVersion);
      const pluginDir = path16.dirname(this.pluginExecutionLease.directory);
      installRelease({ directory: pluginDir, version: this.latestVersion, files, lease: this.pluginExecutionLease });
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
      this.updateInProgress = !!this.pluginExecutionLease && fs18.existsSync(path16.join(this.pluginExecutionLease.directory, "update-pending.json"));
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
    const args = [bin, "run", "-m", task.model];
    if (!task.forceModel) args.push("--agent", agent);
    args.push("--dangerously-skip-permissions", "--", prompt);
    return args;
  }
  // Human-readable command string for the preview modal
  buildCommand(task) {
    const args = this.buildArgs(task);
    return args.map(commandPreviewArg).join(" ");
  }
  // Quick evaluation via same detached PS + polling mechanism. Used for workflow
  // transition validation prompts.
  async evaluateWithOpencode(prompt, model, cwd) {
    return new Promise((resolve5) => {
      const fs19 = require("fs");
      const path17 = require("path");
      const tmpDir = require("os").tmpdir();
      const evalId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const outFile = path17.join(tmpDir, `autooc-eval-${evalId}.txt`);
      const pidFile = path17.join(tmpDir, `autooc-eval-${evalId}.pid`);
      const bin = resolveOpencodeBin(this.settings.opencodePath);
      const agent = this.getEffectiveAgent();
      const safeCwd = cwd.replace(/'/g, "''");
      const secretEnv = this.getSecretsEnv();
      let settled = false;
      let hiddenProc = null;
      const cleanup = (removeScript = true) => {
        hiddenProc == null ? void 0 : hiddenProc.cleanup(removeScript);
        try {
          fs19.unlinkSync(scriptFile);
        } catch (e) {
        }
        try {
          fs19.unlinkSync(outFile);
        } catch (e) {
        }
        try {
          fs19.unlinkSync(pidFile);
        } catch (e) {
        }
      };
      let launchScript;
      if (isWindows()) {
        launchScript = [
          ...psUtf8Prelude(),
          `$env:USERPROFILE = ${psSingleQuoted(process.env.USERPROFILE || "")}`,
          `$env:APPDATA     = ${psSingleQuoted(process.env.APPDATA || "")}`,
          `$env:LOCALAPPDATA= ${psSingleQuoted(process.env.LOCALAPPDATA || "")}`,
          `$env:PATH        = ${psSingleQuoted(process.env.PATH || "")}`,
          `$env:HOME        = ${psSingleQuoted(process.env.USERPROFILE || "")}`,
          ...buildPowerShellEnvLines(secretEnv),
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
      } else {
        const shEnv = {
          ...secretEnv,
          HOME: process.env.HOME || process.env.USERPROFILE || "",
          PATH: process.env.PATH || ""
        };
        launchScript = [
          `echo $$ > ${shSingleQuoted(pidFile)}`,
          ...buildShEnvLines(shEnv),
          `cd ${shSingleQuoted(cwd)} || exit 1`,
          `bin=${shSingleQuoted(bin)}`,
          `out_tmp="$(mktemp)"`,
          `err_tmp="$(mktemp)"`,
          `"$bin" run -m ${shSingleQuoted(model)} --agent ${shSingleQuoted(agent)} --dangerously-skip-permissions -- ${shSingleQuoted(prompt)} > "$out_tmp" 2> "$err_tmp"`,
          `exit_code=$?`,
          `stdout="$(cat "$out_tmp" 2>/dev/null)"`,
          `stderr="$(cat "$err_tmp" 2>/dev/null)"`,
          `rm -f "$out_tmp" "$err_tmp"`,
          `if [ -n "$stderr" ]; then combined="$(printf '%s
%s' "$stdout" "$stderr")"; else combined="$stdout"; fi`,
          `printf '
DONE:%s
%s' "$exit_code" "$combined" > ${shSingleQuoted(outFile)}`
        ].join("\n");
      }
      const scriptFile = path17.join(tmpDir, `autooc-eval-${evalId}${scriptExt()}`);
      if (isWindows()) writeUtf8BomFile(scriptFile, launchScript);
      else fs19.writeFileSync(scriptFile, launchScript, "utf8");
      hiddenProc = launchHidden(scriptFile, pidFile);
      const startedAt = Date.now();
      const poll = setInterval(() => {
        if (settled) return;
        if (Date.now() - startedAt > 18e4) {
          settled = true;
          clearInterval(poll);
          hiddenProc == null ? void 0 : hiddenProc.kill();
          cleanup(true);
          resolve5({ output: "evaluation timeout", exitCode: -1 });
          return;
        }
        if (!fs19.existsSync(outFile)) return;
        settled = true;
        clearInterval(poll);
        const raw = fs19.readFileSync(outFile, "utf8");
        cleanup(true);
        const doneMatch = raw.match(/^[\s\S]*?\nDONE:(-?\d+)\n([\s\S]*)$/m);
        const exitCode = doneMatch ? parseInt(doneMatch[1], 10) : -1;
        const output = doneMatch ? doneMatch[2].trim() : raw.trim();
        resolve5({ output: this.redactSecrets(normalizeCommandOutput(output)), exitCode });
      }, 2e3);
    });
  }
  // Runs opencode via a fully-detached PowerShell process to avoid Electron's
  // restricted environment killing the child. Output is written to a temp file
  // that the plugin polls every 3 s.
  async runTask(task, onComplete, overrides = {}) {
    var _a, _b, _c, _d, _e, _f, _g;
    if (this.updateInProgress) throw new Error("Plugin update is in progress");
    if (this.sharedWorkflowExecution) throw new Error("Shared workflow owns the execution reservation");
    const idx = this.settings.tasks.findIndex((t) => t.id === task.id);
    if (idx === -1) return;
    if (this.isTaskActive(this.settings.tasks[idx])) {
      new import_obsidian.Notice(`AutoOC: Task "${this.settings.tasks[idx].name}" is already running.`);
      if (onComplete) await onComplete(this.settings.tasks[idx], -1);
      return;
    }
    const effectiveTask = { ...this.settings.tasks[idx], ...overrides };
    if (this.pluginExecutionLease && !onComplete && Object.keys(overrides).length === 0) {
      const vault = this.app.vault.adapter.basePath;
      const workflow = standaloneTaskWorkflow(effectiveTask.id);
      const definition = prepareWorkflowDefinition(workflow, this.settings.tasks, this.settings);
      if (supportsSharedWorkflow(definition, createWorkflowTaskAdapter(definition, vault))) {
        await this.runSharedWorkflow(workflow.id, void 0, false, true, effectiveTask.id);
        return;
      }
    }
    if ((effectiveTask.taskKind || "opencode") === "code") {
      await this.runCodeTask(effectiveTask, onComplete);
      return;
    }
    if (effectiveTask.taskKind === "codex") {
      void this.runCodexTask(effectiveTask, onComplete);
      return;
    }
    if (effectiveTask.taskKind === "copilot") {
      void this.runCopilotTask(effectiveTask, onComplete);
      return;
    }
    const branchWasProvided = Object.prototype.hasOwnProperty.call(effectiveTask, "branch");
    if (branchWasProvided && typeof effectiveTask.branch !== "string") {
      this.settings.tasks[idx].status = "failed";
      this.settings.tasks[idx].lastRun = (/* @__PURE__ */ new Date()).toISOString();
      this.settings.tasks[idx].output = "[AutoOC] Task not launched: branch must be a string when provided.";
      await this.saveSettings();
      new import_obsidian.Notice(`AutoOC: "${task.name}" has an invalid branch.`);
      if (onComplete) await onComplete(this.settings.tasks[idx], -1);
      return;
    }
    if (!((_a = effectiveTask.branch) == null ? void 0 : _a.trim())) delete effectiveTask.branch;
    if (effectiveTask.branch) {
      const { isValidGitBranchName } = require_import_utils();
      if (!isValidGitBranchName(effectiveTask.branch)) {
        this.settings.tasks[idx].status = "failed";
        this.settings.tasks[idx].lastRun = (/* @__PURE__ */ new Date()).toISOString();
        this.settings.tasks[idx].output = "[AutoOC] Task not launched: invalid git branch name.";
        await this.saveSettings();
        new import_obsidian.Notice(`AutoOC: "${task.name}" has an invalid git branch name.`);
        if (onComplete) await onComplete(this.settings.tasks[idx], -1);
        return;
      }
    }
    if (!((_b = effectiveTask.prompt) == null ? void 0 : _b.trim())) {
      this.settings.tasks[idx].status = "failed";
      this.settings.tasks[idx].lastRun = (/* @__PURE__ */ new Date()).toISOString();
      this.settings.tasks[idx].output = "[AutoOC] Task not launched: prompt is empty.";
      await this.saveSettings();
      new import_obsidian.Notice(`AutoOC: "${task.name}" has an empty prompt.`);
      if (onComplete) await onComplete(this.settings.tasks[idx], -1);
      return;
    }
    if (!((_c = effectiveTask.model) == null ? void 0 : _c.trim())) {
      this.settings.tasks[idx].status = "failed";
      this.settings.tasks[idx].lastRun = (/* @__PURE__ */ new Date()).toISOString();
      this.settings.tasks[idx].output = "[AutoOC] Task not launched: model is empty.";
      await this.saveSettings();
      new import_obsidian.Notice(`AutoOC: "${task.name}" has no model selected.`);
      if (onComplete) await onComplete(this.settings.tasks[idx], -1);
      return;
    }
    const vaultBasePath = this.app.vault.adapter.basePath || ".";
    const taskCwd = effectiveTask.workingDirectory || this.settings.workingDirectory || vaultBasePath;
    const secretEnv = this.getSecretsEnv();
    if (effectiveTask.interactiveTerminal) {
      const current = this.settings.tasks[idx];
      current.status = "running";
      current.lastRun = (/* @__PURE__ */ new Date()).toISOString();
      current.output = "[opening interactive OpenCode CLI...]";
      (_d = this.view) == null ? void 0 : _d.resetDashboardTaskShift(task.id);
      await this.saveSettings();
      try {
        let prompt2 = effectiveTask.prompt;
        if (effectiveTask.useRalphLoop) {
          prompt2 = `/ralph-loop ${prompt2}`;
        }
        const bin2 = resolveOpencodeBin(this.settings.opencodePath);
        const agent = this.getEffectiveAgent(effectiveTask.agent);
        const reportInteractiveFailure = async (error) => {
          var _a2;
          const t = this.settings.tasks.find((candidate) => candidate.id === task.id);
          if (!t) return;
          t.status = "failed";
          t.lastRun = (/* @__PURE__ */ new Date()).toISOString();
          t.output = `[AutoOC] Could not open interactive OpenCode CLI: ${String(error)}`;
          (_a2 = this.view) == null ? void 0 : _a2.startGradualSink(task.id);
          await this.saveSettings();
          new import_obsidian.Notice(`AutoOC: could not open CLI task "${task.name}".`);
          if (onComplete) await onComplete(t, -1);
        };
        if (process.platform === "win32") {
          openOpencodeCliLongPromptWindows(bin2, taskCwd, secretEnv, effectiveTask.model, effectiveTask.forceModel ? "" : agent, prompt2);
        } else {
          const args2 = ["-m", effectiveTask.model];
          if (!effectiveTask.forceModel) args2.push("--agent", agent);
          args2.push("--prompt", prompt2);
          openOpencodeCli(bin2, taskCwd, secretEnv, args2, {
            onError: reportInteractiveFailure,
            linuxTerminal: this.settings.linuxTerminal
          });
        }
        current.status = "completed";
        current.output = "[opened interactive OpenCode CLI with preloaded prompt]";
        await this.saveSettings();
        new import_obsidian.Notice(`AutoOC: opened CLI task "${task.name}".`);
        if (onComplete) await onComplete(current, 0);
      } catch (e) {
        current.status = "failed";
        current.output = `[AutoOC] Could not open interactive OpenCode CLI: ${String(e)}`;
        (_e = this.view) == null ? void 0 : _e.startGradualSink(task.id);
        await this.saveSettings();
        new import_obsidian.Notice(`AutoOC: could not open CLI task "${task.name}".`);
        if (onComplete) await onComplete(current, -1);
      }
      return;
    }
    this.settings.tasks[idx].status = "running";
    this.settings.tasks[idx].lastRun = (/* @__PURE__ */ new Date()).toISOString();
    this.settings.tasks[idx].output = "[starting detached process\u2026]\n";
    (_f = this.view) == null ? void 0 : _f.resetDashboardTaskShift(task.id);
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
    const tmpFullPromptFile = require("path").join(tmpDir, `autooc-${task.id}.full-prompt.txt`);
    let fullPromptFile = require("path").resolve(taskCwd, `.autooc-${task.id}.full-prompt.txt`);
    const fs19 = require("fs");
    try {
      fs19.unlinkSync(outFile);
    } catch (e) {
    }
    try {
      fs19.unlinkSync(errFile);
    } catch (e) {
    }
    try {
      fs19.unlinkSync(doneFile);
    } catch (e) {
    }
    try {
      fs19.unlinkSync(pidFile);
    } catch (e) {
    }
    try {
      fs19.unlinkSync(promptFile);
    } catch (e) {
    }
    try {
      fs19.unlinkSync(fullPromptFile);
    } catch (e) {
    }
    try {
      fs19.unlinkSync(tmpFullPromptFile);
    } catch (e) {
    }
    if (preparedPrompt.length > SAFE_CLI_PROMPT_LENGTH || prompt.includes("WORKFLOW HANDOFF CONTEXT")) {
      try {
        fs19.writeFileSync(fullPromptFile, prompt, "utf8");
      } catch (e) {
        fullPromptFile = tmpFullPromptFile;
        fs19.writeFileSync(fullPromptFile, prompt, "utf8");
      }
      const location = fullPromptFile === tmpFullPromptFile ? "temp file" : "workspace file";
      const shortPrompt = `Read the complete task prompt and workflow context from the ${location} at ${fullPromptFile} and follow it exactly.`;
      fs19.writeFileSync(promptFile, shortPrompt, "utf8");
    } else {
      fs19.writeFileSync(promptFile, preparedPrompt, "utf8");
    }
    const safeCwd = taskCwd.replace(/'/g, "''");
    let gitCmds = "";
    if (effectiveTask.branch) {
      if (isWindows()) {
        const safeBranch = psSingleQuoted(effectiveTask.branch);
        if (effectiveTask.createBranch) {
          gitCmds = `$safeBranch = ${safeBranch}; $timestamp = Get-Date -Format "yyyyMMdd-HHmm"; $branchName = $safeBranch + "-$timestamp"; git checkout -b $branchName 2>$null; if ($?) { echo "Created branch $branchName" } else { git checkout $safeBranch }`;
        } else {
          gitCmds = `$safeBranch = ${safeBranch}; git checkout $safeBranch`;
        }
      } else {
        const safeBranch = shSingleQuoted(effectiveTask.branch);
        if (effectiveTask.createBranch) {
          gitCmds = `safe_branch=${safeBranch}
branch_name="$safe_branch-$(date +%Y%m%d-%H%M)"
git checkout -b "$branch_name" 2>/dev/null
if [ $? -eq 0 ]; then echo "Created branch $branch_name"; else git checkout "$safe_branch"; fi`;
        } else {
          gitCmds = `git checkout ${safeBranch}`;
        }
      }
    }
    const effectiveAgent = this.getEffectiveAgent(effectiveTask.agent);
    const launchScript = buildOpenCodeScript({ pidFile, secretEnv, safeCwd, gitCmds, bin, model, effectiveAgent, effectiveTask, promptFile, outFile, errFile, doneFile, taskCwd });
    const scriptFile = require("path").join(tmpDir, `autooc-${task.id}${scriptExt()}`);
    if (isWindows()) writeUtf8BomFile(scriptFile, launchScript);
    else fs19.writeFileSync(scriptFile, launchScript, "utf8");
    let hiddenProc;
    try {
      hiddenProc = launchHidden(scriptFile, pidFile);
    } catch (error) {
      const current = this.settings.tasks[idx];
      current.status = "failed";
      current.lastRun = (/* @__PURE__ */ new Date()).toISOString();
      current.output = `[AutoOC] Task launcher failed: ${String(error)}`;
      await this.saveSettings();
      new import_obsidian.Notice(`AutoOC: could not launch "${task.name}".`);
      if (onComplete) await onComplete(current, -1);
      return;
    }
    let settled = false;
    let cancelled = false;
    let pollHandle = null;
    const wasManuallyStopped = (current) => cancelled || current.output.includes("[task stopped manually]");
    const shouldAbortBeforeFinalMutation = (current) => wasManuallyStopped(current) || current.status !== "running";
    const cleanupTempFiles = () => {
      hiddenProc.cleanup(true);
      try {
        fs19.unlinkSync(promptFile);
      } catch (e) {
      }
      try {
        fs19.unlinkSync(fullPromptFile);
      } catch (e) {
      }
      try {
        fs19.unlinkSync(tmpFullPromptFile);
      } catch (e) {
      }
      try {
        fs19.unlinkSync(outFile);
      } catch (e) {
      }
      try {
        fs19.unlinkSync(errFile);
      } catch (e) {
      }
      try {
        fs19.unlinkSync(doneFile);
      } catch (e) {
      }
      try {
        fs19.unlinkSync(pidFile);
      } catch (e) {
      }
    };
    this.runningProcesses.set(task.id, {
      kill: () => {
        cancelled = true;
        settled = true;
        if (pollHandle) {
          clearInterval(pollHandle);
          pollHandle = null;
        }
        hiddenProc.kill();
        cleanupTempFiles();
        this.runningProcesses.delete(task.id);
      }
    });
    hiddenProc.onError(async (error) => {
      if (settled) return;
      settled = true;
      if (pollHandle) clearInterval(pollHandle);
      const current = this.settings.tasks.find((candidate) => candidate.id === task.id);
      if (!current || current.status !== "running") return;
      current.status = "failed";
      current.lastRun = (/* @__PURE__ */ new Date()).toISOString();
      current.output = `[AutoOC] Task launcher failed: ${String(error)}`;
      cleanupTempFiles();
      this.runningProcesses.delete(task.id);
      await this.saveSettings();
      new import_obsidian.Notice(`AutoOC: could not launch "${task.name}".`);
      if (onComplete) await onComplete(current, -1);
    });
    const timeoutSeconds = (_g = this.settings.taskTimeoutSeconds) != null ? _g : DEFAULT_TASK_TIMEOUT_SECONDS;
    const timeoutEnabled = timeoutSeconds > 0;
    const timeoutMs = timeoutSeconds * 1e3;
    const startedAt = Date.now();
    let timeoutWarned = false;
    pollHandle = setInterval(async () => {
      var _a2, _b2, _c2;
      if (settled || cancelled) return;
      const t = this.settings.tasks.find((x) => x.id === task.id);
      if (!t) {
        settled = true;
        if (pollHandle) clearInterval(pollHandle);
        pollHandle = null;
        cleanupTempFiles();
        this.runningProcesses.delete(task.id);
        return;
      }
      if (t.status !== "running" && !this.runningProcesses.has(task.id)) {
        cancelled = true;
        if (pollHandle) clearInterval(pollHandle);
        pollHandle = null;
        cleanupTempFiles();
        return;
      }
      if (timeoutEnabled && !timeoutWarned && Date.now() - startedAt > timeoutMs) {
        timeoutWarned = true;
        t.output += `
[\u23F1 timeout warning: ${timeoutSeconds}s exceeded; still waiting for final result]`;
        await this.saveSettings(false);
        new import_obsidian.Notice(`AutoOC: \u23F1 "${task.name}" exceeded ${timeoutSeconds}s; still waiting.`);
      }
      if (timeoutEnabled && timeoutWarned && Date.now() - startedAt > timeoutMs + 3e5) {
        if (shouldAbortBeforeFinalMutation(t)) return;
        settled = true;
        if (pollHandle) clearInterval(pollHandle);
        pollHandle = null;
        hiddenProc.kill();
        this.runningProcesses.delete(task.id);
        cleanupTempFiles();
        if (shouldAbortBeforeFinalMutation(t)) return;
        t.status = "failed";
        t.output += `
[\u23F1 timed out after ${timeoutSeconds}s + 300s grace; no completion marker was written]`;
        (_a2 = this.view) == null ? void 0 : _a2.startGradualSink(task.id);
        if (wasManuallyStopped(t)) return;
        await this.saveSettings();
        if (wasManuallyStopped(t)) return;
        if (onComplete) await onComplete(t, -1);
        new import_obsidian.Notice(`AutoOC: \u23F1 "${task.name}" timed out.`);
        return;
      }
      if (!fs19.existsSync(doneFile)) {
        const stdout2 = fs19.existsSync(outFile) ? decodeCommandBuffer(fs19.readFileSync(outFile)) : "";
        const stderr2 = fs19.existsSync(errFile) ? decodeCommandBuffer(fs19.readFileSync(errFile)) : "";
        const normalized2 = this.redactSecrets(formatTaskOutput(stdout2, stderr2));
        if (normalized2) {
          t.output = `${normalized2}
[running\u2026]`;
        } else if (!t.output.includes("[running\u2026]")) {
          t.output += `${t.output ? "\n" : ""}[running\u2026]`;
        }
        (_b2 = this.view) == null ? void 0 : _b2.nudgeDashboardTask(task.id, "up");
        await this.saveSettings(false);
        return;
      }
      if (settled || shouldAbortBeforeFinalMutation(t)) return;
      settled = true;
      if (pollHandle) clearInterval(pollHandle);
      pollHandle = null;
      this.runningProcesses.delete(task.id);
      const stdout = fs19.existsSync(outFile) ? decodeCommandBuffer(fs19.readFileSync(outFile)) : "";
      const stderr = fs19.existsSync(errFile) ? decodeCommandBuffer(fs19.readFileSync(errFile)) : "";
      const exitCodeRaw = fs19.readFileSync(doneFile, "utf8").trim();
      cleanupTempFiles();
      if (shouldAbortBeforeFinalMutation(t)) return;
      const exitCode = /^-?\d+$/.test(exitCodeRaw) ? parseInt(exitCodeRaw, 10) : -1;
      const normalized = this.redactSecrets(formatTaskOutput(stdout, stderr));
      if (shouldAbortBeforeFinalMutation(t)) return;
      t.output = normalized || "(no output)";
      if (exitCode !== 0) {
        t.status = "failed";
        t.output += `
[exit code: ${exitCode}]`;
        (_c2 = this.view) == null ? void 0 : _c2.startGradualSink(task.id);
        new import_obsidian.Notice(`AutoOC: \u274C "${task.name}" failed (code ${exitCode}).`);
      } else {
        t.status = task.scheduleType === "daily" || task.scheduleType === "weekly" || task.scheduleType === "monthly" || task.scheduleType === "interval" ? "pending" : "completed";
        new import_obsidian.Notice(`AutoOC: \u2705 "${task.name}" completed.`);
      }
      if (this.settings.logsEnabled) {
        saveLogToFile(vaultBasePath, task.id, t.output);
        cleanupOldLogs(vaultBasePath, task.id, this.settings.maxLogsPerTask);
        cleanupLogsByAge(vaultBasePath, task.id, this.settings.logRetentionDays);
      }
      if (wasManuallyStopped(t)) return;
      await this.saveSettings();
      if (wasManuallyStopped(t)) return;
      if (onComplete) {
        await onComplete(t, exitCode);
      }
    }, 3e3);
  }
  async runCopilotTask(task, onComplete) {
    var _a, _b, _c, _d, _e;
    const findCurrent = () => this.settings.tasks.find((candidate) => candidate.id === task.id);
    let current = findCurrent();
    if (!current) return;
    const vaultBasePath = this.app.vault.adapter.basePath || ".";
    const cwd = task.workingDirectory || this.settings.workingDirectory || vaultBasePath;
    const model = ((_a = task.model) == null ? void 0 : _a.trim()) || this.settings.defaultCopilotModel || "";
    const startedAt = (/* @__PURE__ */ new Date()).toISOString();
    let cancelled = false;
    let client;
    let saveTimer;
    let exitCode = -1;
    const controller = { kill: () => {
      cancelled = true;
      client == null ? void 0 : client.dispose();
    } };
    current.status = "running";
    current.lastRun = startedAt;
    current.output = "[starting GitHub Copilot CLI task\u2026]\n";
    this.runningProcesses.set(task.id, controller);
    (_b = this.view) == null ? void 0 : _b.resetDashboardTaskShift(task.id);
    try {
      await this.saveSettings();
      if (cancelled) return;
      const validationError = getCopilotTaskValidationError(task);
      if (validationError) throw new Error(validationError);
      if (!((_c = task.prompt) == null ? void 0 : _c.trim())) throw new Error("Copilot task prompt is empty.");
      client = this.createCopilotClient(cwd, (output) => {
        const active = findCurrent();
        if (cancelled || !active || active.status !== "running") return;
        active.output = this.redactSecrets(output);
        if (!saveTimer) {
          saveTimer = setTimeout(() => {
            saveTimer = void 0;
            const activeTask = findCurrent();
            if (cancelled || !activeTask || activeTask.status !== "running") return;
            this.emitTaskUpdated(activeTask);
            void this.saveSettings(false);
          }, 750);
        }
      });
      const result = await client.run(task.prompt, {
        model,
        allowAllTools: task.copilotAllowAllTools === true,
        timeoutMs: Math.max(0, (_d = this.settings.taskTimeoutSeconds) != null ? _d : DEFAULT_TASK_TIMEOUT_SECONDS) * 1e3,
        env: this.getSecretsEnv()
      });
      current = findCurrent();
      if (cancelled || !current || current.status !== "running") return;
      exitCode = result.exitCode;
      current.output = this.redactSecrets(result.output || (result.exitCode === 0 ? "(no output)" : ""));
      if (result.exitCode !== 0) {
        current.output += `
[Copilot error: ${this.redactSecrets(result.error || `exit code ${result.exitCode}`)}]`;
      }
      current.status = exitCode === 0 ? ["daily", "weekly", "monthly", "interval"].includes(task.scheduleType) ? "pending" : "completed" : "failed";
    } catch (error) {
      current = findCurrent();
      if (cancelled || !current) return;
      current.status = "failed";
      current.output = `${current.output || ""}
[Copilot error: ${this.redactSecrets(String(error))}]`;
    } finally {
      if (saveTimer) clearTimeout(saveTimer);
      if (this.runningProcesses.get(task.id) === controller) this.runningProcesses.delete(task.id);
      client == null ? void 0 : client.dispose();
    }
    current = findCurrent();
    if (!current || cancelled) return;
    if (current.status === "failed") (_e = this.view) == null ? void 0 : _e.startGradualSink(task.id);
    if (this.settings.logsEnabled) {
      const metadata = `[engine: copilot]
[model: ${this.redactSecrets(model || "default")}]
[started: ${startedAt}]
[finished: ${(/* @__PURE__ */ new Date()).toISOString()}]`;
      saveLogToFile(vaultBasePath, task.id, `${metadata}

${current.output}`);
      cleanupOldLogs(vaultBasePath, task.id, this.settings.maxLogsPerTask);
      cleanupLogsByAge(vaultBasePath, task.id, this.settings.logRetentionDays);
    }
    await this.saveSettings();
    this.emitTaskUpdated(current);
    new import_obsidian.Notice(`AutoOC: ${exitCode === 0 ? "\u2705" : "\u274C"} Copilot task "${task.name}" ${exitCode === 0 ? "completed" : "failed"}.`);
    if (onComplete) await onComplete(current, exitCode);
  }
  createCopilotClient(cwd, onOutput) {
    return new CopilotCliClient(resolveCopilotBin(this.settings.copilotPath), cwd, onOutput);
  }
  async runCodexTask(task, onComplete) {
    var _a, _b, _c, _d;
    const idx = this.settings.tasks.findIndex((candidate) => candidate.id === task.id);
    if (idx === -1) return;
    const current = this.settings.tasks[idx];
    if (!((_a = task.prompt) == null ? void 0 : _a.trim())) {
      current.status = "failed";
      current.lastRun = (/* @__PURE__ */ new Date()).toISOString();
      current.output = "[AutoOC] Codex task not launched: prompt is empty.";
      await this.saveSettings();
      if (onComplete) await onComplete(current, -1);
      return;
    }
    const vaultBasePath = this.app.vault.adapter.basePath || ".";
    const taskCwd = task.workingDirectory || this.settings.workingDirectory || vaultBasePath;
    const model = this.getEffectiveCodexModel(task.model);
    const reasoningEffort = task.reasoningEffort || this.settings.defaultCodexReasoningEffort || "medium";
    const startedAt = (/* @__PURE__ */ new Date()).toISOString();
    let cancelled = false;
    let saveTimer = null;
    let codexLogOutput = "";
    current.status = "running";
    current.lastRun = startedAt;
    current.output = "[starting Codex task\u2026]\n";
    delete current.pendingCodexApproval;
    (_b = this.view) == null ? void 0 : _b.resetDashboardTaskShift(task.id);
    await this.saveSettings();
    new import_obsidian.Notice(`AutoOC: running Codex task "${task.name}"\u2026`);
    const scheduleSave = () => {
      if (saveTimer) return;
      saveTimer = setTimeout(() => {
        saveTimer = null;
        void this.saveSettings(false).catch(() => {
          new import_obsidian.Notice("AutoOC: could not persist Codex progress; previous settings were preserved.");
        });
      }, 1e4);
    };
    const client = this.createCodexClient(taskCwd, {
      onStarted: ({ threadId, turnId }) => {
        current.lastCodexThreadId = threadId;
        current.lastCodexTurnId = turnId;
        if (task.interactiveTerminal) {
          const bin = resolveCodexBin(this.settings.codexPath);
          openCodexApp(bin, taskCwd, (error) => {
            new import_obsidian.Notice(`AutoOC: Codex started, but ChatGPT could not be opened: ${String(error)}`);
          });
          new import_obsidian.Notice(`AutoOC: opened ChatGPT / Codex task "${task.name}".`);
        }
        scheduleSave();
      },
      onOutput: (output) => {
        var _a2;
        if (cancelled || current.status !== "running") return;
        current.output = this.redactSecrets(output || "[Codex is working\u2026]");
        (_a2 = this.view) == null ? void 0 : _a2.nudgeDashboardTask(task.id, "up");
        this.emitTaskUpdated(current);
        scheduleSave();
      },
      onApproval: (approval) => {
        if (cancelled || current.status !== "running") return;
        current.pendingCodexApproval = {
          requestId: approval.requestId,
          kind: approval.kind,
          summary: approval.summary
        };
        current.output += `${current.output ? "\n" : ""}[waiting for approval: ${approval.summary}]`;
        void this.saveSettings(false);
        this.emitTaskUpdated(current);
        new import_obsidian.Notice(`AutoOC: Codex task "${task.name}" needs approval.`);
      }
    });
    this.runningCodexClients.set(task.id, client);
    this.runningProcesses.set(task.id, {
      kill: () => {
        cancelled = true;
        if (saveTimer) clearTimeout(saveTimer);
        void client.interrupt();
        this.runningCodexClients.delete(task.id);
        this.runningProcesses.delete(task.id);
      }
    });
    let exitCode = -1;
    try {
      const result = await executeCodexTask(client, {
        prompt: task.prompt,
        model,
        reasoningEffort,
        interactive: task.interactiveTerminal
      });
      if (cancelled || current.status !== "running") return;
      current.lastCodexThreadId = result.threadId;
      current.lastCodexTurnId = result.turnId;
      delete current.pendingCodexApproval;
      const successful = result.status === "completed";
      exitCode = successful ? 0 : -1;
      const finalOutput = this.redactSecrets(result.output || result.error || "(no output)");
      const metadata = [
        `[engine: codex]`,
        `[model: ${model || "default"}]`,
        `[reasoning: ${reasoningEffort || "default"}]`,
        `[thread: ${result.threadId}]`,
        `[turn: ${result.turnId}]`
      ].join("\n");
      current.output = finalOutput;
      if (successful) {
        current.status = task.scheduleType === "daily" || task.scheduleType === "weekly" || task.scheduleType === "monthly" || task.scheduleType === "interval" ? "pending" : "completed";
        new import_obsidian.Notice(`AutoOC: \u2705 Codex task "${task.name}" completed.`);
      } else {
        current.status = "failed";
        current.output += `
[Codex status: ${result.status}]`;
        (_c = this.view) == null ? void 0 : _c.startGradualSink(task.id);
        new import_obsidian.Notice(`AutoOC: \u274C Codex task "${task.name}" failed.`);
      }
      codexLogOutput = `${metadata}
[started: ${startedAt}]
[finished: ${(/* @__PURE__ */ new Date()).toISOString()}]

${this.redactSecrets(result.transcript || current.output)}`;
    } catch (error) {
      if (cancelled || current.output.includes("[task stopped manually]")) return;
      current.status = "failed";
      delete current.pendingCodexApproval;
      current.output = `${current.output || ""}
[Codex error: ${String(error)}]`.trim();
      const ids = client.getIds();
      codexLogOutput = `[engine: codex]
[model: ${model || "default"}]
[reasoning: ${reasoningEffort || "default"}]
[thread: ${ids.threadId || "unavailable"}]
[turn: ${ids.turnId || "unavailable"}]
[started: ${startedAt}]
[finished: ${(/* @__PURE__ */ new Date()).toISOString()}]

${current.output}`;
      (_d = this.view) == null ? void 0 : _d.startGradualSink(task.id);
      new import_obsidian.Notice(`AutoOC: \u274C Codex task "${task.name}" failed.`);
    } finally {
      if (saveTimer) clearTimeout(saveTimer);
      this.runningCodexClients.delete(task.id);
      this.runningProcesses.delete(task.id);
      client.dispose();
    }
    if (this.settings.logsEnabled) {
      saveLogToFile(vaultBasePath, task.id, codexLogOutput || current.output);
      cleanupOldLogs(vaultBasePath, task.id, this.settings.maxLogsPerTask);
      cleanupLogsByAge(vaultBasePath, task.id, this.settings.logRetentionDays);
    }
    await this.saveSettings();
    this.emitTaskUpdated(current);
    if (onComplete) await onComplete(current, exitCode);
  }
  createCodexClient(cwd, callbacks) {
    return new CodexAppServerClient(resolveCodexBin(this.settings.codexPath), cwd, callbacks);
  }
  async resolveCodexApproval(taskId, approved) {
    const task = this.settings.tasks.find((candidate) => candidate.id === taskId);
    const execution = task == null ? void 0 : task.runtimeExecution;
    if (this.sharedWorkflowExecution && execution && (task == null ? void 0 : task.pendingCodexApproval)) {
      const directory = path16.join(this.app.vault.adapter.basePath, ".obsidian", "plugins", "auto-oc", "runtime");
      answerWorkflowApproval(directory, execution.runId, String(task.pendingCodexApproval.requestId), approved);
      return;
    }
    const client = this.runningCodexClients.get(taskId);
    const approval = task == null ? void 0 : task.pendingCodexApproval;
    if (!task || !client || !approval) {
      new import_obsidian.Notice("AutoOC: this Codex approval is no longer active.");
      return;
    }
    if (!client.resolveApproval(approval.requestId, approved)) {
      new import_obsidian.Notice("AutoOC: could not answer the Codex approval.");
      return;
    }
    task.output += `
[approval ${approved ? "accepted" : "rejected"}]`;
    delete task.pendingCodexApproval;
    await this.saveSettings(false);
    this.emitTaskUpdated(task);
  }
  async runCodeTask(task, onComplete) {
    var _a, _b;
    const idx = this.settings.tasks.findIndex((t) => t.id === task.id);
    if (idx === -1) return;
    const current = this.settings.tasks[idx];
    const code = current.code || current.prompt || "";
    if (!code.trim()) {
      current.status = "failed";
      current.lastRun = (/* @__PURE__ */ new Date()).toISOString();
      current.output = "[AutoOC] Code task not launched: code is empty.";
      await this.saveSettings();
      new import_obsidian.Notice(`AutoOC: "${current.name}" has empty code.`);
      if (onComplete) await onComplete(current, -1);
      return;
    }
    const vaultBasePath = this.app.vault.adapter.basePath || ".";
    current.status = "running";
    current.lastRun = (/* @__PURE__ */ new Date()).toISOString();
    current.output = "[running code task...]\n";
    (_a = this.view) == null ? void 0 : _a.resetDashboardTaskShift(current.id);
    await this.saveSettings();
    new import_obsidian.Notice(`AutoOC: running code task "${current.name}"...`);
    try {
      const out = executeCodeTask({
        ...current,
        code,
        vaultBase: vaultBasePath,
        cwd: current.workingDirectory || this.settings.workingDirectory || vaultBasePath,
        log: (...args) => {
          current.output += args.map(String).join(" ") + "\n";
        }
      });
      current.output = (current.output || "") + out;
      current.status = current.scheduleType === "daily" || current.scheduleType === "weekly" || current.scheduleType === "monthly" || current.scheduleType === "interval" ? "pending" : "completed";
      new import_obsidian.Notice(`AutoOC: \u2705 code task "${current.name}" completed.`);
      if (this.settings.logsEnabled) {
        saveLogToFile(vaultBasePath, current.id, current.output || "(no output)");
        cleanupOldLogs(vaultBasePath, current.id, this.settings.maxLogsPerTask);
        cleanupLogsByAge(vaultBasePath, current.id, this.settings.logRetentionDays);
      }
      await this.saveSettings();
      if (onComplete) await onComplete(current, 0);
    } catch (err) {
      current.status = "failed";
      current.output = (current.output || "") + `[code error: ${String(err)}]`;
      (_b = this.view) == null ? void 0 : _b.startGradualSink(current.id);
      if (this.settings.logsEnabled) {
        saveLogToFile(vaultBasePath, current.id, current.output);
        cleanupOldLogs(vaultBasePath, current.id, this.settings.maxLogsPerTask);
        cleanupLogsByAge(vaultBasePath, current.id, this.settings.logRetentionDays);
      }
      await this.saveSettings();
      new import_obsidian.Notice(`AutoOC: \u274C code task "${current.name}" failed.`);
      if (onComplete) await onComplete(current, -1);
    }
  }
  async killTask(id) {
    var _a;
    if (((_a = this.sharedWorkflowExecution) == null ? void 0 : _a.taskId) === id) {
      this.sharedWorkflowExecution.controller.abort();
      return;
    }
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
  async killWorkflow(id) {
    var _a, _b;
    if (((_a = this.sharedWorkflowExecution) == null ? void 0 : _a.workflowId) === id) {
      this.sharedWorkflowExecution.controller.abort();
      return;
    }
    const wf = this.settings.workflows.find((w) => w.id === id);
    if (!wf) return;
    this.stoppingWorkflows.add(id);
    (_b = this.workflowDelayControllers.get(id)) == null ? void 0 : _b.abort();
    if (wf.status === "running" && wf.currentStep >= 0 && wf.currentStep < wf.steps.length) {
      const currentStep = wf.steps[wf.currentStep];
      const currentTask = this.settings.tasks.find((t) => t.id === (currentStep == null ? void 0 : currentStep.taskId));
      if ((currentTask == null ? void 0 : currentTask.status) === "running") {
        await this.killTask(currentTask.id);
      }
    }
    if (wf.status === "running") {
      wf.status = "failed";
      const stepLabel = wf.currentStep >= 0 ? ` at step ${wf.currentStep + 1}/${wf.steps.length}` : "";
      wf.steps.forEach((step) => {
        const task = this.settings.tasks.find((t) => t.id === step.taskId);
        if (task && task.status === "running") {
          task.status = "failed";
          task.output += "\n[workflow stopped manually]";
        }
      });
      await this.saveSettings();
      new import_obsidian.Notice(`AutoOC: \u23F9 Workflow "${wf.name}" stopped${stepLabel}.`);
    }
    this.stoppingWorkflows.delete(id);
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
    this.syncVisualBuilders();
  }
  async duplicateTask(task) {
    const copy = {
      ...task,
      id: generateId(),
      name: `${task.name} (copy)`,
      status: "pending",
      lastRun: "",
      output: "",
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      lastCodexThreadId: void 0,
      lastCodexTurnId: void 0,
      pendingCodexApproval: void 0
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
  workflowTaskIds(workflow) {
    return Array.from(new Set(workflow.steps.map((step) => step.taskId).filter(Boolean)));
  }
  workflowTaskIdsUsedOnlyBy(workflowId) {
    const workflow = this.settings.workflows.find((w) => w.id === workflowId);
    if (!workflow) return [];
    const taskIds = this.workflowTaskIds(workflow);
    return taskIds.filter((taskId) => !this.settings.workflows.some(
      (other) => other.id !== workflowId && other.steps.some((step) => step.taskId === taskId)
    ));
  }
  async deleteWorkflow(id, deleteWorkflowTasks = false) {
    const taskIdsToDelete = deleteWorkflowTasks ? this.workflowTaskIdsUsedOnlyBy(id) : [];
    if (taskIdsToDelete.length > 0) {
      this.settings.tasks = this.settings.tasks.filter((task) => !taskIdsToDelete.includes(task.id));
    }
    this.settings.workflows = this.settings.workflows.filter((w) => w.id !== id);
    await this.saveSettings();
    this.syncVisualBuilders();
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
  ensureUniqueTaskName(name) {
    const existing = new Set(this.settings.tasks.map((t) => t.name));
    let candidate = name;
    let i = 1;
    while (existing.has(candidate)) {
      candidate = `${name} (imported ${i})`;
      i++;
    }
    return candidate;
  }
  ensureUniqueWorkflowName(name) {
    const existing = new Set(this.settings.workflows.map((w) => w.name));
    let candidate = name;
    let i = 1;
    while (existing.has(candidate)) {
      candidate = `${name} (imported ${i})`;
      i++;
    }
    return candidate;
  }
  buildExportJson(tasks, workflows, name, description) {
    const taskExportIdMap = /* @__PURE__ */ new Map();
    const exportTasks = tasks.map((t, i) => {
      const exportId = `task-${i}`;
      taskExportIdMap.set(t.id, exportId);
      return toExportTask(t, exportId);
    });
    const exportWorkflows = workflows.map(
      (w, i) => toExportWorkflow(w, `wf-${i}`, taskExportIdMap)
    );
    const data = {
      autoOCExport: {
        schemaVersion: tasks.some((task) => task.taskKind === "copilot") ? "1.6.0" : "1.5.0",
        exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
        pluginVersion: this.manifest.version,
        name,
        description
      },
      tasks: exportTasks,
      workflows: exportWorkflows
    };
    return JSON.stringify(data, null, 2);
  }
  async exportToFile(tasks, workflows, name, description) {
    const json = this.buildExportJson(tasks, workflows, name, description);
    try {
      const electron = window.require("electron");
      const result = await electron.remote.dialog.showSaveDialog({
        defaultPath: `autooc-export-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.json`,
        filters: [{ name: "JSON files", extensions: ["json"] }],
        title: "Export AutoOC tasks and workflows"
      });
      if (result.canceled || !result.filePath) return;
      fs18.writeFileSync(result.filePath, json, "utf8");
      new import_obsidian.Notice(
        `AutoOC: exported ${tasks.length} task(s) and ${workflows.length} workflow(s).`
      );
    } catch (e) {
      new import_obsidian.Notice(`AutoOC: export failed \u2014 ${String(e)}`);
    }
  }
  buildExportSelectionPayload(selectedTaskIds, selectedWorkflowIds) {
    const tasks = this.settings.tasks.filter((t) => selectedTaskIds.has(t.id));
    const workflows = this.settings.workflows.filter((w) => selectedWorkflowIds.has(w.id));
    const referencedTaskIds = /* @__PURE__ */ new Set();
    for (const wf of workflows) {
      for (const step of wf.steps) {
        if (step.taskId) referencedTaskIds.add(step.taskId);
      }
    }
    const autoIncludedTasks = this.settings.tasks.filter(
      (t) => referencedTaskIds.has(t.id) && !selectedTaskIds.has(t.id)
    );
    return {
      tasks: [...tasks, ...autoIncludedTasks],
      workflows,
      referencedTaskIds
    };
  }
  async importFromFile(filePath) {
    const raw = fs18.readFileSync(filePath, "utf8");
    const data = JSON.parse(raw);
    return this.importFromData(data);
  }
  async importFromData(data) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r, _s, _t, _u, _v;
    if (!data.autoOCExport) {
      throw new Error("Invalid AutoOC export file (missing autoOCExport header).");
    }
    const sv = data.autoOCExport.schemaVersion;
    if (sv !== "1.0" && sv !== "1.4.0" && sv !== "1.5.0" && sv !== "1.6.0") {
      throw new Error(`Unsupported AutoOC export schema version: ${sv}.`);
    }
    const exportIdToTaskId = /* @__PURE__ */ new Map();
    let tasksImported = 0;
    for (const et of data.tasks || []) {
      const importedTaskKind = et.taskKind || "opencode";
      if (!["opencode", "codex", "copilot", "code"].includes(importedTaskKind)) {
        throw new Error(`Unsupported taskKind: ${String(importedTaskKind)}.`);
      }
      const copilotError = getCopilotTaskValidationError(et);
      if (copilotError) throw new Error(`Task "${et.name}": ${copilotError}`);
      if (et.reasoningEffort !== void 0 && (importedTaskKind !== "codex" || typeof et.reasoningEffort !== "string" || !et.reasoningEffort.trim())) {
        throw new Error(`Task "${et.name}" has reasoningEffort outside a Codex task.`);
      }
      if (importedTaskKind === "code" && et.interactiveTerminal === true) {
        throw new Error(`Task "${et.name}" cannot combine Code with interactiveTerminal.`);
      }
      const task = {
        id: generateId(),
        taskKind: importedTaskKind,
        requiresAutoOCSecrets: et.requiresAutoOCSecrets,
        name: this.ensureUniqueTaskName(et.name),
        area: (_a = et.area) != null ? _a : "",
        prompt: importedTaskKind === "code" ? et.code || et.prompt || "" : et.prompt,
        model: importedTaskKind === "code" ? "" : importedTaskKind === "copilot" ? this.settings.defaultCopilotModel || "" : importedTaskKind === "codex" ? this.getEffectiveCodexModel() : this.getEffectiveDefaultModel(),
        copilotAllowAllTools: importedTaskKind === "copilot" ? et.copilotAllowAllTools === true : void 0,
        agent: importedTaskKind === "opencode" ? this.getEffectiveAgent(et.agent) : "",
        reasoningEffort: importedTaskKind === "codex" ? et.reasoningEffort || this.settings.defaultCodexReasoningEffort : void 0,
        useRalphLoop: importedTaskKind === "opencode" ? (_b = et.useRalphLoop) != null ? _b : false : false,
        forceModel: importedTaskKind === "opencode" ? (_c = et.forceModel) != null ? _c : false : false,
        scheduleType: (_d = et.scheduleType) != null ? _d : "manual",
        scheduleTime: (_e = et.scheduleTime) != null ? _e : nowTimeString(),
        scheduleDate: (_f = et.scheduleDate) != null ? _f : "",
        scheduleDays: (_g = et.scheduleDays) != null ? _g : [],
        scheduleMonthDays: (_h = et.scheduleMonthDays) != null ? _h : [],
        scheduleIntervalValue: (_i = et.scheduleIntervalValue) != null ? _i : 10,
        scheduleIntervalUnit: (_j = et.scheduleIntervalUnit) != null ? _j : "minutes",
        status: "pending",
        lastRun: "",
        output: "",
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        workingDirectory: et.workingDirectory,
        branch: importedTaskKind === "opencode" ? et.branch : "",
        createBranch: importedTaskKind === "opencode" ? et.createBranch : false,
        interactiveTerminal: importedTaskKind === "code" ? void 0 : (_k = et.interactiveTerminal) != null ? _k : importedTaskKind === "opencode" ? this.settings.defaultInteractiveTerminal : false,
        code: et.code,
        codeLang: et.codeLang,
        codeInputVar: et.codeInputVar,
        codeOutputVar: et.codeOutputVar,
        codeAllowVault: et.codeAllowVault,
        codeAllowFiles: et.codeAllowFiles,
        codeAllowTerminal: et.codeAllowTerminal
      };
      this.settings.tasks.push(task);
      exportIdToTaskId.set(et.exportId, task.id);
      tasksImported++;
    }
    let workflowsImported = 0;
    for (const ew of data.workflows || []) {
      const exportIdToStepId = /* @__PURE__ */ new Map();
      const steps = [];
      for (const s of ew.steps || []) {
        const stepKind = s.stepKind || "task";
        const importedTransitions = s.transitions;
        const hasImportedTransitions = Object.prototype.hasOwnProperty.call(s, "transitions");
        const step = {
          id: s.id || generateId(),
          stepKind,
          name: s.name,
          area: s.area || ew.area || "",
          taskId: s.taskExportId ? exportIdToTaskId.get(s.taskExportId) : void 0,
          transitionMode: s.transitionMode,
          evaluatePrompt: s.evaluatePrompt,
          forceContinue: s.forceContinue,
          delayValue: s.delayValue,
          delayUnit: s.delayUnit,
          code: s.code,
          codeLang: s.codeLang,
          codeInputVar: s.codeInputVar,
          codeOutputVar: s.codeOutputVar,
          codeAllowVault: s.codeAllowVault,
          codeAllowFiles: s.codeAllowFiles,
          codeAllowTerminal: s.codeAllowTerminal,
          transitions: !hasImportedTransitions ? void 0 : Array.isArray(importedTransitions) ? importedTransitions : importedTransitions && typeof importedTransitions === "object" && typeof importedTransitions.toStepId === "string" ? [importedTransitions] : [],
          position: s.position
        };
        steps.push(step);
        exportIdToStepId.set(step.id, step.id);
      }
      const { applyLegacyLinearTransitions } = require_import_utils();
      applyLegacyLinearTransitions(steps);
      if (steps.length === 0) continue;
      const workflow = {
        id: generateId(),
        name: this.ensureUniqueWorkflowName(ew.name),
        area: (_l = ew.area) != null ? _l : "",
        description: (_m = ew.description) != null ? _m : "",
        steps,
        status: "pending",
        currentStep: -1,
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        handoffBranch: (_n = ew.handoffBranch) != null ? _n : false,
        handoffOutput: (_o = ew.handoffOutput) != null ? _o : true,
        scheduleType: (_p = ew.scheduleType) != null ? _p : "manual",
        scheduleTime: (_q = ew.scheduleTime) != null ? _q : nowTimeString(),
        scheduleDate: (_r = ew.scheduleDate) != null ? _r : "",
        scheduleDays: (_s = ew.scheduleDays) != null ? _s : [],
        scheduleMonthDays: (_t = ew.scheduleMonthDays) != null ? _t : [],
        scheduleIntervalValue: (_u = ew.scheduleIntervalValue) != null ? _u : 10,
        scheduleIntervalUnit: (_v = ew.scheduleIntervalUnit) != null ? _v : "minutes"
      };
      this.settings.workflows.push(workflow);
      workflowsImported++;
    }
    await this.saveSettings();
    return { tasksImported, workflowsImported };
  }
  async applyWorkflowCheckpoint(checkpoint, expectedRunId, activelyExecuting = false) {
    const index = this.settings.workflows.findIndex((w) => w.id === checkpoint.workflowId);
    if (index < 0) throw new Error("Workflow for execution progress is absent");
    const projected = projectWorkflowProgress(this.settings.workflows[index], this.settings.tasks, this.settings, checkpoint, expectedRunId, activelyExecuting);
    this.settings.workflows[index] = projected;
    await this.saveSettings();
  }
  async runWorkflow(workflow) {
    if (this.updateInProgress) throw new Error("Plugin update is in progress");
    if (this.sharedWorkflowExecution) throw new Error("Shared workflow owns the execution reservation");
    const idx = this.settings.workflows.findIndex((w) => w.id === workflow.id);
    if (idx === -1) return;
    const wf = this.settings.workflows[idx];
    if (this.settings.workflows.some((item) => {
      const execution = item.runtimeExecution;
      return execution && !["completed", "failed"].includes(execution.phase);
    })) {
      new import_obsidian.Notice("AutoOC: a durable execution requires resume or reconciliation before starting a workflow.");
      return;
    }
    if (wf.status === "running") {
      new import_obsidian.Notice(`AutoOC: Workflow "${wf.name}" is already running.`);
      return;
    }
    if (wf.steps.length === 0) {
      new import_obsidian.Notice(`AutoOC: Workflow "${wf.name}" has no steps.`);
      return;
    }
    for (let i = 0; i < wf.steps.length; i++) {
      const step = wf.steps[i];
      if (step.stepKind === "task" && !this.settings.tasks.find((t) => t.id === step.taskId)) {
        new import_obsidian.Notice(`AutoOC: Workflow "${wf.name}" \u2014 step ${i + 1} references a deleted task.`);
        return;
      }
    }
    if (this.pluginExecutionLease) {
      const definition = prepareWorkflowDefinition(wf, this.settings.tasks, this.settings);
      const vault = this.app.vault.adapter.basePath;
      if (supportsSharedWorkflow(definition, createWorkflowTaskAdapter(definition, vault))) {
        await this.runSharedWorkflow(wf.id, void 0, false, true);
        return;
      }
    }
    this.workflowRuntime = this.workflowRuntime || /* @__PURE__ */ new Map();
    this.workflowRuntime.set(wf.id, {
      stepOutputs: /* @__PURE__ */ new Map(),
      stepIndex: 0
    });
    wf.status = "running";
    wf.currentStep = 0;
    wf.lastRun = (/* @__PURE__ */ new Date()).toISOString();
    wf.steps.forEach((step) => {
      step.status = "pending";
      step.output = "";
      step.lastRun = "";
    });
    await this.saveSettings();
    new import_obsidian.Notice(`AutoOC: \u26A1 Starting workflow "${wf.name}" (${wf.steps.length} steps)...`);
    const entryStep = this.findEntryStep(wf);
    if (!entryStep) {
      wf.status = "failed";
      await this.saveSettings();
      new import_obsidian.Notice(`AutoOC: Workflow "${wf.name}" has no reachable entry step.`);
      return;
    }
    await this.runWorkflowStepById(wf.id, entryStep.id);
  }
  // Find the entry step: a step that has no incoming transitions from any other
  // step in the workflow. If multiple are candidates, picks the one with the
  // smallest position.x (visual order). Falls back to the first step.
  findEntryStep(wf) {
    return findWorkflowEntry(wf.steps);
  }
  async runWorkflowStepById(workflowId, stepId) {
    if (this.updateInProgress) throw new Error("Plugin update is in progress");
    const wfIdx = this.settings.workflows.findIndex((w) => w.id === workflowId);
    if (wfIdx === -1) return;
    const wf = this.settings.workflows[wfIdx];
    if (!wf || wf.status !== "running") return;
    const stepIdx = wf.steps.findIndex((s) => s.id === stepId);
    if (stepIdx === -1) {
      wf.status = "failed";
      new import_obsidian.Notice(`AutoOC: Workflow "${wf.name}" \u2014 step ${stepId} not found.`);
      await this.saveSettings();
      return;
    }
    if (this.stoppingWorkflows.has(workflowId)) return;
    await this.runWorkflowStep(wfIdx, stepIdx);
  }
  // Resolve the next step from a list of transitions. For each transition:
  // - "force" / "default": follow unconditionally if the previous step
  //   succeeded (force ignores failure, default requires success).
  // - "eval": call the model to decide.
  // - "conditional": evaluate the JS `condition` against the runtime
  //   context (input = last output, outputs = map of stepId → output).
  // Returns the target step id, or null if the workflow should stop.
  async resolveNextStep(wf, currentStep, currentStepIndex, lastOutput, lastSucceeded, transitions) {
    return resolveWorkflowTransition(wf.steps, currentStepIndex, lastOutput, lastSucceeded, transitions, this.getRuntimeOutputs(wf.id), {
      evaluate: async (transition, target, input) => {
        var _a, _b;
        new import_obsidian.Notice(`AutoOC: Evaluating transition for "${wf.name}" \u2192 ${target.id}...`);
        const cwd = this.settings.workingDirectory || this.app.vault.adapter.basePath || ".";
        const model = ((_a = this.availableModels[0]) == null ? void 0 : _a.value) || this.settings.defaultModel || "opencode/default";
        const prompt = ((_b = transition.evaluatePrompt) == null ? void 0 : _b.trim()) || "Did the previous step complete successfully? If it is safe to continue, reply YES. Otherwise reply NO.";
        const result = await this.evaluateWithOpencode(`${prompt}

Previous step output:
---
${input}
---

Reply ONLY with YES or NO.`, model, cwd);
        return result.output;
      },
      onError: (kind, error) => {
        new import_obsidian.Notice(`AutoOC: ${kind} error \u2014 ${String(error)}`);
      }
    });
  }
  getRuntimeOutputs(workflowId) {
    const rt = this.workflowRuntime;
    if (!rt) return {};
    const ctx = rt.get(workflowId);
    if (!ctx) return {};
    const out = {};
    for (const [k, v] of ctx.stepOutputs.entries()) out[k] = v;
    return out;
  }
  // Run a JavaScript condition expression against a runtime context.
  // Variables exposed: input (last step output), outputs (map of stepId → output),
  // workflow (object with name/id), step (current step), require (Node require).
  evaluateCondition(expression, input, outputs) {
    return evaluateWorkflowCondition(expression, input, outputs);
  }
  async runWorkflowStep(wfIdx, stepIndex) {
    if (this.updateInProgress) throw new Error("Plugin update is in progress");
    const wf = this.settings.workflows[wfIdx];
    if (!wf || wf.status !== "running") return;
    const step = wf.steps[stepIndex];
    if (!step) {
      wf.status = "completed";
      await this.saveSettings();
      return;
    }
    step.status = "running";
    step.lastRun = (/* @__PURE__ */ new Date()).toISOString();
    step.output = "";
    await this.saveSettings();
    const rt = this.workflowRuntime.get(wf.id);
    if (rt) rt.stepIndex = stepIndex;
    if (step.stepKind === "delay") {
      await this.runDelayStep(wf, step, stepIndex);
      return;
    }
    if (step.stepKind === "code") {
      await this.runCodeStep(wf, step, stepIndex);
      return;
    }
    await this.runTaskStep(wf, step, stepIndex);
  }
  async runDelayStep(wf, step, stepIndex) {
    var _a;
    const spec = workflowDelay(step.delayValue, step.delayUnit);
    const ctx = this.workflowRuntime.get(wf.id);
    if (this.stoppingWorkflows.has(wf.id) || wf.status !== "running") return;
    (_a = this.workflowDelayControllers.get(wf.id)) == null ? void 0 : _a.abort();
    const controller = new AbortController();
    this.workflowDelayControllers.set(wf.id, controller);
    new import_obsidian.Notice(`AutoOC: \u23F1 ${spec.output} in "${wf.name}"...`);
    try {
      await waitForWorkflowDelay(spec.milliseconds, controller.signal);
      if (controller.signal.aborted || wf.status !== "running" || this.workflowRuntime.get(wf.id) !== ctx) return;
      await this.completeStep(wf, step, stepIndex, true, spec.output);
    } catch (error) {
      if (!controller.signal.aborted) throw error;
    } finally {
      if (this.workflowDelayControllers.get(wf.id) === controller) this.workflowDelayControllers.delete(wf.id);
    }
  }
  async runCodeStep(wf, step, stepIndex) {
    const ctx = this.workflowRuntime.get(wf.id);
    const inputVar = step.codeInputVar || "input";
    const outputVar = step.codeOutputVar || "output";
    const inputVal = ctx && ctx.stepOutputs.size > 0 ? Array.from(ctx.stepOutputs.values()).pop() : "";
    const outputs = {};
    if (ctx) for (const [k, v] of ctx.stepOutputs.entries()) outputs[k] = v;
    try {
      const vaultBase = this.app.vault.adapter.basePath || ".";
      const out = executeCode({
        ...step,
        vaultBase,
        cwd: this.settings.workingDirectory || vaultBase,
        code: step.code || "",
        input: inputVal,
        outputs,
        codeInputVar: inputVar,
        codeOutputVar: outputVar
      });
      if (ctx) ctx.stepOutputs.set(step.id, out);
      new import_obsidian.Notice(`AutoOC: \u2699 Code step completed in "${wf.name}" (${out.length} chars)`);
      await this.completeStep(wf, step, stepIndex, true, out);
    } catch (err) {
      const msg = `[code error: ${String(err)}]`;
      if (ctx) ctx.stepOutputs.set(step.id, msg);
      new import_obsidian.Notice(`AutoOC: \u274C Code step failed in "${wf.name}" \u2014 ${String(err)}`);
      await this.completeStep(wf, step, stepIndex, false, msg);
    }
  }
  async runTaskStep(wf, step, stepIndex) {
    var _a;
    const executionContext = (_a = this.workflowRuntime) == null ? void 0 : _a.get(wf.id);
    const isCurrentExecution = () => {
      var _a2, _b;
      return executionContext !== void 0 && ((_a2 = this.workflowRuntime) == null ? void 0 : _a2.get(wf.id)) === executionContext && ((_b = this.settings.workflows.find((w) => w.id === wf.id)) == null ? void 0 : _b.status) === "running" && !this.stoppingWorkflows.has(wf.id);
    };
    if (!isCurrentExecution()) return;
    const taskIdx = this.settings.tasks.findIndex((t) => t.id === step.taskId);
    if (taskIdx === -1) {
      wf.status = "failed";
      new import_obsidian.Notice(`AutoOC: Workflow "${wf.name}" failed \u2014 task not found at step ${stepIndex + 1}.`);
      await this.saveSettings();
      return;
    }
    const task = this.settings.tasks[taskIdx];
    const taskOverrides = {};
    const entries = Array.from(executionContext.stepOutputs.entries());
    const previous = entries.length ? entries[entries.length - 1] : void 0;
    if (wf.handoffOutput && previous) {
      taskOverrides.prompt = workflowTaskPrompt(task.prompt, wf, { stepId: previous[0], output: previous[1] });
    }
    wf.currentStep = stepIndex;
    await this.saveSettings();
    if (!isCurrentExecution()) return;
    let resultConsumed = false;
    await this.runTask(task, async (completedTask, exitCode) => {
      if (!isCurrentExecution() || resultConsumed) return;
      resultConsumed = true;
      const currentWf = this.settings.workflows.find((w) => w.id === wf.id);
      if (!currentWf || currentWf.status !== "running" || this.stoppingWorkflows.has(currentWf.id)) return;
      const currentStep = currentWf.steps[stepIndex];
      const lastOutput = completedTask.output || "";
      const ctx = this.workflowRuntime.get(currentWf.id);
      if (ctx) ctx.stepOutputs.set(currentStep.id, lastOutput);
      const lastSucceeded = exitCode === 0 && completedTask.status !== "failed";
      const transitions = workflowStepTransitions(currentWf.steps, stepIndex);
      const { nextStepId, reason } = await this.resolveNextStep(
        currentWf,
        currentStep,
        stepIndex,
        lastOutput,
        lastSucceeded,
        transitions
      );
      if (!isCurrentExecution()) return;
      if (this.stoppingWorkflows.has(currentWf.id) || currentWf.status !== "running") return;
      if (!nextStepId) {
        if (this.stoppingWorkflows.has(currentWf.id) || currentWf.status !== "running") return;
        const failedByTask = !lastSucceeded;
        currentWf.status = failedByTask ? "failed" : "completed";
        completedTask.output += failedByTask ? `
[Workflow failed at step ${stepIndex + 1}/${currentWf.steps.length}]` : `
[Workflow completed at step ${stepIndex + 1}/${currentWf.steps.length}]`;
        new import_obsidian.Notice(
          failedByTask ? `AutoOC: \u274C Workflow "${currentWf.name}" failed at step ${stepIndex + 1}/${currentWf.steps.length}.` : `AutoOC: \u2705 Workflow "${currentWf.name}" completed at step ${stepIndex + 1}/${currentWf.steps.length}.`
        );
        this.workflowRuntime.delete(currentWf.id);
        await this.saveSettings();
        return;
      }
      const nextIdx = currentWf.steps.findIndex((s) => s.id === nextStepId);
      if (nextIdx === -1) {
        if (this.stoppingWorkflows.has(currentWf.id) || currentWf.status !== "running") return;
        currentWf.status = "failed";
        new import_obsidian.Notice(`AutoOC: \u274C Workflow "${currentWf.name}" \u2014 transition target ${nextStepId} not found.`);
        await this.saveSettings();
        return;
      }
      if (this.stoppingWorkflows.has(currentWf.id) || currentWf.status !== "running") return;
      currentWf.currentStep = nextIdx;
      await this.saveSettings();
      if (!isCurrentExecution()) return;
      if (this.stoppingWorkflows.has(currentWf.id) || currentWf.status !== "running") return;
      new import_obsidian.Notice(`AutoOC: \u26A1 Workflow "${currentWf.name}" \u2192 step ${nextIdx + 1}/${currentWf.steps.length} (${reason})`);
      setTimeout(() => {
        if (!isCurrentExecution()) return;
        this.runWorkflowStepById(currentWf.id, nextStepId);
      }, 200);
    }, taskOverrides);
  }
  // Complete a non-task step and move to the next one.
  async completeStep(wf, step, stepIndex, succeeded, output) {
    const ctx = this.workflowRuntime.get(wf.id);
    const isCurrentExecution = () => {
      var _a;
      return ctx !== void 0 && this.workflowRuntime.get(wf.id) === ctx && ((_a = this.settings.workflows.find((w) => w.id === wf.id)) == null ? void 0 : _a.status) === "running" && !this.stoppingWorkflows.has(wf.id);
    };
    if (!isCurrentExecution()) return;
    if (ctx) ctx.stepOutputs.set(step.id, output);
    step.status = succeeded ? "completed" : "failed";
    step.output = output;
    step.lastRun = (/* @__PURE__ */ new Date()).toISOString();
    const transitions = workflowStepTransitions(wf.steps, stepIndex);
    const { nextStepId, reason } = await this.resolveNextStep(
      wf,
      step,
      stepIndex,
      output,
      succeeded,
      transitions
    );
    if (!isCurrentExecution()) return;
    if (!nextStepId) {
      const wfRef2 = this.settings.workflows.find((w) => w.id === wf.id);
      if (wfRef2) {
        wfRef2.status = succeeded ? "completed" : "failed";
        await this.saveSettings();
        new import_obsidian.Notice(succeeded ? `AutoOC: \u2705 Workflow "${wfRef2.name}" completed.` : `AutoOC: \u274C Workflow "${wfRef2.name}" failed.`);
      }
      this.workflowRuntime.delete(wf.id);
      return;
    }
    const wfRef = this.settings.workflows.find((w) => w.id === wf.id);
    if (wfRef) {
      const nextIdx = wfRef.steps.findIndex((s) => s.id === nextStepId);
      if (nextIdx >= 0) {
        wfRef.currentStep = nextIdx;
        await this.saveSettings();
        new import_obsidian.Notice(`AutoOC: \u26A1 Workflow "${wfRef.name}" \u2192 step ${nextIdx + 1}/${wfRef.steps.length} (${reason})`);
        setTimeout(() => {
          if (isCurrentExecution()) this.runWorkflowStepById(wf.id, nextStepId);
        }, 200);
      }
    }
  }
};
var AutoOCView = class extends import_obsidian.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.filterText = "";
    this.filterStatus = "all";
    this.filterArea = "all";
    this.currentTab = "dashboard";
    this.expandedTasks = /* @__PURE__ */ new Set();
    this.expandedWorkflows = /* @__PURE__ */ new Set();
    this.dashboardPositions = /* @__PURE__ */ new Map();
    // Accumulated drift per task, in physical px relative to the map's own
    // height (NOT a %-of-immediate-parent value) — keeps rise/sink distance
    // visually consistent whether a task bubble sits loose on the map or is
    // nested two levels deep inside an area/workflow ring.
    this.dashboardTaskShift = /* @__PURE__ */ new Map();
    this.sinkIntervals = /* @__PURE__ */ new Map();
    this.dashboardTaskDriftDirection = /* @__PURE__ */ new Map();
    this.dashboardLayoutSignature = "";
    this.showDashboardKpis = false;
    // Watches the map's real rendered size so bubble sizing (task bubbles are
    // fixed px, capped to fit their parent) gets recomputed when the pane is
    // resized. Percentage-based left/top/width already reflow for free via
    // CSS, but nothing else in this view listens for layout size changes, so
    // without this, shrinking the canvas leaves stale px sizes that overflow
    // their now-smaller container.
    this.dashboardResizeObserver = null;
    // Set right before a resize-triggered render so renderDashboard's settle+fit
    // pass runs even though the task/workflow structure didn't change (normally
    // that pass is skipped on unchanged layouts to avoid redoing work every
    // render — see the guard in renderDashboard).
    this.forceDashboardFitOnNextRender = false;
    this.plugin = plugin;
  }
  loadDashboardPositions() {
    this.dashboardPositions.clear();
    const saved = this.plugin.settings.dashboardPositions;
    if (saved) {
      for (const [key, pos] of Object.entries(saved)) {
        this.dashboardPositions.set(key, pos);
      }
    }
  }
  async persistDashboardPositions() {
    const obj = {};
    this.dashboardPositions.forEach((pos, key) => {
      obj[key] = pos;
    });
    this.plugin.settings.dashboardPositions = obj;
    await this.plugin.saveSettings(false);
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
    this.unsubscribeTaskUpdated = this.plugin.onTaskUpdated((task) => this.updateTaskNameDom(task));
    this.unsubscribeWorkflowUpdated = this.plugin.onWorkflowUpdated((workflow) => this.updateWorkflowNameDom(workflow));
    this.loadDashboardPositions();
    this.render();
  }
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
  refresh() {
    this.render();
  }
  updateTaskNameDom(task) {
    const usageCount = this.plugin.settings.workflows.reduce((count, workflow) => {
      return count + workflow.steps.filter((step) => step.taskId === task.id).length;
    }, 0);
    this.containerEl.querySelectorAll(`[data-auto-oc-task-id="${task.id}"]`).forEach((el) => {
      var _a;
      (_a = el.querySelector(".auto-oc-task-name")) == null ? void 0 : _a.setText(task.name);
      const label = el.querySelector(".auto-oc-dashboard-hover-label");
      if (label) label.setText(task.name);
      if (el.classList.contains("auto-oc-dashboard-task-bubble")) {
        el.setAttr("aria-label", `Task: ${task.name}. Status: ${task.status}. Usage count: ${usageCount}. Press Enter to open in Tasks.`);
      }
    });
  }
  updateWorkflowNameDom(workflow) {
    var _a;
    const area = ((_a = workflow.area) == null ? void 0 : _a.trim()) || "No area";
    this.containerEl.querySelectorAll(`[data-auto-oc-workflow-id="${workflow.id}"]`).forEach((el) => {
      var _a2;
      (_a2 = el.querySelector(".auto-oc-task-name")) == null ? void 0 : _a2.setText(workflow.name);
      const label = el.querySelector(".auto-oc-dashboard-hover-label");
      if (label) label.setText(workflow.name);
      if (el.classList.contains("auto-oc-dashboard-workflow-bubble")) {
        el.setAttr("aria-label", `Workflow: ${workflow.name}. Area: ${area}. Status: ${workflow.status}. Press Enter to open in WorkFlows.`);
      }
    });
  }
  resetDashboardTaskShift(taskId) {
    const existing = this.sinkIntervals.get(taskId);
    if (existing) {
      clearInterval(existing);
      this.sinkIntervals.delete(taskId);
    }
    this.dashboardTaskDriftDirection.delete(taskId);
    this.dashboardTaskShift.delete(taskId);
  }
  nudgeDashboardTask(taskId, direction, amountPct = 1.8, maxShiftPct = 18) {
  }
  // Mirrors the class-selector check used inside renderDashboard's drag/collision
  // closures, so drift-driven nudges (heartbeat rise, gradual sink) can reuse the
  // same sibling-push behavior as manual dragging without needing access to
  // renderDashboard's local scope.
  isDashboardBubbleEl(el) {
    return el instanceof HTMLElement && (el.classList.contains("auto-oc-dashboard-area-bubble") || el.classList.contains("auto-oc-dashboard-workflow-bubble") || el.classList.contains("auto-oc-dashboard-task-bubble"));
  }
  // Task bubbles render at a fixed physical px diameter (see TASK_BUBBLE_PX
  // in renderDashboard), not a %, so their width never means "this task's
  // saved size" — persisting it would just re-inject a stray px number where
  // a % is expected next render (area/workflow top-level layout reuses
  // saved.size as a %). Only area/workflow bubbles have a meaningful size to
  // remember across renders/drags.
  parseBubbleSizeForSave(bubble) {
    if (bubble.classList.contains("auto-oc-dashboard-task-bubble")) return void 0;
    return parseFloat(bubble.style.width || "0") || void 0;
  }
  parseBubbleSizePxForSave(bubble) {
    if (bubble.classList.contains("auto-oc-dashboard-task-bubble")) return void 0;
    const width = bubble.getBoundingClientRect().width;
    return Number.isFinite(width) && width > 0 ? Math.round(width * 100) / 100 : void 0;
  }
  clampDashboardBubbleToParent(bubble) {
    const parent = bubble.offsetParent;
    if (!parent) return;
    const bounds = parent.getBoundingClientRect();
    if (bounds.width === 0 || bounds.height === 0) return;
    const rect = bubble.getBoundingClientRect();
    const widthPct = rect.width / bounds.width * 100;
    const heightPct = rect.height / bounds.height * 100;
    let leftPct = (rect.left - bounds.left) / bounds.width * 100;
    let topPct = (rect.top - bounds.top) / bounds.height * 100;
    if (this.isDashboardBubbleEl(parent)) {
      const parentRadius = Math.min(bounds.width, bounds.height) / 2;
      const bubbleRadius = rect.width / 2;
      const parentCenterX = bounds.left + bounds.width / 2;
      const parentCenterY = bounds.top + bounds.height / 2;
      const bubbleCenterX = rect.left + rect.width / 2;
      const bubbleCenterY = rect.top + rect.height / 2;
      let dx = bubbleCenterX - parentCenterX;
      let dy = bubbleCenterY - parentCenterY;
      let distance = Math.hypot(dx, dy);
      const maxDistance = Math.max(0, parentRadius - bubbleRadius * 0.88);
      if (distance > maxDistance) {
        if (distance < 0.01) {
          dx = 1;
          dy = 0;
          distance = 1;
        }
        const nextCenterX = parentCenterX + dx / distance * maxDistance;
        const nextCenterY = parentCenterY + dy / distance * maxDistance;
        leftPct = (nextCenterX - bubbleRadius - bounds.left) / bounds.width * 100;
        topPct = (nextCenterY - bubbleRadius - bounds.top) / bounds.height * 100;
      }
    }
    bubble.style.left = `${Math.max(0, Math.min(100 - widthPct, leftPct))}%`;
    bubble.style.top = `${Math.max(0, Math.min(100 - heightPct, topPct))}%`;
  }
  // Same "push siblings out of the way" behavior used while dragging a bubble
  // (attachBubbleDrag's resolveSiblingCollisions), but callable from outside
  // renderDashboard's scope so drift ticks can trigger it too.
  resolveDashboardSiblingCollisions(el) {
    const parent = el.offsetParent;
    if (!parent) return;
    const bounds = parent.getBoundingClientRect();
    if (bounds.width === 0 || bounds.height === 0) return;
    const bubbles = Array.from(parent.children).filter((child) => this.isDashboardBubbleEl(child));
    let frontier = /* @__PURE__ */ new Set([el]);
    for (let pass = 0; pass < 5 && frontier.size > 0; pass++) {
      const nextFrontier = /* @__PURE__ */ new Set();
      for (const a of frontier) {
        for (const b of bubbles) {
          if (a === b) continue;
          const aRect = a.getBoundingClientRect();
          const bRect = b.getBoundingClientRect();
          const aRadius = aRect.width / 2;
          const bRadius = bRect.width / 2;
          const aCenterX = aRect.left + aRadius;
          const aCenterY = aRect.top + aRect.height / 2;
          const bCenterX = bRect.left + bRadius;
          const bCenterY = bRect.top + bRect.height / 2;
          let dx = bCenterX - aCenterX;
          let dy = bCenterY - aCenterY;
          let distance = Math.hypot(dx, dy);
          const minDistance = aRadius + bRadius + 4;
          if (distance >= minDistance) continue;
          if (distance < 0.01) {
            const angle = (bubbles.indexOf(a) + bubbles.indexOf(b) + pass) / Math.max(bubbles.length, 1) * Math.PI * 2;
            dx = Math.cos(angle);
            dy = Math.sin(angle);
            distance = 1;
          }
          const push = (minDistance - distance) * 1.05;
          const moveBubble = (bubble, rect, amount) => {
            if (amount === 0) return;
            const nextLeftPx = rect.left - bounds.left + dx / distance * amount;
            const nextTopPx = rect.top - bounds.top + dy / distance * amount;
            const nextLeftPct = nextLeftPx / bounds.width * 100;
            const nextTopPct = nextTopPx / bounds.height * 100;
            const widthPct = rect.width / bounds.width * 100;
            const heightPct = rect.height / bounds.height * 100;
            bubble.style.left = `${Math.max(0, Math.min(100 - widthPct, nextLeftPct))}%`;
            bubble.style.top = `${Math.max(0, Math.min(100 - heightPct, nextTopPct))}%`;
          };
          moveBubble(b, bRect, push);
          this.clampDashboardBubbleToParent(b);
          const nextARect = a.getBoundingClientRect();
          const nextBRect = b.getBoundingClientRect();
          const nextARadius = nextARect.width / 2;
          const nextBRadius = nextBRect.width / 2;
          const nextDx = nextBRect.left + nextBRadius - (nextARect.left + nextARadius);
          const nextDy = nextBRect.top + nextBRect.height / 2 - (nextARect.top + nextARect.height / 2);
          const nextDistance = Math.max(Math.hypot(nextDx, nextDy), 1);
          const residual = minDistance - nextDistance;
          if (residual > 0.5) {
            moveBubble(a, nextARect, -residual * 0.55);
            this.clampDashboardBubbleToParent(a);
          }
          nextFrontier.add(b);
        }
      }
      frontier = nextFrontier;
    }
    bubbles.forEach((bubble) => {
      const key = bubble.getAttribute("data-dashboard-key");
      if (!key) return;
      this.dashboardPositions.set(key, {
        x: parseFloat(bubble.style.left || "0"),
        y: parseFloat(bubble.style.top || "0"),
        size: this.parseBubbleSizeForSave(bubble),
        sizePx: this.parseBubbleSizePxForSave(bubble)
      });
    });
  }
  // Same all-pairs, multi-pass settle used when a manual drag is released
  // (renderDashboard's settleBubbleCollisions), ported so drift ticks can
  // call it too. The chained push above only resolves collisions along the
  // path from the moved bubble; this catches any remaining overlap between
  // siblings that weren't directly touched — e.g. two tasks that each drifted
  // independently (both running) and happened to end up on top of each other.
  settleDashboardBubbleCollisions(parent, passes = 10) {
    const bubbles = Array.from(parent.children).filter((child) => this.isDashboardBubbleEl(child));
    const bounds = parent.getBoundingClientRect();
    if (bubbles.length < 2 || bounds.width === 0 || bounds.height === 0) return;
    for (let pass = 0; pass < passes; pass++) {
      let movedAny = false;
      for (let i = 0; i < bubbles.length; i++) {
        for (let j = i + 1; j < bubbles.length; j++) {
          const a = bubbles[i];
          const b = bubbles[j];
          const aRect = a.getBoundingClientRect();
          const bRect = b.getBoundingClientRect();
          const aRadius = aRect.width / 2;
          const bRadius = bRect.width / 2;
          const aCenterX = aRect.left + aRadius;
          const aCenterY = aRect.top + aRect.height / 2;
          const bCenterX = bRect.left + bRadius;
          const bCenterY = bRect.top + bRect.height / 2;
          let dx = bCenterX - aCenterX;
          let dy = bCenterY - aCenterY;
          let distance = Math.hypot(dx, dy);
          const minDistance = aRadius + bRadius + 2;
          if (distance >= minDistance) continue;
          if (distance < 0.01) {
            const angle = (i + j + pass) / Math.max(bubbles.length, 1) * Math.PI * 2;
            dx = Math.cos(angle);
            dy = Math.sin(angle);
            distance = 1;
          }
          const push = (minDistance - distance) * 0.75;
          const moveBubble = (bubble, rect, amount) => {
            const nextLeftPx = rect.left - bounds.left + dx / distance * amount;
            const nextTopPx = rect.top - bounds.top + dy / distance * amount;
            const nextLeftPct = nextLeftPx / bounds.width * 100;
            const nextTopPct = nextTopPx / bounds.height * 100;
            const widthPct = rect.width / bounds.width * 100;
            const heightPct = rect.height / bounds.height * 100;
            bubble.style.left = `${Math.max(0, Math.min(100 - widthPct, nextLeftPct))}%`;
            bubble.style.top = `${Math.max(0, Math.min(100 - heightPct, nextTopPct))}%`;
            this.clampDashboardBubbleToParent(bubble);
          };
          moveBubble(a, aRect, -push);
          moveBubble(b, bRect, push);
          movedAny = true;
        }
      }
      if (!movedAny) break;
    }
    bubbles.forEach((bubble) => {
      const key = bubble.getAttribute("data-dashboard-key");
      if (!key) return;
      this.dashboardPositions.set(key, {
        x: parseFloat(bubble.style.left || "0"),
        y: parseFloat(bubble.style.top || "0"),
        size: this.parseBubbleSizeForSave(bubble),
        sizePx: this.parseBubbleSizePxForSave(bubble)
      });
    });
  }
  startDashboardTaskDrift(taskId, direction, stepPct = 6, maxPct = 50) {
    const existing = this.sinkIntervals.get(taskId);
    if (existing) {
      clearInterval(existing);
      this.sinkIntervals.delete(taskId);
    }
    this.dashboardTaskDriftDirection.delete(taskId);
    this.dashboardTaskShift.delete(taskId);
  }
  startGradualSink(taskId, stepPct = 6, maxPct = 50) {
    this.resetDashboardTaskShift(taskId);
  }
  syncDashboardTaskDrift(tasks) {
    const activeTaskIds = new Set(tasks.map((task) => task.id));
    tasks.forEach((task) => this.resetDashboardTaskShift(task.id));
    Array.from(this.sinkIntervals.keys()).forEach((taskId) => {
      if (activeTaskIds.has(taskId)) return;
      const existing = this.sinkIntervals.get(taskId);
      if (existing) clearInterval(existing);
      this.sinkIntervals.delete(taskId);
      this.dashboardTaskDriftDirection.delete(taskId);
      this.dashboardTaskShift.delete(taskId);
    });
  }
  // Re-renders the dashboard whenever the map's real pixel size changes
  // (e.g. the user resizes the sidebar/pane). Bubble positions/widths that
  // are %-based reflow for free via CSS, but task bubbles are deliberately
  // fixed px (capped to fit their parent — see taskBubbleSizeForParent), so
  // without this, shrinking the canvas leaves stale sizes that no longer
  // fit their now-smaller area/workflow ring. Debounced and gated on an
  // actual size delta to avoid feedback loops (this same re-render recreates
  // the map and re-attaches a fresh observer every time).
  watchDashboardMapResize(map) {
    var _a;
    (_a = this.dashboardResizeObserver) == null ? void 0 : _a.disconnect();
    this.dashboardResizeObserver = null;
  }
  // Purely decorative "aquarium" ambience behind the bubbles: soft caustic
  // light rays, small rising bubbles, and drifting dust motes. Everything is
  // pointer-events:none and lives in its own layer (z-index 0, below the
  // area/workflow/task bubbles at 1/4/8/9), so it never affects drag,
  // collision, or positioning logic. Positions/timings are derived from a
  // deterministic hash (not Math.random()) so the layer doesn't reshuffle
  // itself on every re-render.
  createDashboardAmbientLayer(map) {
    const ambient = map.createDiv("auto-oc-dashboard-ambient");
    const seededRandom = (seed) => {
      let hash = 0;
      for (let i = 0; i < seed.length; i++) hash = (hash << 5) - hash + seed.charCodeAt(i) | 0;
      return Math.abs(hash) % 1e3 / 1e3;
    };
    for (let i = 0; i < 2; i++) {
      const ray = ambient.createDiv(`auto-oc-dashboard-ambient-ray${i === 1 ? " auto-oc-dashboard-ambient-ray-alt" : ""}`);
      ray.style.top = `${-20 + seededRandom(`ray-top-${i}`) * 28}%`;
    }
    const bubbleCount = 10;
    for (let i = 0; i < bubbleCount; i++) {
      const seed = `ambient-bubble-${i}`;
      const size = 3 + seededRandom(`${seed}-size`) * 7;
      const left = seededRandom(`${seed}-left`) * 96;
      const duration = 14 + seededRandom(`${seed}-dur`) * 12;
      const delay2 = -(seededRandom(`${seed}-delay`) * duration);
      const opacity = 0.05 + seededRandom(`${seed}-op`) * 0.13;
      const bubble = ambient.createDiv("auto-oc-dashboard-ambient-bubble");
      bubble.style.left = `${left}%`;
      bubble.style.width = `${size}px`;
      bubble.style.height = `${size}px`;
      bubble.style.opacity = `${opacity}`;
      bubble.style.animationDuration = `${duration}s`;
      bubble.style.animationDelay = `${delay2}s`;
    }
    const dustCount = 8;
    for (let i = 0; i < dustCount; i++) {
      const seed = `ambient-dust-${i}`;
      const size = 1 + seededRandom(`${seed}-size`);
      const left = seededRandom(`${seed}-left`) * 96;
      const top = seededRandom(`${seed}-top`) * 90;
      const duration = 20 + seededRandom(`${seed}-dur`) * 10;
      const delay2 = -(seededRandom(`${seed}-delay`) * duration);
      const opacity = 0.04 + seededRandom(`${seed}-op`) * 0.04;
      const dust = ambient.createDiv("auto-oc-dashboard-ambient-dust");
      dust.style.left = `${left}%`;
      dust.style.top = `${top}%`;
      dust.style.width = `${size}px`;
      dust.style.height = `${size}px`;
      dust.style.opacity = `${opacity}`;
      dust.style.animationDuration = `${duration}s`;
      dust.style.animationDelay = `${delay2}s`;
    }
  }
  openCli() {
    new OpenCodeCliModal(this.app, this.plugin).open();
  }
  openCodex() {
    new CodexAppModal(this.app, this.plugin).open();
  }
  openTaskInList(task) {
    this.currentTab = "tasks";
    this.filterText = "";
    this.filterStatus = "all";
    this.expandedTasks.add(task.id);
    this.render();
    window.setTimeout(() => {
      var _a;
      (_a = this.containerEl.querySelector(`[data-auto-oc-task-id="${task.id}"]`)) == null ? void 0 : _a.scrollIntoView({ block: "center" });
    }, 0);
  }
  openWorkflowInList(workflow) {
    this.currentTab = "workflows";
    this.expandedWorkflows.add(workflow.id);
    this.render();
    window.setTimeout(() => {
      var _a;
      (_a = this.containerEl.querySelector(`[data-auto-oc-workflow-id="${workflow.id}"]`)) == null ? void 0 : _a.scrollIntoView({ block: "center" });
    }, 0);
  }
  render() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass("auto-oc-view");
    this.renderHeader(containerEl);
    const tabBar = containerEl.createDiv("auto-oc-tab-bar");
    const navRow = tabBar.createDiv("auto-oc-tab-row auto-oc-tab-row-nav");
    const btnDashboard = navRow.createEl("button", {
      text: "Dashboard",
      cls: "auto-oc-tab-btn"
    });
    btnDashboard.onclick = () => {
      this.currentTab = "dashboard";
      this.render();
    };
    const btnTasks = navRow.createEl("button", {
      text: "\u{1F4CB} Tasks",
      cls: "auto-oc-tab-btn"
    });
    btnTasks.onclick = () => {
      this.currentTab = "tasks";
      this.render();
    };
    const btnWorkflows = navRow.createEl("button", {
      text: "\u{1F517} WorkFlows",
      cls: "auto-oc-tab-btn"
    });
    btnWorkflows.onclick = () => {
      this.currentTab = "workflows";
      this.render();
    };
    const btnSecrets = navRow.createEl("button", {
      text: "\u{1F512} Secrets",
      cls: "auto-oc-tab-btn"
    });
    btnSecrets.title = "Manage local secrets injected into OpenCode as temporary environment variables";
    btnSecrets.onclick = () => {
      this.currentTab = "secrets";
      this.render();
    };
    const btnVisualBuilder = navRow.createEl("button", {
      text: "\u2728 WF Visual Builder",
      cls: "auto-oc-tab-btn"
    });
    btnVisualBuilder.title = "Open the n8n-style visual workflow builder (loads and saves to this extension)";
    btnVisualBuilder.onclick = () => this.plugin.openVisualBuilder();
    const btnPrompt = navRow.createEl("button", {
      text: "\u{1F4DD} WF Builder Prompt",
      cls: "auto-oc-tab-btn"
    });
    btnPrompt.title = "Copy this prompt to create your workflow";
    btnPrompt.onclick = async () => {
      try {
        await copyTextToClipboard(AUTOOC_WORKFLOW_PROMPT);
        new import_obsidian.Notice("AutoOC: workflow creation prompt copied to clipboard.");
      } catch (err) {
        new import_obsidian.Notice(`AutoOC: could not copy prompt \u2014 ${String(err)}`);
      }
    };
    const btnCli = navRow.createEl("button", {
      text: "\u{1F4BB} OpenCode CLI",
      cls: "auto-oc-tab-btn"
    });
    btnCli.onclick = () => this.openCli();
    const btnCodex = navRow.createEl("button", {
      text: "\u2726 ChatGPT / Codex",
      cls: "auto-oc-tab-btn"
    });
    btnCodex.title = "Open ChatGPT/Codex in the project or a selected folder";
    btnCodex.onclick = () => this.openCodex();
    const toolsRow = tabBar.createDiv("auto-oc-tab-row auto-oc-tab-row-tools");
    if (this.currentTab === "tasks") {
      const btnNewTask = toolsRow.createEl("button", {
        text: "+ New Task",
        cls: "auto-oc-btn-primary"
      });
      btnNewTask.onclick = () => new CreateTaskModal(this.app, this.plugin).open();
    } else if (this.currentTab === "workflows") {
      const btnNewWorkflow = toolsRow.createEl("button", {
        text: "+ New Workflow",
        cls: "auto-oc-btn-primary"
      });
      btnNewWorkflow.onclick = () => new CreateWorkflowModal(this.app, this.plugin).open();
    } else if (this.currentTab === "secrets") {
      const btnNewSecret = toolsRow.createEl("button", {
        text: "+ New Secret",
        cls: "auto-oc-btn-primary"
      });
      btnNewSecret.onclick = () => this.openSecretEditor();
    }
    const toolsSpacer = toolsRow.createDiv("auto-oc-tab-spacer");
    toolsSpacer.style.flex = "1";
    const btnExport = toolsRow.createEl("button", {
      text: "\u{1F4E4} Export",
      cls: "auto-oc-tab-btn"
    });
    btnExport.title = "Export tasks and workflows to JSON";
    btnExport.onclick = () => new ExportModal(this.app, this.plugin).open();
    const btnImport = toolsRow.createEl("button", {
      text: "\u{1F4E5} Import",
      cls: "auto-oc-tab-btn"
    });
    btnImport.title = "Import tasks and workflows from JSON";
    btnImport.onclick = () => new ImportModal(this.app, this.plugin).open();
    if (this.currentTab === "dashboard") btnDashboard.addClass("active");
    else if (this.currentTab === "tasks") btnTasks.addClass("active");
    else if (this.currentTab === "workflows") btnWorkflows.addClass("active");
    else if (this.currentTab === "secrets") btnSecrets.addClass("active");
    if (this.currentTab === "dashboard") {
      this.renderDashboard(containerEl);
    } else if (this.currentTab === "workflows") {
      this.renderWorkflows(containerEl);
    } else if (this.currentTab === "secrets") {
      this.renderSecrets(containerEl);
    } else {
      this.renderTasks(containerEl);
    }
  }
  async ensureSecretsUnlocked() {
    const store = this.plugin.secretStore;
    if (!store.hasPin()) {
      const created = await new SecretsPinModal(this.app, store, "create").openAndWait();
      if (created) this.render();
      return created;
    }
    if (store.isUnlocked()) return true;
    return new SecretsPinModal(this.app, store, "unlock").openAndWait();
  }
  async openSecretEditor(secret) {
    if (!await this.ensureSecretsUnlocked()) return;
    new SecretEditModal(this.app, this.plugin, secret, () => this.render()).open();
  }
  async revealSecret(secret) {
    if (!await this.ensureSecretsUnlocked()) return;
    try {
      const value = this.plugin.secretStore.decryptValue(secret);
      new SecretRevealModal(this.app, secret, value).open();
    } catch (e) {
      new import_obsidian.Notice(`AutoOC: could not reveal secret \u2014 ${String(e)}`);
    }
  }
  async copySecretValue(secret) {
    if (!await this.ensureSecretsUnlocked()) return;
    try {
      await copyTextToClipboard(this.plugin.secretStore.decryptValue(secret));
      new import_obsidian.Notice(`AutoOC: copied ${secret.name}.`);
    } catch (e) {
      new import_obsidian.Notice(`AutoOC: could not copy secret \u2014 ${String(e)}`);
    }
  }
  async deleteSecret(secret) {
    if (!await this.ensureSecretsUnlocked()) return;
    const confirmed = await new ConfirmModal(this.app, `Delete secret "${secret.name}"?`, "This cannot be undone.").openAndWait();
    if (!confirmed) return;
    this.plugin.secretStore.delete(secret.id);
    new import_obsidian.Notice(`AutoOC: deleted secret ${secret.name}.`);
    this.render();
  }
  async resetSecretsPin() {
    if (!await this.ensureSecretsUnlocked()) return;
    const confirmed = await new ConfirmModal(
      this.app,
      "Reset Secrets PIN?",
      "This only removes the UI PIN. Encrypted secrets are kept. You can create a new PIN afterwards."
    ).openAndWait();
    if (!confirmed) return;
    this.plugin.secretStore.resetPin();
    new import_obsidian.Notice("AutoOC: Secrets PIN reset. Secrets were kept.");
    this.render();
  }
  async copyAutoOcMcpInstallJson() {
    const snippet = {
      "autooc-mcp": this.plugin.getAutoOcMcpConfigBlock()
    };
    await copyTextToClipboard(JSON.stringify(snippet, null, 2));
    new import_obsidian.Notice("AutoOC: autooc-mcp install JSON copied.");
  }
  async installAutoOcMcpInOpenCode() {
    try {
      const result = await this.plugin.ensureAutoOcMcpEnabled();
      new import_obsidian.Notice(
        result.changed ? `AutoOC: autooc-mcp installed at ${result.configPath}. Restart OpenCode.` : `AutoOC: autooc-mcp was already configured at ${result.configPath}.`
      );
    } catch (e) {
      new import_obsidian.Notice(`AutoOC: could not install autooc-mcp \u2014 ${String(e)}`);
    }
  }
  async copyUvInstallCommand() {
    await copyTextToClipboard(getUvInstallCommand());
    new import_obsidian.Notice("AutoOC: uv install command copied.");
  }
  renderSecrets(containerEl) {
    const section = containerEl.createDiv("auto-oc-section auto-oc-secrets-section");
    section.createEl("h4", { text: "Secrets" });
    section.createEl("p", {
      text: "Paste values normally; AutoOC encrypts them when saving and injects them into OpenCode as temporary env vars.",
      cls: "setting-item-description"
    });
    const uvStatus = describeUvStatus();
    if (!uvStatus.available) {
      const uvWarning = section.createDiv("auto-oc-secrets-runtime-warning");
      uvWarning.createEl("strong", { text: "autooc-mcp needs uv" });
      uvWarning.createEl("p", {
        text: "uv is not installed or AutoOC cannot find it. Install uv before using the autooc-mcp installer."
      });
      const copyUv = uvWarning.createEl("button", { text: "Copy uv install command", cls: "auto-oc-btn-secondary" });
      copyUv.onclick = () => this.copyUvInstallCommand();
    }
    if (!this.plugin.secretStore.isSecureStorageAvailable()) {
      section.createEl("p", {
        text: "Secure storage is not available on this system. Secrets cannot be created or revealed.",
        cls: "setting-item-description auto-oc-update-error"
      });
      return;
    }
    const actions = section.createDiv("auto-oc-task-actions");
    actions.addClass("auto-oc-secrets-toolbar");
    const lockBtn = actions.createEl("button", { text: "Lock", cls: "auto-oc-btn-secondary" });
    lockBtn.onclick = () => {
      this.plugin.secretStore.lock();
      this.render();
    };
    const resetBtn = actions.createEl("button", { text: "Reset PIN", cls: "auto-oc-btn-secondary" });
    resetBtn.onclick = () => this.resetSecretsPin();
    if (!this.plugin.secretStore.hasPin()) {
      section.createEl("p", {
        text: "No UI PIN is set yet. Create one before managing secrets.",
        cls: "setting-item-description"
      });
      const btn = section.createEl("button", { text: "Create PIN", cls: "auto-oc-btn-primary" });
      btn.onclick = () => this.ensureSecretsUnlocked();
      return;
    }
    if (!this.plugin.secretStore.isUnlocked()) {
      section.createEl("p", { text: "Secrets are locked.", cls: "setting-item-description" });
      const btn = section.createEl("button", { text: "Unlock Secrets", cls: "auto-oc-btn-primary" });
      btn.onclick = async () => {
        if (await this.ensureSecretsUnlocked()) this.render();
      };
      return;
    }
    const installMcpBtn = actions.createEl("button", { text: "Install autooc-mcp in OpenCode", cls: "auto-oc-btn-primary" });
    installMcpBtn.title = "Write autooc-mcp into the global OpenCode config and create the local MCP server file.";
    installMcpBtn.onclick = () => this.installAutoOcMcpInOpenCode();
    const copyMcpBtn = actions.createEl("button", { text: "Copy autooc-mcp install JSON", cls: "auto-oc-btn-secondary" });
    copyMcpBtn.title = "Copy the OpenCode/harness config block that installs the local autooc-mcp server.";
    copyMcpBtn.onclick = () => this.copyAutoOcMcpInstallJson();
    const secrets = this.plugin.secretStore.list();
    if (secrets.length === 0) {
      section.createEl("p", { text: "No secrets yet. Use + New Secret to add one.", cls: "setting-item-description" });
      return;
    }
    const tableWrap = section.createDiv("auto-oc-secrets-table-wrap");
    const table = tableWrap.createEl("table", { cls: "auto-oc-secrets-table" });
    const thead = table.createEl("thead");
    const headRow = thead.createEl("tr");
    ["Name", "Env Var", "Type", "Profile", "Updated", "Actions"].forEach((h) => headRow.createEl("th", { text: h }));
    const tbody = table.createEl("tbody");
    for (const secret of secrets) {
      const row = tbody.createEl("tr");
      row.createEl("td", { text: secret.name, cls: "auto-oc-secret-name" });
      row.createEl("td", { text: secret.envName, cls: "auto-oc-secret-env" });
      const typeTd = row.createEl("td");
      typeTd.createSpan({ text: secret.type, cls: "auto-oc-secret-chip" });
      const profileTd = row.createEl("td");
      profileTd.createSpan({ text: secret.profile || "default", cls: "auto-oc-secret-chip auto-oc-secret-profile" });
      row.createEl("td", { text: secret.updatedAt ? new Date(secret.updatedAt).toLocaleString() : "" });
      const actionTd = row.createEl("td", { cls: "auto-oc-secrets-actions-cell" });
      const actionWrap = actionTd.createDiv("auto-oc-secrets-actions");
      const reveal = actionWrap.createEl("button", { text: "Reveal" });
      reveal.onclick = () => this.revealSecret(secret);
      const copyValue = actionWrap.createEl("button", { text: "Copy value" });
      copyValue.onclick = () => this.copySecretValue(secret);
      const copyEnv = actionWrap.createEl("button", { text: "Copy env" });
      copyEnv.onclick = async () => {
        await copyTextToClipboard(secret.envName);
        new import_obsidian.Notice("AutoOC: env var copied.");
      };
      const edit = actionWrap.createEl("button", { text: "Edit" });
      edit.onclick = () => this.openSecretEditor(secret);
      const del = actionWrap.createEl("button", { text: "Delete", cls: "auto-oc-secret-danger" });
      del.onclick = () => this.deleteSecret(secret);
    }
  }
  // Renders the extension header at the top of the panel: title,
  // version, check-updates button, and a status pill when an update
  // is available or in progress. This was previously rendered inside
  // each tab's view; extracting it here keeps the title and update
  // controls visible at all times.
  renderHeader(containerEl) {
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
  }
  renderDashboard(containerEl) {
    const statuses = ["pending", "running", "completed", "failed"];
    const tasks = this.plugin.settings.tasks;
    const workflows = this.plugin.settings.workflows;
    if (tasks.length === 0 && workflows.length === 0) {
      const empty = containerEl.createDiv("auto-oc-empty auto-oc-dashboard-empty");
      empty.createEl("div", { text: "No activity yet", cls: "auto-oc-dashboard-empty-title" });
      empty.createEl("div", { text: "Create tasks and workflows to see scheduler KPIs here." });
      return;
    }
    const taskCounts = Object.fromEntries(statuses.map((status) => [status, tasks.filter((task) => task.status === status).length]));
    const workflowCounts = Object.fromEntries(statuses.map((status) => [status, workflows.filter((workflow) => workflow.status === status).length]));
    const taskUsage = /* @__PURE__ */ new Map();
    workflows.forEach((workflow) => {
      workflow.steps.forEach((step) => {
        if (step.taskId) taskUsage.set(step.taskId, (taskUsage.get(step.taskId) || 0) + 1);
      });
    });
    const totalReferences = Array.from(taskUsage.values()).reduce((sum, count) => sum + count, 0);
    const mostUsed = tasks.reduce((best, task) => {
      const count = taskUsage.get(task.id) || 0;
      if (!best || count > best.count) return { name: task.name, count };
      return best;
    }, null);
    const unusedTasks = tasks.filter((task) => !taskUsage.has(task.id)).length;
    const taskFailCounts = /* @__PURE__ */ new Map();
    tasks.forEach((task) => {
      let fails = 0;
      const out = task.output || "";
      const exitMatch = out.match(/\[exit code:\s*(-?\d+)\]/g);
      if (exitMatch) fails = exitMatch.length;
      if (task.status === "failed") fails = Math.max(fails, 1);
      if (fails > 0) taskFailCounts.set(task.id, fails);
    });
    const dashboard = containerEl.createDiv("auto-oc-dashboard");
    const kpis = dashboard.createDiv(this.showDashboardKpis ? "auto-oc-dashboard-kpis" : "auto-oc-dashboard-kpis auto-oc-dashboard-kpis-hidden");
    const addKpi = (label, value, cls) => {
      const kpi = kpis.createDiv("auto-oc-dashboard-kpi");
      kpi.createEl("span", { text: label, cls: "auto-oc-dashboard-kpi-label" });
      kpi.createEl("strong", { text: String(value), cls });
    };
    addKpi("Tasks", tasks.length);
    statuses.forEach((status) => addKpi(`Tasks ${status}`, taskCounts[status], status === "running" ? "auto-oc-stat-running" : status === "failed" ? "auto-oc-stat-failed" : void 0));
    addKpi("Workflows", workflows.length);
    statuses.forEach((status) => addKpi(`Workflows ${status}`, workflowCounts[status], status === "running" ? "auto-oc-stat-running" : status === "failed" ? "auto-oc-stat-failed" : void 0));
    addKpi("Task refs", totalReferences);
    addKpi("Most used", mostUsed && mostUsed.count > 0 ? `${mostUsed.name} (${mostUsed.count})` : "None");
    addKpi("Unused tasks", unusedTasks);
    const map = dashboard.createDiv("auto-oc-dashboard-map");
    this.createDashboardAmbientLayer(map);
    this.watchDashboardMapResize(map);
    const btnToggleKpis = map.createEl("button", {
      text: this.showDashboardKpis ? "Hide metrics" : "Show metrics",
      cls: "auto-oc-dashboard-kpi-toggle"
    });
    btnToggleKpis.onclick = () => {
      this.showDashboardKpis = !this.showDashboardKpis;
      this.render();
    };
    const areaName = (value) => (value == null ? void 0 : value.trim()) || "No area";
    const layoutSignature = JSON.stringify({
      tasks: tasks.map((task) => ({ id: task.id, area: areaName(task.area) })).sort((a, b) => a.id.localeCompare(b.id)),
      workflows: workflows.map((workflow) => ({
        id: workflow.id,
        area: areaName(workflow.area),
        steps: workflow.steps.map((step) => step.taskId || step.id)
      })).sort((a, b) => a.id.localeCompare(b.id))
    });
    const layoutChanged = layoutSignature !== this.dashboardLayoutSignature;
    if (layoutChanged) this.dashboardLayoutSignature = layoutSignature;
    const areaNames = Array.from(/* @__PURE__ */ new Set([
      ...workflows.map((workflow) => areaName(workflow.area)),
      ...tasks.map((task) => areaName(task.area))
    ])).sort((a, b) => a.localeCompare(b));
    const taskById = new Map(tasks.map((task) => [task.id, task]));
    const mapRect = map.getBoundingClientRect();
    const mapWidthPx = Math.max(mapRect.width || 0, 520);
    const pctFromPx = (px, parentPx, minPct, maxPct) => {
      const pct = px / Math.max(parentPx, 1) * 100;
      return Math.max(minPct, Math.min(maxPct, pct));
    };
    const areaSizeForContent = (contentWeight) => {
      const px = Math.min(260, Math.max(120, 92 + Math.sqrt(Math.max(contentWeight, 1)) * 42));
      return { px, pct: pctFromPx(px, mapWidthPx, 1, 36) };
    };
    const workflowSizePxForTasks = (taskCount) => {
      return Math.min(190, Math.max(92, 72 + Math.sqrt(Math.max(taskCount, 1)) * 34));
    };
    const workflowSizePctForParent = (taskCount, parent) => {
      const parentWidth = parent.getBoundingClientRect().width || mapWidthPx;
      return pctFromPx(workflowSizePxForTasks(taskCount), parentWidth, 1, 78);
    };
    const TASK_BUBBLE_PX = { sm: 24, md: 30, lg: 38, xl: 48 }[this.plugin.settings.dashboardTaskBubbleSize];
    const taskBubbleSizeForParent = (parent) => {
      const rect = parent.getBoundingClientRect();
      const parentDiameter = rect.height || rect.width || 0;
      if (parentDiameter <= 0) return { px: TASK_BUBBLE_PX, pct: 12 };
      const px = TASK_BUBBLE_PX;
      return { px, pct: px / parentDiameter * 100 };
    };
    const setBubbleRect = (el, x, y, size) => {
      el.style.left = `${x}%`;
      el.style.top = `${y}%`;
      el.style.width = `${size}%`;
      el.style.height = "";
    };
    const saveBubblePosition = (bubble) => {
      const key = bubble.getAttribute("data-dashboard-key");
      if (!key) return;
      this.dashboardPositions.set(key, {
        x: parseFloat(bubble.style.left || "0"),
        y: parseFloat(bubble.style.top || "0"),
        size: this.parseBubbleSizeForSave(bubble),
        sizePx: this.parseBubbleSizePxForSave(bubble)
      });
    };
    const saveBubbleTreePositions = (parent) => {
      const bubbles = Array.from(parent.querySelectorAll(".auto-oc-dashboard-area-bubble, .auto-oc-dashboard-workflow-bubble, .auto-oc-dashboard-task-bubble"));
      bubbles.forEach(saveBubblePosition);
    };
    const addLabel = (el, name, ariaLabel = name) => {
      el.tabIndex = 0;
      el.setAttr("aria-label", ariaLabel);
      el.createDiv("auto-oc-dashboard-hover-label").setText(name);
    };
    const addBubbleVisual = (el) => {
      el.createDiv("auto-oc-dashboard-bubble-visual");
    };
    const isDashboardBubble = (el) => {
      return el.classList.contains("auto-oc-dashboard-area-bubble") || el.classList.contains("auto-oc-dashboard-workflow-bubble") || el.classList.contains("auto-oc-dashboard-task-bubble");
    };
    const withDashboardMeasuring = (fn) => {
      map.addClass("auto-oc-dashboard-measuring");
      try {
        return fn();
      } finally {
        map.removeClass("auto-oc-dashboard-measuring");
      }
    };
    const clampBubbleToParent = (bubble) => {
      const parent = bubble.offsetParent;
      if (!parent) return;
      const bounds = parent.getBoundingClientRect();
      const rect = bubble.getBoundingClientRect();
      const widthPct = rect.width / bounds.width * 100;
      const heightPct = rect.height / bounds.height * 100;
      let leftPct = (rect.left - bounds.left) / bounds.width * 100;
      let topPct = (rect.top - bounds.top) / bounds.height * 100;
      if (isDashboardBubble(parent)) {
        const parentRadius = Math.min(bounds.width, bounds.height) / 2;
        const bubbleRadius = rect.width / 2;
        const parentCenterX = bounds.left + bounds.width / 2;
        const parentCenterY = bounds.top + bounds.height / 2;
        const bubbleCenterX = rect.left + rect.width / 2;
        const bubbleCenterY = rect.top + rect.height / 2;
        let dx = bubbleCenterX - parentCenterX;
        let dy = bubbleCenterY - parentCenterY;
        let distance = Math.hypot(dx, dy);
        const maxDistance = Math.max(0, parentRadius - bubbleRadius * 0.88);
        if (distance > maxDistance) {
          if (distance < 0.01) {
            dx = 1;
            dy = 0;
            distance = 1;
          }
          const nextCenterX = parentCenterX + dx / distance * maxDistance;
          const nextCenterY = parentCenterY + dy / distance * maxDistance;
          leftPct = (nextCenterX - bubbleRadius - bounds.left) / bounds.width * 100;
          topPct = (nextCenterY - bubbleRadius - bounds.top) / bounds.height * 100;
        }
      }
      bubble.style.left = `${Math.max(0, Math.min(100 - widthPct, leftPct))}%`;
      bubble.style.top = `${Math.max(0, Math.min(100 - heightPct, topPct))}%`;
    };
    const fitContainerToChildren = (container) => {
      return withDashboardMeasuring(() => {
        if (!isDashboardBubble(container)) return;
        const parent = container.offsetParent;
        if (!parent) return;
        const children = Array.from(container.children).filter((child) => child instanceof HTMLElement && isDashboardBubble(child));
        if (children.length === 0) return;
        const parentRect = parent.getBoundingClientRect();
        const childRects = children.map((child) => ({ child, rect: child.getBoundingClientRect() }));
        const padding = 12;
        const minX = Math.min(...childRects.map(({ rect }) => rect.left)) - padding;
        const maxX = Math.max(...childRects.map(({ rect }) => rect.right)) + padding;
        const minY = Math.min(...childRects.map(({ rect }) => rect.top)) - padding;
        const maxY = Math.max(...childRects.map(({ rect }) => rect.bottom)) + padding;
        const diameterPx = Math.max(maxX - minX, maxY - minY, ...childRects.map(({ rect }) => rect.width + padding * 2));
        const oldCenters = childRects.map(({ child, rect }) => ({
          child,
          centerX: rect.left + rect.width / 2,
          centerY: rect.top + rect.height / 2,
          width: rect.width,
          height: rect.height
        }));
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        const sizePx = Math.min(parentRect.width * 0.96, Math.max(44, diameterPx));
        container.style.left = `${(centerX - sizePx / 2 - parentRect.left) / parentRect.width * 100}%`;
        container.style.top = `${(centerY - sizePx / 2 - parentRect.top) / parentRect.height * 100}%`;
        container.style.width = `${sizePx}px`;
        clampBubbleToParent(container);
        const nextRect = container.getBoundingClientRect();
        oldCenters.forEach(({ child, centerX: childCenterX, centerY: childCenterY, width, height }) => {
          child.style.left = `${(childCenterX - width / 2 - nextRect.left) / nextRect.width * 100}%`;
          child.style.top = `${(childCenterY - height / 2 - nextRect.top) / nextRect.height * 100}%`;
          clampBubbleToParent(child);
        });
        saveBubbleTreePositions(parent);
        void this.persistDashboardPositions();
      });
    };
    const settleBubbleCollisions = (parent, passes = 10) => {
      return withDashboardMeasuring(() => {
        const bubbles = Array.from(parent.children).filter((child) => child instanceof HTMLElement && isDashboardBubble(child));
        const bounds = parent.getBoundingClientRect();
        if (bubbles.length < 2 || bounds.width === 0 || bounds.height === 0) return;
        for (let pass = 0; pass < passes; pass++) {
          let movedAny = false;
          for (let i = 0; i < bubbles.length; i++) {
            for (let j = i + 1; j < bubbles.length; j++) {
              const a = bubbles[i];
              const b = bubbles[j];
              const aRect = a.getBoundingClientRect();
              const bRect = b.getBoundingClientRect();
              const aRadius = aRect.width / 2;
              const bRadius = bRect.width / 2;
              const aCenterX = aRect.left + aRadius;
              const aCenterY = aRect.top + aRect.height / 2;
              const bCenterX = bRect.left + bRadius;
              const bCenterY = bRect.top + bRect.height / 2;
              let dx = bCenterX - aCenterX;
              let dy = bCenterY - aCenterY;
              let distance = Math.hypot(dx, dy);
              const minDistance = aRadius + bRadius + 2;
              if (distance >= minDistance) continue;
              if (distance < 0.01) {
                const angle = (i + j + pass) / Math.max(bubbles.length, 1) * Math.PI * 2;
                dx = Math.cos(angle);
                dy = Math.sin(angle);
                distance = 1;
              }
              const push = (minDistance - distance) * 0.75;
              const moveBubble = (bubble, rect, amount) => {
                const nextLeftPx = rect.left - bounds.left + dx / distance * amount;
                const nextTopPx = rect.top - bounds.top + dy / distance * amount;
                const nextLeftPct = nextLeftPx / bounds.width * 100;
                const nextTopPct = nextTopPx / bounds.height * 100;
                const widthPct = rect.width / bounds.width * 100;
                const heightPct = rect.height / bounds.height * 100;
                bubble.style.left = `${Math.max(0, Math.min(100 - widthPct, nextLeftPct))}%`;
                bubble.style.top = `${Math.max(0, Math.min(100 - heightPct, nextTopPct))}%`;
                clampBubbleToParent(bubble);
              };
              moveBubble(a, aRect, -push);
              moveBubble(b, bRect, push);
              movedAny = true;
            }
          }
          if (!movedAny) break;
        }
        saveBubbleTreePositions(parent);
        void this.persistDashboardPositions();
      });
    };
    const hasBubbleOverlap = (parent) => {
      const bubbles = Array.from(parent.children).filter((child) => child instanceof HTMLElement && isDashboardBubble(child));
      for (let i = 0; i < bubbles.length; i++) {
        for (let j = i + 1; j < bubbles.length; j++) {
          const aRect = bubbles[i].getBoundingClientRect();
          const bRect = bubbles[j].getBoundingClientRect();
          const aRadius = aRect.width / 2;
          const bRadius = bRect.width / 2;
          const distance = Math.hypot(
            bRect.left + bRadius - (aRect.left + aRadius),
            bRect.top + bRect.height / 2 - (aRect.top + aRect.height / 2)
          );
          if (distance < aRadius + bRadius + 2) return true;
        }
      }
      return false;
    };
    const attachBubbleDrag = (el, onClick) => {
      let startX = 0;
      let startY = 0;
      let startLeft = 0;
      let startTop = 0;
      let moved = false;
      let parentRect = null;
      let pointerId = null;
      const resolveSiblingCollisions = () => {
        const parent = el.offsetParent;
        if (!parent) return;
        const bounds = parent.getBoundingClientRect();
        const bubbles = Array.from(parent.children).filter((child) => {
          return child instanceof HTMLElement && isDashboardBubble(child);
        });
        let frontier = /* @__PURE__ */ new Set([el]);
        for (let pass = 0; pass < 5 && frontier.size > 0; pass++) {
          const nextFrontier = /* @__PURE__ */ new Set();
          for (const a of frontier) {
            for (const b of bubbles) {
              if (a === b) continue;
              const aRect = a.getBoundingClientRect();
              const bRect = b.getBoundingClientRect();
              const aRadius = aRect.width / 2;
              const bRadius = bRect.width / 2;
              const aCenterX = aRect.left + aRadius;
              const aCenterY = aRect.top + aRect.height / 2;
              const bCenterX = bRect.left + bRadius;
              const bCenterY = bRect.top + bRect.height / 2;
              let dx = bCenterX - aCenterX;
              let dy = bCenterY - aCenterY;
              let distance = Math.hypot(dx, dy);
              const minDistance = aRadius + bRadius + 4;
              if (distance >= minDistance) continue;
              if (distance < 0.01) {
                const angle = (bubbles.indexOf(a) + bubbles.indexOf(b) + pass) / Math.max(bubbles.length, 1) * Math.PI * 2;
                dx = Math.cos(angle);
                dy = Math.sin(angle);
                distance = 1;
              }
              const push = (minDistance - distance) * 1.05;
              const moveBubble = (bubble, rect, amount) => {
                if (amount === 0) return;
                const nextLeftPx = rect.left - bounds.left + dx / distance * amount;
                const nextTopPx = rect.top - bounds.top + dy / distance * amount;
                const nextLeftPct = nextLeftPx / bounds.width * 100;
                const nextTopPct = nextTopPx / bounds.height * 100;
                const widthPct = rect.width / bounds.width * 100;
                const heightPct = rect.height / bounds.height * 100;
                bubble.style.left = `${Math.max(0, Math.min(100 - widthPct, nextLeftPct))}%`;
                bubble.style.top = `${Math.max(0, Math.min(100 - heightPct, nextTopPct))}%`;
              };
              moveBubble(b, bRect, push);
              clampBubbleToParent(b);
              nextFrontier.add(b);
            }
          }
          frontier = nextFrontier;
        }
      };
      el.onpointerdown = (event) => {
        var _a, _b;
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        pointerId = event.pointerId;
        startX = event.clientX;
        startY = event.clientY;
        startLeft = parseFloat(el.style.left || "0");
        startTop = parseFloat(el.style.top || "0");
        parentRect = ((_a = el.offsetParent) == null ? void 0 : _a.getBoundingClientRect()) || null;
        moved = false;
        el.addClass("auto-oc-dashboard-dragging");
        (_b = el.offsetParent) == null ? void 0 : _b.addClass("auto-oc-dashboard-colliding");
        el.style.zIndex = "30";
        el.setPointerCapture(event.pointerId);
      };
      el.onpointermove = (event) => {
        if (pointerId !== event.pointerId || !parentRect) return;
        const dx = event.clientX - startX;
        const dy = event.clientY - startY;
        if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
        const bubbleRect = el.getBoundingClientRect();
        const widthPct = bubbleRect.width / parentRect.width * 100;
        const heightPct = bubbleRect.height / parentRect.height * 100;
        const nextLeft = startLeft + dx / parentRect.width * 100;
        const nextTop = startTop + dy / parentRect.height * 100;
        el.style.left = `${Math.max(0, Math.min(100 - widthPct, nextLeft))}%`;
        el.style.top = `${Math.max(0, Math.min(100 - heightPct, nextTop))}%`;
        resolveSiblingCollisions();
      };
      el.onpointerup = (event) => {
        if (pointerId !== event.pointerId) return;
        const parent = el.offsetParent;
        event.preventDefault();
        event.stopPropagation();
        el.releasePointerCapture(event.pointerId);
        el.removeClass("auto-oc-dashboard-dragging");
        parent == null ? void 0 : parent.removeClass("auto-oc-dashboard-colliding");
        el.style.zIndex = "";
        pointerId = null;
        parentRect = null;
        if (parent) {
          settleBubbleCollisions(parent, 24);
          if (isDashboardBubble(parent)) {
            fitContainerToChildren(parent);
            const grandParent = parent.offsetParent;
            if (grandParent && isDashboardBubble(grandParent)) fitContainerToChildren(grandParent);
          }
        }
        if (!moved && onClick) onClick();
      };
      el.onpointercancel = (event) => {
        var _a;
        if (pointerId !== event.pointerId) return;
        el.removeClass("auto-oc-dashboard-dragging");
        (_a = el.offsetParent) == null ? void 0 : _a.removeClass("auto-oc-dashboard-colliding");
        el.style.zIndex = "";
        pointerId = null;
        parentRect = null;
      };
      el.onkeydown = (event) => {
        if (event.key !== "Enter" || !onClick) return;
        event.preventDefault();
        event.stopPropagation();
        onClick();
      };
    };
    const layoutTopLevel = (items) => {
      const jitterForKey = (key, axis) => {
        let hash = 0;
        for (let i = 0; i < key.length; i++) hash = (hash << 5) - hash + key.charCodeAt(i) + axis * 131 | 0;
        return (Math.abs(hash) % 1e3 / 1e3 - 0.5) * 10;
      };
      const count = Math.max(items.length, 1);
      const cols = count <= 1 ? 1 : count <= 4 ? 2 : Math.ceil(Math.sqrt(count));
      const rows = Math.ceil(count / cols);
      const gap = 4;
      const cellWidth = (100 - gap * (cols + 1)) / cols;
      const cellHeight = (100 - gap * (rows + 1)) / rows;
      return items.map((item, index) => {
        const col = index % cols;
        const row = Math.floor(index / cols);
        const size = Math.min(item.size, cellWidth, cellHeight);
        const saved = this.dashboardPositions.get(item.key);
        if (saved) {
          return {
            ...item,
            size,
            x: Math.max(0, Math.min(100 - size, saved.x)),
            y: Math.max(0, Math.min(100 - size, saved.y))
          };
        }
        const jitterX = Math.max(-cellWidth * 0.18, Math.min(cellWidth * 0.18, jitterForKey(item.key, 0)));
        const jitterY = Math.max(-cellHeight * 0.18, Math.min(cellHeight * 0.18, jitterForKey(item.key, 1)));
        return {
          ...item,
          size,
          x: Math.max(0, Math.min(100 - size, gap + col * (cellWidth + gap) + (cellWidth - size) / 2 + jitterX)),
          y: Math.max(0, Math.min(100 - size, gap + row * (cellHeight + gap) + (cellHeight - size) / 2 + jitterY))
        };
      });
    };
    const createAreaBubble = (name, x, y, size, maxPx) => {
      var _a;
      const areaBubble = map.createDiv("auto-oc-dashboard-area-bubble");
      areaBubble.setAttr("data-dashboard-key", `area:${name}`);
      setBubbleRect(areaBubble, x, y, size);
      const saved = this.dashboardPositions.get(`area:${name}`);
      const widthPx = (_a = saved == null ? void 0 : saved.sizePx) != null ? _a : maxPx;
      if (widthPx) areaBubble.style.width = `${widthPx}px`;
      addBubbleVisual(areaBubble);
      areaBubble.setAttr("aria-label", `Area: ${name}`);
      areaBubble.tabIndex = 0;
      const areaLabel = areaBubble.createDiv("auto-oc-dashboard-area-label");
      areaLabel.setText(name);
      areaBubble.createDiv("auto-oc-dashboard-hover-label").setText(name);
      attachBubbleDrag(areaBubble);
      clampBubbleToParent(areaBubble);
      return areaBubble;
    };
    const createTaskBubble = (parent, task, x, y, size, extraCls = "", positionKey = `task:${task.id}`) => {
      var _a, _b;
      const taskBubble = parent.createDiv(`auto-oc-dashboard-task-bubble auto-oc-dashboard-task-${task.status} auto-oc-dashboard-task-${this.plugin.settings.dashboardTaskBubbleSize} ${extraCls}`.trim());
      taskBubble.setAttr("data-auto-oc-task-id", task.id);
      taskBubble.setAttr("data-dashboard-key", positionKey);
      taskBubble.setAttr("data-usage-count", String(taskUsage.get(task.id) || 0));
      addBubbleVisual(taskBubble);
      const saved = this.dashboardPositions.get(positionKey);
      let posX = (_a = saved == null ? void 0 : saved.x) != null ? _a : x;
      let posY = (_b = saved == null ? void 0 : saved.y) != null ? _b : y;
      if (!saved) {
        const usage = taskUsage.get(task.id) || 0;
        const fails = taskFailCounts.get(task.id) || 0;
        const usageLift = Math.min(usage * 1.2, 14);
        const failDrop = Math.min(fails * 1.5, 12);
        posY = Math.max(0, Math.min(100 - size, posY - usageLift + failDrop));
      }
      setBubbleRect(taskBubble, posX, posY, size);
      const finalPx = taskBubbleSizeForParent(parent).px;
      taskBubble.style.width = `${finalPx}px`;
      taskBubble.style.height = `${finalPx}px`;
      const usageCount = taskUsage.get(task.id) || 0;
      addLabel(taskBubble, task.name, `Task: ${task.name}. Status: ${task.status}. Usage count: ${usageCount}. Press Enter to open in Tasks.`);
      attachBubbleDrag(taskBubble, () => this.openTaskInList(task));
      clampBubbleToParent(taskBubble);
    };
    const configuredAreaNames = areaNames.filter((name) => name !== "No area");
    const areaContentWeight = (areaWorkflows, looseTasks) => {
      return looseTasks.length + areaWorkflows.reduce((sum, workflow) => {
        return sum + workflow.steps.filter((step) => step.taskId && taskById.has(step.taskId)).length;
      }, 0);
    };
    const topLevelItems = [];
    configuredAreaNames.forEach((name) => {
      const areaWorkflows = workflows.filter((workflow) => areaName(workflow.area) === name);
      const looseTasks = tasks.filter((task) => !taskUsage.has(task.id) && areaName(task.area) === name);
      const contentWeight = areaContentWeight(areaWorkflows, looseTasks);
      if (contentWeight === 0) return;
      const areaSize = areaSizeForContent(contentWeight);
      topLevelItems.push({ key: `area:${name}`, size: areaSize.pct, maxPx: areaSize.px });
    });
    const noAreaWorkflows = workflows.filter((workflow) => areaName(workflow.area) === "No area");
    const noAreaLooseTasks = tasks.filter((task) => !taskUsage.has(task.id) && areaName(task.area) === "No area");
    noAreaWorkflows.forEach((workflow) => {
      const taskSteps = workflow.steps.filter((step) => step.taskId && taskById.has(step.taskId));
      const workflowPx = workflowSizePxForTasks(taskSteps.length);
      topLevelItems.push({ key: `workflow:${workflow.id}`, size: pctFromPx(workflowPx, mapWidthPx, 1, 30), maxPx: workflowPx });
    });
    noAreaLooseTasks.forEach((task) => topLevelItems.push({ key: `task:${task.id}`, size: taskBubbleSizeForParent(map).pct }));
    const topLevelLayout = new Map(layoutTopLevel(topLevelItems).map((item) => [item.key, item]));
    configuredAreaNames.forEach((name) => {
      const areaLayout = topLevelLayout.get(`area:${name}`);
      if (!areaLayout) return;
      const areaWorkflows = workflows.filter((workflow) => areaName(workflow.area) === name);
      const looseTasks = tasks.filter((task) => !taskUsage.has(task.id) && areaName(task.area) === name);
      const contentWeight = areaContentWeight(areaWorkflows, looseTasks);
      if (contentWeight === 0) return;
      const areaBubble = createAreaBubble(name, areaLayout.x, areaLayout.y, areaLayout.size, areaLayout.maxPx);
      if (looseTasks.some((task) => task.status === "running") || areaWorkflows.some((workflow) => workflow.status === "running" || workflow.steps.some((step) => {
        var _a;
        return ((_a = taskById.get(step.taskId || "")) == null ? void 0 : _a.status) === "running";
      }))) {
        areaBubble.addClass("auto-oc-dashboard-has-running");
      }
      if (looseTasks.some((task) => task.status === "failed") || areaWorkflows.some((workflow) => workflow.status === "failed" || workflow.steps.some((step) => {
        var _a;
        return ((_a = taskById.get(step.taskId || "")) == null ? void 0 : _a.status) === "failed";
      }))) {
        areaBubble.addClass("auto-oc-dashboard-has-failed");
      }
      const areaWorkflowCount = Math.max(areaWorkflows.length, 1);
      areaWorkflows.forEach((workflow, workflowIndex) => {
        var _a, _b, _c;
        const taskSteps = workflow.steps.filter((step) => step.taskId && taskById.has(step.taskId));
        const angle = -Math.PI / 2 + workflowIndex * Math.PI * 2 / areaWorkflowCount;
        const workflowSize = workflowSizePctForParent(taskSteps.length, areaBubble);
        const workflowRadius = areaWorkflowCount === 1 ? 0 : Math.max(0, 46 - workflowSize / 2);
        const workflowX = 50 + Math.cos(angle) * workflowRadius - workflowSize / 2;
        const workflowY = 50 + Math.sin(angle) * workflowRadius - workflowSize / 2;
        const workflowBubble = areaBubble.createDiv(`auto-oc-dashboard-workflow-bubble auto-oc-dashboard-workflow-${workflow.status}`);
        workflowBubble.setAttr("data-auto-oc-workflow-id", workflow.id);
        addBubbleVisual(workflowBubble);
        if (taskSteps.some((step) => {
          var _a2;
          return ((_a2 = taskById.get(step.taskId || "")) == null ? void 0 : _a2.status) === "running";
        })) workflowBubble.addClass("auto-oc-dashboard-has-running");
        if (taskSteps.some((step) => {
          var _a2;
          return ((_a2 = taskById.get(step.taskId || "")) == null ? void 0 : _a2.status) === "failed";
        })) workflowBubble.addClass("auto-oc-dashboard-has-failed");
        const workflowKey = `area:${name}:workflow:${workflow.id}`;
        workflowBubble.setAttr("data-dashboard-key", workflowKey);
        const savedWorkflow = this.dashboardPositions.get(workflowKey);
        setBubbleRect(workflowBubble, (_a = savedWorkflow == null ? void 0 : savedWorkflow.x) != null ? _a : workflowX, (_b = savedWorkflow == null ? void 0 : savedWorkflow.y) != null ? _b : workflowY, workflowSize);
        workflowBubble.style.width = `${(_c = savedWorkflow == null ? void 0 : savedWorkflow.sizePx) != null ? _c : workflowSizePxForTasks(taskSteps.length)}px`;
        addLabel(workflowBubble, workflow.name, `Workflow: ${workflow.name}. Area: ${name}. Status: ${workflow.status}. Press Enter to open in WorkFlows.`);
        attachBubbleDrag(workflowBubble, () => this.openWorkflowInList(workflow));
        clampBubbleToParent(workflowBubble);
        const taskCount = Math.max(taskSteps.length, 1);
        taskSteps.forEach((step, stepIndex) => {
          const task = taskById.get(step.taskId);
          if (!task) return;
          const taskAngle = -Math.PI / 2 + stepIndex * Math.PI * 2 / taskCount;
          const taskSize = taskBubbleSizeForParent(workflowBubble).pct;
          const radius = taskCount === 1 ? 0 : Math.max(0, 45 - taskSize / 2);
          const taskX = 50 + Math.cos(taskAngle) * radius - taskSize / 2;
          const taskY = 50 + Math.sin(taskAngle) * radius - taskSize / 2;
          createTaskBubble(workflowBubble, task, taskX, taskY, taskSize, "auto-oc-dashboard-task-used", `${workflowKey}:task:${task.id}:${stepIndex}`);
        });
      });
      const looseCount = Math.max(looseTasks.length, 1);
      looseTasks.forEach((task, taskIndex) => {
        const angle = -Math.PI / 2 + taskIndex * Math.PI * 2 / looseCount;
        const taskSize = taskBubbleSizeForParent(areaBubble).pct;
        const radius = looseCount === 1 ? 0 : Math.max(0, 45 - taskSize / 2);
        const taskX = 50 + Math.cos(angle) * radius - taskSize / 2;
        const taskY = 50 + Math.sin(angle) * radius - taskSize / 2;
        createTaskBubble(areaBubble, task, taskX, taskY, taskSize, "auto-oc-dashboard-task-loose", `area:${name}:task:${task.id}`);
      });
    });
    noAreaWorkflows.forEach((workflow) => {
      var _a, _b;
      const taskSteps = workflow.steps.filter((step) => step.taskId && taskById.has(step.taskId));
      const workflowSize = pctFromPx(workflowSizePxForTasks(taskSteps.length), mapWidthPx, 1, 30);
      const workflowLayout = topLevelLayout.get(`workflow:${workflow.id}`);
      if (!workflowLayout) return;
      const workflowBubble = map.createDiv(`auto-oc-dashboard-workflow-bubble auto-oc-dashboard-workflow-${workflow.status}`);
      workflowBubble.setAttr("data-auto-oc-workflow-id", workflow.id);
      addBubbleVisual(workflowBubble);
      if (taskSteps.some((step) => {
        var _a2;
        return ((_a2 = taskById.get(step.taskId || "")) == null ? void 0 : _a2.status) === "running";
      })) workflowBubble.addClass("auto-oc-dashboard-has-running");
      if (taskSteps.some((step) => {
        var _a2;
        return ((_a2 = taskById.get(step.taskId || "")) == null ? void 0 : _a2.status) === "failed";
      })) workflowBubble.addClass("auto-oc-dashboard-has-failed");
      workflowBubble.setAttr("data-dashboard-key", `workflow:${workflow.id}`);
      const savedWorkflow = this.dashboardPositions.get(`workflow:${workflow.id}`);
      setBubbleRect(workflowBubble, workflowLayout.x, workflowLayout.y, workflowSize);
      workflowBubble.style.width = `${(_b = (_a = savedWorkflow == null ? void 0 : savedWorkflow.sizePx) != null ? _a : workflowLayout.maxPx) != null ? _b : workflowSizePxForTasks(taskSteps.length)}px`;
      addLabel(workflowBubble, workflow.name, `Workflow: ${workflow.name}. Area: No area. Status: ${workflow.status}. Press Enter to open in WorkFlows.`);
      attachBubbleDrag(workflowBubble, () => this.openWorkflowInList(workflow));
      clampBubbleToParent(workflowBubble);
      const taskCount = Math.max(taskSteps.length, 1);
      taskSteps.forEach((step, stepIndex) => {
        const task = taskById.get(step.taskId);
        if (!task) return;
        const taskAngle = -Math.PI / 2 + stepIndex * Math.PI * 2 / taskCount;
        const taskSize = taskBubbleSizeForParent(workflowBubble).pct;
        const radius = taskCount === 1 ? 0 : Math.max(0, 45 - taskSize / 2);
        const taskX = 50 + Math.cos(taskAngle) * radius - taskSize / 2;
        const taskY = 50 + Math.sin(taskAngle) * radius - taskSize / 2;
        createTaskBubble(workflowBubble, task, taskX, taskY, taskSize, "auto-oc-dashboard-task-used", `workflow:${workflow.id}:task:${task.id}:${stepIndex}`);
      });
    });
    noAreaLooseTasks.forEach((task) => {
      const taskLayout = topLevelLayout.get(`task:${task.id}`);
      if (!taskLayout) return;
      const taskSize = taskBubbleSizeForParent(map).pct;
      createTaskBubble(map, task, taskLayout.x, taskLayout.y, taskSize, "auto-oc-dashboard-task-loose");
    });
    this.syncDashboardTaskDrift(tasks);
    this.forceDashboardFitOnNextRender = false;
    return;
  }
  renderTasks(containerEl) {
    const tasks = this.plugin.settings.tasks;
    const renderTaskResults = (root) => {
      root.empty();
      const stats = root.createDiv("auto-oc-stats");
      const running = tasks.filter((t) => t.status === "running").length;
      const completed = tasks.filter((t) => t.status === "completed").length;
      const failed = tasks.filter((t) => t.status === "failed").length;
      stats.createEl("span", { text: `${tasks.length} tasks` });
      if (running > 0) stats.createEl("span", { text: `\u{1F7E1} ${running} running`, cls: "auto-oc-stat-running" });
      if (failed > 0) stats.createEl("span", { text: `\u{1F534} ${failed} failed`, cls: "auto-oc-stat-failed" });
      if (completed > 0) stats.createEl("span", { text: `\u{1F7E2} ${completed} completed` });
      const filteredTasks = tasks.filter((t) => {
        var _a;
        const area = ((_a = t.area) == null ? void 0 : _a.trim()) || "No area";
        const matchesText = t.name.toLowerCase().includes(this.filterText) || t.prompt.toLowerCase().includes(this.filterText) || area.toLowerCase().includes(this.filterText);
        const matchesStatus = this.filterStatus === "all" || t.status === this.filterStatus;
        const matchesArea = this.filterArea === "all" || area === this.filterArea;
        return matchesText && matchesStatus && matchesArea;
      });
      if (filteredTasks.length === 0) {
        root.createEl("p", {
          text: this.filterText || this.filterStatus !== "all" || this.filterArea !== "all" ? "No tasks match your filters." : 'No tasks scheduled. Create one with "+New Task".',
          cls: "auto-oc-empty"
        });
        return;
      }
      const list = root.createDiv("auto-oc-list");
      for (const task of [...filteredTasks].reverse()) {
        this.renderTaskCard(list, task);
      }
    };
    const filterBar = containerEl.createDiv("auto-oc-filter-bar");
    const searchInput = filterBar.createEl("input", {
      type: "text",
      placeholder: "\u{1F50D} Search name or prompt...",
      cls: "auto-oc-search-input"
    });
    searchInput.value = this.filterText;
    searchInput.oninput = () => {
      this.filterText = searchInput.value.toLowerCase();
      renderTaskResults(resultsRoot);
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
      renderTaskResults(resultsRoot);
    };
    const areaSelect = filterBar.createEl("select", {
      cls: "auto-oc-status-select"
    });
    const areaOptions = ["all", ...getConfiguredAreaNames(this.plugin.settings), "No area"];
    Array.from(new Set(areaOptions)).forEach((area) => {
      const opt = areaSelect.createEl("option");
      opt.value = area;
      opt.text = area === "all" ? "All areas" : area;
    });
    areaSelect.value = areaOptions.includes(this.filterArea) ? this.filterArea : "all";
    this.filterArea = areaSelect.value;
    areaSelect.onchange = () => {
      this.filterArea = areaSelect.value;
      renderTaskResults(resultsRoot);
    };
    const resultsRoot = containerEl.createDiv("auto-oc-filter-results");
    renderTaskResults(resultsRoot);
  }
  renderTaskCard(parent, task) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const card = parent.createDiv(`auto-oc-card auto-oc-status-${task.status}`);
    card.setAttr("data-auto-oc-task-id", task.id);
    const summary = card.createDiv("auto-oc-card-summary");
    const title = summary.createEl("span", { text: task.name, cls: "auto-oc-task-name" });
    summary.createEl("span", {
      text: (task.taskKind || "opencode") === "code" ? "Code" : task.taskKind === "codex" ? task.interactiveTerminal ? "ChatGPT / Codex" : "Codex" : task.taskKind === "copilot" ? "GitHub Copilot CLI" : task.interactiveTerminal ? "OpenCode CLI" : "OpenCode",
      cls: `auto-oc-task-engine auto-oc-task-engine-${task.taskKind || "opencode"}`
    });
    const badge = summary.createEl("span", {
      text: task.pendingCodexApproval ? "waiting approval" : task.status,
      cls: `auto-oc-badge auto-oc-badge-${task.status}`
    });
    const quickActions = summary.createDiv("auto-oc-card-quick-actions");
    const btnQuickRun = quickActions.createEl("button", { text: "\u25B6", cls: "auto-oc-btn-run" });
    btnQuickRun.title = task.status === "running" ? "Running" : "Run now";
    btnQuickRun.disabled = task.status === "running";
    btnQuickRun.onclick = (e) => {
      e.stopPropagation();
      this.plugin.runTask(task);
    };
    if (task.status === "running") {
      const btnQuickStop = quickActions.createEl("button", { text: "\u23F9", cls: "auto-oc-btn-stop" });
      btnQuickStop.title = "Terminate process now";
      btnQuickStop.onclick = async (e) => {
        e.stopPropagation();
        btnQuickStop.disabled = true;
        await this.plugin.killTask(task.id);
      };
    }
    if (task.pendingCodexApproval) {
      const btnApprove = quickActions.createEl("button", { text: "\u2713", cls: "auto-oc-btn-run" });
      btnApprove.title = task.pendingCodexApproval.summary;
      btnApprove.onclick = async (e) => {
        e.stopPropagation();
        await this.plugin.resolveCodexApproval(task.id, true);
      };
      const btnReject = quickActions.createEl("button", { text: "\u2715", cls: "auto-oc-btn-stop" });
      btnReject.title = `Reject: ${task.pendingCodexApproval.summary}`;
      btnReject.onclick = async (e) => {
        e.stopPropagation();
        await this.plugin.resolveCodexApproval(task.id, false);
      };
    }
    const btnQuickLog = quickActions.createEl("button", { text: "\u{1F4C4}", cls: task.status === "running" ? "auto-oc-btn-log-live" : "auto-oc-btn-output" });
    btnQuickLog.title = task.status === "running" ? "Live log" : "Log";
    btnQuickLog.disabled = !task.output && task.status !== "running";
    btnQuickLog.onclick = (e) => {
      e.stopPropagation();
      new LiveLogModal(this.app, task, this.plugin).open();
    };
    const btnQuickHistory = quickActions.createEl("button", { text: "\u{1F4DC}", cls: "auto-oc-btn-history" });
    btnQuickHistory.title = "History";
    btnQuickHistory.onclick = (e) => {
      e.stopPropagation();
      try {
        new LogHistoryModal(this.app, task, this.plugin).open();
      } catch (err) {
        new import_obsidian.Notice(`AutoOC: could not open history \u2014 ${String(err)}`);
      }
    };
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
    const isExpanded = this.expandedTasks.has(task.id);
    details.style.display = isExpanded ? "block" : "none";
    const meta = details.createDiv("auto-oc-card-meta");
    const modelLabel = task.taskKind === "codex" ? (_c = (_b = (_a = this.plugin.availableCodexModels.find((m) => m.value === task.model)) == null ? void 0 : _a.label) != null ? _b : task.model) != null ? _c : "Automatic" : task.taskKind === "copilot" ? task.model || this.plugin.settings.defaultCopilotModel || "Automatic" : (_e = (_d = this.plugin.availableModels.find((m) => m.value === task.model)) == null ? void 0 : _d.label) != null ? _e : task.model;
    meta.createEl("span", { text: `\u{1F5C2} ${((_f = task.area) == null ? void 0 : _f.trim()) || "No area"}` });
    if ((task.taskKind || "opencode") === "code") {
      meta.createEl("span", { text: "{ } Code task" });
    } else if (task.taskKind === "codex") {
      meta.createEl("span", { text: `\u2726 Codex \xB7 ${modelLabel || "Automatic"}` });
      if (task.interactiveTerminal) meta.createEl("span", { text: "ChatGPT app task" });
      meta.createEl("span", { text: `\u{1F9E0} ${task.reasoningEffort || this.plugin.settings.defaultCodexReasoningEffort}` });
    } else if (task.taskKind === "copilot") {
      meta.createEl("span", { text: `GitHub Copilot CLI \xB7 ${modelLabel}` });
      meta.createEl("span", { text: task.copilotAllowAllTools ? "Tools allowed automatically" : "Read-only tools" });
    } else {
      if (task.interactiveTerminal) meta.createEl("span", { text: "CLI task" });
      else meta.createEl("span", { text: "OpenCode" });
      meta.createEl("span", { text: `\u{1F916} ${modelLabel}` });
      meta.createEl("span", { text: `\u2699\uFE0F ${this.plugin.getEffectiveAgent(task.agent)}` });
    }
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
    } else if (task.scheduleType === "interval") {
      const value = (_g = task.scheduleIntervalValue) != null ? _g : 10;
      const unit = (_h = task.scheduleIntervalUnit) != null ? _h : "minutes";
      scheduleText = `\u{1F501} Every ${value} ${unit}`;
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
    const preview = details.createDiv((task.taskKind || "opencode") === "code" ? "auto-oc-code-preview-wrap" : "auto-oc-prompt-preview");
    if ((task.taskKind || "opencode") === "code") {
      renderCodePreview(preview, task.code || task.prompt || "", 500);
    } else {
      preview.createEl("span", {
        text: task.prompt.slice(0, 140) + (task.prompt.length > 140 ? "\u2026" : "")
      });
    }
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
    if (task.pendingCodexApproval) {
      const approval = actions.createDiv("auto-oc-codex-approval");
      approval.createEl("span", { text: `Approval needed: ${task.pendingCodexApproval.summary}` });
      const approve = approval.createEl("button", { text: "\u2713 Approve", cls: "auto-oc-btn-run" });
      approve.onclick = async (e) => {
        e.stopPropagation();
        await this.plugin.resolveCodexApproval(task.id, true);
      };
      const reject = approval.createEl("button", { text: "\u2715 Reject", cls: "auto-oc-btn-stop" });
      reject.onclick = async (e) => {
        e.stopPropagation();
        await this.plugin.resolveCodexApproval(task.id, false);
      };
    }
    const btnLog = actions.createEl("button", {
      text: task.status === "running" ? "\u{1F4E1} Live Log" : "\u{1F4C4} Log",
      cls: task.status === "running" ? "auto-oc-btn-log-live" : "auto-oc-btn-output"
    });
    btnLog.disabled = !task.output && task.status !== "running";
    btnLog.title = task.output ? "" : "No output yet";
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
      if (isHidden) {
        this.expandedTasks.add(task.id);
      } else {
        this.expandedTasks.delete(task.id);
      }
    };
  }
  // ── Workflows rendering ──────────────────────────────────────────────────
  renderWorkflows(containerEl) {
    const help = containerEl.createDiv("auto-oc-workflow-panel-help");
    help.createSpan({
      text: "Workflows run tasks in order using their own schedule. Per-step transitions decide whether the next task starts: success, force, or AI decides."
    });
    const workflows = this.plugin.settings.workflows;
    const renderWorkflowResults = (root) => {
      root.empty();
      const stats = root.createDiv("auto-oc-stats");
      const completed = workflows.filter((w) => w.status === "completed").length;
      const running = workflows.filter((w) => w.status === "running").length;
      const failed = workflows.filter((w) => w.status === "failed").length;
      stats.createEl("span", { text: `${workflows.length} workflows` });
      if (running > 0) stats.createEl("span", { text: `\u{1F7E1} ${running} running`, cls: "auto-oc-stat-running" });
      if (failed > 0) stats.createEl("span", { text: `\u{1F534} ${failed} failed`, cls: "auto-oc-stat-failed" });
      if (completed > 0) stats.createEl("span", { text: `\u{1F7E2} ${completed} completed` });
      const filteredWorkflows = workflows.filter((workflow) => {
        var _a;
        const area = ((_a = workflow.area) == null ? void 0 : _a.trim()) || "No area";
        const stepText = workflow.steps.map((step) => {
          var _a2, _b;
          if (step.stepKind === "code") return step.code || "code";
          if (step.stepKind === "delay") return `${(_a2 = step.delayValue) != null ? _a2 : 5} ${(_b = step.delayUnit) != null ? _b : "minutes"}`;
          const task = this.plugin.settings.tasks.find((candidate) => candidate.id === step.taskId);
          return task ? `${task.name} ${task.prompt} ${task.area || ""}` : "";
        }).join(" ");
        const haystack = `${workflow.name} ${workflow.description || ""} ${area} ${stepText}`.toLowerCase();
        const matchesText = haystack.includes(this.filterText);
        const matchesStatus = this.filterStatus === "all" || workflow.status === this.filterStatus;
        const matchesArea = this.filterArea === "all" || area === this.filterArea;
        return matchesText && matchesStatus && matchesArea;
      });
      if (filteredWorkflows.length === 0) {
        root.createEl("p", {
          text: this.filterText || this.filterStatus !== "all" || this.filterArea !== "all" ? "No workflows match your filters." : 'No workflows yet. Chain tasks together with "+ New Workflow".',
          cls: "auto-oc-empty"
        });
        return;
      }
      const list = root.createDiv("auto-oc-list");
      for (const wf of [...filteredWorkflows].reverse()) {
        this.renderWorkflowCard(list, wf);
      }
    };
    const filterBar = containerEl.createDiv("auto-oc-filter-bar");
    const searchInput = filterBar.createEl("input", {
      type: "text",
      placeholder: "\u{1F50D} Search workflows...",
      cls: "auto-oc-search-input"
    });
    searchInput.value = this.filterText;
    searchInput.oninput = () => {
      this.filterText = searchInput.value.toLowerCase();
      renderWorkflowResults(resultsRoot);
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
      renderWorkflowResults(resultsRoot);
    };
    const areaSelect = filterBar.createEl("select", {
      cls: "auto-oc-status-select"
    });
    const areaOptions = ["all", ...getConfiguredAreaNames(this.plugin.settings), "No area"];
    Array.from(new Set(areaOptions)).forEach((area) => {
      const opt = areaSelect.createEl("option");
      opt.value = area;
      opt.text = area === "all" ? "All areas" : area;
    });
    areaSelect.value = areaOptions.includes(this.filterArea) ? this.filterArea : "all";
    this.filterArea = areaSelect.value;
    areaSelect.onchange = () => {
      this.filterArea = areaSelect.value;
      renderWorkflowResults(resultsRoot);
    };
    const resultsRoot = containerEl.createDiv("auto-oc-filter-results");
    renderWorkflowResults(resultsRoot);
  }
  renderWorkflowCard(parent, workflow) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j;
    const card = parent.createDiv(`auto-oc-card auto-oc-status-${workflow.status}`);
    card.setAttr("data-auto-oc-workflow-id", workflow.id);
    const summary = card.createDiv("auto-oc-card-summary");
    const nameEl = summary.createEl("span", {
      text: workflow.name,
      cls: "auto-oc-task-name"
    });
    const badge = summary.createEl("span", {
      text: workflow.status,
      cls: `auto-oc-badge auto-oc-badge-${workflow.status}`
    });
    const quickActions = summary.createDiv("auto-oc-card-quick-actions");
    const btnQuickRun = quickActions.createEl("button", { text: "\u25B6", cls: "auto-oc-btn-run" });
    btnQuickRun.title = this.plugin.isWorkflowExecuting(workflow.id) ? "Running" : "Run workflow";
    btnQuickRun.disabled = this.plugin.isWorkflowExecuting(workflow.id) || ["ready", "in_flight"].includes((_a = workflow.runtimeExecution) == null ? void 0 : _a.phase);
    btnQuickRun.onclick = (e) => {
      e.stopPropagation();
      this.plugin.runWorkflow(workflow);
    };
    if (this.plugin.isWorkflowExecuting(workflow.id)) {
      const btnQuickStop = quickActions.createEl("button", { text: "\u23F9", cls: "auto-oc-btn-stop" });
      btnQuickStop.title = "Stop workflow now";
      btnQuickStop.onclick = async (e) => {
        e.stopPropagation();
        btnQuickStop.disabled = true;
        await this.plugin.killWorkflow(workflow.id);
      };
    }
    const currentTask = this.plugin.settings.tasks.find((task) => {
      var _a2;
      return task.id === ((_a2 = workflow.steps[workflow.currentStep]) == null ? void 0 : _a2.taskId);
    });
    const btnQuickLog = quickActions.createEl("button", { text: "\u{1F4C4}", cls: "auto-oc-btn-output" });
    btnQuickLog.title = "Current step log";
    btnQuickLog.disabled = !currentTask || !currentTask.output && currentTask.status !== "running";
    btnQuickLog.onclick = (e) => {
      e.stopPropagation();
      if (currentTask) new LiveLogModal(this.app, currentTask, this.plugin).open();
    };
    const btnQuickHistory = quickActions.createEl("button", { text: "\u{1F4DC}", cls: "auto-oc-btn-history" });
    btnQuickHistory.title = "Current step history";
    btnQuickHistory.disabled = !currentTask;
    btnQuickHistory.onclick = (e) => {
      e.stopPropagation();
      if (currentTask) new LogHistoryModal(this.app, currentTask, this.plugin).open();
    };
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
    const isExpandedWf = this.expandedWorkflows.has(workflow.id);
    details.style.display = isExpandedWf ? "block" : "none";
    const areaMeta = details.createDiv("auto-oc-card-meta");
    areaMeta.createEl("span", { text: `\u{1F5C2} ${((_b = workflow.area) == null ? void 0 : _b.trim()) || "No area"}` });
    if (workflow.description) {
      const desc = details.createDiv("auto-oc-prompt-preview");
      desc.createEl("span", { text: workflow.description.slice(0, 200) });
    }
    const stepsDiv = details.createDiv("auto-oc-workflow-steps-mini");
    const stepLabel = (step) => {
      var _a2, _b2, _c2;
      if ((_a2 = step.name) == null ? void 0 : _a2.trim()) return step.name.trim();
      if (step.stepKind === "code") return "{ } Code";
      if (step.stepKind === "delay") return `\u23F1 ${(_b2 = step.delayValue) != null ? _b2 : 5} ${(_c2 = step.delayUnit) != null ? _c2 : "minutes"}`;
      const t = this.plugin.settings.tasks.find((task) => task.id === step.taskId);
      return t ? t.name : "(deleted task)";
    };
    const transitionModeLabel = (mode) => {
      if (mode === "force") return "force";
      if (mode === "eval") return "AI";
      if (mode === "conditional") return "condition";
      return "default";
    };
    for (let i = 0; i < workflow.steps.length; i++) {
      const step = workflow.steps[i];
      const task = this.plugin.settings.tasks.find((t) => t.id === step.taskId);
      const stepName = stepLabel(step);
      const stepItem = stepsDiv.createDiv("auto-oc-workflow-task-detail");
      const isCurrent = this.plugin.isWorkflowExecuting(workflow.id) && workflow.currentStep === i;
      const isDone = workflow.currentStep > i || workflow.status === "completed" && workflow.currentStep >= i;
      const icon = isDone ? "\u2705" : isCurrent ? "\u23F3" : "\u2B1C";
      const stepHeader = stepItem.createDiv("auto-oc-workflow-task-header");
      stepHeader.createSpan({
        text: `${icon} Step ${i + 1}: ${stepName}`,
        cls: "auto-oc-workflow-task-title"
      });
      if (step.stepKind !== "task" && step.status) {
        stepHeader.createSpan({
          text: step.status,
          cls: `auto-oc-badge auto-oc-badge-${step.status}`
        });
      }
      if (task) {
        stepHeader.createSpan({
          text: task.status,
          cls: `auto-oc-badge auto-oc-badge-${task.status}`
        });
      }
      const stepArea = ((_c = step.area) == null ? void 0 : _c.trim()) || ((_d = workflow.area) == null ? void 0 : _d.trim());
      if (stepArea) {
        stepHeader.createSpan({
          text: `\u{1F5C2} ${stepArea}`,
          cls: "auto-oc-workflow-transition-label"
        });
      }
      const transitions = step.transitions && step.transitions.length > 0 ? step.transitions : workflow.steps[i + 1] ? [{ toStepId: workflow.steps[i + 1].id, mode: step.transitionMode || "default" }] : [];
      if (transitions.length > 0) {
        const transitionSummary = transitions.map((transition) => {
          const target = workflow.steps.find((candidate) => candidate.id === transition.toStepId);
          return `\u2192 ${target ? stepLabel(target) : "missing step"} [${transitionModeLabel(transition.mode)}]`;
        }).join(" \xB7 ");
        stepHeader.createSpan({
          text: ` ${transitionSummary}`,
          cls: "auto-oc-workflow-transition-label"
        });
      }
      if (!task) {
        if (step.stepKind === "code") {
          const codePreview = stepItem.createDiv("auto-oc-code-preview-wrap");
          renderCodePreview(codePreview, step.code || "// empty code step", 500);
          const stepActions = stepItem.createDiv("auto-oc-workflow-task-actions");
          const btnCodeLog = stepActions.createEl("button", {
            text: "\u{1F4C4} Log",
            cls: "auto-oc-btn-output"
          });
          btnCodeLog.disabled = !step.output;
          btnCodeLog.onclick = (e) => {
            e.stopPropagation();
            new TextPreviewModal(this.app, `Code step ${i + 1} output`, step.output || "").open();
          };
          const btnEditCode = stepActions.createEl("button", {
            text: "\u270F\uFE0F Edit Code",
            cls: "auto-oc-btn-edit"
          });
          btnEditCode.onclick = (e) => {
            e.stopPropagation();
            new EditWorkflowStepModal(this.app, this.plugin, workflow, step).open();
          };
        } else if (step.stepKind === "delay") {
          const stepMeta = stepItem.createDiv("auto-oc-workflow-task-meta");
          stepMeta.createSpan({ text: `Pauses for ${(_e = step.delayValue) != null ? _e : 5} ${(_f = step.delayUnit) != null ? _f : "minutes"}` });
          const stepActions = stepItem.createDiv("auto-oc-workflow-task-actions");
          const btnDelayLog = stepActions.createEl("button", {
            text: "\u{1F4C4} Log",
            cls: "auto-oc-btn-output"
          });
          btnDelayLog.disabled = !step.output;
          btnDelayLog.onclick = (e) => {
            e.stopPropagation();
            new TextPreviewModal(this.app, `Delay step ${i + 1} output`, step.output || "").open();
          };
          const btnEditDelay = stepActions.createEl("button", {
            text: "\u270F\uFE0F Edit Delay",
            cls: "auto-oc-btn-edit"
          });
          btnEditDelay.onclick = (e) => {
            e.stopPropagation();
            new EditWorkflowStepModal(this.app, this.plugin, workflow, step).open();
          };
        }
        continue;
      }
      const taskMeta = stepItem.createDiv("auto-oc-workflow-task-meta");
      const modelLabel = (_h = (_g = this.plugin.availableModels.find((m) => m.value === task.model)) == null ? void 0 : _g.label) != null ? _h : task.model;
      if ((task.taskKind || "opencode") === "code") {
        taskMeta.createSpan({ text: "{ } Code task" });
      } else {
        taskMeta.createSpan({ text: `\u{1F916} ${modelLabel || "(no model)"}` });
        taskMeta.createSpan({ text: `\u2699\uFE0F ${this.plugin.getEffectiveAgent(task.agent)}` });
      }
      if (task.branch) taskMeta.createSpan({ text: `\u{1F33F} ${task.branch}${task.createBranch ? " (create)" : ""}` });
      if (task.workingDirectory) taskMeta.createSpan({ text: `\u{1F4C2} ${task.workingDirectory}` });
      if (task.lastRun) taskMeta.createSpan({ text: `\u23F1 ${formatDateTime(task.lastRun)}` });
      const promptPreview = stepItem.createDiv("auto-oc-workflow-task-prompt");
      if ((task.taskKind || "opencode") === "code") {
        promptPreview.removeClass("auto-oc-workflow-task-prompt");
        promptPreview.addClass("auto-oc-code-preview-wrap");
        renderCodePreview(promptPreview, task.code || task.prompt || "", 500);
      } else {
        promptPreview.createSpan({
          text: task.prompt.slice(0, 180) + (task.prompt.length > 180 ? "\u2026" : "")
        });
      }
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
      } else if (wfScheduleType === "interval") {
        const value = (_i = workflow.scheduleIntervalValue) != null ? _i : 10;
        const unit = (_j = workflow.scheduleIntervalUnit) != null ? _j : "minutes";
        schedMeta.createEl("span", { text: `\u{1F501} Every ${value} ${unit}` });
      }
    }
    const actions = details.createDiv("auto-oc-card-actions");
    const durableExecution = workflow.runtimeExecution;
    const needsRecovery = durableExecution && ["ready", "in_flight"].includes(durableExecution.phase);
    if (needsRecovery && !this.plugin.isWorkflowExecuting(workflow.id)) {
      const uncertain = durableExecution.phase === "in_flight";
      actions.createEl("span", { text: uncertain ? "Previous step needs verification before continuing." : "Saved execution has pending steps." });
      const recover = actions.createEl("button", { text: uncertain ? "Verify previous result" : "Resume saved execution" });
      recover.onclick = async (e) => {
        e.stopPropagation();
        recover.disabled = true;
        try {
          await this.plugin.recoverSharedWorkflow(workflow.id, durableExecution.runId);
        } catch (error) {
          new import_obsidian.Notice(this.plugin.redactSecrets(String(error)));
        } finally {
          this.refresh();
        }
      };
    }
    const btnRun = actions.createEl("button", {
      text: this.plugin.isWorkflowExecuting(workflow.id) ? "\u23F3 Running\u2026" : "\u25B6 Run Workflow",
      cls: "auto-oc-btn-run"
    });
    btnRun.disabled = this.plugin.isWorkflowExecuting(workflow.id) || !!needsRecovery;
    btnRun.onclick = (e) => {
      e.stopPropagation();
      this.plugin.runWorkflow(workflow);
    };
    if (this.plugin.isWorkflowExecuting(workflow.id)) {
      const btnStop = actions.createEl("button", {
        text: "\u23F9 Stop",
        cls: "auto-oc-btn-stop"
      });
      btnStop.title = "Stop workflow now";
      btnStop.onclick = async (e) => {
        e.stopPropagation();
        btnStop.disabled = true;
        btnStop.textContent = "Stopping\u2026";
        await this.plugin.killWorkflow(workflow.id);
      };
    }
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
      if (!confirm(`Delete workflow "${workflow.name}"?`)) return;
      const workflowTaskIds = this.plugin.workflowTaskIds(workflow);
      const taskIdsOnlyUsedHere = this.plugin.workflowTaskIdsUsedOnlyBy(workflow.id);
      let deleteWorkflowTasks = false;
      if (workflowTaskIds.length > 0) {
        const sharedCount = workflowTaskIds.length - taskIdsOnlyUsedHere.length;
        const sharedNote = sharedCount > 0 ? `

${sharedCount} task(s) are also used by other workflows and will be kept.` : "";
        deleteWorkflowTasks = taskIdsOnlyUsedHere.length > 0 && confirm(
          `Also delete ${taskIdsOnlyUsedHere.length} task(s) used only by this workflow?${sharedNote}`
        );
      }
      await this.plugin.deleteWorkflow(workflow.id, deleteWorkflowTasks);
    };
    summary.onclick = () => {
      const isHidden = details.style.display === "none";
      details.style.display = isHidden ? "block" : "none";
      card.classList.toggle("expanded", isHidden);
      if (isHidden) {
        this.expandedWorkflows.add(workflow.id);
      } else {
        this.expandedWorkflows.delete(workflow.id);
      }
    };
  }
};
var VisualBuilderModal = class extends import_obsidian.Modal {
  constructor(app, plugin) {
    super(app);
    this.iframe = null;
    this.ready = false;
    this.isDirty = false;
    // Tracks the in-flight settings mutation; the modal closes on success
    // if the user clicked "Apply and close".
    this.closeAfterApply = false;
    this.plugin = plugin;
  }
  onOpen() {
    const { contentEl, modalEl, titleEl } = this;
    this.plugin.registerVisualBuilder(this);
    contentEl.empty();
    if (titleEl && titleEl.style) {
      titleEl.style.display = "none";
    }
    setAutoOCModalFullscreen(this);
    preventBackdropClose(this);
    const toolbar = contentEl.createDiv("auto-oc-visual-toolbar");
    const titleSpan = toolbar.createSpan("toolbar-title");
    titleSpan.textContent = "\u2728 WF Visual Builder";
    titleSpan.style.fontSize = "13px";
    const btnReload = toolbar.createEl("button", { text: "Reload state" });
    btnReload.onclick = () => this.sendState();
    const btnSave = toolbar.createEl("button", { text: "Apply" });
    btnSave.title = "Apply the changes from the visual builder back to AutoOC without closing this window";
    btnSave.onclick = () => {
      this.closeAfterApply = false;
      this.requestApply();
    };
    const btnApply = toolbar.createEl("button", { text: "Apply and close" });
    btnApply.title = "Apply the changes from the visual builder back to AutoOC and close this window";
    btnApply.addClass("mod-cta");
    btnApply.onclick = () => {
      this.closeAfterApply = true;
      this.requestApply();
    };
    const spacer = toolbar.createDiv("toolbar-spacer");
    const hint = toolbar.createSpan("toolbar-hint");
    hint.textContent = "Drag a Task / Delay / Code from the left, connect ports to wire transitions, click an edge to change its mode (Default / Force / AI / Conditional), then Apply.";
    contentEl.appendChild(toolbar);
    const iframeWrap = contentEl.createDiv("auto-oc-visual-iframe-wrap");
    const iframe = iframeWrap.createEl("iframe");
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.border = "0";
    iframe.style.display = "block";
    iframe.style.flex = "1 1 auto";
    iframe.srcdoc = visualBuilderHtml2;
    this.iframe = iframe;
    this.messageHandler = (ev) => {
      const data = ev.data;
      if (!data || typeof data !== "object") return;
      if (data.type === "ready") {
        this.ready = true;
        this.sendState();
      } else if (data.type === "apply") {
        this.applyExternalState(data.state).then(() => {
          if (this.closeAfterApply) this.close();
        });
      } else if (data.type === "refresh-agents") {
        const cwd = this.plugin.settings.workingDirectory || this.app.vault.adapter.basePath || ".";
        this.plugin.refreshAgents(cwd);
        new import_obsidian.Notice(`AutoOC: ${this.plugin.availableAgents.length} agents loaded from project/global config.`);
        this.sendMeta();
      } else if (data.type === "refresh-models") {
        this.plugin.refreshModels();
        new import_obsidian.Notice("AutoOC: models updated.");
        this.sendMeta();
      } else if (data.type === "refresh-codex-models") {
        void this.plugin.refreshCodexModels(true).then(() => this.sendMeta());
      } else if (data.type === "log") {
        console.log("[VisualBuilder]", data.message);
      }
    };
    window.addEventListener("message", this.messageHandler);
  }
  onClose() {
    var _a;
    this.plugin.unregisterVisualBuilder(this);
    if (this.messageHandler) {
      window.removeEventListener("message", this.messageHandler);
      this.messageHandler = void 0;
    }
    this.iframe = null;
    this.ready = false;
    (_a = this.plugin.view) == null ? void 0 : _a.refresh();
  }
  // Send the current tasks/workflows to the iframe.
  sendState() {
    if (!this.iframe || !this.iframe.contentWindow) return;
    const payload = {
      type: "load",
      state: {
        tasks: this.plugin.settings.tasks,
        workflows: this.plugin.settings.workflows,
        meta: {
          availableAgents: this.plugin.availableAgents,
          availableModels: this.plugin.availableModels,
          availableCodexModels: this.plugin.availableCodexModels,
          defaultAiEngine: this.plugin.settings.defaultAiEngine,
          defaultCopilotModel: this.plugin.settings.defaultCopilotModel,
          defaultCodexModel: this.plugin.settings.defaultCodexModel,
          defaultCodexReasoningEffort: this.plugin.settings.defaultCodexReasoningEffort,
          pluginVersion: this.plugin.manifest.version
        }
      }
    };
    try {
      this.iframe.contentWindow.postMessage(payload, "*");
    } catch (e) {
      console.error("VisualBuilder postMessage failed:", e);
    }
  }
  sendMeta() {
    if (!this.iframe || !this.iframe.contentWindow) return;
    const payload = {
      type: "meta",
      meta: {
        availableAgents: this.plugin.availableAgents,
        availableModels: this.plugin.availableModels,
        availableCodexModels: this.plugin.availableCodexModels,
        defaultAiEngine: this.plugin.settings.defaultAiEngine,
        defaultCopilotModel: this.plugin.settings.defaultCopilotModel,
        defaultCodexModel: this.plugin.settings.defaultCodexModel,
        defaultCodexReasoningEffort: this.plugin.settings.defaultCodexReasoningEffort,
        pluginVersion: this.plugin.manifest.version
      }
    };
    try {
      this.iframe.contentWindow.postMessage(payload, "*");
    } catch (e) {
      console.error("VisualBuilder postMessage failed:", e);
    }
  }
  // Ask the iframe to send back the current state.
  requestApply() {
    if (!this.iframe || !this.iframe.contentWindow) return;
    this.iframe.contentWindow.postMessage({ type: "request-apply" }, "*");
  }
  // Replace tasks/workflows with the values provided by the iframe. Smart-merge:
  // for tasks/workflows that already exist in the extension, keep runtime state
  // (status, lastRun, output) and any field the iframe did not send (workingDirectory
  // and the Git branch fields live in the classic modal, not the VB property panel).
  // This means editing a task in the visual builder no longer wipes the last
  // execution log or the "currently running" indicator.
  async applyExternalState(state) {
    var _a;
    if (!state || !Array.isArray(state.tasks) || !Array.isArray(state.workflows)) {
      new import_obsidian.Notice("Visual Builder: invalid state payload.");
      return;
    }
    for (const task of state.tasks) {
      const error = getCopilotTaskValidationError(task);
      if (error) {
        new import_obsidian.Notice(`Visual Builder: ${error}`);
        return;
      }
    }
    const oldTasks = this.plugin.settings.tasks;
    const oldWorkflows = this.plugin.settings.workflows;
    const oldTaskById = new Map(oldTasks.map((task) => [task.id, task]));
    const oldWorkflowById = new Map(oldWorkflows.map((workflow) => [workflow.id, workflow]));
    const newTasks = state.tasks.map((t) => {
      var _a2, _b, _c, _d, _e, _f, _g, _h, _i;
      const existing = oldTasks.find((x) => x.id === t.id);
      const id = existing ? t.id : t.id || generateId();
      const taskKind = t.taskKind || (existing == null ? void 0 : existing.taskKind) || "opencode";
      const status = (existing == null ? void 0 : existing.status) || "pending";
      const lastRun = (existing == null ? void 0 : existing.lastRun) || "";
      const output = (existing == null ? void 0 : existing.output) || "";
      return {
        id,
        taskKind,
        name: t.name || "Unnamed",
        area: t.area !== void 0 ? t.area || "" : (existing == null ? void 0 : existing.area) || "",
        prompt: t.prompt || "",
        model: t.model !== void 0 ? t.model : taskKind === "copilot" ? (_b = (_a2 = existing == null ? void 0 : existing.model) != null ? _a2 : this.plugin.settings.defaultCopilotModel) != null ? _b : "" : taskKind === "codex" ? this.plugin.getEffectiveCodexModel(existing == null ? void 0 : existing.model) : this.plugin.getEffectiveDefaultModel(),
        copilotAllowAllTools: taskKind === "copilot" ? ((_c = t.copilotAllowAllTools) != null ? _c : existing == null ? void 0 : existing.copilotAllowAllTools) === true : void 0,
        requiresAutoOCSecrets: (_d = t.requiresAutoOCSecrets) != null ? _d : existing == null ? void 0 : existing.requiresAutoOCSecrets,
        agent: taskKind === "opencode" ? t.agent || this.plugin.getEffectiveAgent() : "",
        reasoningEffort: taskKind === "codex" ? t.reasoningEffort || (existing == null ? void 0 : existing.reasoningEffort) || this.plugin.settings.defaultCodexReasoningEffort : void 0,
        useRalphLoop: taskKind === "opencode" && (t.useRalphLoop !== void 0 ? !!t.useRalphLoop : (_e = existing == null ? void 0 : existing.useRalphLoop) != null ? _e : false),
        forceModel: taskKind === "opencode" && (t.forceModel !== void 0 ? !!t.forceModel : (_f = existing == null ? void 0 : existing.forceModel) != null ? _f : false),
        scheduleType: t.scheduleType || "manual",
        scheduleTime: t.scheduleTime || "09:00",
        scheduleDate: t.scheduleDate || "",
        scheduleDays: Array.isArray(t.scheduleDays) ? t.scheduleDays : [],
        scheduleMonthDays: Array.isArray(t.scheduleMonthDays) ? t.scheduleMonthDays : [],
        scheduleIntervalValue: typeof t.scheduleIntervalValue === "number" ? t.scheduleIntervalValue : (_g = existing == null ? void 0 : existing.scheduleIntervalValue) != null ? _g : 10,
        scheduleIntervalUnit: t.scheduleIntervalUnit || (existing == null ? void 0 : existing.scheduleIntervalUnit) || "minutes",
        status,
        lastRun,
        output,
        lastCodexThreadId: existing == null ? void 0 : existing.lastCodexThreadId,
        lastCodexTurnId: existing == null ? void 0 : existing.lastCodexTurnId,
        pendingCodexApproval: existing == null ? void 0 : existing.pendingCodexApproval,
        createdAt: (existing == null ? void 0 : existing.createdAt) || t.createdAt || (/* @__PURE__ */ new Date()).toISOString(),
        // Preserve classic-only fields when older Visual Builder payloads do
        // not send them.
        workingDirectory: t.workingDirectory !== void 0 ? t.workingDirectory : (_h = existing == null ? void 0 : existing.workingDirectory) != null ? _h : "",
        branch: t.branch !== void 0 ? t.branch || "" : (existing == null ? void 0 : existing.branch) || "",
        createBranch: t.createBranch !== void 0 ? !!t.createBranch : (_i = existing == null ? void 0 : existing.createBranch) != null ? _i : false,
        interactiveTerminal: t.interactiveTerminal !== void 0 ? !!t.interactiveTerminal : existing == null ? void 0 : existing.interactiveTerminal,
        code: t.code !== void 0 ? t.code : existing == null ? void 0 : existing.code,
        codeLang: t.codeLang !== void 0 ? t.codeLang : existing == null ? void 0 : existing.codeLang,
        codeInputVar: t.codeInputVar !== void 0 ? t.codeInputVar : existing == null ? void 0 : existing.codeInputVar,
        codeOutputVar: t.codeOutputVar !== void 0 ? t.codeOutputVar : existing == null ? void 0 : existing.codeOutputVar,
        codeAllowVault: t.codeAllowVault !== void 0 ? !!t.codeAllowVault : existing == null ? void 0 : existing.codeAllowVault,
        codeAllowFiles: t.codeAllowFiles !== void 0 ? !!t.codeAllowFiles : existing == null ? void 0 : existing.codeAllowFiles,
        codeAllowTerminal: t.codeAllowTerminal !== void 0 ? !!t.codeAllowTerminal : existing == null ? void 0 : existing.codeAllowTerminal
      };
    });
    const newWorkflows = state.workflows.map((w) => {
      var _a2, _b, _c, _d;
      const existing = oldWorkflows.find((x) => x.id === w.id);
      const id = existing ? w.id : w.id || generateId();
      const status = (existing == null ? void 0 : existing.status) || "pending";
      const currentStep = (_a2 = existing == null ? void 0 : existing.currentStep) != null ? _a2 : -1;
      return {
        id,
        name: w.name || "Unnamed",
        area: w.area !== void 0 ? w.area || "" : (existing == null ? void 0 : existing.area) || "",
        description: w.description || "",
        steps: (w.steps || []).map((s, i) => {
          const oldStep = existing == null ? void 0 : existing.steps.find((x) => x.id === s.id);
          return {
            id: s.id || generateId(),
            stepKind: s.stepKind || "task",
            name: s.name,
            area: s.area || w.area || (existing == null ? void 0 : existing.area) || "",
            taskId: s.taskId,
            transitionMode: s.transitionMode,
            evaluatePrompt: s.evaluatePrompt,
            forceContinue: s.forceContinue,
            delayValue: s.delayValue,
            delayUnit: s.delayUnit,
            code: s.code,
            codeLang: s.codeLang,
            codeInputVar: s.codeInputVar,
            codeOutputVar: s.codeOutputVar,
            codeAllowVault: s.codeAllowVault,
            codeAllowFiles: s.codeAllowFiles,
            codeAllowTerminal: s.codeAllowTerminal,
            // Preserve per-step runtime state (lastRun, output, status) so
            // a user editing a non-running step in the VB does not lose
            // its captured log/output.
            status: oldStep == null ? void 0 : oldStep.status,
            lastRun: oldStep == null ? void 0 : oldStep.lastRun,
            output: oldStep == null ? void 0 : oldStep.output,
            transitions: s.transitions,
            position: s.position || { x: 40 + i * 280, y: 60 }
          };
        }),
        status,
        currentStep,
        createdAt: (existing == null ? void 0 : existing.createdAt) || w.createdAt || (/* @__PURE__ */ new Date()).toISOString(),
        lastRun: existing == null ? void 0 : existing.lastRun,
        handoffBranch: t_or_undef(w.handoffBranch, (_b = existing == null ? void 0 : existing.handoffBranch) != null ? _b : false),
        handoffOutput: t_or_undef(w.handoffOutput, (_c = existing == null ? void 0 : existing.handoffOutput) != null ? _c : true) !== false,
        scheduleType: w.scheduleType || "manual",
        scheduleTime: w.scheduleTime || "09:00",
        scheduleDate: w.scheduleDate || "",
        scheduleDays: Array.isArray(w.scheduleDays) ? w.scheduleDays : [],
        scheduleMonthDays: Array.isArray(w.scheduleMonthDays) ? w.scheduleMonthDays : [],
        scheduleIntervalValue: typeof w.scheduleIntervalValue === "number" ? w.scheduleIntervalValue : (_d = existing == null ? void 0 : existing.scheduleIntervalValue) != null ? _d : 10,
        scheduleIntervalUnit: w.scheduleIntervalUnit || (existing == null ? void 0 : existing.scheduleIntervalUnit) || "minutes"
      };
    });
    const renamedTasks = newTasks.filter((task) => {
      var _a2, _b;
      return ((_a2 = oldTaskById.get(task.id)) == null ? void 0 : _a2.name) !== void 0 && ((_b = oldTaskById.get(task.id)) == null ? void 0 : _b.name) !== task.name;
    });
    const renamedWorkflows = newWorkflows.filter((workflow) => {
      var _a2, _b;
      return ((_a2 = oldWorkflowById.get(workflow.id)) == null ? void 0 : _a2.name) !== void 0 && ((_b = oldWorkflowById.get(workflow.id)) == null ? void 0 : _b.name) !== workflow.name;
    });
    this.plugin.settings.tasks = newTasks;
    this.plugin.settings.workflows = newWorkflows;
    await this.plugin.saveSettings(false);
    (_a = this.plugin.view) == null ? void 0 : _a.refresh();
    renamedTasks.forEach((task) => this.plugin.emitTaskUpdated(task));
    renamedWorkflows.forEach((workflow) => this.plugin.emitWorkflowUpdated(workflow));
    new import_obsidian.Notice(`AutoOC: applied ${newTasks.length} task(s) and ${newWorkflows.length} workflow(s) from Visual Builder.`);
  }
};
var ConfirmModal = class extends import_obsidian.Modal {
  constructor(app, titleText, bodyText) {
    super(app);
    this.titleText = titleText;
    this.bodyText = bodyText;
  }
  openAndWait() {
    this.open();
    return new Promise((resolve5) => {
      this.resolve = resolve5;
    });
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("auto-oc-modal");
    setupModalX(this);
    contentEl.createEl("h3", { text: this.titleText });
    contentEl.createEl("p", { text: this.bodyText, cls: "setting-item-description" });
    new import_obsidian.Setting(contentEl).addButton((btn) => btn.setButtonText("Cancel").onClick(() => {
      var _a;
      (_a = this.resolve) == null ? void 0 : _a.call(this, false);
      this.close();
    })).addButton((btn) => btn.setButtonText("Confirm").setWarning().onClick(() => {
      var _a;
      (_a = this.resolve) == null ? void 0 : _a.call(this, true);
      this.close();
    }));
  }
  onClose() {
    var _a;
    (_a = this.resolve) == null ? void 0 : _a.call(this, false);
    this.resolve = void 0;
    this.contentEl.empty();
  }
};
var SecretsPinModal = class extends import_obsidian.Modal {
  constructor(app, store, mode) {
    super(app);
    this.store = store;
    this.mode = mode;
    this.settled = false;
    this.pin = "";
    this.confirmPin = "";
  }
  openAndWait() {
    this.open();
    return new Promise((resolve5) => {
      this.resolve = resolve5;
    });
  }
  finish(value) {
    var _a;
    this.settled = true;
    (_a = this.resolve) == null ? void 0 : _a.call(this, value);
    this.close();
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("auto-oc-modal");
    setupModalX(this);
    preventBackdropClose(this);
    contentEl.createEl("h3", { text: this.mode === "create" ? "Create Secrets PIN" : "Unlock Secrets" });
    contentEl.createEl("p", {
      text: this.mode === "create" ? "This PIN protects the Secrets UI. It can be reset without deleting encrypted secrets." : "Enter the Secrets UI PIN.",
      cls: "setting-item-description"
    });
    new import_obsidian.Setting(contentEl).setName("PIN").addText((text) => {
      text.inputEl.type = "password";
      text.inputEl.addClass("auto-oc-modal-input");
      text.onChange((v) => this.pin = v);
      window.setTimeout(() => text.inputEl.focus(), 50);
    });
    if (this.mode === "create") {
      new import_obsidian.Setting(contentEl).setName("Confirm PIN").addText((text) => {
        text.inputEl.type = "password";
        text.inputEl.addClass("auto-oc-modal-input");
        text.onChange((v) => this.confirmPin = v);
      });
    }
    new import_obsidian.Setting(contentEl).addButton((btn) => btn.setButtonText("Cancel").onClick(() => this.finish(false))).addButton((btn) => btn.setButtonText(this.mode === "create" ? "Create PIN" : "Unlock").setCta().onClick(() => {
      if (this.pin.length < 4) {
        new import_obsidian.Notice("AutoOC: PIN must be at least 4 characters.");
        return;
      }
      if (this.mode === "create") {
        if (this.pin !== this.confirmPin) {
          new import_obsidian.Notice("AutoOC: PIN confirmation does not match.");
          return;
        }
        this.store.setPin(this.pin);
        new import_obsidian.Notice("AutoOC: Secrets PIN created.");
        this.finish(true);
        return;
      }
      if (!this.store.verifyPin(this.pin)) {
        new import_obsidian.Notice("AutoOC: incorrect PIN.");
        return;
      }
      this.finish(true);
    }));
  }
  onClose() {
    var _a;
    if (!this.settled) (_a = this.resolve) == null ? void 0 : _a.call(this, false);
    this.resolve = void 0;
    this.contentEl.empty();
  }
};
var SecretEditModal = class extends import_obsidian.Modal {
  constructor(app, plugin, secret, onSaved) {
    super(app);
    this.plugin = plugin;
    this.secret = secret;
    this.onSaved = onSaved;
    this.draft = {
      name: (secret == null ? void 0 : secret.name) || "",
      envName: (secret == null ? void 0 : secret.envName) || "",
      type: (secret == null ? void 0 : secret.type) || "token",
      profile: (secret == null ? void 0 : secret.profile) || "default",
      value: "",
      notes: (secret == null ? void 0 : secret.notes) || ""
    };
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("auto-oc-modal");
    setAutoOCModalSize(this, 720);
    setupModalX(this);
    preventBackdropClose(this);
    contentEl.createEl("h3", { text: this.secret ? "Edit Secret" : "New Secret" });
    new import_obsidian.Setting(contentEl).setName("Name").setDesc("Human-readable name, for example jira-token or web-login-password.").addText((text) => {
      text.inputEl.addClass("auto-oc-modal-input");
      text.setValue(this.draft.name).onChange((v) => {
        this.draft.name = v;
        if (!this.secret && !this.draft.envName.trim()) this.draft.envName = normalizeEnvName(v);
      });
      window.setTimeout(() => text.inputEl.focus(), 50);
    });
    new import_obsidian.Setting(contentEl).setName("Environment variable").setDesc("Use this in opencode MCP config as {env:NAME}.").addText((text) => {
      text.inputEl.addClass("auto-oc-modal-input");
      text.setPlaceholder("AUTOOC_JIRA_TOKEN").setValue(this.draft.envName).onChange((v) => this.draft.envName = v);
    });
    new import_obsidian.Setting(contentEl).setName("Type").addDropdown((dd) => {
      for (const type of SECRET_TYPES) dd.addOption(type, type);
      dd.setValue(this.draft.type);
      dd.onChange((v) => this.draft.type = v);
    });
    new import_obsidian.Setting(contentEl).setName("Profile").setDesc("default is always injected. Other profiles are reserved for future per-task selection.").addText((text) => {
      text.inputEl.addClass("auto-oc-modal-input");
      text.setValue(this.draft.profile).onChange((v) => this.draft.profile = v || "default");
    });
    new import_obsidian.Setting(contentEl).setName(this.secret ? "New value" : "Value").setDesc(
      this.secret ? "Paste the new password/token as plain text. AutoOC encrypts it when you save. Leave empty to keep the current value." : "Paste the password/token as plain text. AutoOC encrypts it when you save; the table never shows it."
    ).addTextArea((ta) => {
      ta.inputEl.addClass("auto-oc-modal-textarea");
      ta.inputEl.rows = 4;
      ta.inputEl.spellcheck = false;
      ta.setValue(this.draft.value).onChange((v) => this.draft.value = v);
    });
    new import_obsidian.Setting(contentEl).setName("Notes").addText((text) => {
      text.inputEl.addClass("auto-oc-modal-input");
      text.setValue(this.draft.notes).onChange((v) => this.draft.notes = v);
    });
    new import_obsidian.Setting(contentEl).addButton((btn) => btn.setButtonText("Cancel").onClick(() => this.close())).addButton((btn) => btn.setButtonText("Save Secret").setCta().onClick(() => {
      var _a;
      if (!this.draft.name.trim()) {
        new import_obsidian.Notice("AutoOC: secret name is required.");
        return;
      }
      if (!this.secret && !this.draft.value) {
        new import_obsidian.Notice("AutoOC: secret value is required.");
        return;
      }
      try {
        this.plugin.secretStore.upsert({
          id: (_a = this.secret) == null ? void 0 : _a.id,
          name: this.draft.name,
          envName: this.draft.envName || this.draft.name,
          type: this.draft.type,
          profile: this.draft.profile || "default",
          value: this.draft.value || void 0,
          notes: this.draft.notes
        });
        new import_obsidian.Notice("AutoOC: secret saved.");
        this.onSaved();
        this.close();
      } catch (e) {
        new import_obsidian.Notice(`AutoOC: could not save secret \u2014 ${String(e)}`);
      }
    }));
  }
  onClose() {
    this.contentEl.empty();
  }
};
var SecretRevealModal = class extends import_obsidian.Modal {
  constructor(app, secret, value) {
    super(app);
    this.secret = secret;
    this.value = value;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("auto-oc-modal");
    setupModalX(this);
    contentEl.createEl("h3", { text: `Secret: ${this.secret.name}` });
    contentEl.createEl("p", { text: this.secret.envName, cls: "setting-item-description" });
    const textarea = contentEl.createEl("textarea", { cls: "auto-oc-modal-textarea" });
    textarea.value = this.value;
    textarea.readOnly = true;
    textarea.rows = 4;
    textarea.style.width = "100%";
    new import_obsidian.Setting(contentEl).addButton((btn) => btn.setButtonText("Copy value").onClick(async () => {
      await copyTextToClipboard(this.value);
      new import_obsidian.Notice("AutoOC: secret copied.");
    })).addButton((btn) => btn.setButtonText("Close").onClick(() => this.close()));
  }
  onClose() {
    this.value = "";
    this.contentEl.empty();
  }
};
var CreateTaskModal = class extends import_obsidian.Modal {
  constructor(app, plugin, editTask) {
    super(app);
    this.focusNameOnNextOpen = true;
    this.plugin = plugin;
    this.editTask = editTask;
    this.draft = editTask ? { ...editTask } : {
      name: "",
      taskKind: plugin.settings.defaultAiEngine,
      prompt: "",
      model: plugin.settings.defaultAiEngine === "codex" ? plugin.getEffectiveCodexModel() : plugin.settings.defaultAiEngine === "copilot" ? plugin.settings.defaultCopilotModel || "" : plugin.getEffectiveDefaultModel(),
      agent: plugin.getEffectiveAgent(),
      reasoningEffort: plugin.settings.defaultCodexReasoningEffort,
      useRalphLoop: false,
      forceModel: false,
      interactiveTerminal: plugin.settings.defaultAiEngine === "opencode" && plugin.settings.defaultInteractiveTerminal,
      scheduleType: "manual",
      scheduleTime: nowTimeString(),
      scheduleDate: todayString(),
      scheduleDays: [],
      scheduleMonthDays: [],
      scheduleIntervalValue: 10,
      scheduleIntervalUnit: "minutes"
    };
  }
  onOpen() {
    var _a;
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("auto-oc-modal");
    setAutoOCModalSize(this, 900);
    preventBackdropClose(this);
    const shouldFocusName = this.focusNameOnNextOpen;
    this.focusNameOnNextOpen = false;
    const headerBar = contentEl.createDiv("auto-oc-modal-header");
    const taskKind = this.draft.taskKind || "opencode";
    const taskType = taskKind === "opencode" && this.draft.interactiveTerminal ? "cli" : taskKind === "codex" && this.draft.interactiveTerminal ? "codex-app" : taskKind;
    headerBar.createEl("h3", {
      text: this.editTask ? "Edit Task" : "New Task"
    });
    new import_obsidian.Setting(contentEl).setName("Task type").setDesc("Choose OpenCode, Codex in ChatGPT, GitHub Copilot CLI, an interactive OpenCode CLI, or local JavaScript.").addDropdown((dd) => {
      dd.addOption("opencode", "OpenCode task");
      dd.addOption("codex", "Codex task");
      dd.addOption("codex-app", "ChatGPT / Codex task");
      dd.addOption("copilot", "GitHub Copilot CLI task");
      dd.addOption("code", "Code task");
      dd.addOption("cli", "OpenCode CLI task");
      dd.setValue(taskType);
      dd.onChange((v) => {
        this.draft.taskKind = v === "code" ? "code" : v === "copilot" ? "copilot" : v === "codex" || v === "codex-app" ? "codex" : "opencode";
        this.draft.interactiveTerminal = v === "cli" || v === "codex-app";
        if (v === "codex" || v === "codex-app") {
          this.draft.model = "";
          this.draft.reasoningEffort = this.plugin.settings.defaultCodexReasoningEffort;
        } else if (v === "copilot") {
          this.draft.model = this.plugin.settings.defaultCopilotModel || "";
          this.draft.agent = "";
          this.draft.reasoningEffort = void 0;
          this.draft.useRalphLoop = false;
          this.draft.forceModel = false;
          this.draft.branch = "";
          this.draft.createBranch = false;
        } else if (v === "opencode" || v === "cli") {
          this.draft.model = this.plugin.getEffectiveDefaultModel();
        }
        if (v === "code" && !this.draft.code) {
          this.draft.code = "// Set output to pass data forward\noutput = input;";
        }
        this.onOpen();
      });
    });
    new import_obsidian.Setting(contentEl).setName("Name").setDesc("Short task identifier").addText((text) => {
      var _a2;
      text.inputEl.addClass("auto-oc-modal-input");
      text.setValue((_a2 = this.draft.name) != null ? _a2 : "").onChange((v) => this.draft.name = v);
      if (shouldFocusName) window.setTimeout(() => text.inputEl.focus(), 50);
    });
    new import_obsidian.Setting(contentEl).setName("Area").setDesc("Optional dashboard grouping area").addText((text) => {
      var _a2;
      text.inputEl.addClass("auto-oc-modal-input");
      text.setPlaceholder("No area").setValue((_a2 = this.draft.area) != null ? _a2 : "").onChange((v) => this.draft.area = v.trim());
      renderAreaSuggestions(contentEl, text.inputEl, getConfiguredAreaNames(this.plugin.settings), (area) => {
        this.draft.area = area;
      });
    });
    if (taskKind === "code") {
      const initialCode = (_a = this.draft.code) != null ? _a : "// Set output to pass data forward\noutput = input;";
      new import_obsidian.Setting(contentEl).setName("JavaScript code").setDesc("Available variables: input, outputs, JSON, Math, Date, String, Number, Boolean, Array, Object, RegExp. Set output to return data.").addTextArea((ta) => {
        ta.setValue(initialCode).onChange((v) => this.draft.code = v);
        ta.inputEl.addClass("auto-oc-modal-textarea");
        setupCodeTextarea(ta.inputEl);
        ta.inputEl.rows = 12;
        ta.inputEl.style.width = "100%";
      });
      new import_obsidian.Setting(contentEl).setName("Variables").setDesc("Input variable starts empty for scheduled runs; output variable is saved as task output").addText((text) => {
        text.inputEl.addClass("auto-oc-modal-input");
        text.setPlaceholder("input").setValue(this.draft.codeInputVar || "input").onChange((v) => this.draft.codeInputVar = v || "input");
      }).addText((text) => {
        text.inputEl.addClass("auto-oc-modal-input");
        text.setPlaceholder("output").setValue(this.draft.codeOutputVar || "output").onChange((v) => this.draft.codeOutputVar = v || "output");
      });
    } else {
      const promptNotice = contentEl.createDiv("auto-oc-prompt-notice");
      promptNotice.style.display = "none";
      new import_obsidian.Setting(contentEl).setName("Prompt / Goal").setDesc(`Text to send to ${taskKind === "copilot" ? "GitHub Copilot CLI" : taskKind === "codex" ? "Codex" : "OpenCode"}`).addTextArea((ta) => {
        var _a2, _b;
        const updatePromptNotice = (value) => {
          if (taskKind === "opencode" && this.draft.interactiveTerminal && value.length > SAFE_CLI_PROMPT_LENGTH) {
            ta.inputEl.addClass("auto-oc-prompt-too-long");
            promptNotice.setText(
              `CLI prompts over ${SAFE_CLI_PROMPT_LENGTH} characters are saved to a temporary workspace file, the OpenCode TUI is instructed to read it, and the file is deleted after 1 minute.`
            );
            promptNotice.style.display = "block";
          } else {
            ta.inputEl.removeClass("auto-oc-prompt-too-long");
            promptNotice.setText("");
            promptNotice.style.display = "none";
          }
        };
        ta.setValue((_a2 = this.draft.prompt) != null ? _a2 : "").onChange((v) => {
          this.draft.prompt = v;
          updatePromptNotice(v);
        });
        ta.inputEl.addClass("auto-oc-modal-textarea");
        ta.inputEl.rows = 5;
        ta.inputEl.style.width = "100%";
        ta.inputEl.spellcheck = false;
        updatePromptNotice((_b = this.draft.prompt) != null ? _b : "");
      });
    }
    contentEl.createDiv("auto-oc-modal-section-title").setText(taskKind === "opencode" ? "\u{1F4C2} Workspace & Git" : "\u{1F4C2} Workspace");
    new import_obsidian.Setting(contentEl).setName("Project Path").setDesc("Absolute path to the project (empty = vault root)").addText((text) => {
      var _a2;
      text.inputEl.addClass("auto-oc-modal-input");
      text.setPlaceholder(this.app.vault.adapter.basePath || "C:\\path\\to\\project").setValue((_a2 = this.draft.workingDirectory) != null ? _a2 : "").onChange((v) => this.draft.workingDirectory = v);
    });
    let branchInput = null;
    if (taskKind === "opencode") {
      new import_obsidian.Setting(contentEl).setName("Git Branch").setDesc("Branch to work on").addText((text) => {
        var _a2;
        branchInput = text.inputEl;
        text.inputEl.addClass("auto-oc-modal-input");
        text.setPlaceholder("main").setValue((_a2 = this.draft.branch) != null ? _a2 : "").onChange((v) => this.draft.branch = v);
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
        var _a2;
        tog.setValue((_a2 = this.draft.createBranch) != null ? _a2 : false);
        tog.onChange((v) => this.draft.createBranch = v);
      });
    }
    if (taskKind === "opencode") {
      const agentCwd = this.draft.workingDirectory || this.plugin.settings.workingDirectory || this.app.vault.adapter.basePath || ".";
      const projectAgents = this.plugin.availableAgents.filter((a) => isValidAgentName(a.value));
      new import_obsidian.Setting(contentEl).setName("Agent").setDesc(`AI agent personality to use (${projectAgents.length} loaded). Use Refresh Agents after changing Project Path.`).addDropdown((dd) => {
        var _a2;
        projectAgents.forEach((a) => dd.addOption(a.value, a.label));
        const current = (_a2 = this.draft.agent) != null ? _a2 : this.plugin.getEffectiveAgent();
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
        var _a2;
        const models = this.plugin.availableModels;
        models.forEach((m) => dd.addOption(m.value, m.label));
        const current = (_a2 = this.draft.model) != null ? _a2 : this.plugin.getEffectiveDefaultModel();
        if (!current && models.length === 0) {
          dd.addOption("", "(no models; tap refresh)");
        } else if (current && !models.find((m) => m.value === current)) {
          dd.addOption(current, current);
        }
        dd.setValue(current || "");
        dd.onChange((v) => this.draft.model = v);
      });
      new import_obsidian.Setting(contentEl).setName("Force model").setDesc("Skip --agent so OpenCode uses exactly the selected model.").addToggle((tog) => {
        var _a2;
        tog.setValue((_a2 = this.draft.forceModel) != null ? _a2 : false);
        tog.onChange((v) => this.draft.forceModel = v);
      });
      new import_obsidian.Setting(contentEl).addButton(
        (btn) => btn.setButtonText("\u{1F504} Refresh Models").onClick(() => {
          this.plugin.refreshModels();
          new import_obsidian.Notice("AutoOC: models updated. Reopen dialog.");
        })
      );
      new import_obsidian.Setting(contentEl).setName("Ralph Loop").setDesc("Wrap prompt with /ralph-loop to auto-continue until DONE").addToggle((tog) => {
        var _a2;
        tog.setValue((_a2 = this.draft.useRalphLoop) != null ? _a2 : false);
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
    } else if (taskKind === "codex") {
      new import_obsidian.Setting(contentEl).setName("Codex model").setDesc("Model used by Codex. Automatic uses the current ChatGPT/Codex default.").addDropdown((dd) => {
        var _a2, _b;
        dd.addOption("", "Automatic");
        this.plugin.availableCodexModels.forEach((entry) => dd.addOption(entry.value, entry.label));
        const current = (_b = (_a2 = this.draft.model) != null ? _a2 : this.plugin.settings.defaultCodexModel) != null ? _b : "";
        if (current && !this.plugin.availableCodexModels.some((entry) => entry.value === current)) dd.addOption(current, current);
        dd.setValue(current);
        dd.onChange((value) => {
          this.draft.model = value;
          const efforts = this.plugin.getCodexReasoningEfforts(value);
          if (!efforts.includes(this.draft.reasoningEffort || "")) this.draft.reasoningEffort = efforts[0];
          this.onOpen();
        });
      }).addButton((btn) => btn.setButtonText("\u{1F504} Refresh").onClick(async () => {
        await this.plugin.refreshCodexModels(true);
        this.onOpen();
      }));
      new import_obsidian.Setting(contentEl).setName("Reasoning effort").setDesc("How much reasoning Codex should use for this task.").addDropdown((dd) => {
        const efforts = this.plugin.getCodexReasoningEfforts(this.draft.model);
        efforts.forEach((effort) => dd.addOption(effort, effort));
        const current = this.draft.reasoningEffort || this.plugin.settings.defaultCodexReasoningEffort || efforts[0];
        if (current && !efforts.includes(current)) dd.addOption(current, current);
        dd.setValue(current || "");
        dd.onChange((value) => this.draft.reasoningEffort = value);
      });
    } else if (taskKind === "copilot") {
      addCopilotTaskSettings(contentEl, this.draft, this.plugin.settings.defaultCopilotModel);
    } else {
      contentEl.createDiv("auto-oc-modal-section-title").setText("Code permissions");
      new import_obsidian.Setting(contentEl).setName("Vault API").setDesc("Expose vault.read/write/append/exists/list, confined to this Obsidian vault.").addToggle((tog) => {
        tog.setValue(!!this.draft.codeAllowVault);
        tog.onChange((v) => this.draft.codeAllowVault = v);
      });
      new import_obsidian.Setting(contentEl).setName("Local files API").setDesc("Expose files.read/write/append/exists/list for local paths. Relative paths use Project Path or the vault root.").addToggle((tog) => {
        tog.setValue(!!this.draft.codeAllowFiles);
        tog.onChange((v) => this.draft.codeAllowFiles = v);
      });
      new import_obsidian.Setting(contentEl).setName("Terminal API").setDesc("Expose terminal.run(command, { cwd, timeoutMs }).").addToggle((tog) => {
        tog.setValue(!!this.draft.codeAllowTerminal);
        tog.onChange((v) => this.draft.codeAllowTerminal = v);
      });
    }
    new import_obsidian.Setting(contentEl).setName("Schedule Type").addDropdown((dd) => {
      var _a2;
      dd.addOption("manual", "Manual (run only when I press play)");
      dd.addOption("once", "Once (specific date and time)");
      dd.addOption("daily", "Daily (fixed time)");
      dd.addOption("weekly", "Weekdays");
      dd.addOption("monthly", "Monthly (days of month)");
      dd.addOption("interval", "Interval (every X seconds/minutes/hours)");
      dd.setValue((_a2 = this.draft.scheduleType) != null ? _a2 : "manual");
      dd.onChange((v) => {
        this.draft.scheduleType = v;
        this.onOpen();
      });
    });
    if (this.draft.scheduleType === "once") {
      new import_obsidian.Setting(contentEl).setName("Date").setDesc("Format YYYY-MM-DD").addText((text) => {
        var _a2;
        text.inputEl.addClass("auto-oc-modal-input");
        text.setPlaceholder(todayString()).setValue((_a2 = this.draft.scheduleDate) != null ? _a2 : "").onChange((v) => this.draft.scheduleDate = v);
      });
    }
    if (this.draft.scheduleType === "weekly") {
      const daySetting = new import_obsidian.Setting(contentEl).setName("Weekdays");
      daySetting.settingEl.style.flexWrap = "wrap";
      DAY_NAMES.forEach((name, idx) => {
        daySetting.addToggle((tog) => {
          var _a2;
          tog.setValue(((_a2 = this.draft.scheduleDays) != null ? _a2 : []).includes(idx));
          tog.onChange((checked) => {
            var _a3;
            const days = [...(_a3 = this.draft.scheduleDays) != null ? _a3 : []];
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
        var _a2;
        text.inputEl.addClass("auto-oc-modal-input");
        text.setPlaceholder("1, 15, 31").setValue(((_a2 = this.draft.scheduleMonthDays) != null ? _a2 : []).join(", ")).onChange((v) => {
          const parsed = parseMonthDays(v);
          this.draft.scheduleMonthDays = parsed != null ? parsed : [];
        });
      });
    }
    if (this.draft.scheduleType === "interval") {
      new import_obsidian.Setting(contentEl).setName("Interval").setDesc("Run the task repeatedly every X units").addText((text) => {
        var _a2;
        text.inputEl.addClass("auto-oc-modal-input");
        text.inputEl.type = "number";
        text.inputEl.min = "1";
        text.setPlaceholder("10").setValue(String((_a2 = this.draft.scheduleIntervalValue) != null ? _a2 : 10)).onChange((v) => {
          const n = parseInt(v, 10);
          this.draft.scheduleIntervalValue = isNaN(n) || n < 1 ? 1 : n;
        });
      }).addDropdown((dd) => {
        var _a2;
        dd.addOption("seconds", "Seconds");
        dd.addOption("minutes", "Minutes");
        dd.addOption("hours", "Hours");
        dd.setValue((_a2 = this.draft.scheduleIntervalUnit) != null ? _a2 : "minutes");
        dd.onChange((v) => this.draft.scheduleIntervalUnit = v);
      });
    }
    if (this.draft.scheduleType !== "manual" && this.draft.scheduleType !== "interval") {
      new import_obsidian.Setting(contentEl).setName("Time").setDesc("Format HH:MM (24h)").addText((text) => {
        var _a2;
        text.inputEl.addClass("auto-oc-modal-input");
        text.setPlaceholder("09:00").setValue((_a2 = this.draft.scheduleTime) != null ? _a2 : "").onChange((v) => this.draft.scheduleTime = v);
      });
    }
    new import_obsidian.Setting(contentEl).addButton(
      (btn) => btn.setButtonText(this.editTask ? "Save Changes" : "Create Task").setCta().onClick(async () => {
        var _a2, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r, _s;
        if (!((_a2 = this.draft.name) == null ? void 0 : _a2.trim())) {
          new import_obsidian.Notice("Name is required.");
          return;
        }
        const savingTaskKind = this.draft.taskKind || "opencode";
        if (savingTaskKind !== "code" && !((_b = this.draft.prompt) == null ? void 0 : _b.trim())) {
          new import_obsidian.Notice("Prompt is required.");
          return;
        }
        if (savingTaskKind === "code" && !(this.draft.code || "").trim()) {
          new import_obsidian.Notice("Code is required.");
          return;
        }
        if (savingTaskKind === "opencode" && !((_c = this.draft.model) != null ? _c : "").trim()) {
          new import_obsidian.Notice("You must select a model.");
          return;
        }
        if (this.draft.scheduleType !== "manual" && this.draft.scheduleType !== "interval" && !/^\d{2}:\d{2}$/.test((_d = this.draft.scheduleTime) != null ? _d : "")) {
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
        let updatedTask = null;
        let areaChanged = false;
        if (this.editTask) {
          const idx = this.plugin.settings.tasks.findIndex(
            (t) => t.id === this.editTask.id
          );
          if (idx !== -1) {
            const existing = this.plugin.settings.tasks[idx];
            const previousArea = ((_g = existing.area) == null ? void 0 : _g.trim()) || "";
            this.plugin.settings.tasks[idx] = {
              ...this.editTask,
              ...this.draft,
              prompt: savingTaskKind === "code" ? this.draft.code || "" : this.draft.prompt || "",
              taskKind: savingTaskKind,
              interactiveTerminal: savingTaskKind === "code" ? void 0 : !!this.draft.interactiveTerminal,
              reasoningEffort: savingTaskKind === "codex" ? this.draft.reasoningEffort : void 0,
              copilotAllowAllTools: savingTaskKind === "copilot" ? this.draft.copilotAllowAllTools === true : void 0,
              status: existing.status,
              lastRun: existing.lastRun,
              output: existing.output
            };
            updatedTask = this.plugin.settings.tasks[idx];
            areaChanged = previousArea !== (((_h = updatedTask.area) == null ? void 0 : _h.trim()) || "");
          }
        } else {
          const task = {
            id: generateId(),
            taskKind: savingTaskKind,
            name: this.draft.name,
            prompt: savingTaskKind === "code" ? this.draft.code || "" : this.draft.prompt,
            model: savingTaskKind === "code" ? "" : this.draft.model,
            area: (_i = this.draft.area) != null ? _i : "",
            agent: savingTaskKind === "opencode" ? this.plugin.getEffectiveAgent(this.draft.agent) : "",
            reasoningEffort: savingTaskKind === "codex" ? this.draft.reasoningEffort || this.plugin.settings.defaultCodexReasoningEffort : void 0,
            copilotAllowAllTools: savingTaskKind === "copilot" ? this.draft.copilotAllowAllTools === true : void 0,
            useRalphLoop: savingTaskKind === "opencode" ? (_j = this.draft.useRalphLoop) != null ? _j : false : false,
            forceModel: savingTaskKind === "opencode" ? (_k = this.draft.forceModel) != null ? _k : false : false,
            scheduleType: (_l = this.draft.scheduleType) != null ? _l : "manual",
            scheduleTime: (_m = this.draft.scheduleTime) != null ? _m : nowTimeString(),
            scheduleDate: (_n = this.draft.scheduleDate) != null ? _n : "",
            scheduleDays: (_o = this.draft.scheduleDays) != null ? _o : [],
            scheduleMonthDays: (_p = this.draft.scheduleMonthDays) != null ? _p : [],
            scheduleIntervalValue: (_q = this.draft.scheduleIntervalValue) != null ? _q : 10,
            scheduleIntervalUnit: (_r = this.draft.scheduleIntervalUnit) != null ? _r : "minutes",
            status: "pending",
            lastRun: "",
            output: "",
            createdAt: (/* @__PURE__ */ new Date()).toISOString(),
            workingDirectory: this.draft.workingDirectory,
            branch: savingTaskKind === "opencode" ? this.draft.branch : "",
            createBranch: savingTaskKind === "opencode" ? this.draft.createBranch : false,
            interactiveTerminal: savingTaskKind === "code" ? void 0 : !!this.draft.interactiveTerminal,
            code: savingTaskKind === "code" ? this.draft.code : void 0,
            codeLang: savingTaskKind === "code" ? "javascript" : void 0,
            codeInputVar: savingTaskKind === "code" ? this.draft.codeInputVar || "input" : void 0,
            codeOutputVar: savingTaskKind === "code" ? this.draft.codeOutputVar || "output" : void 0,
            codeAllowVault: savingTaskKind === "code" ? !!this.draft.codeAllowVault : void 0,
            codeAllowFiles: savingTaskKind === "code" ? !!this.draft.codeAllowFiles : void 0,
            codeAllowTerminal: savingTaskKind === "code" ? !!this.draft.codeAllowTerminal : void 0
          };
          this.plugin.settings.tasks.push(task);
        }
        await this.plugin.saveSettings(!this.editTask);
        if (updatedTask) {
          if (areaChanged) (_s = this.plugin.view) == null ? void 0 : _s.render();
          this.plugin.emitTaskUpdated(updatedTask);
        }
        new import_obsidian.Notice(`Task "${this.draft.name}" saved.`);
        this.close();
      })
    );
  }
  onClose() {
    this.contentEl.empty();
  }
};
var EditWorkflowStepModal = class extends import_obsidian.Modal {
  constructor(app, plugin, workflow, step) {
    super(app);
    this.plugin = plugin;
    this.workflow = workflow;
    this.step = step;
    this.draft = { ...step };
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("auto-oc-modal");
    setAutoOCModalSize(this, 760);
    preventBackdropClose(this);
    contentEl.createEl("h3", {
      text: this.step.stepKind === "delay" ? "Edit Delay Step" : "Edit Code Step"
    });
    new import_obsidian.Setting(contentEl).setName("Step name").setDesc("Optional label used in this workflow").addText((text) => {
      text.inputEl.addClass("auto-oc-modal-input");
      text.setPlaceholder(this.step.stepKind === "delay" ? "Delay" : "Code").setValue(this.draft.name || "").onChange((v) => this.draft.name = v.trim());
    });
    new import_obsidian.Setting(contentEl).setName("Area").setDesc("Defaults to the workflow area").addText((text) => {
      var _a;
      text.inputEl.addClass("auto-oc-modal-input");
      text.setPlaceholder(((_a = this.workflow.area) == null ? void 0 : _a.trim()) || "No area").setValue(this.draft.area || this.workflow.area || "").onChange((v) => this.draft.area = v.trim());
    });
    if (this.step.stepKind === "delay") {
      new import_obsidian.Setting(contentEl).setName("Delay").setDesc("Pause the workflow before continuing").addText((text) => {
        var _a;
        text.inputEl.addClass("auto-oc-modal-input");
        text.inputEl.type = "number";
        text.inputEl.min = "0";
        text.setValue(String((_a = this.draft.delayValue) != null ? _a : 5)).onChange((v) => {
          const n = parseInt(v, 10);
          this.draft.delayValue = isNaN(n) || n < 0 ? 0 : n;
        });
      }).addDropdown((dd) => {
        dd.addOption("seconds", "Seconds");
        dd.addOption("minutes", "Minutes");
        dd.addOption("hours", "Hours");
        dd.setValue(this.draft.delayUnit || "minutes");
        dd.onChange((v) => this.draft.delayUnit = v);
      });
    } else {
      const initialCode = this.draft.code || "";
      new import_obsidian.Setting(contentEl).setName("JavaScript code").setDesc("Available variables: input, outputs, JSON, Math, Date, String, Number, Boolean, Array, Object, RegExp. Set output to pass data forward.").addTextArea((text) => {
        text.inputEl.addClass("auto-oc-modal-textarea");
        setupCodeTextarea(text.inputEl);
        text.inputEl.rows = 12;
        text.setValue(initialCode).onChange((v) => this.draft.code = v);
      });
      new import_obsidian.Setting(contentEl).setName("Variables").setDesc("Input variable receives previous step output; output variable is returned to the next step").addText((text) => {
        text.inputEl.addClass("auto-oc-modal-input");
        text.setPlaceholder("input").setValue(this.draft.codeInputVar || "input").onChange((v) => this.draft.codeInputVar = v || "input");
      }).addText((text) => {
        text.inputEl.addClass("auto-oc-modal-input");
        text.setPlaceholder("output").setValue(this.draft.codeOutputVar || "output").onChange((v) => this.draft.codeOutputVar = v || "output");
      });
      contentEl.createDiv("auto-oc-modal-section-title").setText("Code permissions");
      new import_obsidian.Setting(contentEl).setName("Vault API").setDesc("Expose vault.read/write/append/exists/list, confined to this Obsidian vault.").addToggle((tog) => {
        tog.setValue(!!this.draft.codeAllowVault);
        tog.onChange((v) => this.draft.codeAllowVault = v);
      });
      new import_obsidian.Setting(contentEl).setName("Local files API").setDesc("Expose files.read/write/append/exists/list for local paths. Relative paths use AutoOC working directory or the vault root.").addToggle((tog) => {
        tog.setValue(!!this.draft.codeAllowFiles);
        tog.onChange((v) => this.draft.codeAllowFiles = v);
      });
      new import_obsidian.Setting(contentEl).setName("Terminal API").setDesc("Expose terminal.run(command, { cwd, timeoutMs }). Commands run from AutoOC working directory or the vault root by default.").addToggle((tog) => {
        tog.setValue(!!this.draft.codeAllowTerminal);
        tog.onChange((v) => this.draft.codeAllowTerminal = v);
      });
      contentEl.createEl("p", {
        text: "Code steps run in a VM sandbox. Extra capabilities are only exposed when enabled above: vault, files, and terminal.",
        cls: "setting-item-description auto-oc-workflow-section-help"
      });
    }
    new import_obsidian.Setting(contentEl).addButton(
      (btn) => btn.setButtonText("Save Step").setCta().onClick(async () => {
        var _a, _b;
        if (!((_a = this.draft.area) == null ? void 0 : _a.trim())) this.draft.area = this.workflow.area || "";
        Object.assign(this.step, this.draft);
        const wfIdx = this.plugin.settings.workflows.findIndex((w) => w.id === this.workflow.id);
        if (wfIdx !== -1) {
          const stepIdx = this.plugin.settings.workflows[wfIdx].steps.findIndex((s) => s.id === this.step.id);
          if (stepIdx !== -1) {
            this.plugin.settings.workflows[wfIdx].steps[stepIdx] = { ...this.step };
          }
        }
        await this.plugin.saveSettings();
        (_b = this.plugin.view) == null ? void 0 : _b.refresh();
        new import_obsidian.Notice("AutoOC: workflow step saved.");
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
    this.draft = editWorkflow ? { ...editWorkflow } : { name: "", description: "", handoffBranch: false, handoffOutput: true, scheduleType: "manual", scheduleTime: nowTimeString(), scheduleDate: todayString(), scheduleDays: [], scheduleMonthDays: [], scheduleIntervalValue: 10, scheduleIntervalUnit: "minutes" };
    this.selectedSteps = editWorkflow ? editWorkflow.steps.map((s, i) => ({
      ...s,
      id: s.id || generateId(),
      stepKind: s.stepKind || "task",
      area: s.area || editWorkflow.area || "",
      transitions: [...s.transitions || []],
      position: s.position || { x: 60 + i * 280, y: 60 }
    })) : [];
    this.stepConfigs = {};
    if (editWorkflow) {
      for (const step of editWorkflow.steps) {
        this.stepConfigs[step.id] = {
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
    new import_obsidian.Setting(contentEl).setName("Area").setDesc("Optional dashboard grouping area").addText((text) => {
      var _a;
      text.inputEl.addClass("auto-oc-modal-input");
      text.setPlaceholder("No area").setValue((_a = this.draft.area) != null ? _a : "").onChange((v) => {
        var _a2;
        const previousArea = ((_a2 = this.draft.area) == null ? void 0 : _a2.trim()) || "";
        const nextArea = v.trim();
        this.draft.area = nextArea;
        this.selectedSteps.forEach((step) => {
          var _a3;
          if (!((_a3 = step.area) == null ? void 0 : _a3.trim()) || step.area.trim() === previousArea) step.area = nextArea;
        });
      });
      renderAreaSuggestions(contentEl, text.inputEl, getConfiguredAreaNames(this.plugin.settings), (area) => {
        this.draft.area = area;
        this.selectedSteps.forEach((step) => {
          var _a2;
          if (!((_a2 = step.area) == null ? void 0 : _a2.trim())) step.area = area;
        });
      });
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
      dd.addOption("interval", "Interval (every X seconds/minutes/hours)");
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
    if (this.draft.scheduleType === "interval") {
      new import_obsidian.Setting(contentEl).setName("Interval").setDesc("Run the workflow repeatedly every X units").addText((text) => {
        var _a;
        text.inputEl.addClass("auto-oc-modal-input");
        text.inputEl.type = "number";
        text.inputEl.min = "1";
        text.setPlaceholder("10").setValue(String((_a = this.draft.scheduleIntervalValue) != null ? _a : 10)).onChange((v) => {
          const n = parseInt(v, 10);
          this.draft.scheduleIntervalValue = isNaN(n) || n < 1 ? 1 : n;
        });
      }).addDropdown((dd) => {
        var _a;
        dd.addOption("seconds", "Seconds");
        dd.addOption("minutes", "Minutes");
        dd.addOption("hours", "Hours");
        dd.setValue((_a = this.draft.scheduleIntervalUnit) != null ? _a : "minutes");
        dd.onChange((v) => this.draft.scheduleIntervalUnit = v);
      });
    }
    if (this.draft.scheduleType !== "manual" && this.draft.scheduleType !== "interval") {
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
        var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _A, _B;
        if (!((_a = this.draft.name) == null ? void 0 : _a.trim())) {
          new import_obsidian.Notice("Name is required.");
          return;
        }
        if (this.selectedSteps.length < 2) {
          new import_obsidian.Notice("A workflow needs at least 2 steps.");
          return;
        }
        if (this.draft.scheduleType !== "manual" && this.draft.scheduleType !== "interval" && !/^\d{2}:\d{2}$/.test((_b = this.draft.scheduleTime) != null ? _b : "")) {
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
        const steps = this.selectedSteps.map((src, idx) => {
          var _a2, _b2, _c2;
          const config = this.stepConfigs[src.id] || {};
          const workflowArea = ((_a2 = this.draft.area) == null ? void 0 : _a2.trim()) || "";
          const step = {
            ...src,
            id: src.id || generateId(),
            stepKind: src.stepKind || "task",
            name: ((_b2 = src.name) == null ? void 0 : _b2.trim()) || void 0,
            area: ((_c2 = src.area) == null ? void 0 : _c2.trim()) || workflowArea,
            transitions: [],
            position: { x: 60 + idx * 280, y: 60 },
            transitionMode: config.transitionMode || "default",
            evaluatePrompt: config.evaluatePrompt,
            forceContinue: config.forceContinue
          };
          return step;
        });
        for (let i = 0; i < steps.length - 1; i++) {
          steps[i].transitions = [{
            toStepId: steps[i + 1].id,
            mode: steps[i].transitionMode || "default",
            evaluatePrompt: steps[i].evaluatePrompt,
            forceContinue: steps[i].forceContinue
          }];
        }
        let updatedWorkflow = null;
        let areaChanged = false;
        if (this.editWorkflow) {
          const idx = this.plugin.settings.workflows.findIndex(
            (w) => w.id === this.editWorkflow.id
          );
          if (idx !== -1) {
            const existing = this.plugin.settings.workflows[idx];
            const previousArea = ((_e = existing.area) == null ? void 0 : _e.trim()) || "";
            this.plugin.settings.workflows[idx] = {
              ...this.editWorkflow,
              name: this.draft.name,
              area: (_f = this.draft.area) != null ? _f : "",
              description: this.draft.description,
              steps,
              handoffBranch: (_g = this.draft.handoffBranch) != null ? _g : false,
              handoffOutput: (_h = this.draft.handoffOutput) != null ? _h : false,
              status: existing.status,
              currentStep: existing.currentStep,
              lastRun: existing.lastRun,
              scheduleType: (_i = this.draft.scheduleType) != null ? _i : "manual",
              scheduleTime: (_j = this.draft.scheduleTime) != null ? _j : nowTimeString(),
              scheduleDate: (_k = this.draft.scheduleDate) != null ? _k : "",
              scheduleDays: (_l = this.draft.scheduleDays) != null ? _l : [],
              scheduleMonthDays: (_m = this.draft.scheduleMonthDays) != null ? _m : [],
              scheduleIntervalValue: (_n = this.draft.scheduleIntervalValue) != null ? _n : 10,
              scheduleIntervalUnit: (_o = this.draft.scheduleIntervalUnit) != null ? _o : "minutes"
            };
            updatedWorkflow = this.plugin.settings.workflows[idx];
            areaChanged = previousArea !== (((_p = updatedWorkflow.area) == null ? void 0 : _p.trim()) || "");
          }
        } else {
          const workflow = {
            id: generateId(),
            name: this.draft.name,
            area: (_q = this.draft.area) != null ? _q : "",
            description: (_r = this.draft.description) != null ? _r : "",
            steps,
            status: "pending",
            currentStep: -1,
            createdAt: (/* @__PURE__ */ new Date()).toISOString(),
            handoffBranch: (_s = this.draft.handoffBranch) != null ? _s : false,
            handoffOutput: (_t = this.draft.handoffOutput) != null ? _t : false,
            scheduleType: (_u = this.draft.scheduleType) != null ? _u : "manual",
            scheduleTime: (_v = this.draft.scheduleTime) != null ? _v : nowTimeString(),
            scheduleDate: (_w = this.draft.scheduleDate) != null ? _w : todayString(),
            scheduleDays: (_x = this.draft.scheduleDays) != null ? _x : [],
            scheduleMonthDays: (_y = this.draft.scheduleMonthDays) != null ? _y : [],
            scheduleIntervalValue: (_z = this.draft.scheduleIntervalValue) != null ? _z : 10,
            scheduleIntervalUnit: (_A = this.draft.scheduleIntervalUnit) != null ? _A : "minutes"
          };
          this.plugin.settings.workflows.push(workflow);
        }
        await this.plugin.saveSettings(!this.editWorkflow);
        if (updatedWorkflow) {
          if (areaChanged) (_B = this.plugin.view) == null ? void 0 : _B.render();
          this.plugin.emitWorkflowUpdated(updatedWorkflow);
        }
        new import_obsidian.Notice(`Workflow "${this.draft.name}" saved.`);
        this.close();
      })
    );
  }
  workflowStepLabel(step) {
    var _a;
    if ((_a = step.name) == null ? void 0 : _a.trim()) return step.name.trim();
    return this.defaultWorkflowStepName(step);
  }
  defaultWorkflowStepName(step, index) {
    var _a, _b;
    if (step.stepKind === "code") return "{ } Code";
    if (step.stepKind === "delay") return `\u23F1 ${(_a = step.delayValue) != null ? _a : 5} ${(_b = step.delayUnit) != null ? _b : "minutes"}`;
    const task = this.plugin.settings.tasks.find((t) => t.id === step.taskId);
    return task ? `${(task.taskKind || "opencode") === "code" ? "{ }" : "\u{1F4CC}"} ${task.name}` : "\u274C Deleted task";
  }
  renderStepsList(container) {
    var _a, _b, _c, _d, _e;
    container.empty();
    if (this.selectedSteps.length === 0) {
      container.createEl("p", {
        text: "No steps added yet. Add a task, code, or delay step below.",
        cls: "auto-oc-empty"
      });
    }
    for (let i = 0; i < this.selectedSteps.length; i++) {
      const step = this.selectedSteps[i];
      if (!step.id) step.id = generateId();
      const task = step.stepKind === "task" ? this.plugin.settings.tasks.find((t) => t.id === step.taskId) : void 0;
      const config = this.stepConfigs[step.id] || {};
      const stepEl = container.createDiv("auto-oc-workflow-step-item");
      const isLast = i === this.selectedSteps.length - 1;
      const header = stepEl.createDiv("auto-oc-workflow-step-header");
      header.createEl("span", {
        text: `Step ${i + 1}`,
        cls: "auto-oc-workflow-step-num"
      });
      header.createEl("span", {
        text: this.workflowStepLabel(step),
        cls: step.stepKind === "task" && !task ? "auto-oc-workflow-step-err" : ""
      });
      if (!isLast) {
        header.createEl("span", { text: "\u2192", cls: "auto-oc-workflow-step-arrow" });
        header.createEl("span", {
          text: `Step ${i + 2}`,
          cls: "auto-oc-workflow-step-num"
        });
        header.createEl("span", { text: this.workflowStepLabel(this.selectedSteps[i + 1]) });
      }
      const btnRemove = header.createEl("button", {
        text: "\u2716",
        cls: "auto-oc-btn-delete-small"
      });
      btnRemove.style.marginLeft = "auto";
      btnRemove.onclick = () => {
        this.selectedSteps.splice(i, 1);
        delete this.stepConfigs[step.id];
        this.renderStepsList(container);
      };
      new import_obsidian.Setting(stepEl).setName("Step name").setDesc("Optional label used in this workflow").addText((text) => {
        text.inputEl.addClass("auto-oc-modal-input");
        text.setPlaceholder(this.defaultWorkflowStepName(step, i)).setValue(step.name || "").onChange((v) => {
          step.name = v.trim();
        });
      });
      new import_obsidian.Setting(stepEl).setName("Area").setDesc("Defaults to the workflow area").addText((text) => {
        var _a2;
        text.inputEl.addClass("auto-oc-modal-input");
        text.setPlaceholder(((_a2 = this.draft.area) == null ? void 0 : _a2.trim()) || "No area").setValue(step.area || this.draft.area || "").onChange((v) => step.area = v.trim());
      });
      if (step.stepKind === "code") {
        const initialCode = step.code || "";
        new import_obsidian.Setting(stepEl).setName("JavaScript code").setDesc("Runs inside the workflow. Previous output is available as the input variable; assign the output variable to pass data forward.").addTextArea((text) => {
          text.inputEl.addClass("auto-oc-modal-textarea");
          setupCodeTextarea(text.inputEl);
          text.inputEl.rows = 6;
          text.setValue(initialCode).onChange((v) => step.code = v);
        });
        new import_obsidian.Setting(stepEl).setName("Variables").setDesc("Input and output variable names").addText((text) => {
          text.inputEl.addClass("auto-oc-modal-input");
          text.setPlaceholder("input").setValue(step.codeInputVar || "input").onChange((v) => step.codeInputVar = v || "input");
        }).addText((text) => {
          text.inputEl.addClass("auto-oc-modal-input");
          text.setPlaceholder("output").setValue(step.codeOutputVar || "output").onChange((v) => step.codeOutputVar = v || "output");
        });
        new import_obsidian.Setting(stepEl).setName("Code permissions").setDesc("Expose optional APIs to this code step").addToggle((tog) => {
          tog.setTooltip("Vault API");
          tog.setValue(!!step.codeAllowVault);
          tog.onChange((v) => step.codeAllowVault = v);
          tog.toggleEl.insertAdjacentHTML("afterend", `<span class="auto-oc-day-label">Vault</span>`);
        }).addToggle((tog) => {
          tog.setTooltip("Local files API");
          tog.setValue(!!step.codeAllowFiles);
          tog.onChange((v) => step.codeAllowFiles = v);
          tog.toggleEl.insertAdjacentHTML("afterend", `<span class="auto-oc-day-label">Files</span>`);
        }).addToggle((tog) => {
          tog.setTooltip("Terminal API");
          tog.setValue(!!step.codeAllowTerminal);
          tog.onChange((v) => step.codeAllowTerminal = v);
          tog.toggleEl.insertAdjacentHTML("afterend", `<span class="auto-oc-day-label">Terminal</span>`);
        });
      } else if (step.stepKind === "delay") {
        new import_obsidian.Setting(stepEl).setName("Delay").setDesc("Pause the workflow before continuing").addText((text) => {
          var _a2;
          text.inputEl.addClass("auto-oc-modal-input");
          text.inputEl.type = "number";
          text.inputEl.min = "0";
          text.setValue(String((_a2 = step.delayValue) != null ? _a2 : 5)).onChange((v) => {
            const n = parseInt(v, 10);
            step.delayValue = isNaN(n) || n < 0 ? 0 : n;
          });
        }).addDropdown((dd) => {
          dd.addOption("seconds", "Seconds");
          dd.addOption("minutes", "Minutes");
          dd.addOption("hours", "Hours");
          dd.setValue(step.delayUnit || "minutes");
          dd.onChange((v) => step.delayUnit = v);
        });
      }
      if (!isLast) {
        const transConfig = stepEl.createDiv("auto-oc-workflow-transition");
        const nextStep = this.selectedSteps[i + 1];
        const transitionHeader = transConfig.createDiv("auto-oc-workflow-transition-header");
        transitionHeader.createSpan({
          text: `Transition: Step ${i + 1} \u2192 Step ${i + 2}`,
          cls: "auto-oc-workflow-transition-title"
        });
        transitionHeader.createSpan({
          text: `After \xAB${this.workflowStepLabel(step)}\xBB finishes, decide whether \xAB${this.workflowStepLabel(nextStep)}\xBB starts.`,
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
        const currentMode = (_b = config.transitionMode) != null ? _b : ((_a = config.forceContinue) != null ? _a : false) ? "force" : config.evaluatePrompt !== void 0 ? "eval" : "default";
        for (const m of modes) {
          modeSel.createEl("option", { text: m.label }).value = m.val;
        }
        modeSel.value = currentMode;
        const modeDesc = modeDiv.createSpan({
          text: (_d = (_c = modes.find((m) => m.val === currentMode)) == null ? void 0 : _c.desc) != null ? _d : "",
          cls: "auto-oc-workflow-mode-desc"
        });
        modeSel.onchange = () => {
          var _a2;
          this.stepConfigs[step.id] = this.stepConfigs[step.id] || {};
          if (modeSel.value === "force") {
            this.stepConfigs[step.id].transitionMode = "force";
            this.stepConfigs[step.id].forceContinue = true;
            this.stepConfigs[step.id].evaluatePrompt = void 0;
          } else if (modeSel.value === "eval") {
            this.stepConfigs[step.id].transitionMode = "eval";
            this.stepConfigs[step.id].forceContinue = void 0;
            this.stepConfigs[step.id].evaluatePrompt = (_a2 = this.stepConfigs[step.id].evaluatePrompt) != null ? _a2 : defaultEvalPrompt;
          } else {
            this.stepConfigs[step.id].transitionMode = "default";
            this.stepConfigs[step.id].forceContinue = void 0;
            this.stepConfigs[step.id].evaluatePrompt = void 0;
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
            text: `Write the condition here. OpenCode will receive this text plus the output of \xAB${this.workflowStepLabel(step)}\xBB. It must answer YES to start \xAB${this.workflowStepLabel(nextStep)}\xBB.`,
            cls: "auto-oc-workflow-ai-prompt-help"
          });
          const evalTextarea = promptBox.createEl("textarea", {
            cls: "auto-oc-modal-textarea auto-oc-workflow-ai-textarea"
          });
          evalTextarea.rows = 4;
          evalTextarea.value = (_e = config.evaluatePrompt) != null ? _e : defaultEvalPrompt;
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
            { label: "Errors?", prompt: "Did the previous task complete without errors or failures? Look for error messages, stack traces, or exit codes in the output. If no errors were found, reply YES. If there were errors, reply NO." },
            { label: "Tests OK?", prompt: "Were all tests executed successfully? Check the output for test failures, assertion errors, or test suite crashes. If all tests passed, reply YES. If any test failed, reply NO." },
            { label: "Build OK?", prompt: "Was the build successful? Check for compilation errors, linker errors, or build failures. If the build completed without errors, reply YES. Otherwise reply NO." },
            { label: "Work left?", prompt: "Based on the output, is there remaining work that requires a follow-up step? Look for TODO comments, unfinished tasks, or incomplete implementations. If more work is needed, reply YES. If the task is fully complete, reply NO." },
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
              if (p.prompt) {
                evalTextarea.value = p.prompt;
                this.stepConfigs[step.id] = this.stepConfigs[step.id] || {};
                this.stepConfigs[step.id].evaluatePrompt = p.prompt;
                previewCode.textContent = `${p.prompt}

Previous step output:
---
[output of \xAB${this.workflowStepLabel(step)}\xBB appears here]
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

Previous step output:
---
[output of \xAB${this.workflowStepLabel(step)}\xBB appears here]
---

Reply ONLY with YES or NO.`;
          evalTextarea.oninput = () => {
            this.stepConfigs[step.id] = this.stepConfigs[step.id] || {};
            this.stepConfigs[step.id].evaluatePrompt = evalTextarea.value;
            previewCode.textContent = `${evalTextarea.value || "(your prompt)"}

Previous step output:
---
[output of \xAB${this.workflowStepLabel(step)}\xBB appears here]
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
    const selectedTaskIds = this.selectedSteps.map((s) => s.taskId).filter(Boolean);
    const tasks = this.plugin.settings.tasks.filter(
      (t) => !selectedTaskIds.includes(t.id)
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
            (t) => !prevIds.has(t.id) && !selectedTaskIds.includes(t.id)
          );
          if (newTasks.length > 0) {
            const newest = newTasks[newTasks.length - 1];
            this.selectedSteps.push({ id: generateId(), stepKind: "task", taskId: newest.id, area: this.draft.area || newest.area || "", transitions: [], position: { x: 0, y: 0 } });
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
          const task = this.plugin.settings.tasks.find((t) => t.id === sel.value);
          this.selectedSteps.push({ id: generateId(), stepKind: "task", taskId: sel.value, area: this.draft.area || (task == null ? void 0 : task.area) || "", transitions: [], position: { x: 0, y: 0 } });
          this.renderStepsList(container);
        }
      };
    }
    const btnCode = addDiv.createEl("button", {
      text: "\u2795 Add Code Step",
      cls: "auto-oc-btn-secondary"
    });
    btnCode.title = "Add a JavaScript code step to this workflow";
    btnCode.onclick = () => {
      this.selectedSteps.push({
        id: generateId(),
        stepKind: "code",
        name: "Code",
        area: this.draft.area || "",
        code: "// input is the previous step's output\n// Set output to the value passed to the next step\noutput = String(input).toUpperCase();",
        codeLang: "javascript",
        codeInputVar: "input",
        codeOutputVar: "output",
        transitions: [],
        position: { x: 0, y: 0 }
      });
      this.renderStepsList(container);
    };
    const btnDelay = addDiv.createEl("button", {
      text: "\u2795 Add Delay Step",
      cls: "auto-oc-btn-secondary"
    });
    btnDelay.title = "Add a delay step to this workflow";
    btnDelay.onclick = () => {
      this.selectedSteps.push({
        id: generateId(),
        stepKind: "delay",
        name: "Delay",
        area: this.draft.area || "",
        delayValue: 5,
        delayUnit: "minutes",
        transitions: [],
        position: { x: 0, y: 0 }
      });
      this.renderStepsList(container);
    };
  }
  onClose() {
    this.contentEl.empty();
  }
};
var ExportModal = class extends import_obsidian.Modal {
  constructor(app, plugin) {
    super(app);
    this.selectedTaskIds = /* @__PURE__ */ new Set();
    this.selectedWorkflowIds = /* @__PURE__ */ new Set();
    this.name = "";
    this.description = "";
    this.plugin = plugin;
    for (const t of plugin.settings.tasks) this.selectedTaskIds.add(t.id);
    for (const w of plugin.settings.workflows) this.selectedWorkflowIds.add(w.id);
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("auto-oc-modal");
    setAutoOCModalSize(this, 720);
    preventBackdropClose(this);
    contentEl.createEl("h3", { text: "\u{1F4E4} Export Tasks & Workflows" });
    contentEl.createEl("p", {
      text: "Select the items you want to share. Selected workflows automatically include their referenced tasks so the file remains importable on another machine.",
      cls: "setting-item-description"
    });
    new import_obsidian.Setting(contentEl).setName("Export name (optional)").addText((text) => {
      text.setPlaceholder("My tasks").onChange((v) => this.name = v);
    });
    new import_obsidian.Setting(contentEl).setName("Description (optional)").addText((text) => {
      text.setPlaceholder("Shared AutoOC configuration").onChange((v) => this.description = v);
    });
    contentEl.createDiv("auto-oc-modal-section-title").setText("\u{1F4CB} Tasks");
    const taskActions = contentEl.createDiv("auto-oc-export-actions");
    taskActions.style.display = "flex";
    taskActions.style.gap = "8px";
    taskActions.style.marginBottom = "8px";
    const taskList = contentEl.createDiv("auto-oc-export-list");
    const renderTaskList = () => {
      taskList.empty();
      if (this.plugin.settings.tasks.length === 0) {
        taskList.createEl("p", { text: "No tasks available.", cls: "auto-oc-empty" });
        return;
      }
      for (const task of this.plugin.settings.tasks) {
        const row = taskList.createDiv("auto-oc-export-item");
        const label = row.createEl("label", { cls: "auto-oc-export-label" });
        const cb = label.createEl("input");
        cb.type = "checkbox";
        cb.checked = this.selectedTaskIds.has(task.id);
        cb.onchange = () => {
          if (cb.checked) this.selectedTaskIds.add(task.id);
          else this.selectedTaskIds.delete(task.id);
          updateSummary();
        };
        label.createSpan({ text: ` ${task.name}` });
        label.title = task.prompt.slice(0, 120) + (task.prompt.length > 120 ? "\u2026" : "");
      }
    };
    renderTaskList();
    const addSelectBtn = (parent, text, all, isTask) => {
      parent.createEl("button", {
        text,
        cls: "auto-oc-btn-secondary"
      }).onclick = () => {
        const source = isTask ? this.plugin.settings.tasks : this.plugin.settings.workflows;
        for (const item of source) {
          const set = isTask ? this.selectedTaskIds : this.selectedWorkflowIds;
          if (all) set.add(item.id);
          else set.delete(item.id);
        }
        if (isTask) renderTaskList();
        else renderWorkflowList();
        updateSummary();
      };
    };
    addSelectBtn(taskActions, "Select all", true, true);
    addSelectBtn(taskActions, "Deselect all", false, true);
    contentEl.createDiv("auto-oc-modal-section-title").setText("\u{1F517} Workflows");
    const wfActions = contentEl.createDiv("auto-oc-export-actions");
    wfActions.style.display = "flex";
    wfActions.style.gap = "8px";
    wfActions.style.marginBottom = "8px";
    const workflowList = contentEl.createDiv("auto-oc-export-list");
    const renderWorkflowList = () => {
      workflowList.empty();
      if (this.plugin.settings.workflows.length === 0) {
        workflowList.createEl("p", { text: "No workflows available.", cls: "auto-oc-empty" });
        return;
      }
      for (const wf of this.plugin.settings.workflows) {
        const row = workflowList.createDiv("auto-oc-export-item");
        const label = row.createEl("label", { cls: "auto-oc-export-label" });
        const cb = label.createEl("input");
        cb.type = "checkbox";
        cb.checked = this.selectedWorkflowIds.has(wf.id);
        cb.onchange = () => {
          if (cb.checked) this.selectedWorkflowIds.add(wf.id);
          else this.selectedWorkflowIds.delete(wf.id);
          updateSummary();
        };
        label.createSpan({ text: ` ${wf.name}` });
        const stepNames = wf.steps.map((s) => {
          var _a, _b, _c, _d;
          if (s.stepKind === "code") return "{ } Code";
          if (s.stepKind === "delay") return `\u23F1 ${(_a = s.delayValue) != null ? _a : 5} ${(_b = s.delayUnit) != null ? _b : "minutes"}`;
          return (_d = (_c = this.plugin.settings.tasks.find((t) => t.id === s.taskId)) == null ? void 0 : _c.name) != null ? _d : "?";
        }).join(" \u2192 ");
        label.title = wf.description ? `${wf.description}
${stepNames}` : stepNames;
      }
    };
    renderWorkflowList();
    addSelectBtn(wfActions, "Select all", true, false);
    addSelectBtn(wfActions, "Deselect all", false, false);
    const summary = contentEl.createDiv("auto-oc-export-summary");
    summary.style.marginTop = "16px";
    summary.style.fontSize = "0.85rem";
    summary.style.color = "var(--text-muted)";
    const updateSummary = () => {
      const payload = this.plugin.buildExportSelectionPayload(
        this.selectedTaskIds,
        this.selectedWorkflowIds
      );
      const explicitTasks = this.plugin.settings.tasks.filter(
        (t) => this.selectedTaskIds.has(t.id)
      ).length;
      const autoTasks = payload.tasks.length - explicitTasks;
      summary.textContent = `Will export ${explicitTasks} selected task(s)` + (autoTasks > 0 ? ` + ${autoTasks} task(s) required by workflows` : "") + ` and ${payload.workflows.length} selected workflow(s).`;
    };
    updateSummary();
    const btnRow = contentEl.createDiv("auto-oc-export-actions");
    btnRow.style.display = "flex";
    btnRow.style.gap = "8px";
    btnRow.style.marginTop = "12px";
    const getPayload = () => this.plugin.buildExportSelectionPayload(
      this.selectedTaskIds,
      this.selectedWorkflowIds
    );
    const btnCopy = btnRow.createEl("button", {
      text: "\u{1F4CB} Copy JSON",
      cls: "auto-oc-btn-secondary"
    });
    btnCopy.onclick = async () => {
      const payload = getPayload();
      if (payload.tasks.length === 0 && payload.workflows.length === 0) {
        new import_obsidian.Notice("AutoOC: nothing selected to export.");
        return;
      }
      const json = this.plugin.buildExportJson(
        payload.tasks,
        payload.workflows,
        this.name,
        this.description
      );
      try {
        await navigator.clipboard.writeText(json);
        new import_obsidian.Notice("AutoOC: JSON copied to clipboard.");
      } catch (e) {
        new import_obsidian.Notice(`AutoOC: could not copy \u2014 ${String(e)}`);
      }
    };
    const btnSave = btnRow.createEl("button", {
      text: "\u{1F4BE} Save JSON\u2026",
      cls: "auto-oc-btn-primary"
    });
    btnSave.onclick = async () => {
      const payload = getPayload();
      if (payload.tasks.length === 0 && payload.workflows.length === 0) {
        new import_obsidian.Notice("AutoOC: nothing selected to export.");
        return;
      }
      await this.plugin.exportToFile(
        payload.tasks,
        payload.workflows,
        this.name,
        this.description
      );
      this.close();
    };
  }
  onClose() {
    this.contentEl.empty();
  }
};
var ImportModal = class extends import_obsidian.Modal {
  constructor(app, plugin) {
    super(app);
    this.filePath = null;
    this.previewData = null;
    this.previewEl = null;
    this.sourceMode = "file";
    this.libraryEntries = [];
    this.libraryError = null;
    this.selectedLibraryFile = null;
    this.pastedJson = "";
    // Last validation result (errors + warnings). Rendered in the
    // preview so the user can see exactly what's wrong with the file.
    this.lastValidation = null;
    this.plugin = plugin;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("auto-oc-modal");
    setAutoOCModalSize(this, 720);
    preventBackdropClose(this);
    contentEl.createEl("h3", { text: "\u{1F4E5} Import Tasks & Workflows" });
    contentEl.createEl("p", {
      text: "Import from a local JSON file, paste JSON directly, or browse the shared library configured in settings. Imported items use this system's default model and agent when the saved agent is unavailable. Duplicate names are renamed automatically.",
      cls: "setting-item-description"
    });
    const tabBar = contentEl.createDiv("auto-oc-tab-bar");
    const btnFile = tabBar.createEl("button", {
      text: "\u{1F4C1} From file",
      cls: "auto-oc-tab-btn"
    });
    const btnPaste = tabBar.createEl("button", {
      text: "\u{1F4CB} Paste JSON",
      cls: "auto-oc-tab-btn"
    });
    const btnLibrary = tabBar.createEl("button", {
      text: "\u{1F310} Browse library",
      cls: "auto-oc-tab-btn"
    });
    const panel = contentEl.createDiv("auto-oc-import-panel");
    const renderPanel = () => {
      btnFile.toggleClass("active", this.sourceMode === "file");
      btnPaste.toggleClass("active", this.sourceMode === "paste");
      btnLibrary.toggleClass("active", this.sourceMode === "library");
      panel.empty();
      if (this.sourceMode === "file") {
        this.renderFilePanel(panel);
      } else if (this.sourceMode === "paste") {
        this.renderPastePanel(panel);
      } else {
        this.renderLibraryPanel(panel);
      }
    };
    btnFile.onclick = () => {
      this.sourceMode = "file";
      renderPanel();
    };
    btnPaste.onclick = () => {
      this.sourceMode = "paste";
      renderPanel();
    };
    btnLibrary.onclick = () => {
      this.sourceMode = "library";
      renderPanel();
    };
    this.previewEl = contentEl.createDiv("auto-oc-import-preview");
    this.previewEl.style.marginTop = "16px";
    const btnRow = contentEl.createDiv("auto-oc-import-actions");
    btnRow.style.display = "flex";
    btnRow.style.gap = "8px";
    btnRow.style.marginTop = "16px";
    const btnImport = btnRow.createEl("button", {
      text: "Import",
      cls: "auto-oc-btn-primary"
    });
    btnImport.disabled = !this.previewData;
    btnImport.onclick = async () => {
      if (!this.previewData) return;
      btnImport.disabled = true;
      btnImport.textContent = "Importing\u2026";
      try {
        const result = await this.plugin.importFromData(this.previewData);
        new import_obsidian.Notice(
          `AutoOC: imported ${result.tasksImported} task(s) and ${result.workflowsImported} workflow(s).`
        );
        this.close();
      } catch (e) {
        new import_obsidian.Notice(`AutoOC: import failed \u2014 ${String(e)}`);
        btnImport.disabled = false;
        btnImport.textContent = "Import";
      }
    };
    const btnCancel = btnRow.createEl("button", {
      text: "Cancel",
      cls: "auto-oc-btn-secondary"
    });
    btnCancel.onclick = () => this.close();
    this._importBtn = btnImport;
    renderPanel();
    this.renderPreview();
  }
  renderFilePanel(panel) {
    new import_obsidian.Setting(panel).setName("JSON file").setDesc("Choose an AutoOC export file").addButton(
      (btn) => btn.setButtonText("Choose file\u2026").onClick(async () => {
        const chosen = await this.chooseFile();
        if (chosen) {
          this.filePath = chosen;
          this.selectedLibraryFile = null;
          await this.loadFilePreview();
        }
      })
    ).addText((text) => {
      var _a;
      text.setDisabled(true);
      text.inputEl.addClass("auto-oc-modal-input");
      text.setValue((_a = this.filePath) != null ? _a : "");
    });
  }
  renderPastePanel(panel) {
    panel.createEl("p", {
      text: "Paste an AutoOC JSON export below. The preview will update automatically when the JSON is valid.",
      cls: "setting-item-description"
    });
    const textarea = panel.createEl("textarea", {
      cls: "auto-oc-modal-textarea auto-oc-import-paste"
    });
    textarea.value = this.pastedJson;
    textarea.rows = 12;
    textarea.spellcheck = false;
    textarea.placeholder = '{\n  "autoOCExport": { ... },\n  "tasks": [ ... ],\n  "workflows": [ ... ]\n}';
    textarea.style.width = "100%";
    textarea.style.fontFamily = "var(--font-monospace)";
    textarea.style.fontSize = "0.8rem";
    const parse = () => {
      var _a, _b, _c, _d, _e, _f, _g, _h;
      this.pastedJson = textarea.value.trim();
      if (!this.pastedJson) {
        this.previewData = null;
        this.renderPreview();
        this.updateImportButton();
        return;
      }
      try {
        const data = JSON.parse(this.pastedJson);
        const result = this.validateExport(data);
        this.lastValidation = result;
        if (!result.ok) {
          this.previewData = null;
          new import_obsidian.Notice(`AutoOC: pasted JSON has ${result.errors.length} error(s) \u2014 see the preview panel.`, 8e3);
        } else {
          this.previewData = data;
          this.filePath = null;
          this.selectedLibraryFile = null;
          if (result.warnings.length > 0) {
            new import_obsidian.Notice(`AutoOC: parsed ${(_b = (_a = data.tasks) == null ? void 0 : _a.length) != null ? _b : 0} task(s), ${(_d = (_c = data.workflows) == null ? void 0 : _c.length) != null ? _d : 0} workflow(s) with ${result.warnings.length} warning(s).`, 6e3);
          } else {
            new import_obsidian.Notice(`AutoOC: parsed ${(_f = (_e = data.tasks) == null ? void 0 : _e.length) != null ? _f : 0} task(s), ${(_h = (_g = data.workflows) == null ? void 0 : _g.length) != null ? _h : 0} workflow(s).`);
          }
        }
      } catch (e) {
        this.previewData = null;
        this.lastValidation = { ok: false, errors: [`Could not parse JSON: ${String(e)}`], warnings: [] };
        new import_obsidian.Notice(`AutoOC: could not parse JSON \u2014 ${String(e)}`, 8e3);
      }
      this.renderPreview();
      this.updateImportButton();
    };
    textarea.oninput = parse;
    const actions = panel.createDiv("auto-oc-import-paste-actions");
    actions.style.display = "flex";
    actions.style.gap = "8px";
    actions.style.marginTop = "8px";
    const btnClear = actions.createEl("button", {
      text: "Clear",
      cls: "auto-oc-btn-secondary"
    });
    btnClear.onclick = () => {
      textarea.value = "";
      this.pastedJson = "";
      this.previewData = null;
      this.renderPreview();
      this.updateImportButton();
    };
    const btnFormat = actions.createEl("button", {
      text: "Format JSON",
      cls: "auto-oc-btn-secondary"
    });
    btnFormat.onclick = () => {
      try {
        const parsed = JSON.parse(textarea.value);
        const formatted = JSON.stringify(parsed, null, 2);
        textarea.value = formatted;
        this.pastedJson = formatted;
        parse();
      } catch (e) {
        new import_obsidian.Notice(`AutoOC: cannot format \u2014 ${String(e)}`);
      }
    };
  }
  renderLibraryPanel(panel) {
    var _a;
    panel.empty();
    const loadRow = panel.createDiv("auto-oc-import-library-load");
    loadRow.style.display = "flex";
    loadRow.style.gap = "8px";
    loadRow.style.marginBottom = "12px";
    const resolvedUrl = normalizeLibraryUrl(this.plugin.settings.libraryUrl);
    const btnLoad = loadRow.createEl("button", {
      text: "\u{1F504} Load library",
      cls: "auto-oc-btn-secondary"
    });
    btnLoad.title = `Source: ${resolvedUrl}`;
    btnLoad.onclick = async () => {
      btnLoad.disabled = true;
      btnLoad.textContent = "Loading\u2026";
      await this.loadLibraryIndex();
      this.renderLibraryPanel(panel);
    };
    const listContainer = panel.createDiv("auto-oc-import-library-list");
    if (this.libraryError) {
      listContainer.createEl("p", {
        text: `Could not load library: ${this.libraryError}`,
        cls: "auto-oc-empty"
      });
      return;
    }
    if (this.libraryEntries.length === 0) {
      listContainer.createEl("p", {
        text: "No library entries loaded yet. Click Load library.",
        cls: "auto-oc-empty"
      });
      return;
    }
    listContainer.createEl("p", {
      text: `${this.libraryEntries.length} item(s) available:`,
      cls: "setting-item-description"
    });
    for (const entry of this.libraryEntries) {
      const row = listContainer.createDiv("auto-oc-import-library-item");
      row.style.padding = "6px 0";
      const isSelected = this.selectedLibraryFile === entry.file;
      const btn = row.createEl("button", {
        text: isSelected ? "\u2713 " + entry.name : entry.name,
        cls: isSelected ? "auto-oc-btn-primary" : "auto-oc-btn-secondary"
      });
      btn.style.width = "100%";
      btn.style.textAlign = "left";
      btn.title = (_a = entry.description) != null ? _a : entry.file;
      btn.onclick = async () => {
        this.selectedLibraryFile = entry.file;
        await this.loadLibraryFile(entry.file);
        this.renderLibraryPanel(panel);
      };
      if (entry.description) {
        row.createEl("div", {
          text: entry.description,
          cls: "setting-item-description"
        });
      }
    }
  }
  async chooseFile() {
    try {
      const electron = window.require("electron");
      const result = await electron.remote.dialog.showOpenDialog({
        properties: ["openFile"],
        filters: [{ name: "JSON files", extensions: ["json"] }],
        title: "Import AutoOC tasks and workflows"
      });
      if (!result.canceled && result.filePaths.length > 0) {
        return result.filePaths[0];
      }
    } catch (e) {
      new import_obsidian.Notice(`AutoOC: file picker failed \u2014 ${String(e)}`);
    }
    return null;
  }
  async loadFilePreview() {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    if (!this.filePath) return;
    try {
      const raw = fs18.readFileSync(this.filePath, "utf8");
      const data = JSON.parse(raw);
      this.validateExport(data);
      const result = this.validateExport(data);
      this.lastValidation = result;
      if (!result.ok) {
        this.previewData = null;
        new import_obsidian.Notice(`AutoOC: file has ${result.errors.length} error(s) \u2014 see the preview panel.`, 8e3);
      } else {
        this.previewData = data;
        if (result.warnings.length > 0) {
          new import_obsidian.Notice(`AutoOC: loaded ${(_b = (_a = data.tasks) == null ? void 0 : _a.length) != null ? _b : 0} task(s), ${(_d = (_c = data.workflows) == null ? void 0 : _c.length) != null ? _d : 0} workflow(s) with ${result.warnings.length} warning(s).`, 6e3);
        } else {
          new import_obsidian.Notice(`AutoOC: loaded ${(_f = (_e = data.tasks) == null ? void 0 : _e.length) != null ? _f : 0} task(s), ${(_h = (_g = data.workflows) == null ? void 0 : _g.length) != null ? _h : 0} workflow(s).`);
        }
      }
    } catch (e) {
      this.previewData = null;
      new import_obsidian.Notice(`AutoOC: could not read file \u2014 ${String(e)}`, 8e3);
    }
    this.renderPreview();
    this.updateImportButton();
  }
  async loadLibraryIndex() {
    this.libraryError = null;
    this.libraryEntries = [];
    try {
      const url = noCacheUrl(getLibraryIndexUrl(this.plugin.settings.libraryUrl));
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data.library || !Array.isArray(data.library)) {
        throw new Error("Invalid library index.");
      }
      this.libraryEntries = data.library;
    } catch (e) {
      this.libraryError = String(e);
      new import_obsidian.Notice(`AutoOC: library load failed \u2014 ${String(e)}`);
    }
  }
  async loadLibraryFile(fileName) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    try {
      const url = noCacheUrl(getLibraryFileUrl(this.plugin.settings.libraryUrl, fileName));
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const result = this.validateExport(data);
      this.lastValidation = result;
      if (!result.ok) {
        this.previewData = null;
        new import_obsidian.Notice(`AutoOC: "${fileName}" has ${result.errors.length} error(s) \u2014 see the preview panel.`, 8e3);
      } else {
        this.previewData = data;
        if (result.warnings.length > 0) {
          new import_obsidian.Notice(`AutoOC: loaded "${fileName}" \u2014 ${(_b = (_a = data.tasks) == null ? void 0 : _a.length) != null ? _b : 0} task(s), ${(_d = (_c = data.workflows) == null ? void 0 : _c.length) != null ? _d : 0} workflow(s) with ${result.warnings.length} warning(s).`, 6e3);
        } else {
          new import_obsidian.Notice(`AutoOC: loaded "${fileName}" \u2014 ${(_f = (_e = data.tasks) == null ? void 0 : _e.length) != null ? _f : 0} task(s), ${(_h = (_g = data.workflows) == null ? void 0 : _g.length) != null ? _h : 0} workflow(s).`);
        }
      }
    } catch (e) {
      this.previewData = null;
      new import_obsidian.Notice(`AutoOC: could not load file \u2014 ${String(e)}`, 8e3);
    }
    this.renderPreview();
    this.updateImportButton();
  }
  // Validate an imported JSON. Collects ALL issues before throwing so
  // the user gets a complete diagnostic in one Notice instead of
  // fixing one error at a time. The shape and rules mirror what
  // `importFromData` expects.
  validateExport(data) {
    const errors = [];
    const warnings = [];
    if (!data || typeof data !== "object") {
      return { ok: false, errors: ["The file is not a JSON object."], warnings: [] };
    }
    if (!data.autoOCExport || typeof data.autoOCExport !== "object") {
      return { ok: false, errors: ["Missing `autoOCExport` header at the root of the JSON."], warnings: [] };
    }
    const sv = data.autoOCExport.schemaVersion;
    const SUPPORTED = ["1.0", "1.4.0", "1.5.0", "1.6.0"];
    if (!sv) {
      errors.push("`autoOCExport.schemaVersion` is missing. Expected one of: " + SUPPORTED.join(", "));
    } else if (!SUPPORTED.includes(sv)) {
      errors.push('Unsupported `schemaVersion`: "' + sv + '". Expected one of: ' + SUPPORTED.join(", "));
    }
    if (!Array.isArray(data.tasks)) {
      errors.push("`tasks` must be an array (can be empty).");
    }
    if (!Array.isArray(data.workflows)) {
      errors.push("`workflows` must be an array (can be empty).");
    }
    const taskExportIds = /* @__PURE__ */ new Set();
    if (Array.isArray(data.tasks)) {
      const seenNames = /* @__PURE__ */ new Set();
      data.tasks.forEach((t, i) => {
        const where = "task[" + i + "]";
        if (!t || typeof t !== "object") {
          errors.push(where + " is not an object.");
          return;
        }
        if (typeof t.exportId !== "string" || !t.exportId.trim()) {
          errors.push(where + ".exportId is missing or empty.");
        } else {
          if (taskExportIds.has(t.exportId)) {
            errors.push(where + '.exportId "' + t.exportId + '" is duplicated.');
          }
          taskExportIds.add(t.exportId);
        }
        if (typeof t.name !== "string" || !t.name.trim()) {
          errors.push(where + ".name is missing or empty.");
        } else if (seenNames.has(t.name)) {
          warnings.push(where + '.name "' + t.name + '" is duplicated; imports will rename automatically.');
        } else {
          seenNames.add(t.name);
        }
        if (typeof t.prompt !== "string" || !t.prompt.trim()) {
          errors.push(where + ".prompt is missing or empty.");
        }
        const taskKind = t.taskKind || "opencode";
        if (!["opencode", "codex", "copilot", "code"].includes(taskKind)) {
          errors.push(where + ".taskKind is invalid. Expected opencode, codex, copilot, or code.");
        }
        const copilotError = getCopilotTaskValidationError(t);
        if (copilotError) errors.push(where + ": " + copilotError);
        if (t.reasoningEffort !== void 0 && (taskKind !== "codex" || typeof t.reasoningEffort !== "string" || !t.reasoningEffort.trim())) {
          errors.push(where + ".reasoningEffort is only valid for Codex tasks.");
        }
        if (t.interactiveTerminal !== void 0 && typeof t.interactiveTerminal !== "boolean") {
          errors.push(where + ".interactiveTerminal must be a boolean.");
        } else if (taskKind === "code" && t.interactiveTerminal === true) {
          errors.push(where + ": Code tasks cannot set interactiveTerminal.");
        }
        const validSchedules = ["manual", "once", "daily", "weekly", "monthly", "interval"];
        if (t.scheduleType && !validSchedules.includes(t.scheduleType)) {
          errors.push(where + '.scheduleType "' + t.scheduleType + '" is invalid. Expected: ' + validSchedules.join(", "));
        }
        if (t.scheduleType === "once" && (!t.scheduleDate || !/^\d{4}-\d{2}-\d{2}$/.test(t.scheduleDate))) {
          warnings.push(where + ": scheduleType is 'once' but scheduleDate is empty or not YYYY-MM-DD.");
        }
        if (t.scheduleType === "weekly" && (!Array.isArray(t.scheduleDays) || t.scheduleDays.length === 0)) {
          warnings.push(where + ": scheduleType is 'weekly' but scheduleDays is empty.");
        }
        if (Array.isArray(t.scheduleDays)) {
          t.scheduleDays.forEach((d) => {
            if (typeof d !== "number" || d < 0 || d > 6) {
              errors.push(where + ".scheduleDays contains an invalid value: " + JSON.stringify(d) + " (must be 0-6).");
            }
          });
        }
        if (Array.isArray(t.scheduleMonthDays)) {
          t.scheduleMonthDays.forEach((d) => {
            if (typeof d !== "number" || d < 1 || d > 31) {
              errors.push(where + ".scheduleMonthDays contains an invalid value: " + JSON.stringify(d) + " (must be 1-31).");
            }
          });
        }
      });
    }
    if (Array.isArray(data.workflows)) {
      data.workflows.forEach((w, wi) => {
        const wwhere = "workflow[" + wi + "]";
        if (!w || typeof w !== "object") {
          errors.push(wwhere + " is not an object.");
          return;
        }
        if (typeof w.name !== "string" || !w.name.trim()) {
          errors.push(wwhere + ".name is missing or empty.");
        }
        if (!Array.isArray(w.steps)) {
          errors.push(wwhere + ".steps must be an array.");
          return;
        }
        const steps = w.steps;
        const stepIds = /* @__PURE__ */ new Set();
        steps.forEach((s, i) => {
          const swhere = wwhere + ".steps[" + i + "]";
          if (!s || typeof s !== "object") {
            return;
          }
          if (typeof s.id !== "string" || !s.id.trim()) {
            errors.push(swhere + ".id is missing or empty.");
          } else {
            if (stepIds.has(s.id)) {
              errors.push(swhere + '.id "' + s.id + '" is duplicated within the workflow.');
            }
            stepIds.add(s.id);
          }
        });
        steps.forEach((s, i) => {
          const swhere = wwhere + ".steps[" + i + "]";
          if (!s || typeof s !== "object") {
            return;
          }
          const kind = s.stepKind || "task";
          if (!["task", "delay", "code"].includes(kind)) {
            errors.push(swhere + '.stepKind "' + kind + '" is invalid. Expected: task, delay, or code.');
          }
          if (kind === "task") {
            if (typeof s.taskExportId !== "string" || !s.taskExportId.trim()) {
              errors.push(swhere + " (task) is missing taskExportId.");
            } else if (!taskExportIds.has(s.taskExportId)) {
              errors.push(swhere + ' (task) references taskExportId "' + s.taskExportId + '" which is not defined in `tasks`.');
            }
          }
          if (kind === "delay") {
            if (typeof s.delayValue !== "number" || s.delayValue < 0) {
              errors.push(swhere + " (delay) is missing or has an invalid delayValue (must be a non-negative number).");
            }
            if (s.delayUnit && !["seconds", "minutes", "hours"].includes(s.delayUnit)) {
              errors.push(swhere + '.delayUnit "' + s.delayUnit + '" is invalid. Expected: seconds, minutes, hours.');
            }
          }
          if (kind === "code") {
            if (typeof s.code !== "string" || !s.code.trim()) {
              errors.push(swhere + " (code) is missing the `code` field.");
            }
            if (s.codeLang && s.codeLang !== "javascript") {
              warnings.push(swhere + '.codeLang is "' + s.codeLang + `"; only 'javascript' is currently supported.`);
            }
          }
          const transitions = Array.isArray(s.transitions) ? s.transitions : s.transitions && typeof s.transitions === "object" && typeof s.transitions.toStepId === "string" ? [s.transitions] : [];
          if (s.transitions !== void 0 && !Array.isArray(s.transitions) && transitions.length === 0) {
            errors.push(swhere + ".transitions must be an array or a single transition object.");
          }
          if (transitions.length > 0) {
            const validModes = ["default", "force", "eval", "conditional"];
            transitions.forEach((t, ti) => {
              const twhere = swhere + ".transitions[" + ti + "]";
              if (!t || typeof t !== "object") {
                errors.push(twhere + " is not an object.");
                return;
              }
              if (typeof t.toStepId !== "string" || !t.toStepId.trim()) {
                errors.push(twhere + ".toStepId is missing.");
              } else if (!stepIds.has(t.toStepId)) {
                errors.push(twhere + '.toStepId "' + t.toStepId + `" references a step that doesn't exist in this workflow.`);
              }
              if (t.mode && !validModes.includes(t.mode)) {
                errors.push(twhere + '.mode "' + t.mode + '" is invalid. Expected: ' + validModes.join(", "));
              }
              if (t.mode === "eval" && (typeof t.evaluatePrompt !== "string" || !t.evaluatePrompt.trim())) {
                errors.push(twhere + " (eval) is missing evaluatePrompt.");
              }
              if (t.mode === "conditional" && (typeof t.condition !== "string" || !t.condition.trim())) {
                errors.push(twhere + " (conditional) is missing the `condition` expression.");
              }
            });
          }
        });
        const incoming = /* @__PURE__ */ new Set();
        steps.forEach((s) => {
          (Array.isArray(s.transitions) ? s.transitions : s.transitions && typeof s.transitions === "object" && typeof s.transitions.toStepId === "string" ? [s.transitions] : []).forEach((t) => incoming.add(t.toStepId));
        });
        const entryCandidates = steps.filter((s) => s.id && !incoming.has(s.id));
        if (steps.length > 0 && entryCandidates.length === 0) {
          errors.push(wwhere + " has no entry step (every step is the target of a transition).");
        }
      });
    }
    return { ok: errors.length === 0, errors, warnings };
  }
  updateImportButton() {
    const btnImport = this._importBtn;
    if (btnImport) {
      btnImport.disabled = !this.previewData;
      btnImport.textContent = "Import";
    }
  }
  renderPreview() {
    var _a, _b, _c, _d;
    if (!this.previewEl) return;
    this.previewEl.empty();
    if (this.lastValidation && this.lastValidation.errors.length > 0 && !this.previewData) {
      const errBox = this.previewEl.createDiv("auto-oc-import-errors");
      errBox.style.background = "rgba(224, 108, 117, 0.12)";
      errBox.style.border = "1px solid var(--background-modifier-error, #e06c75)";
      errBox.style.padding = "10px 12px";
      errBox.style.borderRadius = "6px";
      errBox.style.color = "var(--text-error, #e06c75)";
      const title = errBox.createEl("div", { text: `\u274C ${this.lastValidation.errors.length} error(s) found \u2014 fix them before importing` });
      title.style.fontWeight = "600";
      title.style.marginBottom = "6px";
      const list = errBox.createEl("ul", { cls: "auto-oc-import-error-list" });
      list.style.margin = "0";
      list.style.paddingLeft = "20px";
      this.lastValidation.errors.forEach((msg) => {
        list.createEl("li", { text: msg });
      });
    }
    if (!this.previewData) {
      if (!this.lastValidation || this.lastValidation.errors.length === 0) {
        this.previewEl.createEl("p", {
          text: "No valid export loaded yet.",
          cls: "auto-oc-empty"
        });
      }
      return;
    }
    const box = this.previewEl.createDiv("auto-oc-import-preview-box");
    box.style.background = "var(--background-secondary)";
    box.style.padding = "12px";
    box.style.borderRadius = "6px";
    const meta = this.previewData.autoOCExport;
    if (meta.name) {
      box.createEl("div", { text: `Name: ${meta.name}`, cls: "setting-item-description" });
    }
    if (meta.description) {
      box.createEl("div", { text: meta.description, cls: "setting-item-description" });
    }
    box.createEl("div", {
      text: `Exported: ${formatDateTime(meta.exportedAt)} \xB7 Schema: ${meta.schemaVersion}`,
      cls: "setting-item-description"
    });
    const counts = box.createEl("ul", { cls: "auto-oc-import-counts" });
    counts.style.marginTop = "8px";
    counts.style.marginBottom = "0";
    counts.createEl("li", { text: `${(_b = (_a = this.previewData.tasks) == null ? void 0 : _a.length) != null ? _b : 0} task(s)` });
    counts.createEl("li", { text: `${(_d = (_c = this.previewData.workflows) == null ? void 0 : _c.length) != null ? _d : 0} workflow(s)` });
    if (this.lastValidation && this.lastValidation.warnings.length > 0) {
      const warnBox = box.createDiv("auto-oc-import-warnings");
      warnBox.style.marginTop = "10px";
      warnBox.style.padding = "8px 10px";
      warnBox.style.background = "rgba(216, 166, 87, 0.10)";
      warnBox.style.border = "1px solid rgba(216, 166, 87, 0.4)";
      warnBox.style.borderRadius = "6px";
      warnBox.style.color = "var(--text-warning, #d8a657)";
      warnBox.createEl("div", {
        text: `\u26A0 ${this.lastValidation.warnings.length} warning(s)`,
        attr: { style: "font-weight:600;margin-bottom:4px" }
      });
      const wlist = warnBox.createEl("ul", { cls: "auto-oc-import-warn-list" });
      wlist.style.margin = "0";
      wlist.style.paddingLeft = "20px";
      this.lastValidation.warnings.forEach((msg) => {
        wlist.createEl("li", { text: msg });
      });
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
      this.task = this.plugin.settings.tasks.find((task) => task.id === this.task.id) || this.task;
      if (!this.task.lastRun) {
        elapsedEl.textContent = "";
        return;
      }
      const secs = taskElapsedSeconds(this.task);
      if (secs === void 0) {
        elapsedEl.textContent = "\u23F1 Elapsed time: unavailable";
        return;
      }
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
      this.statusEl.textContent = `Status: ${latest.status}` + (latest.lastRun ? `  |  Started: ${formatDateTime(latest.lastRun)}` : "") + (isRunning ? "  \u23F3" : "");
      this.statusEl.className = "auto-oc-log-status auto-oc-badge-" + latest.status;
    }
    if (this.renderEl) {
      const newContent = latest.output || "(no output yet\u2026)";
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
    return new Promise((resolve5) => {
      this.resolveSelection = resolve5;
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
var TextPreviewModal = class extends import_obsidian.Modal {
  constructor(app, titleText, bodyText) {
    super(app);
    this.titleText = titleText;
    this.bodyText = bodyText;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h3", { text: this.titleText });
    const pre = contentEl.createEl("pre", { cls: "auto-oc-output-pre" });
    pre.textContent = this.bodyText || "(empty)";
    new import_obsidian.Setting(contentEl).addButton(
      (btn) => btn.setButtonText("Copy").onClick(() => {
        navigator.clipboard.writeText(this.bodyText || "");
        new import_obsidian.Notice("Output copied.");
      })
    );
  }
  onClose() {
    this.contentEl.empty();
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
      openOpencodeCli(bin, cwd, this.plugin.getSecretsEnv(), [], {
        onError: (error) => new import_obsidian.Notice(`AutoOC: could not open OpenCode CLI: ${String(error)}`),
        linuxTerminal: this.plugin.settings.linuxTerminal
      });
      new import_obsidian.Notice(`AutoOC: opened OpenCode CLI in ${cwd}`);
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
var CodexAppModal = class extends import_obsidian.Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.addClass("auto-oc-cli-modal");
    setupModalX(this);
    contentEl.createEl("h3", { text: "ChatGPT / Codex" });
    contentEl.createEl("p", {
      text: "Choose the project folder to open in the ChatGPT Codex workspace.",
      cls: "setting-item-description"
    });
    const vaultCwd = this.app.vault.adapter.basePath || ".";
    const defaultCwd = this.plugin.settings.workingDirectory || vaultCwd;
    const buttons = contentEl.createDiv("auto-oc-cli-modal-buttons");
    const openDefault = buttons.createEl("button", { text: "\u{1F4C2} Open project / vault", cls: "auto-oc-btn-primary" });
    openDefault.onclick = () => this.launch(defaultCwd);
    contentEl.createEl("p", { text: defaultCwd, cls: "setting-item-description auto-oc-cli-path" });
    const choose = buttons.createEl("button", { text: "\u{1F5C0} Choose folder\u2026", cls: "auto-oc-btn-secondary" });
    choose.onclick = async () => {
      const cwd = await this.chooseFolder();
      if (cwd) this.launch(cwd);
    };
    const cancel = buttons.createEl("button", { text: "Cancel", cls: "auto-oc-btn-secondary" });
    cancel.onclick = () => this.close();
  }
  async launch(cwd) {
    try {
      if (!fs18.existsSync(cwd) || !fs18.statSync(cwd).isDirectory()) throw new Error(`Folder does not exist: ${cwd}`);
      openCodexNewThread(cwd, (error) => void this.fallbackOpen(error, cwd));
      new import_obsidian.Notice(`AutoOC: opening a new ChatGPT / Codex conversation in ${cwd}`);
      this.close();
    } catch (error) {
      void this.fallbackOpen(error, cwd);
    }
  }
  async fallbackOpen(error, cwd) {
    try {
      await copyTextToClipboard(cwd);
    } catch (e) {
    }
    if (isWindows()) {
      try {
        const script = "$app = Get-StartApps | Where-Object { $_.Name -match 'ChatGPT|Codex' } | Select-Object -First 1; if ($app) { Start-Process ('shell:AppsFolder\\' + $app.AppID) } else { exit 1 }";
        const launcher = (0, import_child_process5.spawn)("powershell.exe", ["-NoLogo", "-NonInteractive", "-Command", script], { detached: true, stdio: "ignore", windowsHide: true });
        launcher.unref();
      } catch (e) {
      }
    }
    new import_obsidian.Notice(`AutoOC: could not open the selected folder directly (${String(error)}). ChatGPT was opened when possible and the path was copied: ${cwd}`, 1e4);
    this.close();
  }
  async chooseFolder() {
    try {
      const electron = window.require("electron");
      const result = await electron.remote.dialog.showOpenDialog({
        properties: ["openDirectory"],
        title: "Select folder for ChatGPT / Codex"
      });
      return !result.canceled && result.filePaths.length > 0 ? result.filePaths[0] : null;
    } catch (error) {
      new import_obsidian.Notice(`AutoOC: folder picker failed \u2014 ${String(error)}`);
      return null;
    }
  }
  onClose() {
    this.contentEl.empty();
  }
};
var DiagnosticModal = class extends import_obsidian.Modal {
  constructor(app, plugin) {
    super(app);
    this.logEl = null;
    this.pollHandle = null;
    this.hiddenProc = null;
    this.tempFiles = [];
    this.plugin = plugin;
  }
  cleanupDiagnostics(killProcess = false) {
    var _a, _b;
    if (this.pollHandle) {
      clearInterval(this.pollHandle);
      this.pollHandle = null;
    }
    if (killProcess) {
      (_a = this.hiddenProc) == null ? void 0 : _a.kill();
    } else {
      (_b = this.hiddenProc) == null ? void 0 : _b.cleanup(true);
    }
    this.hiddenProc = null;
    const fs19 = require("fs");
    for (const file of this.tempFiles) {
      try {
        fs19.unlinkSync(file);
      } catch (e) {
      }
    }
    this.tempFiles = [];
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
        this.cleanupDiagnostics(true);
        if (this.logEl) this.logEl.textContent = "[launching detached process\u2026]\n";
        const bin2 = resolveOpencodeBin(this.plugin.settings.opencodePath);
        const model = this.plugin.getEffectiveDefaultModel();
        if (!model) {
          new import_obsidian.Notice("AutoOC: no model selected. Reload models in Settings.");
          return;
        }
        const fs19 = require("fs");
        const path17 = require("path");
        const osTmp = require("os").tmpdir();
        const outFile = path17.join(osTmp, "autooc-diag.txt");
        const pidFile = path17.join(osTmp, "autooc-diag.pid");
        try {
          fs19.unlinkSync(outFile);
        } catch (e) {
        }
        try {
          fs19.unlinkSync(pidFile);
        } catch (e) {
        }
        let launchScript;
        if (isWindows()) {
          launchScript = [
            ...psUtf8Prelude(),
            `$env:USERPROFILE = ${psSingleQuoted(process.env.USERPROFILE || "")}`,
            `$env:APPDATA     = ${psSingleQuoted(process.env.APPDATA || "")}`,
            `$env:LOCALAPPDATA= ${psSingleQuoted(process.env.LOCALAPPDATA || "")}`,
            `$env:PATH        = ${psSingleQuoted(process.env.PATH || "")}`,
            `$env:HOME        = ${psSingleQuoted(process.env.USERPROFILE || "")}`,
            `$outTmp = [System.IO.Path]::GetTempFileName()`,
            `$errTmp = [System.IO.Path]::GetTempFileName()`,
            `$bin = ${psSingleQuoted(bin2)}`,
            `$argList = @('run','-m',${psSingleQuoted(model)},'--dangerously-skip-permissions','--','di hola')`,
            `& $bin @argList > $outTmp 2> $errTmp`,
            `$exitCode = if ($null -ne $LASTEXITCODE) { $LASTEXITCODE } else { 0 }`,
            `$out = (Get-Content $outTmp -Raw -Encoding UTF8 -ErrorAction SilentlyContinue).Trim()`,
            `$err = (Get-Content $errTmp -Raw -Encoding UTF8 -ErrorAction SilentlyContinue).Trim()`,
            `Remove-Item $outTmp,$errTmp -ErrorAction SilentlyContinue`,
            `$combined = ($out + $(if($err){"
" + $err}else{""})).Trim()`,
            `[System.IO.File]::WriteAllText('${outFile.replace(/'/g, "''")}', $combined + "
DONE:" + $exitCode)`
          ].join("\n");
        } else {
          const shEnv = {
            HOME: process.env.HOME || process.env.USERPROFILE || "",
            PATH: process.env.PATH || ""
          };
          launchScript = [
            `echo $$ > ${shSingleQuoted(pidFile)}`,
            ...buildShEnvLines(shEnv),
            `bin=${shSingleQuoted(bin2)}`,
            `out_tmp="$(mktemp)"`,
            `err_tmp="$(mktemp)"`,
            `"$bin" run -m ${shSingleQuoted(model)} --dangerously-skip-permissions -- 'di hola' > "$out_tmp" 2> "$err_tmp"`,
            `exit_code=$?`,
            `stdout="$(cat "$out_tmp" 2>/dev/null)"`,
            `stderr="$(cat "$err_tmp" 2>/dev/null)"`,
            `rm -f "$out_tmp" "$err_tmp"`,
            `if [ -n "$stderr" ]; then combined="$(printf '%s
%s' "$stdout" "$stderr")"; else combined="$stdout"; fi`,
            `printf '%s
DONE:%s' "$combined" "$exit_code" > ${shSingleQuoted(outFile)}`
          ].join("\n");
        }
        const scriptFile = path17.join(osTmp, `autooc-diag${scriptExt()}`);
        if (isWindows()) writeUtf8BomFile(scriptFile, launchScript);
        else fs19.writeFileSync(scriptFile, launchScript, "utf8");
        this.tempFiles = [outFile, pidFile, scriptFile];
        if (this.logEl) this.logEl.textContent += `Script: ${scriptFile}

`;
        this.hiddenProc = launchHidden(scriptFile, pidFile);
        const startedAt = Date.now();
        this.pollHandle = setInterval(() => {
          if (Date.now() - startedAt > 18e4) {
            this.cleanupDiagnostics(true);
            if (this.logEl) this.logEl.textContent += "\n\n[timeout]";
            return;
          }
          if (!fs19.existsSync(outFile)) {
            if (this.logEl) this.logEl.textContent += ".";
            return;
          }
          if (this.pollHandle) clearInterval(this.pollHandle);
          this.pollHandle = null;
          const raw = fs19.readFileSync(outFile, "utf8");
          this.cleanupDiagnostics(false);
          const doneMatch = raw.match(/\nDONE:(-?\d+)\s*$/);
          const output = doneMatch ? raw.slice(0, doneMatch.index).trim() : raw.trim();
          const normalized = normalizeCommandOutput(output);
          const exitCode = doneMatch ? parseInt(doneMatch[1], 10) : -1;
          if (this.logEl) {
            this.logEl.textContent = normalized || "(no output)";
            this.logEl.textContent += exitCode === 0 ? "\n\n[\u2705 completed]" : `

[\u274C code ${exitCode}]`;
          }
        }, 2e3);
      })
    );
    this.logEl = contentEl.createEl("pre", { cls: "auto-oc-output-pre auto-oc-log-pre" });
    this.logEl.textContent = "(output will appear here\u2026)";
  }
  onClose() {
    this.cleanupDiagnostics(true);
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
    new import_obsidian.Setting(containerEl).setName("Dashboard task bubble size").setDesc("Fixed task bubble diameter in pixels.").addDropdown((dropdown) => dropdown.addOptions({ sm: "Small (24px)", md: "Medium (30px)", lg: "Large (38px)", xl: "Extra large (48px)" }).setValue(this.plugin.settings.dashboardTaskBubbleSize).onChange(async (value) => {
      if (value === "sm" || value === "md" || value === "lg" || value === "xl") {
        this.plugin.settings.dashboardTaskBubbleSize = value;
        await this.plugin.saveSettings();
      }
    }));
    new import_obsidian.Setting(containerEl).setName("Default AI engine").setDesc("Engine selected for new AI tasks.").addDropdown((dropdown) => dropdown.addOption("opencode", "OpenCode").addOption("codex", "Codex / ChatGPT").addOption("copilot", "GitHub Copilot CLI").setValue(this.plugin.settings.defaultAiEngine).onChange(async (value) => {
      if (value === "opencode" || value === "codex" || value === "copilot") {
        this.plugin.settings.defaultAiEngine = value;
        await this.plugin.saveSettings();
      }
    }));
    addCopilotGlobalSettings(containerEl, this.plugin);
    containerEl.createEl("h3", { text: "Codex / ChatGPT" });
    new import_obsidian.Setting(containerEl).setName("Codex executable path").setDesc(`Absolute path or "codex" for auto-detection. Detected: ${resolveCodexBin(this.plugin.settings.codexPath)}`).addText((text) => text.setPlaceholder("codex").setValue(this.plugin.settings.codexPath).onChange(async (value) => {
      this.plugin.settings.codexPath = value.trim() || "codex";
      await this.plugin.saveSettings();
    })).addButton((button) => button.setButtonText("\u{1F50D} Detect & test").onClick(async () => {
      this.plugin.settings.codexPath = resolveCodexBin("codex");
      await this.plugin.saveSettings(false);
      await this.plugin.refreshCodexModels(true);
      this.display();
    }));
    new import_obsidian.Setting(containerEl).setName("Default Codex model").setDesc(`${this.plugin.availableCodexModels.length} models loaded from ChatGPT/Codex.`).addDropdown((dropdown) => {
      dropdown.addOption("", "Automatic");
      this.plugin.availableCodexModels.forEach((model) => dropdown.addOption(model.value, model.label));
      const current = this.plugin.settings.defaultCodexModel || "";
      if (current && !this.plugin.availableCodexModels.some((model) => model.value === current)) dropdown.addOption(current, current);
      dropdown.setValue(current).onChange(async (value) => {
        this.plugin.settings.defaultCodexModel = value;
        const efforts = this.plugin.getCodexReasoningEfforts(value);
        if (!efforts.includes(this.plugin.settings.defaultCodexReasoningEffort)) {
          this.plugin.settings.defaultCodexReasoningEffort = efforts[0];
        }
        await this.plugin.saveSettings();
        this.display();
      });
    }).addButton((button) => button.setButtonText("\u{1F504} Reload").onClick(async () => {
      await this.plugin.refreshCodexModels(true);
      this.display();
    }));
    new import_obsidian.Setting(containerEl).setName("Default Codex reasoning").addDropdown((dropdown) => {
      const efforts = this.plugin.getCodexReasoningEfforts();
      efforts.forEach((effort) => dropdown.addOption(effort, effort));
      const current = this.plugin.settings.defaultCodexReasoningEffort || efforts[0];
      if (current && !efforts.includes(current)) dropdown.addOption(current, current);
      dropdown.setValue(current || "").onChange(async (value) => {
        this.plugin.settings.defaultCodexReasoningEffort = value;
        await this.plugin.saveSettings();
      });
    });
    containerEl.createEl("h3", { text: "OpenCode" });
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
        const { existsSync: existsSync12 } = require("fs");
        const candidates = [
          `${process.env.APPDATA}\\npm\\opencode.cmd`,
          `${process.env.APPDATA}\\npm\\opencode`,
          `${process.env.LOCALAPPDATA}\\npm\\opencode.cmd`,
          `${process.env.ProgramFiles}\\nodejs\\opencode.cmd`
        ].filter(Boolean);
        const found = candidates.find((c) => existsSync12(c));
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
      "Directory from which to launch OpenCode, Codex or GitHub Copilot CLI (empty = vault's current directory)"
    ).addText(
      (text) => text.setPlaceholder("C:\\path\\to\\your\\project").setValue(this.plugin.settings.workingDirectory).onChange(async (v) => {
        this.plugin.settings.workingDirectory = v;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Default CLI task mode").setDesc("New OpenCode tasks open an interactive terminal by default.").addToggle(
      (tog) => tog.setValue(!!this.plugin.settings.defaultInteractiveTerminal).onChange(async (v) => {
        this.plugin.settings.defaultInteractiveTerminal = v;
        await this.plugin.saveSettings();
      })
    );
    if (process.platform === "linux") {
      new import_obsidian.Setting(containerEl).setName("Linux terminal emulator").setDesc(
        "Command used to open the interactive OpenCode CLI. Empty = auto-detect (x-terminal-emulator, gnome-terminal, konsole, xfce4-terminal, lxterminal, alacritty, xterm)."
      ).addText(
        (text) => text.setPlaceholder("auto-detect (e.g. konsole)").setValue(this.plugin.settings.linuxTerminal || "").onChange(async (v) => {
          this.plugin.settings.linuxTerminal = v.trim();
          await this.plugin.saveSettings();
        })
      );
    }
    new import_obsidian.Setting(containerEl).setName("Shared Library URL").setDesc(
      `GitHub repo or raw URL used by the Import \u2192 Browse Library feature. GitHub URLs like https://github.com/user/repo are converted automatically.
Resolved: ${normalizeLibraryUrl(this.plugin.settings.libraryUrl)}`
    ).addText(
      (text) => text.setPlaceholder(DEFAULT_SETTINGS.libraryUrl).setValue(this.plugin.settings.libraryUrl).onChange(async (v) => {
        this.plugin.settings.libraryUrl = v.trim();
        await this.plugin.saveSettings();
        this.display();
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
    new import_obsidian.Setting(containerEl).setName("Default OpenCode Model").addDropdown((dd) => {
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
