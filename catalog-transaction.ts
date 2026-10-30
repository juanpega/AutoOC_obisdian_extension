import { physicalPath } from "./path-identity";
import * as path from "path";
import { AsyncLocalStorage } from "async_hooks";

// One owner, one ordered read/project/replace/publication boundary. This is
// deliberately separate from SettingsWriter's I/O queue: nesting save/load
// in that queue would deadlock. External writers still fail fingerprint checks.
const tails = new Map<string, Promise<void>>();
const context = new AsyncLocalStorage<{key:string;active:boolean}>();
export function catalogTransaction<T>(file:string, operation:()=>Promise<T>):Promise<T> {
  const key = path.join(physicalPath(path.dirname(file)),path.basename(file));
  const current=context.getStore();
  // Publication can perform a legacy migration save. It belongs to the same
  // transaction; unrelated callers still wait for the full publication.
  if(current?.key===key && current.active)return operation();
  const result = (tails.get(key) || Promise.resolve()).then(()=>{
    const state={key,active:true};
    return context.run(state,async()=>{try{return await operation();}finally{state.active=false;}});
  });
  const tail = result.then(()=>{},()=>{});
  tails.set(key,tail);
  void tail.then(()=>{if(tails.get(key)===tail)tails.delete(key);});
  return result;
}
