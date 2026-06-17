# Deploy gratis: Cloudflare Pages + n8n efimero

Este proyecto no necesita PC ni VPS prendido 24/7. La web despliega desde GitHub en Cloudflare Pages y la automatizacion corre por ventanas usando GitHub Actions.

## Web en Cloudflare Pages

Cloudflare Pages esta conectado al repo `HitoFlores/AfiliadosML`.

Configuracion:
- Build command: `npm run build`
- Output directory: `out`
- Env var recomendada: `NEXT_PUBLIC_SITE_URL=https://catalogomx.com`

Next.js usa `output: "export"` e imagenes sin optimizador para generar sitio estatico.

Deploy:
1. Cualquier push a `main` actualiza GitHub.
2. Cloudflare Pages detecta el push.
3. Cloudflare ejecuta build y publica el sitio.

No hay workflow propio de Cloudflare en `.github/workflows`; el unico workflow versionado es el runner efimero de n8n.

## GitHub Actions n8n

Workflow: `.github/workflows/free-ephemeral-n8n.yml`

Horario actual, America/Chihuahua:
- Pausado temporalmente: no hay crons activos mientras Abacus no tenga creditos para generar reviews.
- Dispatch manual queda disponible para schema/mantenimiento, pero `generation_paused=true` evita Freshness, Scheduler, Poll y Main.

Crons UTC:
- Pausados temporalmente en `.github/workflows/free-ephemeral-n8n.yml`.
- Reactivar cuando haya creditos Abacus restaurando el bloque `schedule` y usando `generation_paused=false`.

Dispatch manual:
- `run_daily_scheduler`: corre Scheduler y Freshness aunque no sea la hora diaria.
- `run_main_safety`: reservado para compatibilidad; el runner ya corre Main al final.
- `force_regen_slug`: regenera un slug especifico si existe en Sheet.
- `main_max_runs`: limite de ejecuciones Main en ese ciclo. Default temporal: `0`.
- `generation_paused`: pausa temporal. Default: `true`; con `true` solo corre Sheet Schema y mantenimiento manual (`cleanup`, `restore`, `backfill`) antes de salir.
- `schema_only`: asegura schema de Google Sheets y termina sin correr Freshness, Scheduler, Poll ni Main.
- `run_candidate_backfill`: backfill temporal/manual para poblar `review_candidates` desde los reviews ya publicados en `data/*.json`.
- `run_candidate_cleanup`: crea respaldo de `review_candidates` y descarta candidatos `pending` problematicos.
- `restore_candidate_rows`: filas de `review_candidates` separadas por coma para reabrir despues de un cleanup.

Cada corrida:
1. Checkout del repo.
2. `npm ci`.
3. `npm run n8n:prepare`.
4. Importa credenciales n8n desde `N8N_CREDENTIALS_JSON_B64`.
5. Importa workflows generados en `.tmp/n8n-ephemeral/workflows`.
6. Ejecuta Sheet Schema.
7. Si `run_candidate_cleanup=true`, ejecuta Candidate Cleanup.
8. Si `restore_candidate_rows` tiene filas, ejecuta Candidate Restore.
9. Si `run_candidate_backfill=true`, ejecuta Candidate Backfill.
10. Si `generation_paused=true`, termina sin correr Freshness, Scheduler, Poll ni Main.
11. Si toca ciclo diario, ejecuta Freshness.
12. Si toca ciclo diario, ejecuta Scheduler.
13. Ejecuta Telegram Poll.
14. Ejecuta Main hasta `MAIN_MAX_RUNS`.
15. Escribe resumen en GitHub Step Summary.
16. Si es ciclo diario, manda resumen Telegram.

## Workflows Generados

`scripts/n8n-ephemeral/prepare-workflows.mjs` genera/importa 11 workflows:
- `AfiliadosML`
- `AfiliadosML - Telegram Poll`
- `AfiliadosML - Scheduler 7am` (nombre historico; se ejecuta a las 9am)
- `AfiliadosML - Error Handler`
- `AfiliadosML - Token Refresh`
- `AfiliadosML - Recordatorios`
- `AfiliadosML - Freshness`
- `AfiliadosML - Sheet Schema`
- `AfiliadosML - Candidate Backfill`
- `AfiliadosML - Candidate Cleanup`
- `AfiliadosML - Candidate Restore`

Sheet Schema:
- Corre al inicio de cada ciclo.
- Asegura headers nuevos en `review_candidates` usando Google Sheets API con la credencial n8n.
- Revisa `review_candidates` contra `data/*.json` y cierra candidatos `pending`, `ready` o `processing` que ya tienen review publicado aunque el `candidate_id` se haya perdido.
- Puede ejecutarse solo con `schema_only=true` para reconciliar Google Sheets sin correr Freshness, Scheduler, Poll ni Main.

Freshness:
- Consulta Mercado Libre con OAuth.
- Escribe `freshness` en cada JSON.
- Manda alerta Telegram solo si `stale_count > 0`.
- Reprioriza candidatos relacionados si un review queda stale.

Candidate Backfill:
- Workflow temporal/manual. Se corre con `run_candidate_backfill=true` cuando hay reviews viejos que nunca sembraron candidatos.
- Lee `data/*.json` al preparar workflows y genera candidatos desde `editorial.comparativa_editorial`, `editorial.mejor_alternativa`, `editorial.alternativas` con titulo real y `productos_similares_ml` si existen.
- Deduplica contra `review_candidates`, omite candidatos ya publicados y descarta textos basura como `Sin candidato real confiable identificado en ML`.
- Descarta candidatos specs-only, por ejemplo `15 pulgadas`, y limpia calificadores de condicion como `nueva` o `no reacondicionada`.
- Inserta los faltantes como `pending` con `candidate_id` estable `{source_slug}:{slugify(candidate_name)}`.

Candidate Cleanup:
- Workflow manual. Se corre con `run_candidate_cleanup=true`.
- Antes de tocar filas crea una pestana de respaldo `review_candidates_backup_<timestamp>`.
- Marca como `discarded` solo candidatos `pending` problematicos: nombres genericos, self-candidates, textos basura, duplicados por clave canonica o candidatos ya publicados.
- Tambien descarta specs sueltas como `15 pulgadas`; cada corrida crea backup antes de tocar filas. Ejemplo real: `review_candidates_backup_20260614205439` antes de descartar filas `12`, `16`, `25` y `26`.
- No cambia candidatos `ready`, `done`, `processing` ni `discarded`.

Candidate Restore:
- Workflow manual. Se corre al mandar `restore_candidate_rows` con filas separadas por coma, por ejemplo `12,16`.
- Reabre filas especificas marcandolas como `pending` si fueron descartadas por cleanup y limpia el error operativo del descarte.

Scheduler:
- Manda hasta 3 candidatos `pending`, priorizando `candidate_tier`: `superior > economico > similar > unknown`.
- Intenta mezclar hasta 3 `source_slug` distintos antes de rellenar con la misma fuente; si solo existe una fuente disponible, manda hasta 3 de esa fuente.
- Formato Telegram: una linea por candidato, `1 - Articulo`, `2 - Articulo`, `3 - Articulo`.
- Excluye candidatos ya publicados por `target_slug`, `candidate_id`, producto ML o nombre normalizado, y estados `done`, `ready`, `processing`, `discarded`.
- Excluye specs-only ya existentes en Sheet, asi atributos como `15 pulgadas` no vuelven a salir en Telegram aunque una fila vieja siga `pending`.
- Guarda `shown_batch_id`, `shown_index` y `shown_at` en `review_candidates` para que los numeros respondidos apunten al ultimo lote mostrado aunque Telegram conserve un draft/reply viejo.
- Antes de leer candidatos, asegura automaticamente los headers nuevos de `review_candidates`.
- Un `WAITING_LINK` viejo no impide leer candidatos.
- Filas `articulos` con `estatus=processing` pero sin `articulo`, `referido`, `candidate_id` ni `link_sugerido` no bloquean el Scheduler.
- Si el usuario responde `1 - https://meli.la/...`, el Poll lo procesa en la siguiente corrida disponible.
- Si el usuario responde `1 - descartar`, `1 - descartado`, `1 - eliminar`, `1 - borrar`, `1 - borra`, `1 - basura`, `1 - drop` o `1 - delete`, el Poll marca el candidato como `discarded`.
- Si descarta N candidatos, Poll ofrece hasta N reemplazos nuevos en Telegram y guarda un nuevo snapshot `shown_batch_id`, `shown_index`, `shown_at` para resolver la siguiente respuesta.
- La notificacion de reemplazos debe leer desde `Build Candidate Replacements`; el update de Google Sheets puede no devolver `candidate_name` y producir `1 - undefined`.
- Scheduler y reemplazos limitan cada bucket `marca + tipo` a 4 reviews, contando publicadas y filas ya comprometidas (`ready`, `done`, `processing` o con afiliado). Ejemplos: `delonghi:coffee`, `sony:tv`.
- Si ya no quedan candidatos pendientes para reemplazar descartes, Poll avisa por Telegram.
- Puede procesar varias lineas en un mensaje: `1 - link`, `2 - descartar`, `3 - link`.
- Puede dejar listos 1, 2 o 3 candidatos en una sola corrida si los links son validos; los descartes no crean filas en `articulos`.
- Si el formato no se puede leer, responde por Telegram con un ejemplo valido.
- La notificacion `Candidato listo para generar review` debe mostrar `candidate_name`; si aparece `undefined`, revisar el nodo `Notify Candidate Ready`.
- Esperado: 5-15 min; peor caso 20+ min por demora de GitHub Actions. En pruebas reales GitHub llego a retrasar el schedule mas de una hora.

Main:
- `Top videos` limita la consulta de estadisticas YouTube a 50 IDs para evitar HTTP 400.
- `Build Final JSON` normaliza slugs por familia comercial. Caso probado: `Nintendo LiteSwitch Lite 32GB...` debe salir como `nintendo-switch-lite-32gb` con display title `Nintendo Switch Lite 32GB`.

## Secrets Requeridos

- `N8N_ENCRYPTION_KEY`: llave fija para n8n.
- `N8N_CREDENTIALS_JSON_B64`: export de credenciales n8n en base64.
- `YOUTUBE_API_KEY`
- `ML_CLIENT_ID`
- `ML_CLIENT_SECRET`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `ABACUS_API_KEY`
- `GITHUB_TOKEN`: se usa el token integrado de GitHub Actions con `contents: write`. No configurar `N8N_GITHUB_TOKEN` para este flujo; un PAT vencido provoca errores 401 en freshness.

## Como Generar `N8N_CREDENTIALS_JSON_B64`

En una maquina donde n8n local ya tenga las credenciales funcionando:

```powershell
n8n export:credentials --all --decrypted --output=credentials.json
[Convert]::ToBase64String([IO.File]::ReadAllBytes("credentials.json")) | Set-Clipboard
Remove-Item credentials.json
```

Pega el valor del clipboard como GitHub secret `N8N_CREDENTIALS_JSON_B64`.

No commitear `credentials.json` ni ningun export decrypted.

## Verificacion Antes De Push

```powershell
rtk npm run n8n:prepare
rtk npm run n8n:verify
rtk npm run freshness:test
rtk npm run review:audit
rtk npm run build
```

## Recuperacion

Si el flujo se corta:
1. Leer `docs/ESTADO_DEL_PROYECTO.md`.
2. Revisar GitHub Actions `Free ephemeral n8n`.
3. Revisar `articulos.estatus` y `review_candidates.status` en Google Sheets.
4. Si la pausa temporal sigue activa, no reejecutar generacion; usar `schema_only=true` para reconciliar sin consumir Abacus.
5. Cuando haya creditos Abacus, reactivar crons, correr dispatch manual con `generation_paused=false` y `main_max_runs=1` o `3` segun el caso.

El runner es efimero y retoma por estado en Google Sheets; no depende de `staticData` persistente de n8n.
