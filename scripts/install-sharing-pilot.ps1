param(
    [string]$PackageDirectory = (Join-Path $PSScriptRoot 'package'),
    [string[]]$Vaults = @('C:\Dev\inncrea_hub_main_web', 'C:\Dev\AutoOC')
)
$ErrorActionPreference = 'Stop'
$candidateCli = Join-Path $PackageDirectory 'autooc-cli.cjs'
$verificationPath = Join-Path $PSScriptRoot 'verification.json'
if (-not (Test-Path -LiteralPath $verificationPath)) { throw 'Falta verification.json junto al instalador del piloto.' }
$verification = Get-Content -LiteralPath $verificationPath -Raw | ConvertFrom-Json
if ($verification.version -ne '1.7.30') { throw 'El instalador requiere el candidato 1.7.30 verificado.' }
foreach ($entry in $verification.artifacts.PSObject.Properties) {
    $file = Join-Path $PackageDirectory $entry.Name
    if ((Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant() -ne $entry.Value) { throw "El paquete ha cambiado: $($entry.Name)" }
}
function Invoke-PilotCli {
    param([string[]]$Arguments)
    $raw = & node $candidateCli @Arguments
    if ($LASTEXITCODE -ne 0) { throw "AutoOC ha bloqueado la operacion. Conserva el diagnostico; no borres reservas ni journals. $($raw -join [Environment]::NewLine)" }
    return ($raw -join [Environment]::NewLine | ConvertFrom-Json)
}
$pending = @()
foreach ($vault in $Vaults) {
    $resolvedVault = (Resolve-Path -LiteralPath $vault).Path
    $installation = Join-Path $resolvedVault '.obsidian\plugins\auto-oc'
    $same = $true
    foreach ($entry in $verification.artifacts.PSObject.Properties) {
        $installedFile = Join-Path $installation $entry.Name
        if (-not (Test-Path -LiteralPath $installedFile) -or (Get-FileHash -LiteralPath $installedFile -Algorithm SHA256).Hash.ToLowerInvariant() -ne $entry.Value) { $same = $false; break }
    }
    if ($same) { Write-Host "Ya tiene los siete componentes del candidato: $resolvedVault"; continue }
    Write-Host "Inspeccionando $resolvedVault. Su plugin debe estar descargado normalmente."
    $inspection = Invoke-PilotCli -Arguments @('maintain-release','--vault',$resolvedVault,'--inspect')
    if ($inspection.mode -ne 'inspect') { throw 'Respuesta de inspeccion inesperada.' }
    $pending += $resolvedVault
}
$results = @()
foreach ($vault in $pending) {
    Write-Host "Instalando con mantenimiento oficial y copia de seguridad: $vault"
    $result = Invoke-PilotCli -Arguments @('maintain-release','--vault',$vault,'--install')
    $results += [pscustomobject]@{ vault=$vault; result=$result }
    $results | ConvertTo-Json -Depth 15 | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'install-results.json') -Encoding utf8
    if ($result.mode -ne 'installed') { throw 'La instalacion no esta confirmada. Revisa install-results.json.' }
    foreach ($entry in $verification.artifacts.PSObject.Properties) {
        $file = Join-Path (Join-Path $vault '.obsidian\plugins\auto-oc') $entry.Name
        if ((Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant() -ne $entry.Value) { throw "El componente instalado no coincide: $file" }
    }
    Write-Host "Paquete 1.7.30 verificado: $vault"
}
Write-Host 'Activa de nuevo AutoOC en ambos proyectos. Instalar no confirma que la instancia nueva este cargada.'
Write-Host 'Abre Settings > Library > Shared workflows. Conecta la misma carpeta en ambos proyectos.'
Write-Host 'Publica desde Inncrea, vincula la primera version en AutoOC y despues distribuye las mejoras desde Inncrea.'
Write-Host 'Este instalador no publica colecciones, no ejecuta workflows y no sustituye catalogos directamente.'
