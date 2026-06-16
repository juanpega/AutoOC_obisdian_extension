# AutoOC Release Workflow

This document describes the complete release process for the **AutoOC** Obsidian plugin, including versioning, building, deploying, and how the in-app auto-updater works.

---

## 1. Branch model

- `main` — production branch. This is what the plugin reads for remote updates.
- `dev` — integration branch. Develop new features here and merge into `main` when ready.

## 2. Version numbering

We follow [Semantic Versioning](https://semver.org/lang/es/):

- **MAJOR** (`X.0.0`) — incompatible changes for the user.
- **MINOR** (`0.X.0`) — new features, backward compatible.
- **PATCH** (`0.0.X`) — bug fixes, backward compatible.

Both `manifest.json` and `package.json` must always have the same version.

## 3. Merging `dev` into `main`

When the features in `dev` are ready:

```powershell
git checkout main
git pull origin main
git merge dev
git push origin main
```

Or open a Pull Request on GitHub and merge it from the web interface.

## 4. Bumping the version

After merging `dev` into `main`, bump the version before publishing:

1. Edit `manifest.json`:

   ```json
   {
     "version": "1.2.0"
   }
   ```

2. Edit `package.json`:

   ```json
   {
     "version": "1.2.0"
   }
   ```

3. Build the plugin bundle:

   ```powershell
   npm run build
   ```

   This runs TypeScript checks and generates the compiled `main.js`.

4. Commit and push the release files:

   ```powershell
   git add main.ts main.js manifest.json package.json styles.css
   git commit -m "release: v1.2.0"
   git push origin main
   ```

## 5. Files required in the repository

The in-app updater downloads these three files directly from the configured branch (`main` by default):

- `manifest.json`
- `main.js`
- `styles.css`

Always make sure they are committed and pushed after a build.

## 6. How the auto-updater works

The plugin checks the remote `manifest.json` on startup:

```text
https://raw.githubusercontent.com/juanpega/AutoOC_obisdian_extension/main/manifest.json
```

If the remote `version` is greater than the installed version, the UI shows:

```text
🚀 v1.2.0 available [Update now]
```

When the user clicks **Update now**, the plugin downloads:

- `main.js`
- `manifest.json`
- `styles.css`

from the configured branch and saves them into:

```text
.obsidian/plugins/auto-oc/
```

Then it attempts to reload the plugin automatically. If reload fails, it asks the user to restart Obsidian.

The configured branch is defined in `main.ts`:

```ts
const GITHUB_BRANCH = "main";
```

For testing, you can temporarily point it to `dev`, but production releases should always use `main`.

## 7. Local deployment for testing

To deploy the current build to a local Obsidian vault:

```powershell
node deploy.mjs "C:/path/to/your/vault"
```

Then reload Obsidian:

```text
Ctrl+Shift+P → Reload app without saving
```

## 8. Creating a release zip (optional)

If you prefer to distribute a zip file instead of relying on the auto-updater:

```powershell
npm run build
npm run pack:release
```

The zip will be created in `release/auto-oc-<version>.zip`.

## 9. Quick checklist before publishing

- [ ] `dev` has been merged into `main`.
- [ ] `manifest.json` and `package.json` versions match.
- [ ] Version has been bumped following SemVer.
- [ ] `npm run build` completed successfully.
- [ ] `main.js`, `manifest.json`, and `styles.css` are committed and pushed.
- [ ] `GITHUB_BRANCH` in `main.ts` points to `"main"`.
- [ ] Local deployment has been tested.

---

*Last updated for AutoOC v1.2.0.*
