# Publish Checklist (<version>)

## Pre-release
- [ ] `npm install`
- [ ] Igualar versión en `manifest.json`, `package.json` y raíz de `package-lock.json`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] Verify plugin works in Obsidian
- [ ] Run diagnostic command in plugin UI
- [ ] Update README if needed

## Build release asset
- [ ] `npm run pack:release` después del build; verificar los siete archivos de `RELEASE_WORKFLOW.md`, descriptor y hashes
- [ ] Confirm `release/auto-oc-<version>.zip` exists
- [ ] Save SHA256 checksum

## Repository
- [ ] Commit all source files
- [ ] Create tag `v<version>`
- [ ] Push tag to remote

## GitHub Release
- [ ] Create release from tag `v<version>`
- [ ] Attach zip from `release/`
- [ ] Add release notes (from template)
- [ ] Publish release

## Post-release verification
- [ ] Instalación nueva en Obsidian real desde el ZIP completo, también sin red
- [ ] Actualización iniciada por 1.6.0: completado automático, versión cargada y conservación de datos
- [ ] Cierre normal y reapertura sin borrar reservas; rechazar propietario vivo y efectos inciertos
- [ ] Validate task run, stop, log, diagnostic
