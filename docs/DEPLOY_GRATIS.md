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
- 9:07 AM nominal: Freshness + Scheduler + Poll + Main.
- 9:12 AM a 2:00 PM nominal: Poll/Main cada 5 minutos.
- GitHub Actions puede retrasar jobs programados; no usarlo como alarma exacta.

Crons UTC:
- `7 16 * * *`: ciclo diario de 9:07 AM.
- `12-57/5 16 * * *`: polling despues del disparo diario.
- `*/5 17-20 * * *`: polling hasta las 2:00 PM.

Dispatch manual:
- `run_daily_scheduler`: corre Scheduler y Freshness aunque no sea la hora diaria.
- `run_main_safety`: reservado para compatibilidad; el runner ya corre Main al final.
- `force_regen_slug`: regenera un slug especifico si existe en Sheet.
- `main_max_runs`: limite de ejecuciones Main en ese ciclo. Default: `3`.
- `schema_only`: asegura schema de Google Sheets y termina sin correr Freshness, Scheduler, Poll ni Main.

Cada corrida:
1. Checkout del repo.
2. `npm ci`.
3. `npm run n8n:prepare`.
4. Importa credenciales n8n desde `N8N_CREDENTIALS_JSON_B64`.
5. Importa workflows generados en `.tmp/n8n-ephemeral/workflows`.
6. Si toca ciclo diario, ejecuta Freshness.
7. Si toca ciclo diario, ejecuta Scheduler.
8. Ejecuta Telegram Poll.
9. Ejecuta Main hasta `MAIN_MAX_RUNS`.
10. Escribe resumen en GitHub Step Summary.
11. Si es ciclo diario, manda resumen Telegram.

## Workflows Generados

`scripts/n8n-ephemeral/prepare-workflows.mjs` genera/importa 8 workflows:
- `AfiliadosML`
- `AfiliadosML - Telegram Poll`
- `AfiliadosML - Scheduler 7am` (nombre historico; se ejecuta a las 9am)
- `AfiliadosML - Error Handler`
- `AfiliadosML - Token Refresh`
- `AfiliadosML - Recordatorios`
- `AfiliadosML - Freshness`
- `AfiliadosML - Sheet Schema`

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

Scheduler:
- Manda hasta 3 candidatos `pending`, priorizando `candidate_tier`: `superior > economico > similar > unknown`.
- Formato Telegram: una linea por candidato, `1 - Articulo`, `2 - Articulo`, `3 - Articulo`.
- Excluye candidatos ya publicados por `target_slug`, `candidate_id`, producto ML o nombre normalizado, y estados `done`, `ready`, `processing`, `discarded`.
- Guarda `shown_batch_id`, `shown_index` y `shown_at` en `review_candidates` para que los numeros respondidos apunten al ultimo lote mostrado aunque Telegram conserve un draft/reply viejo.
- Antes de leer candidatos, asegura automaticamente los headers nuevos de `review_candidates`.
- Si el usuario responde `1 - https://meli.la/...`, el Poll lo procesa en la siguiente corrida disponible.
- Si el usuario responde `1 - descartar`, `1 - eliminar`, `1 - basura`, `1 - drop` o `1 - delete`, el Poll marca el candidato como `discarded`.
- Puede procesar varias lineas en un mensaje: `1 - link`, `2 - descartar`, `3 - link`.
- Puede dejar listos 1, 2 o 3 candidatos en una sola corrida si los links son validos; los descartes no crean filas en `articulos`.
- Si el formato no se puede leer, responde por Telegram con un ejemplo valido.
- Esperado: 5-15 min; peor caso 20+ min por demora de GitHub Actions. En pruebas reales GitHub llego a retrasar el schedule mas de una hora.

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
4. Reejecutar dispatch manual con `main_max_runs=1` o `3` segun el caso.

El runner es efimero y retoma por estado en Google Sheets; no depende de `staticData` persistente de n8n.
