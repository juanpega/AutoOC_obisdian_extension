/** JavaScript presentation only. Reading or editing code never executes it. */
export function renderCodePreview(parent: HTMLElement, code: string, maxChars = 600): void {
  const pre = parent.createEl("pre", {cls:"auto-oc-code-preview auto-oc-code-surface"});
  const element = pre.createEl("code", {cls:"language-javascript"});
  const source = (code || "// Empty code").slice(0, maxChars);
  try {
    const {parser} = require("@lezer/javascript") as typeof import("@lezer/javascript");
    const {highlightTree, classHighlighter} = require("@lezer/highlight") as typeof import("@lezer/highlight");
    let position = 0;
    highlightTree(parser.parse(source), classHighlighter, (from, to, classes) => {
      if (from > position) element.createSpan({text:source.slice(position, from)});
      element.createSpan({text:source.slice(from, to), cls:classes});
      position = to;
    });
    element.createSpan({text:source.slice(position)});
  } catch { element.setText(source); }
  if (code.length > maxChars) element.createSpan({text:"\n…"});
}

/** Enhance the existing field so its draft and Save/Cancel contract stay intact.
 * Mount only visible fields: a workflow can contain hundreds of Code steps. */
export function setupCodeTextarea(textarea: HTMLTextAreaElement, app: import("obsidian").App): void {
  textarea.addClass("auto-oc-code-editor");
  textarea.spellcheck = false;
  const document = textarea.ownerDocument, window = document?.defaultView;
  if (!window || !textarea.parentElement) return;
  const parent = textarea.parentElement;
  const root = textarea.closest(".modal-content") || parent;
  let view: import("@codemirror/view").EditorView | undefined;
  let host: HTMLDivElement | undefined;
  let visibility: IntersectionObserver | undefined;
  let releaseKeyboard = () => {};
  const lifecycle = new window.MutationObserver(() => {
    if (!root.contains(textarea)) dispose();
  });
  const dispose = () => { visibility?.disconnect(); lifecycle.disconnect(); releaseKeyboard(); view?.destroy(); };
  lifecycle.observe(root, {childList:true, subtree:true});
  const mount = () => {
    visibility?.disconnect();
    if (!textarea.isConnected) { dispose(); return; }
    try {
      const {EditorState, Compartment} = require("@codemirror/state") as typeof import("@codemirror/state");
      const {EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection} = require("@codemirror/view") as typeof import("@codemirror/view");
      const {history, historyKeymap, defaultKeymap, indentWithTab} = require("@codemirror/commands") as typeof import("@codemirror/commands");
      const {javascript} = require("@codemirror/lang-javascript") as typeof import("@codemirror/lang-javascript");
      const {syntaxHighlighting, bracketMatching, indentOnInput, indentUnit, indentRange, foldGutter, foldKeymap} = require("@codemirror/language") as typeof import("@codemirror/language");
      const {classHighlighter} = require("@lezer/highlight") as typeof import("@lezer/highlight");
      const {searchKeymap, highlightSelectionMatches} = require("@codemirror/search") as typeof import("@codemirror/search");
      const {closeBrackets, closeBracketsKeymap} = require("@codemirror/autocomplete") as typeof import("@codemirror/autocomplete");
      host = document.createElement("div");
      host.className = "auto-oc-code-workbench auto-oc-code-surface";
      // Obsidian handles modal Escape before DOM handlers. While this editor or
      // its search panel has focus, let CodeMirror handle its own keyboard input.
      const {Scope} = require("obsidian") as typeof import("obsidian");
      const scope = new Scope();
      let keyboardActive = false;
      releaseKeyboard = () => { if (keyboardActive) { keyboardActive = false; app.keymap.popScope(scope); } };
      host.addEventListener("focusin", () => { if (!keyboardActive) { app.keymap.pushScope(scope); keyboardActive = true; } });
      host.addEventListener("focusout", () => window.queueMicrotask(() => {
        if (!host?.contains(document.activeElement)) releaseKeyboard();
      }));
      parent.insertBefore(host, textarea);
      const toolbar = host.createDiv("auto-oc-code-toolbar");
      toolbar.createSpan({text:"JavaScript"});
      const indent = toolbar.createEl("button", {text:"Indent code", attr:{type:"button"}});
      const wrap = toolbar.createEl("button", {text:"Wrap lines", attr:{type:"button", "aria-pressed":"false"}});
      const editor = host.createDiv("auto-oc-code-mount");
      const wrapping = new Compartment();
      view = new EditorView({parent:editor, state:EditorState.create({doc:textarea.value, extensions:[
        javascript(), lineNumbers(), foldGutter(), history(), drawSelection(),
        highlightActiveLine(), highlightActiveLineGutter(), bracketMatching(), indentOnInput(), closeBrackets(),
        highlightSelectionMatches(), syntaxHighlighting(classHighlighter), indentUnit.of("  "), wrapping.of([]),
        EditorState.lineSeparator.of(textarea.value.includes("\r\n") ? "\r\n" : "\n"),
        EditorView.contentAttributes.of({"aria-label":"JavaScript code", spellcheck:"false"}),
        keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap, ...searchKeymap, ...foldKeymap, indentWithTab]),
        EditorView.updateListener.of(update => {
          if (!update.docChanged) return;
          textarea.value = update.state.sliceDoc();
          textarea.dispatchEvent(new window.Event("input", {bubbles:true}));
        }),
      ]})});
      indent.onclick = () => {
        view!.dispatch({changes:indentRange(view!.state, 0, view!.state.doc.length), userEvent:"input.indent"});
        view!.focus();
      };
      let wrapped = false;
      wrap.onclick = () => {
        wrapped = !wrapped;
        view!.dispatch({effects:wrapping.reconfigure(wrapped ? EditorView.lineWrapping : [])});
        wrap.setAttribute("aria-pressed", String(wrapped));
      };
      host.createDiv({text:"Tab / Shift+Tab: indent · Ctrl/Cmd+F: find · Ctrl/Cmd+Z: undo · Escape, then Tab: leave editor", cls:"auto-oc-code-help"});
      textarea.hidden = true;
    } catch {
      dispose(); host?.remove(); textarea.hidden = false;
      parent.createDiv({text:"Syntax editor unavailable. You can still edit and save the code below.", cls:"auto-oc-code-help"});
    }
  };
  if (window.IntersectionObserver) {
    visibility = new window.IntersectionObserver(entries => {if (entries.some(entry => entry.isIntersecting)) mount();}, {rootMargin:"100px"});
    visibility.observe(textarea);
  } else mount();
}
