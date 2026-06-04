# AfiliadosML — Estado del proyecto

> Pipeline automático de reviews de afiliados de Mercado Libre México:
> de un link de producto → genera una reseña editorial honesta (estilo Wirecutter/RTINGS)
> → la publica como JSON en este repo → una web Next.js la renderiza.

Última actualización: 2026-06-04 (sesión 4 — completada).

---

## 🏗️ Arquitectura

```
Google Sheet "Reviews ML"
  ├── pestaña "timerrs" (gid 0)           -> tokens OAuth de Mercado Libre
  └── pestaña "articulos" (gid 1072849850) -> COLA de productos a procesar

n8n (local, http://localhost:5678) — 6 workflows:
  1. AfiliadosML                    (id iSQ59pcFepjqmBvC) — PIPELINE PRINCIPAL (activo)
  2. AfiliadosML - Telegram Poll    (id wsMIARaCQQISWJtv) — Poll cada 2min (activo)
  3. AfiliadosML - Error Handler    (id WNQIZP0Tu3hQGODn) — marca errores en Sheet
  4. AfiliadosML - Token Refresh    (id PhRg6OJo47YcvsDo) — refresca token ML (5h)
  5. AfiliadosML - Scheduler 7am    (id wG6XApFxO6SyCgIY) — cron 7:00 AM (INACTIVO — activar al hostear)
  6. AfiliadosML - Recordatorios    (id 7uVW6atEBK8fuoHV) — recordatorios cada 2h (INACTIVO — activar al hostear)

Telegram bot @catalogomx_bot
GitHub HitoFlores/AfiliadosML — n8n commitea data/{slug}.json
Web Next.js (App Router) — "Catalogo MX" — homepage dinámica + /reviews/[slug]
```

### Flujo completo desde celular
```
1. Scheduler 7am → bot manda "¿Qué artículo hoy?" (ForceReply)
   → Sheet: fila WAITING_LINK creada (o timestamp actualizado si ya existe)
2. Usuario responde con meli.la/xxx
3. Poll detecta link → "Verificando..." → resuelve social page → extrae MLM ID + nombre
   → Sheet: fila pasa a waiting_confirm
4. Bot: "Encontré: [Producto]. ¿Es correcto?" + botones teclado
5. Usuario: /articulo_correcto → fila pasa a pending
6. Pass 1 corre: encuentra mejor vendedor verde → Notify con link_sugerido + ForceReply
   → Sheet: fila pasa a waiting
7. Usuario va a ML Partners → genera link de afiliado → responde al bot
8. Poll detecta el link → estatus ready → dispara Pass 2
9. Pass 2: Abacus (Claude) genera review → commitea data/{slug}.json → "✅ Review publicada"
   → Sheet: fila pasa a done
```

### Estados de la columna `estatus`
```
waiting_link → (link recibido) → waiting_confirm → (/articulo_correcto) → pending
  → (Pass 1) → waiting → (referido recibido) → ready → (Pass 2) → done
                                                                  └→ error
```

### Recordatorios automáticos (Recordatorios workflow)
| Estado | Mensaje del bot |
|---|---|
| `waiting_link` | "👋 Ey, aún te estoy esperando! ¿Con qué artículo trabajamos hoy?" |
| `waiting_confirm` | "👋 Sigo esperando tu respuesta!" + botones /articulo_correcto |
| `waiting` | "👋 Sigo esperando el link de afiliado!" |

### Columnas de la pestaña "articulos"
`articulo` · `referido` · `idioma` (default es) · `estatus` · `link_sugerido` · `slug` · `procesado_en` · `error_msg`

---

## 🤖 Generación con Abacus AI (Claude)

- Modelo: **claude-sonnet-4-6** vía RouteLLM (`https://routellm.abacus.ai/v1`)
- Output: JSON estructurado con schema estricto → `articulo_html` en HTML limpio
- API key: `$env.ABACUS_API_KEY`
- Temperatura: 0.2, response_format json_schema (strict)

### YouTube
- Query: `[Marca] [Modelo/Línea] review análisis`, `order=relevance`
- Scoring: +2 si review/análisis/unboxing, -2 si gameplay/teardown/asmr
- Detecta modelos similares → lo menciona en metodología y artículo

### Artículos publicados (en GitHub + web)
| Slug | Producto | Score |
|---|---|---|
| `nintendo-switch-oled` | Nintendo Switch OLED Neón 64GB | 8.0 |
| `asus-vivobook-ultra` | ASUS VivoBook 16 Ultra 5 | 7.1 |
| `bose-ultra-quietcomfort` | Bose QC Ultra 2a Gen Reacondicionado | 7.0 |
| `nintendo-switch-2` | Nintendo Switch 2 | — (YT falló, sin videos) |
| `delonghi-de-mexico-specialista-touch` | Cafetera De'Longhi La Specialista Touch EC9445M | 8.2 |

---

## 🌐 Web (Next.js) — "Catalogo MX"

- **Branding**: "Catalogo MX" con logo propio (public/logo.png, fondo transparente)
- **Header**: dark zinc-950, logo + nav minimal (Reviews · Open source ↗)
- **Homepage**: hero editorial + artículo destacado (mayor score) + grid del resto
- **Trust bar**: 3 pilares editoriales al pie (fuentes, sin notas infladas, metodología)
- **Footer**: dark, disclosure de afiliado
- `/reviews` → redirige a `/#reviews` (ya no da 404)
- Correr local: `npm run dev` → http://localhost:3000

---

## ✅ Hecho en sesión 4

- **Migración a Abacus AI completada**: Gemini reemplazado por Claude (claude-sonnet-4-6 vía RouteLLM)
- **FAQ dinámica**: nodo `Get ML Questions` + campo `faq` en schema + componente `FAQSection`
- **Análisis precio-valor**: campo `precio_valor` en schema + bloque "¿Vale la pena?" en price box
- **YouTube bilingüe**: quitado `relevanceLanguage=es` → acepta videos en inglés (Linus, MKBHD, etc.)
- **Alternativas editoriales**: campo `alternativas` en schema + componente `AlternativasSection`
- **Comparativa real de ML**: `Build Final JSON` guarda `productos_similares_ml` (datos crudos de `Get Similar Products`) → componente `ComparativaML` muestra tabla con thumbnail, título, precio y enlace real
- **ABACUS_API_KEY** agregada a env vars

---

## ✅ Hecho en sesión 3

- **Secretos rotados**: GitHub PAT · ML client_secret · YouTube · Gemini · Telegram · Supadata
- **GitHub CLI**: autenticado con token separado `claude-cli` (repo + workflow + read:org)
- **Workflow Recordatorios** (nuevo): bot castroso que insiste por estado — waiting_link / waiting_confirm / waiting
- **Scheduler inteligente**: no dispara si hay artículo activo (cualquier estado != done/error/waiting_link)
- **waiting_confirm**: nuevo estado entre "link recibido" y "/articulo_correcto" — evita recordatorios incorrectos
- **row_number en staticData**: se guarda cuando se confirma el producto para actualizar la fila correcta
- **Confirmación con botones**: /articulo_correcto y /articulo_incorrecto como botones de teclado (sin problema del _)
- **Gemini key**: movida de hardcodeada a `$env.GEMINI_API_KEY`
- **Fix BOM**: bose y nintendo-switch-2 JSON tenían UTF-8 BOM que rompía JSON.parse en Next.js
- **Review generada**: De'Longhi La Specialista Touch EC9445M — score 8.2 ✅
- **Rebrand**: AfiliadosML → Catalogo MX
- **Homepage rediseñada**: hero editorial + featured card + grid + trust bar
- **Logo**: ícono custom con fondo transparente (flood fill para preservar ojos)
- **Fix /reviews 404**: redirige a /#reviews

---

## 📋 Pendientes (en orden de prioridad)

### 1. 🚀 Hostear
- n8n en VPS/cloud (Railway, Render, o VPS DigitalOcean)
- Web en Vercel (conectar repo GitHub → auto-deploy en cada push)
- **Al hostear**: activar Scheduler 7am + Recordatorios (cambiar crons de */1 a producción)
  - Scheduler: `*/1 * * * *` → `0 7 * * *`
  - Recordatorios: `*/1 * * * *` → `0 */2 * * *`
  - Poll: cambiar de polling a Telegram webhook

---

## ⚙️ Cómo correr n8n localmente

```powershell
'YOUTUBE_API_KEY','SUPADATA_API_KEY','ML_CLIENT_ID','ML_CLIENT_SECRET','TELEGRAM_BOT_TOKEN','TELEGRAM_CHAT_ID','GITHUB_TOKEN','ABACUS_API_KEY' | ForEach-Object { Set-Item "env:$_" ([Environment]::GetEnvironmentVariable($_,'User')) }; $env:N8N_BLOCK_ENV_ACCESS_IN_NODE='false'; n8n start
```

Workflows activos al cerrar sesión 3: **AfiliadosML** (principal) + **Telegram Poll** (2min).
Scheduler 7am y Recordatorios: **INACTIVOS** — activar manualmente cuando se use localmente.

---

## 🔑 Variables de entorno requeridas (User scope en Windows)
```
YOUTUBE_API_KEY      → YouTube Data API v3
SUPADATA_API_KEY     → transcripciones de videos
ML_CLIENT_ID         → Mercado Libre OAuth client id
ML_CLIENT_SECRET     → Mercado Libre OAuth client secret
TELEGRAM_BOT_TOKEN   → @catalogomx_bot token
TELEGRAM_CHAT_ID     → tu chat ID de Telegram
GITHUB_TOKEN         → PAT "n8n-afiliadosml" (repo)
ABACUS_API_KEY       → Abacus AI RouteLLM (Claude)
```

GitHub CLI autenticado con token separado `claude-cli` (repo + workflow + read:org).
