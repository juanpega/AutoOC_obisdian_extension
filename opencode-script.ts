import { isWindows, psSingleQuoted, psUtf8Prelude, buildPowerShellEnvLines, buildShEnvLines, shSingleQuoted } from "./cli-launchers";

export interface OpenCodeScriptOptions {
  pidFile: string;
  secretEnv: Record<string,string>;
  safeCwd: string;
  gitCmds: string;
  bin: string;
  model: string;
  effectiveAgent: string;
  effectiveTask: {forceModel?:boolean};
  promptFile: string;
  outFile: string;
  errFile: string;
  doneFile: string;
  taskCwd: string;
}

export function buildOpenCodeScript(options:OpenCodeScriptOptions):string {
  const {pidFile, secretEnv, safeCwd, gitCmds, bin, model, effectiveAgent, effectiveTask, promptFile, outFile, errFile, doneFile, taskCwd}=options;
    let launchScript: string;
    if (isWindows()) {
      launchScript = [
        `try {`,
        `$PID | Set-Content -LiteralPath ${psSingleQuoted(pidFile)} -Encoding ASCII`,
        ...psUtf8Prelude(),
          `$env:USERPROFILE = ${psSingleQuoted(process.env.USERPROFILE || "")}`,
          `$env:APPDATA     = ${psSingleQuoted(process.env.APPDATA || "")}`,
          `$env:LOCALAPPDATA= ${psSingleQuoted(process.env.LOCALAPPDATA || "")}`,
          `$env:PATH        = ${psSingleQuoted(process.env.PATH || "")}`,
          `$env:HOME        = ${psSingleQuoted(process.env.USERPROFILE || "")}`,
          ...buildPowerShellEnvLines(secretEnv),
          `Set-Location -LiteralPath '${safeCwd}' -ErrorAction Stop`,
          gitCmds ? gitCmds : "",
        `$bin = ${psSingleQuoted(bin)}`,
        `$binExt = [System.IO.Path]::GetExtension($bin)`,
        `$psShim = if ($binExt -ieq '.cmd') { [System.IO.Path]::ChangeExtension($bin, '.ps1') } else { '' }`,
        `$nodeScript = ''`,
        `if ($psShim -and [System.IO.File]::Exists($psShim)) {`,
        `$bin = $psShim`,
        `} elseif ($binExt -ieq '.cmd') {`,
        `$cmdText = Get-Content $bin -Raw -Encoding UTF8`,
        `if ($cmdText -match '"([^"]+\\.exe)"\\s+%\\*') {`,
        `$bin = $Matches[1]`,
        `} elseif ($cmdText -match '"%_prog%"\\s+"%dp0%\\\\([^"]+)"\\s+%\\*') {`,
        `$cmdDir = Split-Path -Parent $bin`,
        `$nodeCandidate = Join-Path $cmdDir 'node.exe'`,
        `$bin = if ([System.IO.File]::Exists($nodeCandidate)) { $nodeCandidate } else { 'node' }`,
        `$nodeScript = Join-Path $cmdDir $Matches[1]`,
        `} else {`,
        `throw "Cannot safely parse npm command shim '$bin' for shell-sensitive prompt text."`,
        `}`,
        `}`,
        `$model = ${psSingleQuoted(model)}`,
        `$agent = ${psSingleQuoted(effectiveAgent)}`,
        `$forceModel = ${effectiveTask.forceModel ? "$true" : "$false"}`,
        `$prompt = Get-Content '${promptFile.replace(/'/g, "''")}' -Raw -Encoding UTF8`,
        `$outFile = ${psSingleQuoted(outFile)}`,
        `$errFile = ${psSingleQuoted(errFile)}`,
        `$opencodeArgs = @()`,
        `if ($nodeScript) {`,
        `$opencodeArgs += $nodeScript`,
        `}`,
        `$opencodeArgs += @('run', '--print-logs', '--log-level', 'INFO', '--auto', '-m', $model)`,
        `if (-not $forceModel) {`,
        `$opencodeArgs += @('--agent', $agent)`,
        `}`,
        `$opencodeArgs += @('--dangerously-skip-permissions', '--', $prompt)`,
         `& $bin @opencodeArgs 1>> $outFile 2>> $errFile`,
         `$exitCode = if ($null -eq $LASTEXITCODE) { 0 } else { $LASTEXITCODE }`,
         `[System.IO.File]::WriteAllText('${doneFile.replace(/'/g, "''")}', [string]$exitCode, [System.Text.Encoding]::UTF8)`,
        `} catch {`,
        `[System.IO.File]::WriteAllText('${outFile.replace(/'/g, "''")}', '', [System.Text.Encoding]::UTF8)`,
        `[System.IO.File]::WriteAllText('${errFile.replace(/'/g, "''")}', $_.Exception.ToString(), [System.Text.Encoding]::UTF8)`,
        `[System.IO.File]::WriteAllText('${doneFile.replace(/'/g, "''")}', '-1', [System.Text.Encoding]::UTF8)`,
        `}`,
      ].filter(line => line !== "").join("\n");
    } else {
      const shEnv: Record<string, string> = {
        ...secretEnv,
        HOME: process.env.HOME || process.env.USERPROFILE || "",
        PATH: process.env.PATH || "",
      };
      const agentArg = effectiveTask.forceModel ? "" : ` --agent ${shSingleQuoted(effectiveAgent)}`;
      launchScript = [
        `echo $$ > ${shSingleQuoted(pidFile)}`,
        ...buildShEnvLines(shEnv),
        `cd ${shSingleQuoted(taskCwd)} || { printf '%s' '-1' > ${shSingleQuoted(doneFile)}; printf '%s' 'cd failed' > ${shSingleQuoted(errFile)}; exit 1; }`,
        gitCmds ? gitCmds : "",
        `bin=${shSingleQuoted(bin)}`,
        `prompt="$(cat ${shSingleQuoted(promptFile)} 2>/dev/null)"`,
        `set -- --print-logs --log-level INFO --auto -m ${shSingleQuoted(model)}${agentArg} --dangerously-skip-permissions -- "$prompt"`,
        `"$bin" run "$@" >> ${shSingleQuoted(outFile)} 2>> ${shSingleQuoted(errFile)}`,
        `exit_code=$?`,
        `printf '%s' "$exit_code" > ${shSingleQuoted(doneFile)}`,
      ].filter(line => line !== "").join("\n");
    }

  return launchScript;
}
