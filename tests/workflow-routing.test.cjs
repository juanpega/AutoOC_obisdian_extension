const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const file = path.resolve(__dirname, '../workflow-routing.ts');
const mod = new Module(file, module);
mod.filename = file; mod.paths = Module._nodeModulePaths(path.dirname(file));
mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText, file);
const {findWorkflowEntry: entry, evaluateWorkflowCondition: condition, resolveWorkflowTransition: route, workflowStepTransitions: transitionsFor} = mod.exports;
const steps = [{id:'a'}, {id:'b'}, {id:'c'}];
const host = {evaluate:async()=>{throw Error('unexpected model call');},onError:()=>{}};

test('legacy task force/eval transitions survive while Code fallback remains success-only',async()=>{
  const taskSteps=[{id:'a',stepKind:'task',transitionMode:'force'},{id:'b',stepKind:'task'}];
  assert.equal((await route(taskSteps,0,'failure',false,transitionsFor(taskSteps,0),{},host)).nextStepId,'b');
  taskSteps[0].transitionMode='eval';taskSteps[0].evaluatePrompt='verify';
  let prompt;assert.equal((await route(taskSteps,0,'result',true,transitionsFor(taskSteps,0),{}, {...host,evaluate:async t=>{prompt=t.evaluatePrompt;return 'YES';}})).nextStepId,'b');assert.equal(prompt,'verify');
  taskSteps[0].stepKind='code';taskSteps[0].transitionMode='force';
  assert.equal((await route(taskSteps,0,'failure',false,transitionsFor(taskSteps,0),{},host)).nextStepId,null);
});

test('entry uses graph roots and visual order without mutating definitions', () => {
  const graph = [{id:'b',position:{x:20,y:0}}, {id:'a',position:{x:0,y:0},transitions:[{toStepId:'c',mode:'default'}]}, {id:'c'}];
  const before = JSON.stringify(graph);
  assert.equal(entry(graph).id,'a'); assert.equal(JSON.stringify(graph),before);
  assert.equal(entry([]),null);
  assert.equal(entry([{id:'a',transitions:[{toStepId:'b'}]},{id:'b',transitions:[{toStepId:'a'}]}]).id,'a');
});
test('default failure gate stops, explicit force advances', async () => {
  assert.deepEqual(await route(steps,0,'error',false,[{toStepId:'b',mode:'default'}],{},host),{nextStepId:null,reason:'no-match'});
  assert.equal((await route(steps,0,'error',false,[{toStepId:'b',mode:'force'}],{},host)).nextStepId,'b');
});
test('conditional handoff reads complete input and previous outputs', async () => {
  const large = 'z'.repeat(20000);
  assert.equal((await route(steps,0,large,true,[{toStepId:'c',mode:'conditional',condition:'input.length === 20000 && outputs.a === input'}],{a:large},host)).nextStepId,'c');
  assert.equal(condition('return input === "ok";', 'ok', {}),true);
});
test('invalid condition is reported and later transitions remain available', async () => {
  const errors=[];
  const result=await route(steps,0,'',true,[{toStepId:'b',mode:'conditional',condition:'bad('},{toStepId:'c',mode:'default'}],{}, {...host,onError:(kind)=>errors.push(kind)});
  assert.equal(result.nextStepId,'c');assert.deepEqual(errors,['condition']);
});
test('model ambiguity and failure cannot approve a transition', async () => {
  const transitions=[{toStepId:'b',mode:'eval'}];
  for(const answer of ['NO','YES and NO','unknown']) assert.equal((await route(steps,0,'',true,transitions,{}, {...host,evaluate:async()=>answer})).nextStepId,null);
  assert.equal((await route(steps,0,'',true,transitions,{}, {...host,evaluate:async()=> 'YES'})).nextStepId,'b');
  const errors=[];assert.equal((await route(steps,0,'',true,transitions,{}, {...host,onError:kind=>errors.push(kind)})).nextStepId,null);assert.deepEqual(errors,['eval']);
});
test('unknown targets are skipped and ordering remains deterministic', async () => {
  assert.equal((await route(steps,0,'',true,[{toStepId:'missing',mode:'force'},{toStepId:'c',mode:'default'},{toStepId:'b',mode:'default'}],{},host)).nextStepId,'c');
  assert.deepEqual(await route(steps,2,'',true,[],{},host),{nextStepId:null,reason:'end'});
});

test('built plugin delegates routing and retains the workflow step dispatcher', async () => {
  const originalLoad=Module._load;
  let Plugin;
  try {
    Module._load=function(name,...args) {
      if(name==='obsidian') return {Plugin:class{},Notice:class{},Modal:class{},Setting:class{},ItemView:class{},PluginSettingTab:class{},WorkspaceLeaf:class{}};
      return originalLoad.call(this,name,...args);
    };
    Plugin=require('../main.js').default;
  } finally {Module._load=originalLoad;}
  const plugin=new Plugin();
  assert.equal(typeof plugin.runWorkflowStepById,'function');
  const workflow={id:'fixture',steps};
  assert.equal(plugin.findEntryStep(workflow).id,'a');
  const result=await plugin.resolveNextStep(workflow,steps[0],0,'ok',true,[{toStepId:'c',mode:'conditional',condition:'input === "ok"'}]);
  assert.deepEqual(result,{nextStepId:'c',reason:'conditional:true'});
});
