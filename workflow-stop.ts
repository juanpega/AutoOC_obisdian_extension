import * as fs from "fs";
import * as path from "path";
import { randomUUID } from "crypto";
import { readExecutionCheckpoint } from "./execution-journal";
import { atomicSettingsWrite } from "./settings-writer";

export function readStopRequest(directory:string,runId:string):string|undefined {
  if (!/^[a-zA-Z0-9-]+$/.test(runId)) throw new Error("Invalid execution identity");
  const file=path.join(directory,runId+".stop.json");
  try {
    const stat=fs.lstatSync(file);
    if (stat.isSymbolicLink() || !stat.isFile()) throw new Error("Invalid stop request file");
  } catch(error) {if ((error as NodeJS.ErrnoException).code === "ENOENT") return;throw error;}
  let value:any;
  try {value=JSON.parse(fs.readFileSync(file,"utf8"));} catch {throw new Error("Invalid stop request");}
  if (value.schemaVersion!==1 || value.runId!==runId || !/^[a-f0-9-]+$/.test(value.requestId || "")) throw new Error("Invalid stop request identity");
  return value.requestId;
}

export async function requestWorkflowStop(directory:string,runId:string) {
  const stat=fs.lstatSync(directory);
  if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error("Invalid runtime directory");
  const state=readExecutionCheckpoint(directory,runId);
  if (["completed","failed","abandoned"].includes(state.phase)) return {runId,requested:false,phase:state.phase};
  readStopRequest(directory,runId); // Refuse malformed or linked request files.
  const requestId=randomUUID();
  await atomicSettingsWrite(path.join(directory,runId+".stop.json"),{schemaVersion:1,runId,requestId});
  return {runId,requestId,requested:true,phase:state.phase};
}
