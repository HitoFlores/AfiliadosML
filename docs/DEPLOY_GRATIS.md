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
- 9:00 AM: Scheduler + Freshness + Poll + Main.
- 9:00 AM a 2:00 PM: Poll/Main cada 5 minutos.

Crons UTC:
- `0 15 * * *`: ciclo diario de 9:00 AM.
- `5-55/5 15 * * *`: polling despues del disparo diario.
- `*/5 16-19 * * *`: polling hasta las 2:00 PM.

Dispatch manual:
- `run_daily_scheduler`: corre Scheduler y Freshness aunque no sea la hora diaria.
- `run_main_safety`: reservado para compatibilidad; el runner ya corre Main al final.
- `force_regen_slug`: regenera un slug especifico si existe en Sheet.
- `main_max_runs`: limite de ejecuciones Main en ese ciclo. Default: `3`.

Cada corrida:
1. Checkout del repo.
2. `npm ci`.
3. `npm run n8n:prepare`.
4. Importa credenciales n8n desde `N8N_CREDENTIALS_JSON_B64`.
5. Importa workflows generados en `.tmp/n8n-ephemeral/workflows`.
6. Si toca ciclo diario, ejecuta Scheduler.
7. Si toca ciclo diario, ejecuta Freshness.
8. Ejecuta Telegram Poll.
9. Ejecuta Main hasta `MAIN_MAX_RUNS`.
10. Escribe resumen en GitHub Step Summary.
11. Si es ciclo diario, manda resumen Telegram.

## Workflows Generados

`scripts/n8n-ephemeral/prepare-workflows.mjs` genera/importa 7 workflows:
- `AfiliadosML`
- `AfiliadosML - Telegram Poll`
- `AfiliadosML - Scheduler 7am` (nombre historico; se ejecuta a las 9am)
- `AfiliadosML - Error Handler`
- `AfiliadosML - Token Refresh`
- `AfiliadosML - Recordatorios`
- `AfiliadosML - Freshness`

Freshness:
- Consulta Mercado Libre con OAuth.
- Escribe `freshness` en cada JSON.
- Manda alerta Telegram solo si `stale_count > 0`.
- Reprioriza candidatos relacionados si un review queda stale.

## Secrets Requeridos

- `N8N_ENCRYPTION_KEY`: llave fija para n8n.
- `N8N_CREDENTIALS_JSON_B64`: export de credenciales n8n en base64.
- `YOUTUBE_API_KEY`
- `ML_CLIENT_ID`
- `ML_CLIENT_SECRET`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `ABACUS_API_KEY`
- `N8N_GITHUB_TOKEN`: PAT con permiso de escribir contents. Si falta, usa `GITHUB_TOKEN` del workflow.

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
