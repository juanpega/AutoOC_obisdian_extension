# Publish Checklist (<version>)

## Pre-release
- [ ] `npm install`
- [ ] Update `manifest.json` and `package.json` to the same `<version>`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] Verify plugin works in Obsidian
- [ ] Run diagnostic command in plugin UI
- [ ] Update README if needed

## Build release asset
- [ ] `npm run pack:release` (after `npm run build`; packages existing `manifest.json`, `main.js`, and `styles.css`)
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
- [ ] Fresh install test using only release files (`manifest.json`, `main.js`, `styles.css`)
- [ ] Validate task run, stop, log, diagnostic
