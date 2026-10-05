const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'library/sdlc-codex-background-app.json'), 'utf8'));
const reqPath = 'Docs/autoOC/02_Requisitos.md';
const sprintPath = 'Docs/autoOC/03_SPRINTs.md';
const statePath = 'Docs/autoOC/04_Trabajo_actual.json';
const id = 'REQ-20260909-001';
const head = 'a'.repeat(40);
const commit = 'b'.repeat(40);
const block = '- [ ] '+id+' Requisito\n  - Estado: Pendiente\n  - Criterios de aceptación:\n    1. Resultado observable\n  - Notas técnicas: conservar';
const other = '- [ ] REQ-20260909-002 Otro requisito\n  - Detalle: intacto';
const prioritizedBlock = '- [x] '+id+' Requisito\n  - Estado: Priorizado en sprint\n  - Criterios de aceptación:\n    1. Resultado observable\n  - Notas técnicas: conservar\n  - Sprint asignado: Sprint 1\n  - Fecha de priorización: 2026-09-11T10:00:00.000Z';
const prioritizedOther = '- [x] REQ-20260909-002 Otro requisito\n  - Detalle: intacto\n  - Estado: Priorizado en sprint\n  - Sprint asignado: Sprint 1\n  - Fecha de priorización: 2026-09-11T10:00:00.000Z';

function fixture() {
  const memory = new Map([[reqPath, '# Requisitos\n\n'+prioritizedBlock+'\n\n'+prioritizedOther+'\n'], [sprintPath, '# Sprints\n\n## Sprint 1\n\n'+block+'\n\n'+other+'\n']]);
  let failOnce = null;
  const calls = [];
  const terminal = {run(command) {
    calls.push(command);
    if(command === 'git rev-parse --show-toplevel') return 'C:/repo\n';
    if(command === 'git branch --show-current') return 'dev\n';
    if(command === 'git rev-parse HEAD') return commit+'\n';
    if(command === 'git diff --name-only -z HEAD --' || command === 'git ls-files --others --exclude-standard -z') return '';
    if(command.startsWith('git merge-base --is-ancestor ')) return '';
    if(command.startsWith('git cat-file -t ')) return 'commit';
    throw new Error('Unexpected command: '+command);
  }};
  const vault = {
    exists:p=>memory.has(p), resolve:p=>'C:/vault/'+p,
    read:p=>{if(!memory.has(p)) throw new Error('Missing '+p); return memory.get(p);},
    write(p,v){if(p===failOnce){failOnce=null;throw new Error('Injected write failure');}memory.set(p,String(v));}
  };
  function run(wid,sid,input='',outputs={}) {
    const step=data.workflows.find(w=>w.exportId===wid).steps.find(s=>s.id===sid);
    const ctx={input,outputs,vault,terminal,console:{log(){}}};
    vm.runInNewContext(step.code,ctx,{timeout:3000});
    return JSON.parse(ctx.output);
  }
  function plan() {
    const selection=run('wf-plan-sprint','select');
    run('wf-plan-sprint','save-plan',JSON.stringify({status:'ok',runId:selection.runId,requirementId:id,repositoryRoot:'C:/repo',branch:'dev',head,planMarkdown:'Pasos y pruebas'}),{select:JSON.stringify(selection)});
    return JSON.parse(memory.get(statePath));
  }
  function implement() {
    const s=plan(),manifest=run('wf-build-sprint','manifest');
    run('wf-build-sprint','save-implementation',JSON.stringify({status:'ok',runId:s.runId,requirementId:id,repositoryRoot:'C:/repo',branch:'dev',head,summary:'Hecho',changedFiles:['src/main.ts'],checks:[{command:'npm test',result:'passed',evidence:'1 test'}],manualValidation:[]}),{manifest:JSON.stringify(manifest)});
    return JSON.parse(memory.get(statePath));
  }
  function closeInput(s) {
    return {status:'ok',runId:s.runId,requirementId:id,repositoryRoot:'C:/repo',branch:'dev',head:commit,commits:[commit],acceptance:[{criterion:'Resultado observable',verified:true,evidence:'Comprobado en test'}],checks:[{command:'npm test',result:'passed',evidence:'1 test'}],manualValidation:[],pr:null,closureMarkdown:'Implementación verificada'};
  }
  function close(d) {
    const manifest=run('wf-close','manifest');
    return run('wf-close','close',JSON.stringify(d),{manifest:JSON.stringify(manifest)});
  }
  return {memory,run,plan,implement,close,closeInput,calls,terminal,fail:p=>{failOnce=p;}};
}

test('real import validator, area, references and code syntax',()=>{
  const source=ts.createSourceFile('main.ts',fs.readFileSync(path.join(root,'main.ts'),'utf8'),ts.ScriptTarget.Latest,true);
  const validationHelper=source.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='getCopilotTaskValidationError');
  const cls=source.statements.find(n=>ts.isClassDeclaration(n)&&n.name?.text==='ImportModal');
  const method=cls.members.find(n=>n.name?.getText(source)==='validateExport');
  const js=ts.transpileModule(validationHelper.getText(source)+'\nclass Validator {'+method.getText(source)+'}; new Validator().validateExport(data)',{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText;
  const result=vm.runInNewContext(js,{data});
  assert.equal(result.ok,true,JSON.stringify(result));
  assert.equal(result.warnings.length,0);
  assert.equal(data.tasks.length,10);
  assert.equal(data.workflows.length,12);
  for(const entry of [...data.tasks,...data.workflows,...data.workflows.flatMap(w=>w.steps)]) assert.equal(entry.area,'Codex dev');
  for(const w of data.workflows)for(const s of w.steps) {
    if(s.code)new vm.Script(s.code);
    for(const t of s.transitions) {assert.notEqual(t.mode,'eval');if(t.condition)new vm.Script(t.condition);}
  }
});
test('enrichment writes valid requirements and marks only captured source entries done',()=>{
  const f=fixture();
  const quick='Docs/autoOC/01_Quick notes - TODOs.md';
  const bugs='Docs/autoOC/06_Bugs_&_HV_feature.md';
  const debt='Docs/autoOC/08_Technical_debt.md';
  const source='- [ ] Nota informal válida\n  Detalle asociado\n- [ ]\n';
  f.memory.set(quick,source);
  f.memory.set(bugs,'# Bugs\n\n- [x] Ya resuelto\n');
  f.memory.set(debt,'# Debt\n\n- [ ]\n');
  f.memory.set(reqPath,'# Requisitos\n\n- [ ]\n');
  const manifest=f.run('wf-enrich','inputs');
  assert.equal(manifest.ignoredPlaceholders.length,3);
  const requirement={
    sourcePath:quick,
    sourceKey:quick+'::- [ ] Nota informal válida',
    sourceText:'- [ ] Nota informal válida\n  Detalle asociado',
    titulo:'Convertir la nota en comportamiento verificable',
    tipo:'todo',
    contextoCodigo:'src/main.ts contiene el flujo relacionado.',
    requisitoEnriquecido:'El sistema debe aplicar el comportamiento descrito.',
    criteriosAceptacion:['El resultado es observable por el usuario.'],
    notasTecnicas:'Añadir una prueba de regresión.'
  };
  const result=f.run('wf-enrich','write',JSON.stringify({status:'ok',requirements:[requirement],warnings:manifest.ignoredPlaceholders}),{inputs:JSON.stringify(manifest)});
  assert.equal(result.written,1);
  assert.equal(result.markedDone,1);
  assert.match(f.memory.get(quick),/^- \[x\] Nota informal válida/m);
  assert.match(f.memory.get(quick),/^- \[ \]$/m);
  assert.match(f.memory.get(debt),/^- \[ \]$/m);
  assert.match(f.memory.get(reqPath),/^- \[ \]$/m);
  assert(f.memory.get(reqPath).includes('Contexto del código: src/main.ts'));
  assert.equal(result.warnings.length,3);
});
test('enrichment does not mark a duplicate or restore only half a write',()=>{
  const f=fixture();
  const quick='Docs/autoOC/01_Quick notes - TODOs.md';
  const source='- [ ] Nota válida';
  f.memory.set(quick,source);
  const requirement={sourcePath:quick,sourceKey:quick+'::'+source,sourceText:source,titulo:'Nota válida',tipo:'todo',contextoCodigo:'src/main.ts',requisitoEnriquecido:'Comportamiento.',criteriosAceptacion:['Resultado observable.'],notasTecnicas:'Prueba.'};
  const duplicateReq='# Requisitos\n\n- [ ] REQ-20260909-999 Nota válida\n  - Source key: '+JSON.stringify(requirement.sourceKey)+'\n';
  f.memory.set(reqPath,duplicateReq);
  const skipped=f.run('wf-enrich','write',JSON.stringify({status:'ok',requirements:[requirement],warnings:[]}),{inputs:'{}'});
  assert.equal(skipped.written,0);
  assert.equal(f.memory.get(quick),source);
  f.memory.set(reqPath,'# Requisitos\n');
  const before=f.memory.get(reqPath);
  f.fail(quick);
  assert.throws(()=>f.run('wf-enrich','write',JSON.stringify({status:'ok',requirements:[requirement],warnings:[]}),{inputs:'{}'}),/restaurar/);
  assert.equal(f.memory.get(reqPath),before);
  assert.equal(f.memory.get(quick),source);
});
test('sprint generation writes the operational queue and marks master requirements as prioritized',()=>{
  const f=fixture();
  f.memory.set(reqPath,'# Requisitos\n\n'+block+'\n\n'+other+'\n');
  f.memory.set(sprintPath,'# Sprints anteriores\n\n- [x] REQ-OLD Cerrado\n');
  const result=f.run('wf-sprints','write',JSON.stringify({status:'ok',criterion:'Dependencias',sprints:[{title:'Sprint 1',objective:'Base',risks:'Pruebas',requirementIds:[id,'REQ-20260909-002']}]}));
  assert.equal(result.markedDoneInRequirements,2);
  assert.match(f.memory.get(reqPath),new RegExp('^- \\[x\\] '+id,'m'));
  assert.match(f.memory.get(reqPath),/Estado: Priorizado en sprint/);
  assert.match(f.memory.get(reqPath),/Sprint asignado: Sprint 1/);
  assert.match(f.memory.get(sprintPath),new RegExp('^- \\[ \\] '+id,'m'));
  assert.throws(()=>f.run('wf-sprints','write',JSON.stringify({status:'ok',criterion:'',sprints:[]})),/todavía contiene requisitos pendientes/);
});
test('plan persists exact ID and build ignores reordered sprint',()=>{
  const f=fixture(),s=f.plan();
  assert.equal(s.stage,'planned'); assert.equal(s.requirementText,block);
  assert(f.memory.get(s.planPath).includes(block));
  f.memory.set(sprintPath,other+'\n\n'+block);
  assert.equal(f.run('wf-build-sprint','manifest').requirementId,id);
  const replanned=f.run('wf-plan-sprint','select');
  assert.equal(replanned.requirementId,id);
  assert.equal(replanned.previousRunId,s.runId);
});
test('no pending requirement does not call planner',()=>{
  const f=fixture();f.memory.set(sprintPath,'# Sprints\n');
  const out=f.run('wf-plan-sprint','select');
  assert.equal(out.found,false);
  const expression=data.workflows.find(w=>w.exportId==='wf-plan-sprint').steps[0].transitions[0].condition;
  assert.equal(vm.runInNewContext(expression,{input:JSON.stringify(out)}),false);
  assert(!f.memory.has(statePath));
});
test('blocked planner result ends cleanly without writing an active plan',()=>{
  const f=fixture();
  const selection=f.run('wf-plan-sprint','select');
  const result=f.run('wf-plan-sprint','save-plan',JSON.stringify({status:'blocked',runId:selection.runId,requirementId:selection.requirementId,reason:'Decisión realmente necesaria'}),{select:JSON.stringify(selection)});
  assert.equal(result.status,'blocked');
  assert.equal(result.saved,false);
  assert.match(result.reason,/realmente necesaria/);
  assert(!f.memory.has(statePath));
});
test('modified operational sprint requirement blocks build',()=>{
  const f=fixture();f.plan();f.memory.set(sprintPath,f.memory.get(sprintPath).replace('conservar','cambiado'));
  assert.throws(()=>f.run('wf-build-sprint','manifest'),/cambió/);
});
test('blocked implementation saves remediation and resumes on the next build run',()=>{
  const f=fixture(),s=f.plan(),manifest=f.run('wf-build-sprint','manifest');
  const result=f.run('wf-build-sprint','save-implementation',JSON.stringify({status:'blocked',runId:s.runId,requirementId:s.requirementId,blockingType:'SENSITIVE_OR_UNSAFE',blockingFiles:['local-secret.json'],reason:'Archivo sensible no ignorado',canAutoRemediate:true,recommendedAction:'Añadir una regla exacta a .gitignore',automaticActions:['Añadir local-secret.json a .gitignore sin leerlo'],manualActions:[],resolutionOptions:['Usar un worktree limpio'],remediationPlanMarkdown:'# Plan de remediación\n\nIgnorar el archivo local y verificarlo.',checks:[]}),{manifest:JSON.stringify(manifest)});
  assert.equal(result.status,'blocked');
  assert.equal(result.saved,true);
  assert.equal(result.blockingType,'SENSITIVE_OR_UNSAFE');
  assert.deepEqual(Array.from(result.blockingFiles),['local-secret.json']);
  assert(f.memory.has(result.remediationPlanPath));
  assert.equal(JSON.parse(f.memory.get(statePath)).stage,'blocked');
  assert(!f.memory.has(s.implementationPath));
  const retryManifest=f.run('wf-build-sprint','manifest');
  assert.equal(retryManifest.mode,'remediate-and-resume');
  const resumed=f.run('wf-build-sprint','save-implementation',JSON.stringify({status:'ok',runId:s.runId,requirementId:s.requirementId,repositoryRoot:'C:/repo',branch:'dev',head,summary:'Remediación aplicada e implementación completada',changedFiles:['.gitignore','src/main.ts'],preExistingRelatedFiles:[],preservedUnrelatedFiles:[],remediationApplied:[{action:'Ignorar archivo local',result:'passed',evidence:'git check-ignore confirma la regla'}],checks:[{command:'npm test',result:'passed',evidence:'1 test'}],manualValidation:[],reason:''}),{manifest:JSON.stringify(retryManifest)});
  assert.equal(resumed.status,'ok');
  assert.equal(resumed.resumedAfterRemediation,true);
  assert.equal(JSON.parse(f.memory.get(statePath)).stage,'implemented');
});
test('close preserves history, checks selected sprint and updates master status',()=>{
  const f=fixture(),s=f.implement();
  const result=f.close(f.closeInput(s));
  assert.equal(result.status,'ok');
  assert(f.memory.get(reqPath).includes('- [x] '+id));
  assert(f.memory.get(reqPath).includes(prioritizedOther));
  assert(f.memory.get(reqPath).includes('Commits: '+commit));
  assert(f.memory.get(sprintPath).includes('- [x] '+id));
  assert(f.memory.get(sprintPath).includes('Estado: Implementado'));
  assert(f.memory.get(sprintPath).includes(other));
  assert(f.memory.has(s.closurePath));
  assert.equal(JSON.parse(f.memory.get(statePath)).stage,'closed');
  const snapshot=JSON.stringify([...f.memory]);
  assert.equal(f.run('wf-close','manifest').alreadyClosed,true);
  assert.equal(JSON.stringify([...f.memory]),snapshot);
  assert.equal(f.run('wf-plan-sprint','select').requirementId,'REQ-20260909-002');
});
test('close refuses blocked, failed checks, missing commits, foreign run and omitted criteria',()=>{
  for(const mutate of [
    d=>{d.status='blocked';d.reason='Falta evidencia';},
    d=>{d.checks[0].result='failed';},
    d=>{d.commits=[];},
    d=>{d.runId='run-other';},
    d=>{d.acceptance[0].criterion='Otro';},
    d=>{d.manualValidation=['Pendiente'];},
    d=>{d.acceptance[0].verified=false;}
  ]) {
    const f=fixture(),s=f.implement(),before=f.memory.get(sprintPath),d=f.closeInput(s);
    mutate(d);assert.throws(()=>f.close(d));assert.equal(f.memory.get(sprintPath),before);
    assert.equal(JSON.parse(f.memory.get(statePath)).stage,'implemented');
  }
});
test('uncommitted implementation and changed Git HEAD block closure',()=>{
  for(const mode of ['dirty','head']){
    const f=fixture(),s=f.implement(),original=f.terminal.run;
    f.terminal.run=c=>c==='git diff --name-only -z HEAD --'&&mode==='dirty'?'src/main.ts\0':c==='git rev-parse HEAD'&&mode==='head'?'c'.repeat(40):original(c);
    assert.throws(()=>f.close(f.closeInput(s)));
    assert(f.memory.get(sprintPath).includes('- [ ] '+id));
  }
});
test('partial write failure restores source, sprint and state with recovery snapshot',()=>{
  const f=fixture(),s=f.implement(),before=[f.memory.get(reqPath),f.memory.get(sprintPath),f.memory.get(statePath)];
  f.fail(reqPath);
  assert.throws(()=>f.close(f.closeInput(s)),/Injected/);
  assert.deepEqual([f.memory.get(reqPath),f.memory.get(sprintPath),f.memory.get(statePath)],before);
  assert(f.memory.has(s.closurePath.replace('cierre.json','antes-del-cierre.json')));
});
test('legacy source closes without touching sprint document',()=>{
  const f=fixture(),legacy='Docs/autoOC/06a_Enriched_B&HVf.md';
  f.memory.set(legacy,block);
  const selection=f.run('wf-plan-bugs_legacy','select');
  f.run('wf-plan-bugs_legacy','save-plan',JSON.stringify({status:'ok',runId:selection.runId,requirementId:id,repositoryRoot:'C:/repo',branch:'dev',head,planMarkdown:'Plan legacy'}),{select:JSON.stringify(selection)});
  const s=JSON.parse(f.memory.get(statePath)),manifest=f.run('wf-build-bugs_legacy','manifest');
  f.run('wf-build-bugs_legacy','save-implementation',JSON.stringify({status:'ok',runId:s.runId,requirementId:id,repositoryRoot:'C:/repo',branch:'dev',head,summary:'Hecho',changedFiles:['src/main.ts'],checks:[],manualValidation:[]}),{manifest:JSON.stringify(manifest)});
  const before=f.memory.get(sprintPath);
  f.close(f.closeInput(s));
  assert(f.memory.get(legacy).includes('- [x] '+id));assert.equal(f.memory.get(sprintPath),before);
});
