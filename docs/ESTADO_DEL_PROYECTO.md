# AfiliadosML - Estado del proyecto

Ultima actualizacion: 2026-06-13.

Proyecto: pipeline automatico de reviews editoriales para productos de Mercado Libre Mexico. Un humano sigue aportando links afiliados; el sistema automatiza descubrimiento, cola, generacion, publicacion, relaciones, rankings y freshness.

## Estado Actual

- Web: Next.js export estatico en Cloudflare Pages. El deploy ocurre por push a GitHub; no se usa un workflow Cloudflare propio.
- Automatizacion: GitHub Actions `Free ephemeral n8n` levanta n8n efimero, importa credenciales/workflows, corre Scheduler/Poll/Freshness/Main y termina.
- Reviews activos en `data/`: 9.
  - `apple-macbook-air-13-m5-512gb`
  - `apple-macbook-pro-m5-16gb-14`
  - `apple-watch-se-gps-smartwatch`
  - `apple-watch-series-11-46mm`
  - `delonghi-specialista-touch-ec9445m-cafetera`
  - `espresso-machine-longhi-eletta-explore`
  - `nintendo-switch-lite-32gb`
  - `nintendo-switch-oled-consola-64gb`
  - `samsung-galaxy-watch7-44mm-reloj`
- Audit local: `rtk npm run review:audit` debe quedar en 0 warnings.
- Build local: `rtk npm run build` debe exportar reviews, rankings y comparadores.
- Archivos de estudio viejos: movidos a `public/archive/`.
- CI viejo de Cloudflare: no existe en `.github/workflows`; el unico workflow versionado es `free-ephemeral-n8n.yml`.
- Candidatos futuros: se normalizan por modelo limpio y se deduplican por clave canonica, conservando tokens de modelo como `M2`, `M3` y `SE`.
- Cleanup de candidatos ya ejecutado: respaldo `review_candidates_backup_20260613043736`; descartes finales filas `3, 5, 7, 9, 13, 15`; restore correctivo filas `12, 16`.
- Ultima prueba manual 2026-06-13: Scheduler mando 3 candidatos, Poll acepto 3 links y Main publico `apple-macbook-pro-m5-16gb-14`, `espresso-machine-longhi-eletta-explore` y `nintendo-switch-lite-32gb`.
- Fixes operativos 2026-06-13:
  - Scheduler ya no queda bloqueado por `WAITING_LINK` viejo ni por filas `processing` vacias en `articulos`.
  - Poll ya no manda `Candidato listo... undefined`; toma `candidate_name` desde `Filter Candidate Queue Adds`.
  - YouTube stats limita IDs a 50 para evitar HTTP 400 en `videos`.
  - Slug/display title de Switch normaliza casos raros de ML como `LiteSwitch` a `nintendo-switch-lite-32gb` / `Nintendo Switch Lite 32GB`.

## Arquitectura

Google Sheet "Reviews ML":
- `timerrs` / gid 0: tokens OAuth de Mercado Libre.
- `articulos` / gid 1072849850: cola de productos a procesar.
- `review_candidates`: candidatos sugeridos por reviews ya publicados.

n8n workflows:
- `AfiliadosML` (`iSQ59pcFepjqmBvC`): pipeline principal.
- `AfiliadosML - Telegram Poll` (`wsMIARaCQQISWJtv`): lee respuestas de Telegram.
- `AfiliadosML - Scheduler 7am` (`wG6XApFxO6SyCgIY`): manda candidatos diarios. El nombre es historico; GitHub Actions lo ejecuta cerca de las 9am.
- `AfiliadosML - Error Handler` (`WNQIZP0Tu3hQGODn`): marca errores en Sheet.
- `AfiliadosML - Token Refresh` (`PhRg6OJo47YcvsDo`): refresca token ML.
- `AfiliadosML - Recordatorios` (`7uVW6atEBK8fuoHV`): recordatorios opcionales.
- `AfiliadosML - Freshness` (`freshnessAfML2026`): generado por `scripts/n8n-ephemeral/prepare-workflows.mjs`.
- `AfiliadosML - Candidate Backfill` (`candidateBackfillAfML2026`): backfill manual de candidatos desde reviews publicados.
- `AfiliadosML - Candidate Cleanup` (`candidateCleanupAfML2026`): cleanup manual con respaldo de candidatos `pending` problematicos.
- `AfiliadosML - Candidate Restore` (`candidateRestoreAfML2026`): restore manual de filas especificas descartadas por cleanup.

GitHub:
- Repo: `HitoFlores/AfiliadosML`.
- n8n commitea `data/{slug}.json`.
- Cloudflare Pages despliega automaticamente al recibir push en GitHub.

## Flujo Operativo

1. Sheet Schema asegura headers y reconcilia candidatos activos contra `data/*.json`; si encuentra un review ya publicado, marca el candidato `done`, llena `target_slug` y avisa por Telegram.
2. Scheduler diario lee `review_candidates`.
3. Si hay candidatos `pending`, manda maximo 3 por Telegram priorizando `candidate_tier`: `superior`, `economico`, `similar`, `unknown`; dentro de cada tier ordena por `priority_score` e intenta mezclar hasta 3 `source_slug` distintos antes de rellenar con la misma fuente.
4. Humano responde con una linea por candidato: `1 - https://meli.la/...` para aprobar o `1 - descartar` para eliminarlo.
5. Poll resuelve los numeros contra el snapshot estable del Scheduler. Links validos marcan el candidato `ready`, guardan `affiliate_url` y crean fila `articulos` con `candidate_id`; descartes marcan `discarded` sin crear fila.
6. Main toma filas `ready`/`pending`, genera review, commitea JSON y marca la fila `done`.
7. Si venia de candidato, marca `review_candidates.status=done`, llena `target_slug` y avisa por Telegram. Si `candidate_id` se perdio en `articulos`, intenta cerrar el candidato por link afiliado, producto ML o nombre.
8. Web muestra reviews relacionados, comparadores y rankings.
9. Freshness diario revisa precios/disponibilidad y sube prioridad de candidatos si un origen queda stale.

## Campos Importantes

`articulos`:
`articulo`, `referido`, `idioma`, `estatus`, `link_sugerido`, `slug`, `procesado_en`, `error_msg`, `candidate_id`

Estados principales:
`waiting_link -> waiting_confirm -> pending -> waiting -> ready -> done`

`review_candidates`:
`candidate_id`, `source_slug`, `source_product_id`, `relation_type`, `candidate_tier`, `candidate_name`, `candidate_query`, `candidate_ml_url`, `candidate_ml_id`, `affiliate_url`, `target_slug`, `status`, `priority_score`, `reason`, `mentioned_in`, `shown_batch_id`, `shown_index`, `shown_at`, `created_at`, `updated_at`, `error_msg`

Sheet Schema asegura automaticamente los headers requeridos en Google Sheets antes del ciclo. Esto incluye `candidate_tier`, `shown_batch_id`, `shown_index` y `shown_at`. Tambien reconcilia candidatos `pending`, `ready` o `processing` contra reviews ya publicados por `candidate_id`, `target_slug`, producto ML o nombre normalizado.

Candidate Backfill es un workflow temporal/manual (`run_candidate_backfill=true`) para poblar `review_candidates` desde reviews viejos en `data/*.json` que no sembraron candidatos al publicarse. Genera candidatos desde `editorial.comparativa_editorial`, `editorial.mejor_alternativa`, `editorial.alternativas` con titulo real y `productos_similares_ml` si existen; deduplica contra la hoja y contra reviews ya publicados; descarta nombres vacios, genericos o `Sin candidato real confiable identificado en ML`.

Normalizacion de candidatos: antes de crear o limpiar filas se eliminan sufijos comerciales (`oferta`, `descuento`, `similar`, `segunda mano`, `reacondicionado`) sin perder senales de modelo. La clave canonica conserva tokens cortos relevantes como `M2`, `M3` y `SE`, y se usa para deduplicar nombres equivalentes sin confundir modelos distintos.

Slug/display title editorial: `Build Final JSON` genera slugs desde familia comercial y specs distintivas, no desde todo el titulo ML. Casos especiales cubiertos: Apple Watch (`apple-watch-series-11-46mm`), Nintendo Switch (`nintendo-switch-lite-32gb` / `nintendo-switch-oled-64gb`) y DeLonghi (`delonghi`). Esto evita duplicados raros de Mercado Libre como `LiteSwitch`.

Candidate Cleanup es manual (`run_candidate_cleanup=true`). Crea una pestana `review_candidates_backup_<timestamp>` antes de tocar datos, descarta solo filas `pending` problematicas y no cambia `ready`, `done`, `processing` ni `discarded`. La ejecucion correctiva registrada dejo backup `review_candidates_backup_20260613043736`, descartes finales filas `3, 5, 7, 9, 13, 15`, y reabrio filas `12, 16` con Candidate Restore.

Candidate Restore es manual (`restore_candidate_rows=12,16` o filas equivalentes). Reabre filas especificas que cleanup marco como `discarded` y las regresa a `pending` cuando el descarte fue un falso positivo.

## Plan Maestro: Escala Automatica

### [x] P0 Docs

Contexto operativo resumible documentado. Este archivo es la fuente de verdad para retomar desde otra sesion.

### [x] P1 productos_similares_ml

`Build Final JSON` guarda `ml_search_debug` y `productos_similares_ml`. El audit falla si ML devuelve candidatos validos pero el JSON queda vacio.

Verificacion:
- `rtk npm run n8n:prepare`
- `rtk npm run review:audit`
- `rtk npm run build`

### [x] P2 review_candidates

Se creo la pestana `review_candidates`. El main genera candidatos desde:
- `productos_similares_ml`
- `comparativa_editorial`
- `alternativas`
- `mejor_alternativa`

Deduplica por `candidate_id` y solo agrega candidatos nuevos. Cada candidato guarda `candidate_tier` (`superior`, `economico`, `similar`, `unknown`) inferido desde `relation_type`, `comparativa_editorial.tipo`, `mejor_alternativa`, texto editorial y precio relativo cuando existe.

Los nombres se limpian antes de generar IDs y claves canonicas: se quitan calificadores comerciales o ambiguos, se separan nombres compuestos y se conservan tokens de modelo como `M2`, `M3` y `SE`. Esto evita duplicados reales sin descartar modelos validos de Apple Watch SE o MacBook Air M2/M3.

### [x] P3 Flujo Diario de Candidatos

Scheduler manda candidatos pendientes por Telegram en formato `1 - Articulo`, hasta 3 lineas. Prioriza `superior`, rellena con `economico` y despues usa `similar`/`unknown`; intenta mezclar fuentes para no mandar todo de una sola categoria cuando hay alternativas; excluye candidatos publicados, `done`, `ready`, `processing` y `discarded`. Poll acepta una o varias respuestas en formato `numero - link` o `numero - descartar`, marca links como `ready` y crea filas en `articulos`; los descartes quedan como `discarded`.

Fixes importantes:
- No crea `WAITING_LINK` si ya hay candidatos pendientes.
- Un `WAITING_LINK` viejo no bloquea la lectura de `review_candidates`.
- Filas `processing` vacias en `articulos` no bloquean Scheduler.
- No confunde links afiliados de candidatos con el flujo manual normal.
- Las notificaciones de candidato listo usan el nombre del candidato, no el item de Google Sheets posterior.
- El runner procesa hasta `MAIN_MAX_RUNS=3` filas por ciclo.
- Persiste snapshot `shown_batch_id + shown_index -> candidate_id` en `review_candidates` para que `1`, `2`, `3` resuelvan contra el ultimo lote mostrado aunque Telegram conserve un draft/reply viejo.
- Sheet Schema cierra candidatos huerfanos si el JSON ya existe pero el `candidate_id` no quedo en `meta`, por ejemplo por corrida manual o perdida del dato en `articulos`.
- Acepta multiples acciones en un solo mensaje:
  `1 - https://meli.la/...`
  `2 - descartar`
  `3 - https://meli.la/...`
- Puede procesar 1, 2 o 3 candidatos en la misma corrida si existen links afiliados validos.

### [x] P4 Related Reviews / Comparadores

Cada review generado desde candidato guarda `meta.candidate_id`. La web infiere relaciones desde `data/*.json`.

Implementado:
- Bloque "Reviews relacionados" en reviews origen.
- Ruta estatica `/comparar/[source]-vs-[target]`.
- Sitemap incluye comparadores cerrados.

Verificacion live:
- Candidato `apple-watch-series-11-46mm:apple-watch-se-3`.
- Target generado: `apple-watch-se-gps-smartwatch`.
- Comparador exportado: `/comparar/apple-watch-series-11-46mm-vs-apple-watch-se-gps-smartwatch`.

### [x] P5 Rankings Automaticos

Implementado:
- `/rankings`
- `/rankings/[category]`
- Helpers `rankingCategories` y `loadRankingCategory`
- Link en header
- Sitemap con rankings

Categorias actuales:
- `mlm-smartwatches`
- `mlm-electric-coffee-makers`
- `mlm-game-consoles`
- `mlm-notebooks`

### [x] P6 Freshness / Repriorizacion

Workflow generado: `AfiliadosML - Freshness` (`freshnessAfML2026`).

Hace:
- Refresca token ML.
- Consulta `/products/{catalog_id}/items`.
- Escribe `freshness` en cada JSON.
- Marca stale por:
  - `inactive_listing`
  - `no_stock`
  - `missing_price`
  - `price_increased_20pct`
  - `api_error`
  - `no_seller_items`
- Sube prioridad de candidatos `pending` cuyo `source_slug` quedo stale.

Integracion:
- `RUN_FRESHNESS=true` en `scripts/n8n-ephemeral/run-cycle.sh`.
- GitHub Actions lo activa en el ciclo diario antes del Scheduler, para no mandar candidatos si Freshness falla.

Verificacion live:
- 5 reviews revisados.
- `freshness.status=active_inferred`
- `is_available=true`
- `stale=false`
- `price_delta_pct=0`
- `stale_count=0`

Nota: no habia un producto caido real al probar. Las ramas stale quedan listas para el primer producto inactivo/sin stock/caro que detecte ML.

## Como Escalar Cobertura

Objetivo practico: pasar de 5 a 50-100 reviews.

Ruta recomendada:
1. Dejar correr el Scheduler diario.
2. Responder 2-3 candidatos por dia con links afiliados.
3. Mantener `MAIN_MAX_RUNS=3` mientras se valida calidad.
4. Cuando la calidad sea estable por 1 semana, subir `MAIN_MAX_RUNS` a 5 desde dispatch manual o workflow.
5. Revisar cada manana:
   - GitHub Actions `Free ephemeral n8n`
   - commits nuevos `feat: review ...`
   - `rtk npm run review:audit`
   - `rtk npm run build`

Si faltan candidatos:
- Forzar regeneracion de reviews fuertes con `force_regen_slug`.
- O agregar manualmente un producto a `articulos` usando el flujo Telegram normal.

## Flujo Completo Actual

1. Cerca de las 9:07 AM America/Chihuahua, GitHub Actions corre `Free ephemeral n8n`. GitHub Actions no garantiza puntualidad; puede retrasar jobs programados.
2. El runner prepara/importa workflows n8n desde `.tmp/n8n-ephemeral/workflows`.
3. Si es ciclo diario, corre Freshness:
   - Revisa precio/disponibilidad de reviews publicados.
   - Escribe `freshness` en JSON via GitHub.
   - Si hay stale, manda alerta Telegram y reprioriza candidatos relacionados.
4. Si `run_candidate_cleanup=true`, corre Candidate Cleanup:
   - Crea respaldo `review_candidates_backup_<timestamp>`.
   - Descarta solo candidatos `pending` problematicos.
   - No toca estados `ready`, `done`, `processing` ni `discarded`.
5. Si `restore_candidate_rows` tiene filas, corre Candidate Restore:
   - Reabre filas especificas descartadas por cleanup y las deja `pending`.
6. Si `run_candidate_backfill=true`, corre Candidate Backfill:
   - Puebla `review_candidates` desde reviews publicados y deduplica contra la hoja actual.
7. Si es ciclo diario, corre Scheduler:
   - Lee `review_candidates`.
   - Si hay candidatos `pending`, manda hasta 3 por Telegram priorizando `superior > economico > similar > unknown`.
   - Excluye candidatos ya publicados y estados `done`, `ready`, `processing`, `discarded`.
   - Guarda `shown_batch_id`, `shown_index` y `shown_at` para resolver indices en Poll.
   - Si no hay candidatos, pide articulo manual.
8. Corre Telegram Poll:
   - Lee respuestas.
   - Si recibe `1 - https://meli.la/...`, marca candidato `ready`.
   - Si recibe `1 - descartar`, marca candidato `discarded`.
   - Crea fila `articulos` con `candidate_id` solo para candidatos `ready`.
9. Corre Main hasta `MAIN_MAX_RUNS` veces:
   - Toma `ready`, `pending` o candidato recuperable en `processing`.
   - Genera review con Abacus.
   - Commimea `data/{slug}.json`.
   - Cierra fila `articulos`.
   - Si venia de candidato, cierra `review_candidates` con `target_slug` y manda aviso `Review de candidato publicada`.
10. Cloudflare Pages despliega al recibir push en GitHub.
11. La web muestra:
   - Review nuevo.
   - Reviews relacionados.
   - Comparador si hay par cerrado.
   - Rankings.
   - `/estado` con resumen operativo.
12. El runner manda resumen Telegram del ciclo diario.

Horario actual:
- Freshness/Scheduler diario: 9:07 AM Chihuahua nominal (`7 16 * * *` UTC).
- Poll/Main: cada 5 minutos de 9:12 AM a 2:00 PM Chihuahua nominal.
- Respuesta Telegram de candidato no es instantanea: normalmente entra en 5-15 min; en carga alta de GitHub puede tardar 20+ min.

## Como Probar Stale Seguro

Opcion segura implementada:
1. Ejecutar `rtk npm run freshness:test`.
2. El test usa fixtures locales y no toca `data/`, Google Sheets ni GitHub.
3. Valida casos:
   - activo inferido por precio
   - listing inactivo
   - sin stock
   - sin precio
   - precio +20%
4. Si falla, no se debe pushear cambios de P6.

Opcion live:
1. Esperar a que ML detecte un producto sin stock, inactivo o con precio +20%.
2. Freshness diario lo marcara stale.
3. Candidatos pendientes relacionados subiran prioridad.

## Higiene y Estabilidad Operativa Propuesta

Prioridad H1:
- Mantener docs limpias y sin mojibake.
- Mantener `public/archive/` para estudios viejos que no deben entrar al sitio principal.
- No crear workflow Cloudflare; deploy es por Cloudflare Pages conectado a GitHub.

Prioridad H2:
- [x] Agregar reporte diario de Freshness por Telegram solo si `stale_count > 0`.
- [x] Agregar resumen de ciclo n8n por Telegram/GitHub Step Summary.
- [x] Agregar limite configurable `MAIN_MAX_RUNS` en GitHub Actions manual dispatch.

Prioridad H3:
- [x] Crear prueba automatica para `prepare-workflows.mjs` que valide que existan los nodos criticos:
  - `Build Final JSON`
  - `Build Review Candidates`
  - `Find Completed Candidate`
  - `Check Freshness`
- [x] Agregar pagina `/estado` para ver conteos: reviews, stale, rankings y comparadores.

## Comandos De Verificacion

Siempre correr antes de push:

```powershell
rtk npm run n8n:prepare
rtk npm run n8n:verify
rtk npm run freshness:test
rtk npm run review:audit
rtk npm run build
```

Para ciclo n8n local:

```powershell
rtk npm run n8n:cycle
```

Para ejecutar workflow Freshness local con n8n instalado:

```powershell
rtk n8n import:workflow --separate --input=.tmp/n8n-ephemeral/workflows
rtk n8n execute --id=freshnessAfML2026
```

## Variables Requeridas

En GitHub Secrets y/o entorno local:
- `YOUTUBE_API_KEY`
- `ML_CLIENT_ID`
- `ML_CLIENT_SECRET`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `GITHUB_TOKEN` integrado de GitHub Actions con `contents: write`; no usar `N8N_GITHUB_TOKEN` para este flujo.
- `ABACUS_API_KEY`
- `N8N_ENCRYPTION_KEY`
- `N8N_CREDENTIALS_JSON_B64`

## Estado De Pendientes

Pendientes tecnicos P0-P6: cerrados.

Pendientes operativos:
- Escalar cobertura respondiendo candidatos diarios.
- Observar un stale real en produccion.
- Revisar `/estado` despues del proximo ciclo diario.
- Monitorear que la cola diaria priorice `superior` y rellene con `economico` sin repetir candidatos ya publicados.
