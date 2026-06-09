# Deploy gratis: Cloudflare Pages + n8n efimero

Este modo evita tener una PC o VPS prendido 24/7.

## Ramas

- `archive/n8n-original`: snapshot del flujo n8n original.
- `feature/free-ephemeral-n8n`: cambios para ejecucion gratis con GitHub Actions.

## Web en Cloudflare Pages

- Build command: `npm run build`
- Output directory: `out`
- Env var recomendada: `NEXT_PUBLIC_SITE_URL=https://catalogomx.com`

Next esta configurado con `output: "export"` e imagenes sin optimizador para que el sitio sea estatico.

## GitHub Actions n8n

Workflow: `.github/workflows/free-ephemeral-n8n.yml`

Corre:

- `0 13 * * *`: scheduler diario, 7 AM Chihuahua en la fecha actual.
- `*/5 13-17 * * *`: polling/proceso cada 5 min de 7 AM a 12 PM Chihuahua.
- `workflow_dispatch`: prueba manual. Incluye `run_main_safety` para procesar una fila `pending` o `ready` sin esperar Telegram.

Cada corrida:

1. Prepara copias parcheadas de `n8n-backup/*.json` en `.tmp/n8n-ephemeral/workflows`.
2. Importa credenciales n8n desde secret.
3. Importa workflows.
4. Ejecuta Token Refresh.
5. Ejecuta Scheduler si toca.
6. Ejecuta Telegram Poll.
7. Opcionalmente ejecuta Main como safety pass si el dispatch manual activa `run_main_safety`.

## Secrets requeridos

- `N8N_ENCRYPTION_KEY`: llave fija para n8n.
- `N8N_CREDENTIALS_JSON_B64`: export de credenciales n8n en base64.
- `YOUTUBE_API_KEY`
- `ML_CLIENT_ID`
- `ML_CLIENT_SECRET`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `ABACUS_API_KEY`
- `N8N_GITHUB_TOKEN`: PAT con permiso de escribir contents. Si falta, usa `GITHUB_TOKEN` del workflow.

## Como generar `N8N_CREDENTIALS_JSON_B64`

En una maquina donde n8n local ya tenga las credenciales funcionando:

```powershell
n8n export:credentials --all --decrypted --output=credentials.json
[Convert]::ToBase64String([IO.File]::ReadAllBytes("credentials.json")) | Set-Clipboard
Remove-Item credentials.json
```

Pega el valor del clipboard como GitHub secret `N8N_CREDENTIALS_JSON_B64`.

## Nota de estado Telegram

El runner es efimero, asi que no puede depender de `staticData` entre corridas. El preparador parchea `Telegram Poll` para confirmar `getUpdates` con Telegram antes de apagar, y para guardar el producto detectado en la fila `waiting_confirm`.

Si el flujo se corta, la siguiente corrida retoma por `estatus` en Google Sheet.
