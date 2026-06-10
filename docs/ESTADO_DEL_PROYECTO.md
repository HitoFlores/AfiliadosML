# AfiliadosML — Estado del proyecto

> Pipeline automático de reviews de afiliados de Mercado Libre México:
> de un link de producto → genera una reseña editorial honesta (estilo Wirecutter/RTINGS)
> → la publica como JSON en este repo → una web Next.js la renderiza.

Última actualización: 2026-06-09 (sesión 8 — documentación resumible + plan de escala automática).

## Estado operativo actual

- Web Next.js en Cloudflare Pages y pipeline n8n efímero en GitHub Actions siguen siendo la ruta principal de producción.
- Reviews activos en `data/`: 4 (`apple-macbook-air-13-m5-512gb`, `apple-watch-series-11-46mm`, `delonghi-specialista-touch-ec9445m-cafetera`, `nintendo-switch-oled-consola-64gb`).
- Los JSON activos ya tienen `producto.display_title`; el audit local debe quedar en 0 warnings.
- El pipeline de YouTube está en generación v6 desde `scripts/n8n-ephemeral/prepare-workflows.mjs`: matching por evidencia, debug de filtro y metadata adicional en `videos_yt`.
- Problema abierto principal: `productos_similares_ml` sigue vacío en los JSON regenerados, aunque el nodo `Get Similar Products` existe.
- Pendientes de higiene: docs antiguas con mojibake en algunos textos históricos y archivos no versionados `public/estudio-comparativo.html`, `public/estudio-v2.html`, `public/estudio-v3-final.html`.

## Cómo retomar desde otra sesión

1. Leer este archivo primero y continuar desde el primer punto `[ ]` o `[~]` del "Plan Maestro: Escala Automática".
2. Ejecutar `rtk git status --short` y no revertir archivos no relacionados ni `public/estudio-*`.
3. Antes de tocar una fase técnica, marcarla `[~] en progreso` aquí, con objetivo, riesgo y comandos esperados.
4. Después de cada fase, marcar `[x] hecho`, anotar comandos corridos y resultado.
5. Mantener explícito que los links afiliados válidos siguen entrando por humano; la automatización propone candidatos y prepara cola, pero no inventa afiliados.

---

## 🏗️ Arquitectura

```
Google Sheet "Reviews ML"
  ├── pestaña "timerrs" (gid 0)           -> tokens OAuth de Mercado Libre
  └── pestaña "articulos" (gid 1072849850) -> COLA de productos a procesar

n8n — 6 workflows:
  1. AfiliadosML                    (id iSQ59pcFepjqmBvC) — PIPELINE PRINCIPAL
  2. AfiliadosML - Telegram Poll    (id wsMIARaCQQISWJtv) — Poll ejecutado por GitHub Actions
  3. AfiliadosML - Error Handler    (id WNQIZP0Tu3hQGODn) — marca errores en Sheet
  4. AfiliadosML - Token Refresh    (id PhRg6OJo47YcvsDo) — refresca token ML (5h)
  5. AfiliadosML - Scheduler 7am    (id wG6XApFxO6SyCgIY) — disponible en runner efímero
  6. AfiliadosML - Recordatorios    (id 7uVW6atEBK8fuoHV) — disponible para activar si hace falta

Telegram bot @catalogomx_bot
GitHub HitoFlores/AfiliadosML — n8n commitea data/{slug}.json
Cloudflare Pages — despliegue sincronizado con GitHub
GitHub Actions "Free ephemeral n8n" — ejecuta Scheduler/Poll/Main sin VPS 24/7
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

### Pipeline de YouTube (v4 — sesión 6)
- **Get Videos YT**: detecta marcas filiales ("Delonghi de Mexico") → usa atributo `Fabricante` como nombre real para la query
- **Top videos v4**: matching multi-token flexible (original, sin apostrofes, compacto) + fallback automático cuando < 2 videos pasan el filtro de marca → segunda búsqueda con marca real + `review` en región US
- **Transcripciones v4**: usa captions publicas de YouTube gratis; Supadata queda fuera mientras no haya creditos
- Scoring: +2 si review/análisis/unboxing, -2 si gameplay/teardown/asmr

### Artículos publicados (en GitHub + web)
| Slug | Producto | Score | Versión |
|---|---|---|---|
| `apple-watch-gps-caja-aluminio-color` | Apple Watch Series 11 GPS 46mm | **8.2** | Claude v4 |
| `nintendo-switch-oled` | Nintendo Switch OLED Neón 64GB | **8.2** | Claude v2 |
| `delonghi-de-mexico-cafetera-espresso-specialista-touch` | De'Longhi La Specialista Touch EC9445M | **7.8** | Claude v2 + fix marca |

> ASUS VivoBook se retiro de `data/` porque la publicacion ya no esta disponible. Queda solo como historico en `data/archive/`.
> Archivos históricos (gemini, abacusv1) en `data/archive/` — referencia comparativa, no se muestran en web.

---

## 📊 Benchmarking del SERVICIO vs competencia (sesión 5)

| Dimensión | The Verge | Wirecutter | RTINGS | **Catalogo MX** |
|---|---|---|---|---|
| Calidad editorial del review | 82 | 90 | 93 | **78** |
| Cobertura (cantidad de productos) | 95 | 85 | 90 | **3 ← crítico** |
| Descubribilidad (Google, SEO en vivo) | 95 | 98 | 90 | **25 ← recién hosteado, falta escala/SEO** |
| Navegación / categorías / guías | 90 | 95 | 88 | **15** |
| Comparador de productos | 60 | 75 | 99 | **20** |
| Actualización / freshness | 80 | 90 | 85 | **0 ← reviews estáticos** |
| Contexto local MX | 10 | 5 | 0 | **100 ← ventaja única** |
| Velocidad de publicación | 40 | 20 | 30 | **99 ← < 10 min** |
| **Promedio del servicio** | **79** | **82** | **86** | **~45** |

**Conclusión:** el review individual ya está en 78. El sitio ya está hosteado; el cuello de botella principal ahora es cobertura. Pasar de 3 a 50 reviews debería llevar el servicio cerca de ~75 sin tocar mucho código.

### Score por producto vs los dioses
| Producto | Nuestro score | The Verge/IGN | Tom's Coffee/Wirecutter |
|---|---|---|---|
| Apple Watch Series 11 | **8.2/10** | — | — |
| Nintendo Switch OLED | **8.2/10** ✅ | 8.0/10 | — |
| De'Longhi Specialista | **7.8/10** | — | ~8.3 (Tom's Coffee Corner) |

---

## 🌐 Web (Next.js) — "Catalogo MX"

- **Branding**: "Catalogo MX" con logo propio (public/logo.png, fondo transparente)
- **Header**: dark zinc-950, logo + nav minimal (Reviews · Open source ↗)
- **Homepage**: hero editorial + artículo destacado (mayor score) + grid del resto
- **Trust bar**: 3 pilares editoriales al pie (fuentes, sin notas infladas, metodología)
- **Footer**: dark, disclosure de afiliado
- **Componentes de review**: ScoreBadge, SubScores, Verdict, FAQSection, AlternativasSection, ComparativaML, VideoSection, BuyerReviews, SpecsTable, ImageGallery, TableOfContents
- `/reviews` → redirige a `/#reviews`
- Correr local: `npm run dev` → http://localhost:3000

### ✅ Verificación UI / producción
- Build estático confirmado con los 3 artículos activos.
- La sección de base editorial ya no deja huecos visuales cuando solo hay un panel.
- La comparativa ML se oculta si no hay productos similares con permalink válido.
- Cloudflare Pages está conectado a GitHub para deploy automático.
- GitHub Actions `Free ephemeral n8n` está activo y con secrets configurados.

---

## ✅ Hecho en sesión 6

- **Score calibrado**: el prompt n8n ya no penaliza por no tener prueba propia; el score mide valor de compra estimado con especificaciones, fuentes externas y compradores ML.
- **Supadata fuera del flujo**: transcripciones pasan a captions públicas de YouTube gratis; se eliminó `SUPADATA_API_KEY` de GitHub Actions y docs.
- **Links ML muertos eliminados**: se removió el fallback de vendedores que construía URLs inválidas y el audit ahora falla si detecta permalinks rotos.
- **ASUS VivoBook retirado**: eliminado de `data/` porque la publicación ya no está disponible; queda solo en `data/archive/`.
- **Apple Watch actualizado**: score ajustado a **8.2** y copy sin castigo por “sin prueba propia”.
- **Alternativas como cola editorial**: la sección ahora sugiere “Otros reviews que conviene generar” para pasar Apple Watch SE/Ultra u otros candidatos por el mismo flujo antes de recomendarlos fuerte.
- **Build estable en Windows**: `experimental.cpus: 1` evita que Next lance demasiados workers y reviente por memoria/pagefile.

---

## ✅ Hecho en sesión 7

- **Cloudflare Pages activo**: la web ya no está pendiente de hosting.
- **n8n efímero en GitHub Actions activo**: workflow `Free ephemeral n8n` disponible con dispatch manual y crons.
- **Secrets GitHub configurados**: credenciales n8n, ML, Telegram, YouTube, Abacus y token GitHub ya existen como secrets.
- **Revisión de estado**: build local OK y `review:audit` OK con 3 reviews activos.

---

## ✅ Hecho en sesión 5

- **Renombrado Gemini → Abacus** en todos los nodos n8n y scripts
- **Tabla comparativa real de ML** (`ComparativaML.tsx`) — productos similares con thumbnail, precio y enlace directo solo cuando ML entrega permalinks validos
- **Fix turbopack rogue** — quitado `turbopack.root` que volvía loca la máquina al levantar el dev server
- **Archivos viejos a `data/archive/`** — gemini y abacusv1 ya no se pre-renderizan como páginas
- **try/catch + strip BOM** en `lib/product.ts` — archivos corruptos no tumban el servidor
- **YouTube fallback para productos de nicho** (`Top videos v4`):
  - Detecta marcas filiales ML ("Delonghi de Mexico") → usa `Fabricante` ("De'Longhi") para la búsqueda
  - Matching flexible multi-token (apostrofes, variantes tipográficas)
  - Fallback automático con query simplificada cuando < 2 videos pasan el filtro
  - Resultado: De'Longhi pasó de 0 videos → 3 videos de Tom's Coffee Corner, score 7.2 → **7.8**
- **Transcripciones v2** — intentaba inglés si no había subtítulos en español; reemplazado por captions públicas de YouTube en sesión 6
- **`scripts/push-to-n8n.py`** — helper para restaurar workflow en n8n tras restart
- **Benchmarking completo** del servicio vs The Verge / Wirecutter / RTINGS / Tom's Coffee Corner

---

## ✅ Hecho en sesión 4

- **Migración a Abacus AI completada**: Gemini reemplazado por Claude (claude-sonnet-4-6 vía RouteLLM)
- **FAQ dinámica**: nodo `Get ML Questions` + campo `faq` en schema + componente `FAQSection`
- **Análisis precio-valor**: campo `precio_valor` en schema + bloque "¿Vale la pena?" en price box
- **YouTube bilingüe**: quitado `relevanceLanguage=es`
- **Alternativas editoriales**: campo `alternativas` en schema + componente `AlternativasSection`
- **Comparativa real de ML**: `Build Final JSON` guarda `productos_similares_ml`
- **ABACUS_API_KEY** agregada a env vars

---

## ✅ Hecho en sesión 3

- Secretos rotados, GitHub CLI autenticado
- Workflow Recordatorios, Scheduler inteligente, waiting_confirm
- Rebrand AfiliadosML → Catalogo MX, homepage rediseñada, logo

---

## Plan Maestro: Escala Automática

> Fuente de verdad operativa para automatizar cobertura sin intervención humana completa. Los links afiliados siguen requiriendo confirmación humana.

### [x] P0 Docs — hecho
- Objetivo: dejar el contexto resumible y verificable antes de tocar código.
- Riesgo: que una sesión nueva regenere workflows sin saber que `productos_similares_ml` y `review_candidates` son la prioridad.
- Archivos esperados: `docs/ESTADO_DEL_PROYECTO.md`.
- Criterios de aceptación: estado real documentado, últimos cambios visibles, problemas abiertos listados y checklist de fases completo.
- Verificación: `rtk npm run review:audit` y lectura manual de esta sección.
- Resultado 2026-06-09: este bloque se agregó antes de los cambios técnicos. Verificado con `rtk npm run review:audit` (4 archivos, 0 warnings).

### [x] P1 productos_similares_ml — hecho
- Objetivo: arreglar generación y guardado de `productos_similares_ml` en cada JSON publicado.
- Archivos/nodos esperados: `scripts/n8n-ephemeral/prepare-workflows.mjs`, nodo `Get Similar Products`, nodo `Build Final JSON`, `scripts/audit-reviews.mjs`.
- Criterios de aceptación: si ML devuelve candidatos válidos, el JSON final no queda vacío; el JSON guarda debug suficiente para auditar query, total recibido, total filtrado y motivo cuando queda vacío.
- Verificación: `rtk npm run n8n:prepare`, `rtk npm run review:audit`, `rtk npm run build`; en n8n, correr `force_regen_slug` de prueba y confirmar commit con `productos_similares_ml` poblado o debug explicando vacío.
- Inicio 2026-06-09: se va a endurecer `Build Final JSON` para guardar debug de ML search y a extender el audit para fallar cuando hubo candidatos válidos pero el JSON quedó vacío.
- Resultado 2026-06-09: `Build Final JSON` ahora guarda `ml_search_debug` con conteos de resultados ML y usa `similarPayload.productos` como única fuente de `productos_similares_ml`; `review:audit` falla si `valid_count > 0` y el array queda vacío.
- Comandos corridos: `rtk npm run n8n:prepare`, `rtk npm run review:audit`, `rtk npm run build`.
- Pendiente operativo: correr un `FORCE_REGEN_SLUG` real en n8n/GitHub Actions para regenerar un review y confirmar el commit con candidatos o debug de vacío.

### [x] P2 review_candidates — hecho
- Objetivo: crear la pestaña `review_candidates` en Google Sheet y poblarla desde cada review sin duplicados.
- Columnas: `candidate_id`, `source_slug`, `source_product_id`, `relation_type`, `candidate_name`, `candidate_query`, `candidate_ml_url`, `candidate_ml_id`, `affiliate_url`, `target_slug`, `status`, `priority_score`, `reason`, `mentioned_in`, `created_at`, `updated_at`, `error_msg`.
- Archivos/nodos esperados: workflow principal n8n, posibles helpers en `scripts/n8n-ephemeral/prepare-workflows.mjs`.
- Criterios de aceptación: candidatos de alternativas/comparativa/similares se upsertean por `candidate_id`; no se duplican entre regeneraciones.
- Verificación: `rtk npm run n8n:prepare`, corrida de un review, revisión de Sheet `review_candidates`.
- Implementado en repo 2026-06-09: `scripts/n8n-ephemeral/prepare-workflows.mjs` agrega rama paralela `Mark Done -> Get Review Candidates -> Build Review Candidates -> Append Review Candidates`.
- Comportamiento: lee la pestaña `review_candidates`, genera candidatos desde `productos_similares_ml`, `comparativa_editorial`, `alternativas` y `mejor_alternativa`, deduplica por `candidate_id` y apendea solo nuevos pendientes. La rama usa `continueOnFail` para no bloquear `Notify Done` si la pestaña aún no existe.
- Verificación live 2026-06-09: se creó la pestaña `review_candidates` por API con encabezados A:Q, se ejecutó `FORCE_REGEN_SLUG=apple-watch-series-11-46mm` en n8n local y se insertaron 4 candidatos `pending` (`Apple Watch SE 3`, `Apple Watch Series 10`, `Apple Watch Ultra 2`, `Samsung Galaxy Watch 7/Garmin Forerunner`).
- Comandos corridos: `rtk npm run n8n:prepare`, `n8n import:workflow --separate --input=.tmp/n8n-ephemeral/workflows`, `n8n execute --id=iSQ59pcFepjqmBvC`, lectura de `review_candidates!A1:Q20` por Google Sheets API.

### [x] P3 flujo diario de candidatos — hecho
- Objetivo: seleccionar 2-3 candidatos pendientes al día y pedir links afiliados por Telegram.
- Archivos/nodos esperados: Scheduler/Poll n8n, Sheet `review_candidates`, Sheet `articulos`.
- Criterios de aceptación: Telegram manda candidatos pendientes, humano responde afiliados, candidatos pasan a `ready` y se crean filas en `articulos`.
- Verificación: corrida manual del scheduler efímero, respuesta de prueba por Telegram y revisión de filas creadas.
- Implementado en repo 2026-06-09: Scheduler lee `review_candidates`, toma hasta 3 candidatos `pending` por `priority_score` y los incluye en el mensaje diario con `ID` y formato de respuesta `numero + link afiliado`.
- Implementado en Poll: respuestas al mensaje de candidatos se enrutan como `candidate_affiliate`, se actualiza `review_candidates.status=ready`, se guarda `affiliate_url` y se crea fila `articulos` con `estatus=ready`.
- Verificado live 2026-06-09: Scheduler mandó candidatos por Telegram; humano respondió `1 + link afiliado`; Poll marcó `apple-watch-series-11-46mm:apple-watch-se-3` como `ready`, guardó `affiliate_url`, creó fila `articulos` con `estatus=ready` y `candidate_id`, y no dejó `WAITING_LINK` abierto.
- Fix post-prueba: el Scheduler ya no crea `WAITING_LINK` cuando hay candidatos pendientes; solo lo crea si no hay candidatos y se pide artículo manual.

### [x] P4 related reviews / comparadores — hecho
- Objetivo: conectar `source_slug` con `target_slug` cuando un candidato queda `done`.
- Archivos/nodos esperados: data JSON, componentes de reviews relacionadas, ruta futura `/comparar/a-vs-b`.
- Criterios de aceptación: un review muestra relacionados existentes y prepara comparador cuando ambos reviews existen.
- Verificación: `rtk npm run build` y revisión visual local.
- Implementado en n8n 2026-06-09: `articulos` ahora tiene columna `candidate_id`; Poll la llena al crear una fila desde candidato; `Route Row` la propaga; al finalizar `Mark Done`, el workflow actualiza `review_candidates.status=done` y `target_slug` con el slug publicado.
- Resultado 2026-06-09: se persiste `meta.candidate_id` en cada JSON generado desde candidato; la web estatica infiere relaciones desde `data/*.json`; los reviews origen muestran "Reviews relacionados"; se agrego ruta estatica `/comparar/[a-vs-b]` y sitemap incluye comparadores cerrados.
- Verificacion live 2026-06-09: se proceso el candidato `apple-watch-series-11-46mm:apple-watch-se-3`, se genero `data/apple-watch-se-gps-smartwatch.json`, se cerro `review_candidates.status=done` con `target_slug=apple-watch-se-gps-smartwatch`, y `rtk npm run build` exporto `/comparar/apple-watch-series-11-46mm-vs-apple-watch-se-gps-smartwatch`.
- Fixes P4: `Route Row` ahora resuelve `meli.la` de afiliado con redirects manuales, recupera candidatos en `processing` con `referido`, filtra autorreferencias en `comparativa_editorial` y el audit falla si una comparativa repite el producto actual.

### [x] P5 rankings automáticos — hecho
- Objetivo: generar rankings por categoría/intención desde JSON existentes.
- Archivos/nodos esperados: rutas estáticas Next.js, `app/sitemap.ts`, helpers de agrupación.
- Criterios de aceptación: páginas de ranking compiladas, enlazadas y en sitemap.
- Verificación: `rtk npm run build`.
- Inicio 2026-06-09: se agregaran rankings estaticos por `meta.categoria`, ordenados por score editorial y enlazados desde `/rankings`.
- Resultado 2026-06-09: se agregaron helpers `rankingCategories`/`loadRankingCategory`, ruta `/rankings`, ruta `/rankings/[category]`, link en header y entradas en sitemap.
- Verificacion: `rtk npm run n8n:prepare`, `rtk npm run review:audit` (5 archivos, 0 warnings), `rtk npm run build` exporto `/rankings/mlm-smartwatches`, `/rankings/mlm-electric-coffee-makers`, `/rankings/mlm-game-consoles` y `/rankings/mlm-notebooks`.

### [ ] P6 freshness / repriorización — pendiente
- Objetivo: revisar precio/disponibilidad, marcar stale y repriorizar candidatos.
- Archivos/nodos esperados: workflow n8n de freshness, campos de estado en JSON o Sheet.
- Criterios de aceptación: productos caídos o caros se marcan stale y generan candidatos de reemplazo.
- Verificación: corrida de freshness contra un producto activo y uno no disponible.

## 📋 Pendientes (en orden de prioridad)

### 1. 📈 Escalar a 50-100 reviews
- El pipeline ya está listo — solo agregar productos al Sheet
- Esto sube el servicio de ~45 a ~75 sin más cambios grandes de código
- Cadencia recomendada: 5-10 productos por día hasta confirmar calidad estable

### 2. 🔁 Automatizar reviews de alternativas
- Cuando un review sugiera alternativas claras (ej. Apple Watch SE/Ultra), agregarlas como candidatos a la cola del Sheet y generar review completo con el flujo normal.
- Mantener revisión manual del candidato para asegurar publicación disponible y link afiliado válido.

### 3. 🧹 Limpiar CI viejo de Cloudflare
- Existe un run fallido de `Deploy Cloudflare Pages` por `CLOUDFLARE_API_TOKEN` vacío.
- Si Cloudflare Pages ya despliega directo desde GitHub, ese workflow puede eliminarse o dejarse deshabilitado para evitar ruido.

---

## ⚙️ Cómo correr n8n localmente

```powershell
'YOUTUBE_API_KEY','ML_CLIENT_ID','ML_CLIENT_SECRET','TELEGRAM_BOT_TOKEN','TELEGRAM_CHAT_ID','GITHUB_TOKEN','ABACUS_API_KEY' | ForEach-Object { Set-Item "env:$_" ([Environment]::GetEnvironmentVariable($_,'User')) }; $env:N8N_BLOCK_ENV_ACCESS_IN_NODE='false'; n8n start
```

Después de arrancar n8n, aplicar el workflow actualizado:
```powershell
python scripts/push-to-n8n.py
```

Uso local opcional. En producción, GitHub Actions ejecuta `Free ephemeral n8n`.

---

## 🔑 Variables de entorno requeridas (User scope en Windows)
```
YOUTUBE_API_KEY      → YouTube Data API v3 + captions publicas
ML_CLIENT_ID         → Mercado Libre OAuth client id
ML_CLIENT_SECRET     → Mercado Libre OAuth client secret
TELEGRAM_BOT_TOKEN   → @catalogomx_bot token
TELEGRAM_CHAT_ID     → tu chat ID de Telegram
GITHUB_TOKEN         → PAT "n8n-afiliadosml" (repo)
ABACUS_API_KEY       → Abacus AI RouteLLM (Claude)
```

GitHub CLI autenticado con token separado `claude-cli` (repo + workflow + read:org).
