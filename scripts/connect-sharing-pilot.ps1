param([string]$SharedDirectory = 'C:\Dev\AutoOC-Shared')
$ErrorActionPreference = 'Stop'
$projects = @(
    @{ Vault='C:\Dev\inncrea_hub_main_web'; Name='Inncrea'; AllowPush=$false },
    @{ Vault='C:\Dev\AutoOC'; Name='AutoOC'; AllowPush=$true }
)
foreach ($project in $projects) {
    $cli = Join-Path $project.Vault '.obsidian\plugins\auto-oc\autooc-cli.cjs'
    $versionRaw = & node $cli version
    if ($LASTEXITCODE -ne 0) { throw "No se pudo consultar la CLI de $($project.Name)." }
    $version = $versionRaw -join [Environment]::NewLine | ConvertFrom-Json
    if ($version.workflowSharing -ne 1) { throw "Instala primero el piloto en $($project.Name)." }
    $requestFile = Join-Path $PSScriptRoot ('connect-' + [guid]::NewGuid().ToString() + '.json')
    $request = @{ action='connect'; directory=$SharedDirectory; projectName=$project.Name; allowPush=$project.AllowPush }
    [System.IO.File]::WriteAllText($requestFile,($request | ConvertTo-Json),[System.Text.UTF8Encoding]::new($false))
    Write-Host "Conectando $($project.Name) mediante su plugin cargado..."
    & node $cli share-workflows --vault $project.Vault --request $requestFile
    if ($LASTEXITCODE -ne 0) { throw 'Conserva el requestId si lo hay y consulta su recibo antes de repetir. Abre el plugin 1.7.30 compatible en el proyecto pendiente.' }
}
Write-Host 'Proyectos conectados. AutoOC permite recibir distribuciones; Inncrea publica y acepta actualizaciones manualmente.'
Write-Host 'En Inncrea: Shared workflows > Publish a collection. Selecciona primero un conjunto pequeno que hayas probado.'
Write-Host 'La conexion no publica ni sustituye ningun workflow.'
