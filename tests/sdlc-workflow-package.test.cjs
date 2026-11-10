const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'library/sdlc-codex-background-app.json'), 'utf8'));
const buildAndFeedback = JSON.parse(fs.readFileSync(path.join(root, 'library/wf-04-codex-build-sprint.json'), 'utf8'));
const safeCommit = JSON.parse(fs.readFileSync(path.join(root, 'library/wf-04a-codex-commit-requirement.json'), 'utf8'));
const safeClose = JSON.parse(fs.readFileSync(path.join(root, 'library/wf-04b-codex-close-requirement.json'), 'utf8'));
const sddCommit = JSON.parse(fs.readFileSync(path.join(root, 'library/wf-04d-codex-commit-sdd-dossier.json'), 'utf8'));
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
    if(command.endsWith('rev-parse --show-toplevel')) return 'C:/repo\n';
    if(command.endsWith('branch --show-current')) return 'dev\n';
    if(command.endsWith('rev-parse HEAD')) return commit+'\n';
    if(command.includes('diff --name-only -z HEAD --') || command.includes('ls-files --others --exclude-standard -z')) return '';
    if(command.includes('merge-base --is-ancestor ')) return '';
    if(command.includes('cat-file -t ')) return 'commit';
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
  function recordCommit() {
    const s=JSON.parse(memory.get(statePath));
    if(s.commitPath)return s;
    const commitPath=s.planPath.replace(/\/plan\.md$/,'/commit.json');
    memory.set(commitPath,JSON.stringify({status:'ok',runId:s.runId,requirementId:s.requirementId,repositoryRoot:s.repositoryRoot,branch:s.branch,headBefore:s.planHead,headAfter:commit,commit,committedFiles:['src/main.ts'],checks:[]})+'\n');
    s.commitPath=commitPath;s.commit=commit;s.committedAt='2026-09-11T12:00:00.000Z';memory.set(statePath,JSON.stringify(s,null,2)+'\n');
    return s;
  }
  function close(d) {
    recordCommit();
    const manifest=run('wf-close','manifest');
    return run('wf-close','close',JSON.stringify(d),{manifest:JSON.stringify(manifest)});
  }
  return {memory,run,plan,implement,recordCommit,close,closeInput,calls,terminal,fail:p=>{failOnce=p;}};
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
  const focusedResult=vm.runInNewContext(js,{data:buildAndFeedback});
  assert.equal(focusedResult.ok,true,JSON.stringify(focusedResult));
  assert.equal(focusedResult.warnings.length,0);
  const commitResult=vm.runInNewContext(js,{data:safeCommit});
  assert.equal(commitResult.ok,true,JSON.stringify(commitResult));
  assert.equal(commitResult.warnings.length,0);
  const closeResult=vm.runInNewContext(js,{data:safeClose});
  assert.equal(closeResult.ok,true,JSON.stringify(closeResult));
  assert.equal(closeResult.warnings.length,0);
  assert.equal(safeClose.workflows[0].name,'04b_codex_cerrar_requisito_con_riesgo_v2');
  const sddResult=vm.runInNewContext(js,{data:sddCommit});
  assert.equal(sddResult.ok,true,JSON.stringify(sddResult));
  assert.equal(sddResult.warnings.length,0);
  assert.equal(data.tasks.length,12);
  assert.equal(data.workflows.length,14);
  assert.equal(data.tasks.find(t=>t.exportId==='implement').interactiveTerminal,false);
  assert.equal(data.tasks.find(t=>t.exportId==='feedback').interactiveTerminal,false);
  assert.equal(data.tasks.find(t=>t.exportId==='commit').interactiveTerminal,false);
  assert.equal(data.tasks.find(t=>t.exportId==='close').interactiveTerminal,false);
  assert.equal(data.tasks.find(t=>t.exportId==='commit-sdd').interactiveTerminal,false);
  assert.match(data.tasks.find(t=>t.exportId==='commit').prompt,/approvalPolicy never/);
  assert.match(data.tasks.find(t=>t.exportId==='commit').prompt,/-c safe\.directory=/);
  assert.match(data.tasks.find(t=>t.exportId==='commit').prompt,/ruta generada, ignorada, no tracked y no staged como \.next\//);
  assert.equal(data.workflows.find(w=>w.exportId==='wf-commit-requirement').steps.at(-1).codeAllowTerminal,true);
  assert.equal(data.workflows.find(w=>w.exportId==='wf-commit-sdd').steps.at(-1).codeAllowTerminal,true);
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
test('implementation feedback creates a form and preserves every applied revision',()=>{
  const f=fixture(),s=f.implement();
  const first=f.run('wf-feedback-implementation','manifest');
  assert.equal(first.status,'waiting_for_feedback');
  assert(f.memory.has(first.feedbackPath));
  f.memory.set(first.feedbackPath,f.memory.get(first.feedbackPath).replace('## Cambios solicitados','## Cambios solicitados\n\nMostrar también el estado vacío y mantener accesibilidad por teclado.'));
  const manifest=f.run('wf-feedback-implementation','manifest');
  assert.equal(manifest.status,'ready');
  assert.equal(manifest.revision,1);
  const result=f.run('wf-feedback-implementation','save-feedback',JSON.stringify({status:'ok',runId:s.runId,requirementId:id,repositoryRoot:'C:/repo',branch:'dev',head,summary:'Feedback aplicado',feedbackAddressed:[{request:'Mostrar estado vacío',result:'implemented',evidence:'Prueba actualizada'}],changedFiles:['src/main.ts','src/main.test.ts'],checks:[{command:'npm test',result:'passed',evidence:'2 tests'}],manualValidation:[]}),{manifest:JSON.stringify(manifest)});
  assert.equal(result.status,'ok');
  assert.equal(result.revision,1);
  assert(f.memory.has(result.feedbackArchivePath));
  assert(f.memory.has(result.implementationPath));
  assert.match(f.memory.get(first.feedbackPath),/Escribe aquí nuevas observaciones/);
  const next=JSON.parse(f.memory.get(statePath));
  assert.equal(next.stage,'implemented');
  assert.equal(next.feedbackRevision,1);
  assert.equal(next.implementationPath,result.implementationPath);
  const commitManifest=f.run('wf-commit-requirement','manifest');
  assert.equal(commitManifest.requirementId,id);
  assert.equal(commitManifest.implementationPath,'C:/vault/'+result.implementationPath);
});
test('trusted code step creates only the reviewed commit and preserves foreign staging',()=>{
  const f=fixture(),s=f.implement(),manifest=f.run('wf-commit-requirement','manifest');
  let added=false,committed=false;
  f.terminal.run=command=>{
    f.calls.push(command);
    if(command.includes('rev-parse --show-toplevel'))return 'C:/repo\n';
    if(command.includes('branch --show-current'))return 'dev\n';
    if(command.includes('rev-parse HEAD'))return (committed?commit:head)+'\n';
    if(command.includes('diff --cached --name-only -z')){
      if(committed)return 'foreign.txt\0';
      return added?'foreign.txt\0src/main.ts\0':'foreign.txt\0';
    }
    if(command.includes(' add -- ')){added=true;return '';}
    if(command.includes(' commit --only ')){committed=true;return '[dev '+commit.slice(0,7)+'] commit';}
    if(command.includes('diff-tree --no-commit-id --name-only -r -z HEAD'))return 'src/main.ts\0';
    throw new Error('Unexpected command: '+command);
  };
  const result=f.run('wf-commit-requirement','create-commit',JSON.stringify({status:'ready',runId:s.runId,requirementId:id,repositoryRoot:'C:/repo',branch:'dev',head,commitFiles:['src/main.ts'],checks:[{command:'npm test',result:'passed',evidence:'ok'}],reason:''}),{manifest:JSON.stringify(manifest)});
  assert.equal(result.status,'ok');
  assert.equal(result.commit,commit);
  assert.deepEqual(Array.from(result.committedFiles),['src/main.ts']);
  assert(f.calls.some(c=>c.includes('commit --only')));
  const next=JSON.parse(f.memory.get(statePath));
  assert.equal(next.commit,commit);
  assert(f.memory.has(next.commitPath));
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
test('SDD workflow commits only readable dossier markdown and preserves foreign staging',()=>{
  const f=fixture(),implemented=f.implement();
  f.close(f.closeInput(implemented));
  const closed=JSON.parse(f.memory.get(statePath));
  const dir=closed.closurePath.replace(/\/cierre\.json$/,'');
  const docs=[dir+'/plan.md',dir+'/implementacion.md',dir+'/cierre.md'];
  const docCommit='d'.repeat(40);
  let currentHead=commit,staged=['foreign.txt'],added=[],committed=[];
  const original=f.terminal.run;
  f.terminal.run=(command)=>{
    if(command.endsWith('rev-parse HEAD'))return currentHead+'\n';
    if(command.includes('status --porcelain=v1 -z -- ')){
      const quoted=[...command.matchAll(/"([^"]+)"/g)].map(m=>m[1]);
      const candidate=quoted.at(-1);
      return docs.includes(candidate)?'?? '+candidate+'\0':'';
    }
    if(command.includes('check-ignore -v -- '))return '';
    if(command.includes('diff --cached --name-only -z'))return staged.length?staged.join('\0')+'\0':'';
    if(command.includes(' add -- ')){
      added=[...command.matchAll(/"([^"]+)"/g)].map(m=>m[1]).filter(p=>docs.includes(p));
      staged=['foreign.txt',...added];return '';
    }
    if(command.includes('diff --cached --check -- '))return '';
    if(command.includes('commit --only -m ')){committed=added.slice();staged=['foreign.txt'];currentHead=docCommit;return '';}
    if(command.includes('diff-tree --no-commit-id --name-only -r -z HEAD'))return committed.join('\0')+'\0';
    return original(command);
  };
  const manifest=f.run('wf-commit-sdd','manifest-sdd');
  assert.deepEqual(Array.from(manifest.pendingDossierFiles),docs);
  const ready={status:'ready',runId:closed.runId,requirementId:id,repositoryRoot:'C:/repo',branch:'dev',head:commit,commitFiles:docs,excludedFiles:[],checks:[{command:'Revisión SDD',result:'passed',evidence:'Solo Markdown legible'}],reason:''};
  const falsePositive={status:'already_committed',runId:closed.runId,requirementId:id,repositoryRoot:'C:/repo',branch:'dev',head:commit,commit:'',commitFiles:[],excludedFiles:[],checks:[],reason:'Ya versionado'};
  assert.throws(()=>f.run('wf-commit-sdd','create-sdd-commit',JSON.stringify(ready),{}),/salida del step manifest-sdd/);
  assert.throws(()=>f.run('wf-commit-sdd','create-sdd-commit',JSON.stringify(falsePositive),{'manifest-sdd':JSON.stringify(manifest)}),/Markdown pendiente/);
  assert.throws(()=>f.run('wf-commit-sdd','create-sdd-commit',JSON.stringify({...ready,commitFiles:[...docs,statePath]}),{'manifest-sdd':JSON.stringify(manifest)}),/commitFiles/);
  const result=f.run('wf-commit-sdd','create-sdd-commit',JSON.stringify(ready),{'manifest-sdd':JSON.stringify(manifest)});
  assert.equal(result.status,'ok');
  assert.equal(result.commit,docCommit);
  assert.deepEqual(Array.from(result.committedFiles),docs);
  assert(result.committedFiles.every(p=>p.endsWith('.md')));
  assert(!result.committedFiles.some(p=>p.endsWith('.json')));
  assert.deepEqual(staged,['foreign.txt']);
  assert.equal(result.message,'docs(sdd): record development dossier for '+id);
});
test('SDD commit step can resume when a previous attempt already staged the full dossier',()=>{
  const workflow=sddCommit.workflows.find(w=>w.exportId==='wf-commit-sdd-safe');
  const code=workflow.steps.find(s=>s.id==='create-sdd-commit').code;
  assert.match(code,/alreadyStaged\.length&&alreadyStaged\.length!==files\.length/);
  assert.match(code,/sameList\(afterStage,preservedStage\)/);
  assert.doesNotMatch(code,/diff --cached --check/);
});
test('blocked close is saved as manual-validation work instead of becoming a parser error',()=>{
  const f=fixture(),s=f.implement(),d=f.closeInput(s);
  const oldManualPath=s.closurePath.replace(/cierre\.json$/,'validacion-manual.md');
  f.memory.set(oldManualPath,'# Validación manual de '+id+'\n\n## Pasos ejecutados\n\n1.\n');
  d.status='blocked';d.reason='Falta probar el inicio de sesión con credenciales reales';
  delete d.closureMarkdown;
  const result=f.close(d),state=JSON.parse(f.memory.get(statePath));
  assert.equal(result.status,'blocked');
  assert.equal(result.saved,true);
  assert.equal(state.stage,'implemented');
  assert.equal(state.closureBlockAttempt,1);
  assert(f.memory.has(state.closureBlockPath));
  assert(f.memory.get(state.manualValidationPath).includes('## Pasos ejecutados'));
  assert(f.memory.get(state.manualValidationPath).includes('- [ ] Cerrar este requisito sin verificar los criterios pendientes'));
  assert(f.memory.get(state.manualValidationPath).startsWith('# Validación manual de '+id));
  const manifest=f.run('wf-close','manifest');
  assert(manifest.manualValidationPath.endsWith('/validacion-manual.md'));
});
test('explicit risk acceptance closes without misrepresenting a waived criterion as verified',()=>{
  const f=fixture(),s=f.implement(),d=f.closeInput(s);
  const manualPath=s.closurePath.replace(/cierre\.json$/,'validacion-manual.md');
  f.memory.set(manualPath,'# Validación manual\n\n## Aceptación explícita de riesgo\n\n- [x] Cerrar este requisito sin verificar los criterios pendientes\n- Responsable: Responsable del producto\n- Fecha: 2026-09-12\n- Motivo: Se acepta validar después del merge\n');
  d.acceptance[0]={criterion:'Resultado observable',verified:false,waived:true,evidence:'No verificado; riesgo aceptado por Responsable del producto el 2026-09-12: Se acepta validar después del merge'};
  d.riskAcceptance={accepted:true,responsible:'Responsable del producto',date:'2026-09-12',reason:'Se acepta validar después del merge',sourcePath:'C:/vault/'+manualPath};
  const result=f.close(d),state=JSON.parse(f.memory.get(statePath));
  assert.equal(result.status,'ok');
  assert.equal(state.stage,'closed');
  assert(f.memory.get(s.closurePath.replace('cierre.json','cierre.md')).includes('NO VERIFICADO — riesgo aceptado'));
  assert(f.memory.get(sprintPath).includes('Cierre bajo aceptación explícita de riesgo'));
});
test('close refuses failed checks, missing commits, foreign run and omitted criteria',()=>{
  for(const mutate of [
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
    f.terminal.run=c=>c.includes('diff --name-only -z HEAD --')&&mode==='dirty'?'src/main.ts\0':c.endsWith('rev-parse HEAD')&&mode==='head'?'c'.repeat(40):original(c);
    assert.throws(()=>f.close(f.closeInput(s)));
    assert(f.memory.get(sprintPath).includes('- [ ] '+id));
  }
});
test('partial write failure restores source, sprint and state with recovery snapshot',()=>{
  const f=fixture(),s=f.implement();f.recordCommit();
  const before=[f.memory.get(reqPath),f.memory.get(sprintPath),f.memory.get(statePath)];
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
