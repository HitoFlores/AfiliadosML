# Graph Report - AfiliadosML  (2026-06-16)

## Corpus Check
- 87 files · ~209,463 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 428 nodes · 575 edges · 40 communities (27 shown, 13 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e3dca8a3`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 44|Community 44]]

## God Nodes (most connected - your core abstractions)
1. `findNode()` - 18 edges
2. `compilerOptions` - 16 edges
3. `AfiliadosML - Estado del proyecto` - 14 edges
4. `rankingCategories()` - 11 edges
5. `scripts` - 11 edges
6. `What You Must Do When Invoked` - 11 edges
7. `canonicalCandidateKey()` - 10 edges
8. `patchMainReviewWorkflow()` - 10 edges
9. `/graphify` - 10 edges
10. `comparisonPairs()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `generateStaticParams()` --calls--> `comparisonPairs()`  [EXTRACTED]
  app/comparar/[pair]/page.tsx → lib/product.ts
- `generateMetadata()` --calls--> `loadComparisonPair()`  [EXTRACTED]
  app/comparar/[pair]/page.tsx → lib/product.ts
- `ComparePage()` --calls--> `loadComparisonPair()`  [EXTRACTED]
  app/comparar/[pair]/page.tsx → lib/product.ts
- `generateStaticParams()` --calls--> `rankingCategories()`  [EXTRACTED]
  app/rankings/[category]/page.tsx → lib/product.ts
- `generateMetadata()` --calls--> `loadRankingCategory()`  [EXTRACTED]
  app/rankings/[category]/page.tsx → lib/product.ts

## Import Cycles
- None detected.

## Communities (40 total, 13 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.10
Nodes (36): buildCandidateBackfillWorkflow(), buildCandidateCleanupWorkflow(), buildCandidateHeaderCode(), buildCandidateRestoreWorkflow(), buildFreshnessWorkflow(), buildSheetSchemaWorkflow(), candidateBackfillWorkflow, candidateCleanupWorkflow (+28 more)

### Community 2 - "Community 2"
Cohesion: 0.07
Nodes (28): dependencies, next, react, react-dom, devDependencies, autoprefixer, eslint, eslint-config-next (+20 more)

### Community 3 - "Community 3"
Cohesion: 0.19
Nodes (21): canonicalCandidateKey(), cleanCandidateName(), isGenericCandidateName(), isSelfCandidate(), isSpecOnlyCandidate(), meaningfulName(), norm(), sameCandidateName() (+13 more)

### Community 4 - "Community 4"
Cohesion: 0.05
Nodes (41): sitemap(), generateMetadata(), generateStaticParams(), RankingCategoryPage(), ICONS, JsonLd(), JsonLdProps, RelatedReviewsProps (+33 more)

### Community 5 - "Community 5"
Cohesion: 0.08
Nodes (23): For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+15 more)

### Community 6 - "Community 6"
Cohesion: 0.10
Nodes (16): candidateHintForIndex(), changedRows, classifyTier(), discardWords, diverseSelected, hiddenStatuses, isMlLink(), looksLikeLink() (+8 more)

### Community 7 - "Community 7"
Cohesion: 0.09
Nodes (21): AfiliadosML - Estado del proyecto, Arquitectura, Campos Importantes, Comandos De Verificacion, Como Escalar Cobertura, Como Probar Stale Seguro, Estado Actual, Estado De Pendientes (+13 more)

### Community 8 - "Community 8"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 9 - "Community 9"
Cohesion: 0.07
Nodes (28): AffiliateCTA(), AffiliateCTAProps, Byline(), BylineProps, SourcesBlock(), ImageGalleryProps, ScoreBadge(), ScoreBadgeProps (+20 more)

### Community 10 - "Community 10"
Cohesion: 0.21
Nodes (11): run-cycle.sh script, DB_SQLITE_DATABASE, DB_TYPE, N8N_BLOCK_ENV_ACCESS_IN_NODE, N8N_DIAGNOSTICS_ENABLED, N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS, N8N_TEMPLATES_ENABLED, N8N_USER_FOLDER (+3 more)

### Community 11 - "Community 11"
Cohesion: 0.22
Nodes (8): Como Generar `N8N_CREDENTIALS_JSON_B64`, Deploy gratis: Cloudflare Pages + n8n efimero, GitHub Actions n8n, Recuperacion, Secrets Requeridos, Verificacion Antes De Push, Web en Cloudflare Pages, Workflows Generados

### Community 12 - "Community 12"
Cohesion: 0.22
Nodes (8): graphify reference: extra exports and benchmark, Step 6b - Wiki (only if --wiki flag), Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag), Step 7a - FalkorDB export (only if --falkordb or --falkordb-push flag), Step 7b - SVG export (only if --svg flag), Step 7c - GraphML export (only if --graphml flag), Step 7d - MCP server (only if --mcp flag), Step 8 - Token reduction benchmark (only if total_words > 5000)

### Community 13 - "Community 13"
Cohesion: 0.22
Nodes (4): currentYear, dataDir, files, root

### Community 14 - "Community 14"
Cohesion: 0.39
Nodes (7): FeaturedCard(), formatPrice(), getReviews(), HomePage(), ReviewCard, scoreColor(), ScorePill()

### Community 15 - "Community 15"
Cohesion: 0.32
Nodes (7): currentYear, dataDir, files, fixString(), fixValue(), root, scoreText()

### Community 16 - "Community 16"
Cohesion: 0.32
Nodes (5): compactUrl(), findCompletedCandidate(), norm(), review, rows

### Community 19 - "Community 19"
Cohesion: 0.33
Nodes (3): Destacada, ReviewsML, sentTone

### Community 25 - "Community 25"
Cohesion: 0.50
Nodes (3): For /graphify add, For --watch, graphify reference: add a URL and watch a folder

### Community 26 - "Community 26"
Cohesion: 0.50
Nodes (3): For git commit hook, For native CLAUDE.md integration, graphify reference: commit hook and native CLAUDE.md integration

### Community 27 - "Community 27"
Cohesion: 0.50
Nodes (3): For /graphify explain, For /graphify path, graphify reference: query, path, explain

### Community 28 - "Community 28"
Cohesion: 0.50
Nodes (3): For --cluster-only, For --update (incremental re-extraction), graphify reference: incremental update and cluster-only

### Community 32 - "Community 32"
Cohesion: 0.40
Nodes (3): files, required, workflowDir

## Knowledge Gaps
- **188 isolated node(s):** `metadata`, `inter`, `metadata`, `metadata`, `AffiliateCTAProps` (+183 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `buildBackfillCandidates()` connect `Community 0` to `Community 3`?**
  _High betweenness centrality (0.002) - this node is a cross-community bridge._
- **What connects `metadata`, `inter`, `metadata` to the rest of the system?**
  _192 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.09878048780487805 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.06896551724137931 - nodes in this community are weakly interconnected._
- **Should `Community 4` be split into smaller, more focused modules?**
  _Cohesion score 0.0519774011299435 - nodes in this community are weakly interconnected._
- **Should `Community 5` be split into smaller, more focused modules?**
  _Cohesion score 0.08333333333333333 - nodes in this community are weakly interconnected._
- **Should `Community 6` be split into smaller, more focused modules?**
  _Cohesion score 0.10144927536231885 - nodes in this community are weakly interconnected._