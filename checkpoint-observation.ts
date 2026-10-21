import * as path from "path";
import * as fs from "fs";
import { validateExecutionCheckpoint, type RunCheckpoint } from "./execution-journal";
import { readSettingsTextAsync, settingsFingerprint } from "./settings-writer";
import { hashTextCooperatively, parseCooperatively } from "./cooperative-json";

// Per-operation observations only. No global/TTL cache: every publication must
// revalidate its entire read set, including shared task/workflow bindings.
export async function observeCheckpoint(directory:string,runId:string) {
  if(!/^[a-zA-Z0-9-]+$/.test(runId))throw new Error("Invalid execution identity");
  const file=path.join(directory,runId+".json"),stat=fs.lstatSync(file),text=await readSettingsTextAsync(file);
  if(text===null)throw new Error("Execution checkpoint is absent");
  let checkpoint:RunCheckpoint;
  try {checkpoint=await parseCooperatively(text);} catch {throw new Error("Cannot read valid execution checkpoint");}
  validateExecutionCheckpoint(checkpoint);
  if(checkpoint.runId!==runId)throw new Error("Execution identity changed");
  const hash=await hashTextCooperatively(text);
  const assertCurrent=()=>{
    const current=fs.lstatSync(file);
    if(!current.isFile() || current.isSymbolicLink() || current.dev!==stat.dev || current.ino!==stat.ino ||
        current.size!==stat.size || current.mtimeMs!==stat.mtimeMs || current.ctimeMs!==stat.ctimeMs)throw new Error("Execution checkpoint changed during observation");
  };
  assertCurrent();
  return {checkpoint,text,assertCurrent,async assertUnchanged(){
    if(await settingsFingerprint(file)!==hash)throw new Error("Execution checkpoint changed during observation");
    assertCurrent();
  }};
}
