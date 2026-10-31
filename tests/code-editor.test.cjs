const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module'), ts = require('typescript');
const file = path.resolve(__dirname, '../code-editor.ts'), loaded = new Module(file, module);
loaded.filename = file; loaded.paths = Module._nodeModulePaths(path.dirname(file));
loaded._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText, file);
const {renderCodePreview} = loaded.exports;
class Element {
  constructor(tag='div', options={}) {this.tag=tag;this.text=options.text||'';this.cls=options.cls||'';this.children=[];}
  createEl(tag, options) {const node=new Element(tag,options);this.children.push(node);return node;}
  createSpan(options) {return this.createEl('span',options);}
  setText(text) {this.text=text;this.children=[];}
  get content() {return this.text+this.children.map(node=>node.content).join('');}
  get all() {return [this,...this.children.flatMap(node=>node.all)];}
}
test('JavaScript preview preserves literal source, highlights real syntax and never interprets markup', () => {
  const source='// a comment\nconst pattern = /https?:\\/\\/[^ ]+/g;\nconst message = `Hello ${name}`;\noutput = "</code><img src=x onerror=alert(1)>";';
  const root=new Element();renderCodePreview(root,source,12000);
  assert.equal(root.content,source);
  assert.ok(root.all.some(node=>node.cls.includes('tok-keyword')&&node.content==='const'));
  assert.ok(root.all.some(node=>node.cls.includes('tok-comment')&&node.content==='// a comment'));
  assert.ok(root.all.some(node=>node.cls.includes('tok-string')&&node.content.includes('<img')));
  assert.ok(root.all.every(node=>['div','pre','code','span'].includes(node.tag)));
});
test('Long previews remain bounded without changing the underlying code', () => {
  const source='const value = 42;\n'.repeat(10000), root=new Element();
  renderCodePreview(root,source,12000);
  assert.equal(root.content,source.slice(0,12000)+'\n…');
  assert.equal(source.length,180000);
});
