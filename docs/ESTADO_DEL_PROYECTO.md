# AfiliadosML — Estado del proyecto

> Pipeline automático de reviews de afiliados de Mercado Libre México:
> de un link de producto → genera una reseña editorial honesta (estilo Wirecutter/RTINGS)
> → la publica como JSON en este repo → una web Next.js la renderiza.

Última actualización: 2026-06-02 (sesión 2 — completada).

---

## 🏗️ Arquitectura

```
Google Sheet "Reviews ML"
  ├── pestaña "timerrs" (gid 0)           -> tokens OAuth de Mercado Libre
  └── pestaña "articulos" (gid 1072849850) -> COLA de productos a procesar

n8n (local, http://localhost:5678) — 5 workflows:
  1. AfiliadosML            (id iSQ59pcFepjqmBvC) — PIPELINE PRINCIPAL (activo)
  2. AfiliadosML - Telegram Poll (id wsMIARaCQQISWJtv) — Poll cada 2min (activo)
  3. AfiliadosML - Error Handler (id WNQIZP0Tu3hQGODn) — marca errores en Sheet
  4. AfiliadosML - Token Refresh (5h) (id PhRg6OJo47YcvsDo) — refresca token ML
  5. AfiliadosML - Scheduler 7am (id wG6XApFxO6SyCgIY) — cron 7:00 AM (inactivo hasta hostear)

Telegram bot @catalogomx_bot
GitHub HitoFlores/AfiliadosML — n8n commitea data/{slug}.json
Web Next.js (App Router) — homepage dinámica + /reviews/[slug]
```

### Flujo completo desde celular (estado actual)
```
1. Scheduler 7am → bot manda "¿Qué artículo hoy?" (ForceReply)
2. Usuario responde con meli.la/xxx
3. Poll detecta link → "Verificando..." → resuelve social page → extrae MLM ID + nombre
4. Bot: "Encontré: [Producto]. ¿Es correcto? /articulo_correcto / /articulo_incorrecto"
5. Usuario: /articulo_correcto → artículo se agrega a la Sheet (pending)
6. Pass 1 corre: encuentra mejor vendedor verde → Notify con link_sugerido + ForceReply
7. Usuario va a ML Partners → genera link de afiliado del vendedor sugerido → responde al bot
8. Poll detecta el link (reply al mensaje del bot) → estatus ready → dispara Pass 2
9. Pass 2: Gemini genera review → commitea data/{slug}.json → "✅ Review publicada"
```

### Estados de la columna `estatus`
```
pending → waiting → ready → done
                          └→ error
```

### Columnas de la pestaña "articulos"
`articulo` · `referido` · `idioma` (default es) · `estatus` · `link_sugerido` · `slug` · `procesado_en` · `error_msg`

---

## 🤖 Generación con Gemini (pendiente migrar a Abacus AI)

- Modelo: **gemini-2.5-flash**, temperatura **0.2** (más estable que antes)
- Output: `articulo_html` directo (no markdown), títulos en `<h2>`/`<h3>`
- Prompt: escéptico, parafrasea siempre, solo evalúa el producto, cita fuentes
- **PENDIENTE**: sigue metiendo comillas textuales a veces → se resolverá al migrar a Abacus AI (Claude)

### YouTube (fix sesión 2)
- Query: `[Marca] [Modelo/Línea] review análisis`, `order=relevance`
- `Top videos`: requiere que la **marca** aparezca en título/desc
- Bonus +2 si el título contiene "review/análisis/reseña/unboxing/vale la pena/vs"
- Penalidad -2 si contiene "gameplay/scratch test/bend test/teardown/relaxing/asmr"
- Detecta si videos son de **modelos similares** → lo menciona en metodología y artículo

### Slugs (fix sesión 2)
- Fórmula: `{Marca}-{Modelo_texto}-{Línea}-{Submodelo}`, máx 60 chars
- Evita: códigos alfanuméricos, colores, specs numéricas, accesorios incluidos
- Ejemplos: `nintendo-switch-oled`, `asus-vivobook-ultra`, `bose-ultra-quietcomfort`

### Artículos publicados (en GitHub + web)
| Slug | Producto | Score |
|---|---|---|
| `nintendo-switch-oled` | Nintendo Switch OLED Neón 64GB | 8.0 |
| `asus-vivobook-ultra` | ASUS VivoBook 16 Ultra 5 | 7.1 |
| `bose-ultra-quietcomfort` | Bose QC Ultra 2a Gen Reacondicionado | 7.0 |
| `nintendo-switch-2` | Nintendo Switch 2 | — (YT falló, sin videos) |

---

## 🌐 Web (Next.js)

- `app/page.tsx` — homepage dinámica: lee todos `data/*.json`, grid de cards con imagen/score/precio
- `lib/product.ts` — normalizador. Fallbacks: autor="Hito Flores", sin mención de IA
- `components/Byline.tsx` — avatar "HF", sin "Contenido asistido por IA"
- `/reviews/[slug]` — página individual con todos los componentes
- Correr local: `npm run dev` → http://localhost:3000

---

## ✅ Hecho en sesión 2

- **Flujo móvil completo**: meli.la → resolve social page → confirmación → Pass 1 → Pass 2
- **Confirmación de producto**: bot pide /articulo_correcto o /articulo_incorrecto antes de procesar
- **ALERTA 2 errores**: si 2 fallos seguidos → para todo y notifica
- **Referido sin /referido**: basta con responder al mensaje del bot con el link
- **Scheduler 7am**: nuevo workflow, ForceReply, inactivo hasta hostear
- **YouTube v2**: query "review análisis" + order=relevance + scoring por tipo de video
- **HTML fix**: Gemini emite HTML directo, títulos en `<h2>/<h3>`
- **Slugs limpios**: todos los JSON renombrados + nueva lógica de generación
- **Sin IA visible**: removido "Contenido asistido por IA" de todo
- **Autor = Hito Flores**: en JSONs, web, showcase
- **Opiniones destacadas**: vacías cuando reviews_ml.total = 0
- **Metodología honesta**: detecta automáticamente si videos son de modelos similares
- **Temperatura 0.2**: scores más estables entre regeneraciones
- **Commit message**: `feat: review {slug}` (antes: `feat: pending product {nombre_largo}`)
- **Homepage dinámica**: grid con todas las reviews, badge de color por score
- **Showcase**: `public/showcase.html` standalone para compartir

---

## 📋 Pendientes (en orden de prioridad)

### 1. 🔐 Rotar secretos (URGENTE — quedaron expuestos en chats anteriores)
Secretos a rotar: GitHub PAT · ML client_secret · YouTube API key · Gemini API key · Telegram bot token · n8n API key

**Cómo rotar sin exponer en chat** — correr esto en tu propia terminal:
```powershell
@('GITHUB_TOKEN|GitHub PAT (ghp_...)','ML_CLIENT_SECRET|ML client secret','YOUTUBE_API_KEY|YouTube API key','GEMINI_API_KEY|Gemini API key','TELEGRAM_BOT_TOKEN|Telegram token') | ForEach-Object { $p=$_.Split('|'); $s=Read-Host $p[1] -AsSecureString; [Environment]::SetEnvironmentVariable($p[0],[Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)),'User'); Write-Host "✓ $($p[0])" }
```
Después generar nueva n8n API key desde `localhost:5678/settings/api` y pasársela a Claude.

### 2. 🤖 Migrar generación a Abacus AI
- Abacus AI RouteLLM soporta `response_format json_schema` ✅ (confirmado en doc oficial)
- Base URL: `https://routellm.abacus.ai/v1`
- Modelo recomendado: `claude-haiku-4-5` (barato, sigue instrucciones mejor que Flash)
- **3 nodos a cambiar**:
  - `Build Gemini Prompt`: body formato OpenAI (`messages` + `response_format json_schema`)
  - `Gemini Generate Article`: URL + header `Authorization: Bearer ABACUS_KEY`
  - `Parse Gemini JSON`: leer `choices[0].message.content` en vez de `candidates[0]...`
- Agrega `ABACUS_API_KEY` a las variables de entorno

### 3. 🚀 Hostear
- n8n en VPS/cloud (Railway, Render, o VPS DigitalOcean)
- Web en Vercel (conectar repo GitHub → auto-deploy en cada push)
- Al hostear: activar Scheduler 7am + cambiar Poll de polling a Telegram webhook

---

## ⚙️ Cómo correr n8n localmente

```powershell
'YOUTUBE_API_KEY','SUPADATA_API_KEY','ML_CLIENT_ID','ML_CLIENT_SECRET','TELEGRAM_BOT_TOKEN','TELEGRAM_CHAT_ID','GITHUB_TOKEN' | ForEach-Object { Set-Item "env:$_" ([Environment]::GetEnvironmentVariable($_,'User')) }; $env:N8N_BLOCK_ENV_ACCESS_IN_NODE='false'; n8n start
```

Workflows activos al cerrar sesión: **AfiliadosML** (principal) + **Telegram Poll** (2min).
Scheduler 7am y demás: **inactivos** (activar manualmente cuando se use).

---

## 🔑 Variables de entorno requeridas (User scope en Windows)
```
YOUTUBE_API_KEY      → YouTube Data API v3
SUPADATA_API_KEY     → transcripciones de videos
ML_CLIENT_ID         → Mercado Libre OAuth client id
ML_CLIENT_SECRET     → Mercado Libre OAuth client secret
TELEGRAM_BOT_TOKEN   → @catalogomx_bot token
TELEGRAM_CHAT_ID     → tu chat ID de Telegram
GITHUB_TOKEN         → PAT con permisos repo completo
ABACUS_API_KEY       → (pendiente, para la migración)
```
