# Prueba Code → OpenCode interactivo (REQ-20261002-011)

Importa `wf-code-interactive-handoff.json` en una bóveda de prueba, con una copia de
`library/fixtures/interactive-handoff-note.md` en esa misma ruta. Selecciona en la
tarea un modelo disponible en tu instalación de OpenCode y conserva el agente
`plan`. Configura el directorio de trabajo como la raíz de esa bóveda. No importes
sobre una ejecución activa. El caso no usa terminal desde Code ni compacta datos.

Registra fecha, versión de Windows y OpenCode, HEAD y hashes de los fuentes,
pruebas y bundles del candidato. Construir el plugin no lo instala: para esta
validación hay que cargar expresamente ese bundle en la bóveda aislada.

1. Ejecuta una sola vez el workflow. Code lee una nota sintética mayor de 10 KB.
   Debe abrirse una sola ventana OpenCode, con directorio, agente y modelo elegidos.
2. La tarea y el paso permanecen `running` hasta observar un proceso CLI nativo
   descendiente de la sesión. El arranque de PowerShell/cmd no basta. Después
   quedan `completed`; el mensaje aclara que no se sigue el resultado del agente.
3. OpenCode debe identificar `INICIO-HANDOFF-011`, `FIN-HANDOFF-011`, las 180 filas
   numeradas y los caracteres Unicode y de shell como datos. Repite cambiando solo
   el Code de la copia de prueba a `output = note.repeat(5)` para superar 50.000
   caracteres. Conserva la comprobación de tamaño y lectura originales.
4. Retrasa la lectura más de 60 segundos. El archivo `prompt.txt` de la carpeta
   `.autooc-interactive-*` debe seguir disponible mientras viva la sesión.
5. Cierra OpenCode normalmente. El runner elimina el prompt y el observador limpia
   únicamente los archivos propios cuando confirma el cierre. Comprueba que Git
   no muestra esos temporales: cada directorio tiene su propio `.gitignore` con
   `*`; no se altera la configuración Git del destino.
6. En esa copia aislada, prueba una ruta OpenCode inexistente y un directorio sin
   permiso de escritura. Debe registrarse `failed`, sin avance exitoso. Si no se
   confirma el proceso en 30 segundos, el intento falla sin relanzarse ni borrar
   un prompt que todavía pudiera consumirse.
7. Prueba detener y relanzar durante el arranque: una señal de la sesión antigua
   no debe completar la nueva. Detener el seguimiento no cierra una consola que
   ya se abrió; cierra esa consola antes de repetir el caso manual.

El observador usa PowerShell y `Get-CimInstance Win32_Process`; si la inspección
de procesos no está disponible, informa fallo, nunca una confirmación supuesta.
Ante cierre abrupto puede quedar un directorio ignorado. No se barre por prefijo:
solo se puede retirar ese directorio concreto tras comprobar que sus procesos
propietarios han terminado y que no contiene archivos ajenos. No borres un prompt
por antigüedad. El cierre abrupto del observador mantiene el prompt para la sesión;
el runner intenta borrarlo al salir.

Automatización: `npm run build` y `npm test`. Las pruebas con dobles verifican
transporte, estados, fallos y callbacks; no acreditan apertura visual ni lectura
real por OpenCode. En el sandbox incompatible con CScript, omite exclusivamente
esa prueba nativa y conserva su validación externa pendiente según `AGENTS.md`.
