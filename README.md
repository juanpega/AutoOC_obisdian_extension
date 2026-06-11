# AutoOC for Obsidian

Plugin de Obsidian para programar y ejecutar tareas de OpenCode CLI con seleccion de modelo, ejecucion manual, log, diagnostico y parada de tareas.

## Features

- Crear tareas con:
  - nombre
  - prompt/goal
  - modelo OpenCode
  - schedule: una vez, diario o semanal
  - opcion Ralph Loop
- Ejecucion manual de una tarea
- Comprobacion automatica de tareas pendientes
- Log de salida por tarea
- Diagnostico integrado para validar OpenCode desde Obsidian
- Boton para parar tareas en ejecucion
- Timeout configurable por tarea
- Carga dinamica de modelos via `opencode models`

## Requisitos

- Obsidian Desktop (Community plugins habilitados)
- OpenCode instalado en local
- Windows (el flujo actual usa PowerShell/VBScript para ejecucion silenciosa)

## Estructura del proyecto

- `main.ts`: codigo fuente del plugin
- `styles.css`: estilos
- `manifest.json`: metadata del plugin
- `main.js`: build final consumido por Obsidian
- `esbuild.config.mjs`: build/bundle
- `deploy.mjs`: copia archivos a `.obsidian/plugins/auto-oc`

## Instalacion para uso local (sin publicar)

1. Clona o copia esta carpeta en tu maquina.
2. Instala dependencias:

```powershell
npm install
```

3. Build + deploy al vault actual:

```powershell
npm run build
node deploy.mjs
```

4. En Obsidian:
- `Ctrl+Shift+P` -> `Reload app without saving`
- Settings -> Community plugins -> activar `AutoOC`

## Uso rapido

1. Abre el panel AutoOC (icono de reloj o comando de paleta).
2. Crea una tarea con `+ Nueva tarea`.
3. Elige modelo (lista dinamica desde OpenCode).
4. Guarda la tarea.
5. Ejecuta con `Ejecutar` o espera al schedule.
6. Mira el log con `Log` o `Log en vivo`.

## Configuracion

En Settings del plugin:

- Ruta de OpenCode CLI
- Directorio de trabajo
- Modelo por defecto
- Timeout por tarea (segundos)
- Recarga de lista de modelos

## Diagnostico

Comando de paleta:

- `AutoOC: Diagnostico - probar comando opencode`

Que valida:

- ruta detectada de OpenCode
- modelo por defecto
- ejecucion real y salida

## Publicar en tu propio repositorio

### 1) Subir codigo fuente

Sube esta carpeta como repo (o subcarpeta de un repo) con:

- `main.ts`
- `styles.css`
- `manifest.json`
- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `esbuild.config.mjs`
- `deploy.mjs`
- `README.md`
- `.gitignore`

### 2) Crear release para distribuir

Para entregar plugin compilado a usuarios:

1. Ejecuta build:

```powershell
npm run build
```

2. Adjunta en release estos archivos:

- `manifest.json`
- `main.js`
- `styles.css`

3. El usuario final debe copiar esos archivos en:

- `.obsidian/plugins/auto-oc/`

## Instalacion del plugin desde release (usuario final)

1. Crear carpeta:

- `.obsidian/plugins/auto-oc`

2. Copiar dentro:

- `manifest.json`
- `main.js`
- `styles.css`

3. Recargar Obsidian y activar plugin.

## Troubleshooting

### No aparece el plugin

- Verifica que Community plugins no este en Restricted Mode.
- Verifica ruta y archivos en `.obsidian/plugins/auto-oc`.
- Recarga Obsidian.

### Los modelos se ven pero la tarea no corre

- Ejecuta el comando de Diagnostico.
- Verifica `Ruta de OpenCode CLI`.
- Prueba en terminal:

```powershell
opencode run "di hola" -m "rndia/qwen3.6:35b" --dangerously-skip-permissions
```

### La tarea tarda mucho

- Revisa timeout por tarea.
- Revisa estado del servidor/proveedor del modelo.
- Usa `Parar` para cancelar y reintentar.

## Scripts utiles

```powershell
npm install
npm run build
node deploy.mjs
npm run pack:release
```

## Archivos para publicar en tu repo

- `package-release.ps1`: crea zip de release con `manifest.json`, `main.js`, `styles.css`
- `RELEASE_NOTES_TEMPLATE.md`: plantilla para texto de release
- `PUBLISH_CHECKLIST.md`: checklist de publicacion end-to-end

## Flujo recomendado de release

1. Build plugin:

```powershell
npm run build
```

2. Crear zip release:

```powershell
npm run pack:release
```

3. El zip queda en `release/auto-oc-<version>.zip` con hash SHA256 en consola.
4. Publica ese zip en tu GitHub Release.

## Estado actual

- Diagnostico funcionando
- Ejecucion de tareas usando launcher silencioso en Windows
- Logs disponibles desde UI

---

Si quieres ampliar el plugin para Mac/Linux, la parte a adaptar es el launcher de procesos en segundo plano (actualmente optimizado para Windows).
