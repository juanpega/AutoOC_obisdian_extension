import {execFile} from "child_process";

export interface WorktreeFile {
  path:string;
  originalPath?:string;
  indexStatus:string;
  worktreeStatus:string;
  category:"local-configuration"|"project";
}

// Display classification only. These files still participate in every Git safety check.
function localConfiguration(file:string):boolean {
  return file.startsWith(".obsidian/") || file === ".env" || file === ".env.local" || /^\.env\.[^/]+\.local$/.test(file);
}

/** Porcelain v1 -z uses destination NUL original for renames/copies; never split on whitespace. */
export function parseWorktreeStatus(text:string):WorktreeFile[] {
  if(!text)return [];
  if(!text.endsWith("\0"))throw new Error("Incomplete Git file status; refresh the review.");
  const fields=text.split("\0");fields.pop();
  const files:WorktreeFile[]=[];
  for(let i=0;i<fields.length;i++) {
    const entry=fields[i];
    if(entry.length<4 || entry[2]!==" " || !/^[ MADRCUT?!]{2}$/.test(entry.slice(0,2)))throw new Error("Unsupported Git file status; review it in your Git tool.");
    const file:WorktreeFile={path:entry.slice(3),indexStatus:entry[0],worktreeStatus:entry[1],category:"project"};
    if(/[RC]/.test(entry.slice(0,2))) {
      file.originalPath=fields[++i];
      if(!file.originalPath)throw new Error("Incomplete Git rename status; refresh the review.");
    }
    // A rename across categories stays with project changes so it cannot hide product edits.
    if(localConfiguration(file.path) && (!file.originalPath || localConfiguration(file.originalPath)))file.category="local-configuration";
    files.push(file);
  }
  return files;
}

/** Keep the leading index/worktree status spaces and NUL delimiters intact. */
export function readWorktreeStatus(cwd:string,ignored=false):Promise<string> {
  return new Promise((resolve,reject)=>execFile("git",["--no-optional-locks","-c","core.fsmonitor=false","status","--porcelain=v1","-z",
    "--untracked-files=all","--ignore-submodules=none",...(ignored?["--ignored=matching"]:[])],
    {cwd,encoding:"utf8",windowsHide:true,timeout:30000,maxBuffer:4*1024*1024},(error,stdout,stderr)=>{
      if(error)reject(new Error("Git file review: "+String(stderr || error.message).trim()));else resolve(stdout);
    }));
}
