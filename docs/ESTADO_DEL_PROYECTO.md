# AfiliadosML - Estado del proyecto

Ultima actualizacion: 2026-06-09.

Proyecto: pipeline automatico de reviews editoriales para productos de Mercado Libre Mexico. Un humano sigue aportando links afiliados; el sistema automatiza descubrimiento, cola, generacion, publicacion, relaciones, rankings y freshness.

## Estado Actual

- Web: Next.js export estatico en Cloudflare Pages. El deploy ocurre por push a GitHub; no se usa un workflow Cloudflare propio.
- Automatizacion: GitHub Actions `Free ephemeral n8n` levanta n8n efimero, importa credenciales/workflows, corre Scheduler/Poll/Freshness/Main y termina.
- Reviews activos en `data/`: 5.
  - `apple-macbook-air-13-m5-512gb`
  - `apple-watch-se-gps-smartwatch`
  - `apple-watch-series-11-46mm`
  - `delonghi-specialista-touch-ec9445m-cafetera`
  - `nintendo-switch-oled-consola-64gb`
- Audit local: `rtk npm run review:audit` debe quedar en 0 warnings.
- Build local: `rtk npm run build` debe exportar reviews, rankings y comparadores.
- Archivos de estudio viejos: movidos a `public/archive/`.
- CI viejo de Cloudflare: no existe en `.github/workflows`; el unico workflow versionado es `free-ephemeral-n8n.yml`.

## Arquitectura

Google Sheet "Reviews ML":
- `timerrs` / gid 0: tokens OAuth de Mercado Libre.
- `articulos` / gid 1072849850: cola de productos a procesar.
- `review_candidates`: candidatos sugeridos por reviews ya publicados.

n8n workflows:
- `AfiliadosML` (`iSQ59pcFepjqmBvC`): pipeline principal.
- `AfiliadosML - Telegram Poll` (`wsMIARaCQQISWJtv`): lee respuestas de Telegram.
- `AfiliadosML - Scheduler 7am` (`wG6XApFxO6SyCgIY`): manda candidatos diarios.
- `AfiliadosML - Error Handler` (`WNQIZP0Tu3hQGODn`): marca errores en Sheet.
- `AfiliadosML - Token Refresh` (`PhRg6OJo47YcvsDo`): refresca token ML.
- `AfiliadosML - Recordatorios` (`7uVW6atEBK8fuoHV`): recordatorios opcionales.
- `AfiliadosML - Freshness` (`freshnessAfML2026`): generado por `scripts/n8n-ephemeral/prepare-workflows.mjs`.

GitHub:
- Repo: `HitoFlores/AfiliadosML`.
- n8n commitea `data/{slug}.json`.
- Cloudflare Pages despliega automaticamente al recibir push en GitHub.

## Flujo Operativo

1. Scheduler diario lee `review_candidates`.
2. Si hay candidatos `pending`, manda 2-3 por Telegram ordenados por `priority_score`.
3. Humano responde: `1 https://meli.la/...` con el link afiliado de ML Partners.
4. Poll marca el candidato como `ready`, guarda `affiliate_url` y crea fila `articulos` con `candidate_id`.
5. Main toma filas `ready`/`pending`, genera review, commitea JSON y marca la fila `done`.
6. Si venia de candidato, marca `review_candidates.status=done` y llena `target_slug`.
7. Web muestra reviews relacionados, comparadores y rankings.
8. Freshness diario revisa precios/disponibilidad y sube prioridad de candidatos si un origen queda stale.

## Campos Importantes

`articulos`:
`articulo`, `referido`, `idioma`, `estatus`, `link_sugerido`, `slug`, `procesado_en`, `error_msg`, `candidate_id`

Estados principales:
`waiting_link -> waiting_confirm -> pending -> waiting -> ready -> done`

`review_candidates`:
`candidate_id`, `source_slug`, `source_product_id`, `relation_type`, `candidate_name`, `candidate_query`, `candidate_ml_url`, `candidate_ml_id`, `affiliate_url`, `target_slug`, `status`, `priority_score`, `reason`, `mentioned_in`, `created_at`, `updated_at`, `error_msg`

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

Deduplica por `candidate_id` y solo agrega candidatos nuevos.

### [x] P3 Flujo Diario de Candidatos

Scheduler manda candidatos pendientes por Telegram. Poll acepta respuesta `numero + link afiliado`, marca candidato `ready` y crea fila en `articulos`.

Fixes importantes:
- No crea `WAITING_LINK` si ya hay candidatos pendientes.
- No confunde links afiliados de candidatos con el flujo manual normal.
- El runner procesa hasta `MAIN_MAX_RUNS=3` filas por ciclo.

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
- GitHub Actions lo activa en el ciclo diario de 7am.

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

1. A las 9:00 AM America/Chihuahua, GitHub Actions corre `Free ephemeral n8n`.
2. El runner prepara/importa workflows n8n desde `.tmp/n8n-ephemeral/workflows`.
3. Si es ciclo diario, corre Scheduler:
   - Lee `review_candidates`.
   - Si hay candidatos `pending`, manda hasta 3 por Telegram.
   - Si no hay candidatos, pide articulo manual.
4. Si es ciclo diario, corre Freshness:
   - Revisa precio/disponibilidad de reviews publicados.
   - Escribe `freshness` en JSON via GitHub.
   - Si hay stale, manda alerta Telegram y reprioriza candidatos relacionados.
5. Corre Telegram Poll:
   - Lee respuestas.
   - Si recibe `1 https://meli.la/...`, marca candidato `ready`.
   - Crea fila `articulos` con `candidate_id`.
6. Corre Main hasta `MAIN_MAX_RUNS` veces:
   - Toma `ready`, `pending` o candidato recuperable en `processing`.
   - Genera review con Abacus.
   - Commimea `data/{slug}.json`.
   - Cierra fila `articulos`.
   - Si venia de candidato, cierra `review_candidates` con `target_slug`.
7. Cloudflare Pages despliega al recibir push en GitHub.
8. La web muestra:
   - Review nuevo.
   - Reviews relacionados.
   - Comparador si hay par cerrado.
   - Rankings.
   - `/estado` con resumen operativo.
9. El runner manda resumen Telegram del ciclo diario.

Horario actual:
- Scheduler/Freshness diario: 9:00 AM Chihuahua (`0 15 * * *` UTC).
- Poll/Main: cada 5 minutos de 9:00 AM a 2:00 PM Chihuahua.

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
- `GITHUB_TOKEN` o `N8N_GITHUB_TOKEN`
- `ABACUS_API_KEY`
- `N8N_ENCRYPTION_KEY`
- `N8N_CREDENTIALS_JSON_B64`

## Estado De Pendientes

Pendientes tecnicos P0-P6: cerrados.

Pendientes operativos:
- Escalar cobertura respondiendo candidatos diarios.
- Observar un stale real en produccion.
- Revisar en produccion el primer reporte Telegram de ciclo/stale.
- Revisar `/estado` despues del proximo ciclo diario.
