# AfiliadosML — Estado del proyecto

> Pipeline automático de reviews de afiliados de Mercado Libre México:
> de un link de producto → genera una reseña editorial honesta (estilo Wirecutter/RTINGS)
> → la publica como JSON en este repo → una web Next.js la renderiza.

Última actualización: 2026-06-09 (sesión 6 — completada).

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
| Descubribilidad (Google, SEO en vivo) | 95 | 98 | 90 | **0 ← no hosteado** |
| Navegación / categorías / guías | 90 | 95 | 88 | **15** |
| Comparador de productos | 60 | 75 | 99 | **20** |
| Actualización / freshness | 80 | 90 | 85 | **0 ← reviews estáticos** |
| Contexto local MX | 10 | 5 | 0 | **100 ← ventaja única** |
| Velocidad de publicación | 40 | 20 | 30 | **99 ← < 10 min** |
| **Promedio del servicio** | **79** | **82** | **86** | **~40** |

**Conclusión:** el review individual ya está en 78. El servicio está en 40 porque no estamos hosteados y tenemos 3 productos activos. El hosting + 50 reviews nos lleva a ~75 sin tocar más código.

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

### ✅ Verificación UI antes de hostear (sesión 6)
- Build estático confirmado con los 3 artículos activos.
- La sección de base editorial ya no deja huecos visuales cuando solo hay un panel.
- La comparativa ML se oculta si no hay productos similares con permalink válido.

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

## 📋 Pendientes (en orden de prioridad)

### 1. 🚀 Hostear
- Web en **Vercel** (conectar repo GitHub → auto-deploy en cada push)
- n8n en **VPS** (Railway, Render, o DigitalOcean)
- Al hostear: activar Scheduler 7am + Recordatorios, cambiar crons:
  - Scheduler: `*/1 * * * *` → `0 7 * * *`
  - Recordatorios: `*/1 * * * *` → `0 */2 * * *`
  - Poll: cambiar de polling a Telegram webhook

### 2. 📈 Escalar a 50-100 reviews
- El pipeline ya está listo — solo agregar productos al Sheet
- Esto sube el servicio de ~40 a ~75 sin más cambios de código

### 3. 🔁 Automatizar reviews de alternativas
- Cuando un review sugiera alternativas claras (ej. Apple Watch SE/Ultra), agregarlas como candidatos a la cola del Sheet y generar review completo con el flujo normal.
- Mantener revisión manual del candidato para asegurar publicación disponible y link afiliado válido.

---

## ⚙️ Cómo correr n8n localmente

```powershell
'YOUTUBE_API_KEY','ML_CLIENT_ID','ML_CLIENT_SECRET','TELEGRAM_BOT_TOKEN','TELEGRAM_CHAT_ID','GITHUB_TOKEN','ABACUS_API_KEY' | ForEach-Object { Set-Item "env:$_" ([Environment]::GetEnvironmentVariable($_,'User')) }; $env:N8N_BLOCK_ENV_ACCESS_IN_NODE='false'; n8n start
```

Después de arrancar n8n, aplicar el workflow actualizado:
```powershell
python scripts/push-to-n8n.py
```

Workflows activos: **AfiliadosML** (principal) + **Telegram Poll** (2min).
Scheduler 7am y Recordatorios: **INACTIVOS** — activar al hostear.

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
