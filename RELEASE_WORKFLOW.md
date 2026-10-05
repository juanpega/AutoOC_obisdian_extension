# AutoOC release workflow

## Prepare a release on a work branch

Keep product development and release preparation on the reviewed work branch. Match the version in manifest.json, package.json and the root entry of package-lock.json before building. Run the installed SDLC review and validation gates; preserve unrelated changes and runtime evidence.

`npm run build` checks TypeScript and builds the plugin, standalone CLI and shared runtime. The build writes release-integrity.json for the complete package. `npm run pack:release` creates release/auto-oc-<version>.zip and rejects a version mismatch or stale artifact.

The package contains exactly these seven artifacts:

- main.js
- manifest.json
- styles.css
- autooc-cli.cjs
- autooc-runtime.cjs
- skills/autooc-runtime/SKILL.md
- release-integrity.json

Verify the extracted ZIP against the descriptor and execute a full workflow from that installation with Obsidian closed. Preserve the run identity, step results and output checks. A successful build alone does not verify an installed package.

## Review, push and publication

Prepare the release notes and PR description, review the selected paths and complete the installed preparation workflow. Push the reviewed work branch only when authorized. PR creation, merge, tags, GitHub release publication and project rollout remain separate human decisions. Preparing the branch does not publish an update.

The in-app updater reads the configured remote branch (main by default). It can offer the new version only after the release artifacts reach that branch. Keep all seven artifacts together; copying only the three legacy plugin files cannot install the standalone component.

## Update an existing vault

With AutoOC unloaded and no unfinished executions, extract the complete ZIP into .obsidian/plugins/auto-oc/ and preserve data.json, credentials and runtime journals. Enable the new plugin afterward. The portable skill describes the CLI commands and owner recovery contract.

El actualizador nuevo descarga y verifica el paquete completo antes de escribir, conserva configuración y journals y respalda los artefactos anteriores. Desde 1.6.0, que solo copia tres archivos, el nuevo main.js completa automáticamente la instalación antes de habilitar ejecución. El bootstrap requiere red, la misma versión y un main.js idéntico al que arranca; rechaza revisiones mezcladas o un origen que haya avanzado. Un paquete completo y verificado arranca sin red. No se requiere instalar manualmente el ZIP para completar el recorrido normal desde 1.6.0.

Ante fallo de descarga o integridad previo a escritura, se conserva la instalación. Ante fallo de escritura se intenta rollback; si falla, el marcador y el respaldo permanecen y bloquean ejecución. No se anuncia carga satisfactoria hasta comprobar la nueva instancia. La reserva de un propietario muerto solo se archiva automáticamente con token estable, ausencia confirmada y configuración/journals sin efectos inciertos. Un propietario vivo o estado ambiguo conserva el bloqueo.

El puente MCP se retira en 1.6.2; se conservan CLI, runtime, skill y almacén de credenciales sin editar configuraciones de otros clientes. Las pruebas con el candidato servido por una fixture no acreditan instalación desde GitHub ni Obsidian real: registrar esos ensayos por separado. La publicación y el rollout siguen requiriendo autorización específica.

Do not bypass an active execution owner or an unfinished update marker. Preserve its backup and evidence, and follow the documented recovery procedure before starting another execution or update.
