# AfiliadosML — Estado del proyecto

> Pipeline automático de reviews de afiliados de Mercado Libre México:
> de un link de producto → genera una reseña editorial honesta (estilo Wirecutter/RTINGS)
> → la publica como JSON en este repo → una web Next.js la renderiza.

Última actualización: 2026-06-02 (sesión 2).

---

## 🏗️ Arquitectura

```
Google Sheet "Reviews ML"
  ├── pestaña "timerrs" (gid 0)      -> tokens OAuth de Mercado Libre
  └── pestaña "articulos" (gid 1072849850) -> COLA de productos a procesar

n8n (local, http://localhost:5678) — 5 workflows:
  1. AfiliadosML (id iSQ59pcFepjqmBvC) — PIPELINE PRINCIPAL
  2. AfiliadosML - Telegram Poll (id wsMIARaCQQISWJtv) — capta /referido + links ML directos
  3. AfiliadosML - Error Handler (id WNQIZP0Tu3hQGODn) — marca errores en la Sheet
  4. AfiliadosML - Token Refresh (5h) (id PhRg6OJo47YcvsDo) — refresca token ML
  5. AfiliadosML - Scheduler 7am (id wG6XApFxO6SyCgIY) — cron diario 7:00 AM, pide link del día

Telegram bot @catalogomx_bot — notificaciones + comando /referido (ForceReply)
GitHub HitoFlores/AfiliadosML — n8n commitea data/{slug}.json
Web Next.js 16 (App Router) — lee data/*.json y renderiza /reviews/[slug]
```

### Flujo de dos pasadas (estados de la columna `estatus`)
```
pending → processing → waiting → (usuario manda /referido) → ready → processing → done
                                                                          └→ error
```
- **Pass 1** (fila `pending`): resuelve producto → elige **mejor vendedor VERDE** (`5_green`) →
  escribe `link_sugerido` → estatus `waiting` → notifica por Telegram.
- El usuario manda **`/referido`** al bot → ForceReply pide el link → lo pega →
  el Poll escribe `referido` + estatus `ready` → dispara el Principal.
- **Pass 2** (fila `ready`): genera la review (Gemini) → commitea `data/{slug}.json` → estatus `done`.

### Columnas de la pestaña "articulos"
`articulo` (link catálogo /p/MLM...) · `referido` (link afiliado) · `idioma` (es/en/ja, default es) ·
`estatus` (dropdown) · `link_sugerido` · `slug` · `procesado_en` · `error_msg`

---

## 🤖 Generación con Gemini

- Nodo "Gemini Generate Article" → modelo **gemini-2.5-flash** (Pro NO está en free tier).
- El body lo arma "Build Gemini Prompt" (prompt escéptico + structured output con `responseSchema`).
- Reglas clave del prompt: tono escéptico (no folleto), **parafrasea siempre** (no copia textual
  por derechos de terceros), **solo evalúa el producto** (ignora envío/empaque/vendedor),
  cita fuentes (videos por canal, compradores en agregado).
- Videos: "Get Videos YT" (pool 20, order=viewCount) → "Top videos" filtra por token del
  producto (Submodelo/Modelo) y rankea por vistas → "Transcripciones" (Supadata).

### Contrato del bloque `editorial` en el JSON
`score`, `score_justificacion`, `sub_scores[]{dimension,score,justificacion}`, `veredicto_corto`,
`compralo_si[]`, `saltatelo_si[]`, `pros[]`, `contras[]`, `fuentes_citadas[]{tipo,autor,aporte}`,
`opiniones_destacadas` → se mapea a `reviews_ml.destacadas[]{titulo,contenido,sentimiento}`,
`seo_title`, `seo_description`, `articulo_html`. Más bloque `autoria{nombre,tagline,metodologia,actualizado}`.

---

## 🌐 Web (Next.js)

- `lib/product.ts` — normalizador (lee schema nuevo y viejo con fallback).
- `lib/toc.ts` — inyecta ids a h2/h3 y arma la tabla de contenidos.
- `components/`: ScoreBadge, ImageGallery, SubScores, Verdict, SpecsTable, VideoSection,
  BuyerReviews, AffiliateCTA, JsonLd, TableOfContents, Byline.
- Secciones vacías se ocultan solas (productos con pocas fuentes).
- Correr local: `npm run dev` → http://localhost:3000/reviews/{slug}

---

## ✅ Hecho
- Pipeline n8n completo de 2 pasadas + green seller + commit por slug.
- Telegram: notificaciones + /referido con ForceReply.
- Web nivel pro (sub-scores, veredicto, pros/contras, fuentes, JSON-LD, byline).
- Secretos movidos a variables de entorno `$env` (fuera del JSON del workflow).
- Error handler + token refresh 5h.
- Probado con 3 productos (Switch 2, Switch OLED, audífonos Bose).
- **[Sesión 2] Scheduler 7am**: nuevo workflow `AfiliadosML - Scheduler 7am` (cron 7:00 → manda
  mensaje Telegram pidiendo link del día). Inactivo hasta hostear n8n.
- **[Sesión 2] Detección de links ML en Poll**: el Poll ahora detecta links de mercadolibre.com.mx
  enviados directamente. Flujo: link detectado → Switch → Add to Queue (Sheet) → Notify → Run Main.
- **[Sesión 2] Fix HTML**: Gemini ahora emite `articulo_html` directamente (no markdown).
  `Convert to HTML` es un passthrough con limpieza mínima. Títulos siempre en `<h2>`/`<h3>`.
- **[Sesión 2] Fix YouTube**: query más inteligente (evita modelo alfanumérico tipo "890101-0100",
  usa Línea/Submodelo). `Top videos` requiere que la marca aparezca en el video; rankea por
  relevancia + vistas.
- **[Sesión 2] Showcase**: `public/showcase.html` — página standalone con review de ambos productos.
- **[Sesión 2] Slugs limpios**: todos los `data/*.json` renombrados a slugs cortos (`nintendo-switch-oled`, `asus-vivobook-ultra`, etc.). Pipeline genera slugs limpios desde ahora (Marca+Modelo+Línea, max 60 chars). Opiniones destacadas vacías cuando `reviews_ml.total = 0`.

## 📋 Pendientes
1. ~~Scheduler 7am~~ ✅ hecho (inactivo hasta hostear)
2. **Migrar a Abacus AI** (API compatible OpenAI, modelo Claude/GPT) → arregla las **comillas
   textuales** que Flash todavía mete en el artículo (problema legal/IP). Requiere reescribir el
   body a formato OpenAI (messages + response_format json_schema).
3. ~~Fix "Convert to HTML"~~ ✅ hecho (Gemini emite HTML directo)
4. ~~Query de YouTube~~ ✅ hecho (query inteligente + filtro por marca)
5. **Hostear**: n8n en VPS/cloud (sacar de la laptop) + web en Vercel. Al hostear:
   - Activar Scheduler 7am
   - Cambiar Telegram Poll de polling a **webhook** (Telegram Trigger)

## 🔐 Secretos a ROTAR (quedaron expuestos en el chat de armado)
GitHub PAT · ML client_secret · YouTube API key · Gemini API key · Telegram bot token ·
n8n API key. Tras rotar, actualizar las variables de entorno `User` y reiniciar n8n.

---

## ⚙️ Cómo correr n8n localmente (con secretos en env)
```powershell
# (con los valores reales) carga las vars y arranca n8n:
'YOUTUBE_API_KEY','SUPADATA_API_KEY','ML_CLIENT_ID','ML_CLIENT_SECRET','TELEGRAM_BOT_TOKEN','TELEGRAM_CHAT_ID','GITHUB_TOKEN' | ForEach-Object { Set-Item "env:$_" ([Environment]::GetEnvironmentVariable($_,'User')) }
$env:N8N_BLOCK_ENV_ACCESS_IN_NODE='false'   # n8n necesita esto para leer $env en nodos
n8n start
```
Los workflows quedaron **inactivos** con crons de producción (Principal diario 8am, Poll 5 min).
Reactivar desde la UI cuando se use.
