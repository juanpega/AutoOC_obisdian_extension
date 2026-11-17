import * as fs from "fs";
import * as path from "path";
import {randomUUID} from "crypto";
import {performance} from "perf_hooks";

export type TimingPhase="queue"|"settingsQueue"|"settingsSave"|"code"|"provider"|"evaluation";
const phases:TimingPhase[]=["queue","settingsQueue","settingsSave","code","provider","evaluation"];
interface Metric {count:number;totalMs:number;maxMs:number;active:number}
interface TimingSpan {phase:TimingPhase;stepId:string;index:number;startedAt:number;durationMs?:number;active:boolean}
export interface ExecutionTiming {schemaVersion:1;attemptId:string;requestId?:string;runId?:string;startedAt:number;updatedAt:number;finished:boolean;phases:Partial<Record<TimingPhase,Metric>>;spans:TimingSpan[];droppedSpans:number}
export interface TimingContext {runtime:string;value:ExecutionTiming;tail:Promise<void>;failed:boolean;writing:boolean;pending?:string}
const idPattern=/^[a-zA-Z0-9-]{1,256}$/;

function safeFile(file:string) {
  try {const stat=fs.lstatSync(file);if(!stat.isFile() || stat.isSymbolicLink() || stat.nlink!==1 || stat.size>524288)throw new Error("Unsafe timing file");}
  catch(error){if((error as NodeJS.ErrnoException).code!=="ENOENT")throw error;}
}
function publish(context:TimingContext) {
  if(context.failed || !fs.existsSync(context.runtime) || !context.value.requestId && !context.value.runId)return;
  context.value.updatedAt=Date.now();
  context.pending=JSON.stringify(context.value);
  if(context.writing)return;
  context.writing=true;
  context.tail=(async()=>{
    while(context.pending!==undefined) {
    const bytes=context.pending;context.pending=undefined;
    const root=fs.realpathSync(context.runtime),stat=fs.lstatSync(context.runtime);
    if(!stat.isDirectory() || stat.isSymbolicLink())throw new Error("Unsafe timing directory");
    const directory=path.join(root,"timings");
    try{fs.mkdirSync(directory,{mode:0o700});}catch(error){if((error as NodeJS.ErrnoException).code!=="EEXIST")throw error;}
    const directoryStat=fs.lstatSync(directory);
    if(!directoryStat.isDirectory() || directoryStat.isSymbolicLink() || fs.realpathSync(directory)!==directory)throw new Error("Unsafe timing directory");
    const file=path.join(directory,"timing-"+context.value.attemptId+".json"),temp=file+"."+randomUUID()+".tmp";
    safeFile(file);
    try {await fs.promises.writeFile(temp,bytes,{flag:"wx",mode:0o600});safeFile(file);await fs.promises.rename(temp,file);}
    finally {try{await fs.promises.unlink(temp);}catch{/* No execution state is touched. */}}
    }
  })().catch(()=>{context.failed=true;}).finally(()=>{
    context.writing=false;
    if(context.pending!==undefined && !context.failed)publish(context);
  }); // Diagnostics must never turn a successful effect into a retry.
}

export function startPhaseTiming(phase:TimingPhase,stepId?:string,context?:TimingContext):()=>void {
  if(!context)return ()=>{};
  const metric=context.value.phases[phase] ||= {count:0,totalMs:0,maxMs:0,active:0};
  let span:TimingSpan|undefined;
  if(stepId && stepId.length<=256) {
    if(context.value.spans.length<256) {
      span={phase,stepId,index:context.value.spans.length,startedAt:Date.now(),active:true};
      context.value.spans.push(span);
    } else context.value.droppedSpans++;
  }
  const started=performance.now();let ended=false;metric.active++;publish(context);
  return ()=>{if(ended)return;ended=true;const elapsed=Math.max(0,performance.now()-started);metric.active--;metric.count++;metric.totalMs+=elapsed;metric.maxMs=Math.max(metric.maxMs,elapsed);if(span){span.durationMs=elapsed;span.active=false;}publish(context);};
}
export function bindTimingRun(runId:string,context?:TimingContext):void {
  if(!context)return;
  if(!idPattern.test(runId) || context.value.runId && context.value.runId!==runId){context.failed=true;return;}
  context.value.runId=runId;publish(context);
}
export async function withExecutionTiming<T>(runtime:string,identity:{requestId?:string;runId?:string;queueMs?:number},operation:(timing:TimingContext)=>Promise<T>,existing?:TimingContext):Promise<T> {
  runtime=fs.existsSync(runtime)?fs.realpathSync(runtime):path.resolve(runtime);
  // Explicit ownership: Node async context tracking is unsafe in Electron renderers.
  if(existing?.runtime===runtime)return operation(existing);
  const now=Date.now(),value:ExecutionTiming={schemaVersion:1,attemptId:randomUUID(),requestId:identity.requestId,runId:identity.runId,startedAt:now,updatedAt:now,finished:false,phases:{},spans:[],droppedSpans:0};
  if(identity.queueMs!==undefined && Number.isFinite(identity.queueMs) && identity.queueMs>=0)value.phases.queue={count:1,totalMs:identity.queueMs,maxMs:identity.queueMs,active:0};
  const context:TimingContext={runtime,value,tail:Promise.resolve(),failed:false,writing:false};
  publish(context);try{return await operation(context);}finally{
    value.finished=true;publish(context);
    while(context.writing || context.pending!==undefined && !context.failed)await context.tail;
  }
}

export function readExecutionTimings(runtime:string,selector:{requestId?:string;runId?:string}):ExecutionTiming[] {
  if(!selector.requestId && !selector.runId)return [];
  if(!fs.existsSync(runtime))return [];
  if(!fs.lstatSync(runtime).isDirectory() || fs.lstatSync(runtime).isSymbolicLink())throw new Error("Unsafe timing directory");
  const directory=path.join(fs.realpathSync(runtime),"timings");
  if(!fs.existsSync(directory))return [];
  const stat=fs.lstatSync(directory);
  if(!stat.isDirectory() || stat.isSymbolicLink() || fs.realpathSync(directory)!==directory)throw new Error("Unsafe timing directory");
  const result:ExecutionTiming[]=[];
  for(const name of fs.readdirSync(directory)) {
    if(!/^timing-[a-f0-9-]{36}\.json$/.test(name))continue;
    const file=path.join(directory,name);safeFile(file);
    let value:any;try{value=JSON.parse(fs.readFileSync(file,"utf8"));}catch{continue;}
    if(value?.schemaVersion!==1 || name!=="timing-"+value.attemptId+".json" || typeof value.finished!=="boolean" ||
       !Number.isFinite(value.startedAt) || !Number.isFinite(value.updatedAt) || value.requestId!==undefined&&!idPattern.test(value.requestId) || value.runId!==undefined&&!idPattern.test(value.runId))continue;
    if(selector.requestId ? value.requestId!==selector.requestId : value.runId!==selector.runId)continue;
    const metrics:ExecutionTiming["phases"]={};
    for(const phase of phases) {
      const metric=value.phases?.[phase];
      if(metric && [metric.count,metric.totalMs,metric.maxMs,metric.active].every(n=>Number.isFinite(n)&&n>=0))metrics[phase]={count:metric.count,totalMs:metric.totalMs,maxMs:metric.maxMs,active:metric.active};
    }
    const spans:TimingSpan[]=Array.isArray(value.spans)?value.spans.slice(0,256).filter(s=>s && phases.includes(s.phase) && typeof s.stepId==="string" && s.stepId.length<=256 && Number.isSafeInteger(s.index) && s.index>=0 && Number.isFinite(s.startedAt) && typeof s.active==="boolean" && (s.durationMs===undefined || Number.isFinite(s.durationMs)&&s.durationMs>=0)).map(s=>({phase:s.phase,stepId:s.stepId,index:s.index,startedAt:s.startedAt,active:s.active,...(s.durationMs===undefined?{}:{durationMs:s.durationMs})})):[];
    result.push({schemaVersion:1,attemptId:value.attemptId,requestId:value.requestId,runId:value.runId,startedAt:value.startedAt,updatedAt:value.updatedAt,finished:value.finished,phases:metrics,spans,droppedSpans:Number.isSafeInteger(value.droppedSpans)&&value.droppedSpans>=0?value.droppedSpans:0});
  }
  return result.sort((a,b)=>a.startedAt-b.startedAt);
}
