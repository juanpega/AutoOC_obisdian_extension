# Publish Checklist (v1.0.0)

## Pre-release
- [ ] `npm install`
- [ ] `npm run build`
- [ ] Verify plugin works in Obsidian
- [ ] Run diagnostic command in plugin UI
- [ ] Update `manifest.json` version
- [ ] Update `package.json` version
- [ ] Update README if needed

## Build release asset
- [ ] `powershell -ExecutionPolicy Bypass -File .\\package-release.ps1 -Version 1.0.0`
- [ ] Confirm zip exists in `release/`
- [ ] Save SHA256 checksum

## Repository
- [ ] Commit all source files
- [ ] Create tag `v1.0.0`
- [ ] Push tag to remote

## GitHub Release
- [ ] Create release from tag `v1.0.0`
- [ ] Attach zip from `release/`
- [ ] Add release notes (from template)
- [ ] Publish release

## Post-release verification
- [ ] Fresh install test using only release files (`manifest.json`, `main.js`, `styles.css`)
- [ ] Validate task run, stop, log, diagnostic
