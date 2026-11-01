import { physicalPath } from "./path-identity";
import * as path from "path";

// One owner, one ordered read/project/replace/publication boundary. This is
// deliberately separate from SettingsWriter's I/O queue: nesting save/load
// in that queue would deadlock. External writers still fail fingerprint checks.
const tails = new Map<string, Promise<void>>();
declare const transactionBrand: unique symbol;
export interface CatalogTransaction { readonly [transactionBrand]: true; }
const owners = new WeakMap<CatalogTransaction, {key:string;active:boolean}>();
// Pass ownership explicitly. AsyncLocalStorage can crash Electron renderers
// when Node's async context frame encounters Chromium's task attribution data.
export function catalogTransaction<T>(file:string, operation:(transaction:CatalogTransaction)=>Promise<T>, transaction?:CatalogTransaction):Promise<T> {
  const key = path.join(physicalPath(path.dirname(file)),path.basename(file));
  // Publication can perform a legacy migration save. It belongs to the same
  // transaction; unrelated callers still wait for the full publication.
  if(transaction) {
    const current=owners.get(transaction);
    if(!current?.active || current.key!==key)return Promise.reject(new Error("Invalid or expired catalog transaction"));
    return operation(transaction);
  }
  const result = (tails.get(key) || Promise.resolve()).then(async()=>{
    const state={key,active:true};
    const owner=Object.freeze({}) as CatalogTransaction;
    owners.set(owner,state);
    try{return await operation(owner);}finally{state.active=false;}
  });
  const tail = result.then(()=>{},()=>{});
  tails.set(key,tail);
  void tail.then(()=>{if(tails.get(key)===tail)tails.delete(key);});
  return result;
}
