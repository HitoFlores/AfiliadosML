import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const sourceDir = path.join(root, "n8n-backup");
const outDir = path.join(root, ".tmp", "n8n-ephemeral", "workflows");

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const files = fs.readdirSync(sourceDir).filter((file) => file.endsWith(".json"));

for (const file of files) {
  const sourcePath = path.join(sourceDir, file);
  const workflow = JSON.parse(fs.readFileSync(sourcePath, "utf8").replace(/^\uFEFF/, ""));

  if (workflow.name === "AfiliadosML - Telegram Poll") {
    patchTelegramPoll(workflow);
    patchPollExecuteWorkflowNodes(workflow);
    addExecuteTrigger(workflow, "Poll Telegram");
  }

  if (workflow.name === "AfiliadosML - Scheduler 7am") {
    addExecuteTrigger(workflow, "Leer Sheet");
  }

  if (workflow.name === "AfiliadosML") {
    patchMainReviewWorkflow(workflow);
  }

  sanitizeWorkflowForImport(workflow);

  // Keep the main workflow active so Telegram Poll can call it through Execute Workflow.
  // Schedule-based workflows stay inactive; the GitHub Action calls them explicitly.
  workflow.active = workflow.name === "AfiliadosML";

  fs.writeFileSync(path.join(outDir, file), JSON.stringify(workflow, null, 2));
}

console.log(`Prepared ${files.length} workflows in ${path.relative(root, outDir)}`);

function findNode(workflow, name) {
  const node = workflow.nodes.find((entry) => entry.name === name);
  if (!node) throw new Error(`Missing node: ${name}`);
  return node;
}

function sanitizeWorkflowForImport(workflow) {
  for (const key of [
    "createdAt",
    "updatedAt",
    "versionId",
    "activeVersionId",
    "versionCounter",
    "triggerCount",
    "shared",
    "tags",
    "activeVersion",
    "meta",
    "pinData",
    "isArchived",
    "staticData",
  ]) {
    delete workflow[key];
  }

  workflow.description = workflow.description ?? "";
  workflow.settings = {
    executionOrder: workflow.settings?.executionOrder ?? "v1",
  };
}

function addExecuteTrigger(workflow, targetNodeName) {
  const triggerName = "Ephemeral Execute Trigger";
  if (workflow.nodes.some((node) => node.name === triggerName)) return;

  workflow.nodes.push({
    id: `ephemeral-${workflow.id}`,
    name: triggerName,
    type: "n8n-nodes-base.executeWorkflowTrigger",
    typeVersion: 1,
    position: [-500, -200],
    parameters: {},
  });

  workflow.connections[triggerName] = {
    main: [[{ node: targetNodeName, type: "main", index: 0 }]],
  };
}

function patchTelegramPoll(workflow) {
  const poll = findNode(workflow, "Poll Telegram");
  let code = poll.parameters.jsCode;

  code = code.replace(
    "const url = sd.pending_articulo || '';",
    "const url = sd.pending_articulo || 'CONFIRM_FROM_SHEET';",
  );

  code = code.replace(
    "await tg('Perfecto! Buscando el mejor vendedor para *' + (sd.pending_nombre || url) + '*...');",
    "await tg('Perfecto! Buscando el mejor vendedor para *' + (sd.pending_nombre || 'el articulo confirmado') + '*...');",
  );

  code = code.replace(
    "if (confirmFlag) return [{ json: { tipo: 'confirmar_articulo' } }];",
    "if (confirmFlag) return [{ json: { tipo: 'confirmar_articulo', articulo_link: sd.pending_articulo || '', nombre: sd.pending_nombre || '' } }];",
  );

  code = code.replace(
    "sd.tg_offset = maxId + 1;",
    `sd.tg_offset = maxId + 1;
// Ephemeral runner: confirm updates with Telegram before the local n8n DB dies.
if (updates.length) {
  try {
    await this.helpers.httpRequest({
      method: 'GET',
      url: 'https://api.telegram.org/bot' + TOKEN + '/getUpdates',
      qs: { offset: sd.tg_offset, limit: 1 },
      json: true,
    });
  } catch (e) {}
}`,
  );

  poll.parameters.jsCode = code;

  const markWaitingConfirm = findNode(workflow, "Marcar waiting_confirm");
  markWaitingConfirm.parameters.columns.value.articulo = "={{ $('Poll Telegram').first().json.articulo_link }}";
  markWaitingConfirm.parameters.columns.value.procesado_en = "={{ new Date().toISOString() }}";

  const encontrarEspera = findNode(workflow, "Encontrar Espera");
  encontrarEspera.parameters.jsCode = `const sd = $getWorkflowStaticData('global');
const articulo_link = $('Poll Telegram').first().json.articulo_link;

// Use row_number saved in the same execution when available.
if (sd.pending_row_number) {
  const rn = sd.pending_row_number;
  delete sd.pending_row_number;
  return [{ json: { found: true, row_number: rn, articulo_link } }];
}

const rows = $input.all().map(i => i.json);
const waiting = rows.find(r => ['waiting_link','waiting_confirm'].includes((r.estatus||'').toLowerCase().trim()));
const confirmedFromSheet = articulo_link === 'CONFIRM_FROM_SHEET';
if (!waiting) return confirmedFromSheet ? [] : [{ json: { found: false, row_number: null, articulo_link } }];

return [{
  json: {
    found: true,
    row_number: waiting.row_number,
    articulo_link: confirmedFromSheet ? (waiting.articulo || '') : articulo_link,
  },
}];`;
}

function patchPollExecuteWorkflowNodes(workflow) {
  for (const node of workflow.nodes) {
    if (node.name !== "Run Main" && node.name !== "Run Main New") continue;
    node.type = "n8n-nodes-base.noOp";
    node.typeVersion = 1;
    node.parameters = {};
  }
}

function patchMainReviewWorkflow(workflow) {
  patchForceRegeneration(workflow);
  patchSimilarProducts(workflow);
  patchStrictYoutubeMatching(workflow);
  patchFreeYoutubeTranscripts(workflow);
  patchBuildPromptV4(workflow);
  patchBuildFinalJsonV4(workflow);
}

function patchForceRegeneration(workflow) {
  const node = findNode(workflow, "Route Row");
  let code = node.parameters.jsCode;

  if (code.includes("FORCE_REGEN_SLUG")) return;

  code = code.replace(
    "const norm = (s) => (s || '').toString().trim().toLowerCase();",
    `const norm = (s) => (s || '').toString().trim().toLowerCase();
const forceSlug = norm($env.FORCE_REGEN_SLUG || '');`,
  );

  code = code.replace(
    `const pick =
  rows.find((r) => norm(r.estatus) === 'ready') ||
  rows.find((r) => norm(r.estatus) === 'pending');`,
    `const pick = forceSlug
  ? rows.find((r) => norm(r.slug) === forceSlug)
  : (
    rows.find((r) => norm(r.estatus) === 'ready') ||
    rows.find((r) => norm(r.estatus) === 'pending')
  );`,
  );

  code = code.replace(
    "_pass:      estatus === 'ready' ? 'pass2' : 'pass1',",
    "_pass:      forceSlug ? 'pass2' : (estatus === 'ready' ? 'pass2' : 'pass1'),",
  );

  node.parameters.jsCode = code;
}

function patchSimilarProducts(workflow) {
  const node = findNode(workflow, "Get Similar Products");
  node.parameters.url =
    "=https://api.mercadolibre.com/sites/MLM/search?q={{ encodeURIComponent([(($('Get Data ML').first().json.attributes.find(a => a.name === 'Marca') || {}).value_name || ''), (($('Get Data ML').first().json.attributes.find(a => a.name === 'Línea') || {}).value_name || ''), (($('Get Data ML').first().json.attributes.find(a => a.name === 'Modelo') || {}).value_name || ''), ($('Get Data ML').first().json.name || '').split(' ').slice(0,3).join(' ')].filter(Boolean).join(' ')) }}&price={{ Math.round((($('Get Item Sellers').first().json.results || [])[0] || {}).price * 0.65 || 0) }}-{{ Math.round((($('Get Item Sellers').first().json.results || [])[0] || {}).price * 1.6 || 0) }}&sort=relevance&limit=10";
}

function patchStrictYoutubeMatching(workflow) {
  const node = findNode(workflow, "Top videos");
  node.parameters.jsCode = `// Top videos v5: strict product/category matching. Bad evidence is worse than no video.
const API_KEY = $env.YOUTUBE_API_KEY;
const item = $('Get Data ML').first().json;
const attrs = item.attributes || [];
const getAttr = (n) => (attrs.find((a) => a.name === n) || {}).value_name || '';
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').replace(/[^a-z0-9\\s]/g, ' ').replace(/\\s+/g, ' ').trim();
const compact = (s) => norm(s).replace(/\\s+/g, '');
const words = (s) => norm(s).split(' ').filter(Boolean);
const hasPhrase = (haystack, phrase) => phrase && haystack.includes(norm(phrase));
const hasCompact = (haystackCompact, phrase) => phrase && haystackCompact.includes(compact(phrase));
const marca = norm(getAttr('Fabricante') || getAttr('Marca'));
const marcaMl = norm(getAttr('Marca'));
const modelo = norm(getAttr('Modelo'));
const submodelo = norm(getAttr('Submodelo'));
const linea = norm(getAttr('Línea') || getAttr('Linea'));
const productName = norm(item.name || '');
const domain = norm(item.domain_id || '');
const STOP = new Set(['de','del','la','el','los','las','para','con','sin','por','una','uno','un','y','color','modelo','version','edicion','nuevo','original','distribuidor','autorizado','gb','tb','ssd','ram','cpu','gpu','chip','nucleos','pulgadas','inch','inches','mx','mexico','negro','blanco','azul','rojo','plata','plateado','medianoche']);
const tokenSet = [...new Set(words([marca, linea, modelo, submodelo, productName].join(' ')).filter((w) => w.length > 2 && !STOP.has(w)))];
const categoryTerms = (() => {
  const text = [domain, item.name, linea, modelo, submodelo].map(norm).join(' ');
  if (/macbook|laptop|notebook|comput/.test(text)) return ['macbook', 'laptop', 'notebook', 'computadora'];
  if (/watch|smartwatch|reloj/.test(text)) return ['watch', 'smartwatch', 'reloj'];
  if (/switch|consol/.test(text)) return ['switch', 'consola', 'nintendo'];
  if (/cafetera|espresso|coffee|cafe/.test(text)) return ['cafetera', 'espresso', 'coffee', 'cafe'];
  return tokenSet.slice(0, 4);
})();
const mustHaveAny = [linea, modelo, submodelo, ...tokenSet.filter((t) => ![marca, marcaMl].includes(t)).slice(0, 5)].filter(Boolean);
const REVIEW_TERMS = ['review', 'analisis', 'reseña', 'resena', 'vale la pena', 'hands on', 'comparativa', 'comparacion', 'opinion', 'should you buy', 'is it worth', 'first look', 'unboxing', 'vs ', ' vs', 'overview', 'prueba'];
const NON_REVIEW_TERMS = ['gameplay', 'playthrough', "let's play", 'lets play', 'scratch test', 'drop test', 'bend test', 'durability test', 'teardown', 'tear down', 'disassembly', 'water test', 'torture test', 'relaxing', 'asmr', 'satisfying', 'walkthrough', 'longplay', 'full game', 'shorts'];
const crossCategoryBad = ['airpods', 'iphone', 'ipad', 'studio display', 'imac', 'mac mini', 'playstation', 'xbox', 'kindle'].filter((term) => !productName.includes(term) && !linea.includes(term) && !modelo.includes(term));
function scoreVideo(v) {
  const title = norm(v.snippet?.title || '');
  const desc = norm(v.snippet?.description || '');
  const full = [title, desc].join(' ');
  const fullCompact = compact(full);
  if (NON_REVIEW_TERMS.some((t) => full.includes(norm(t)))) return null;
  if (crossCategoryBad.some((t) => full.includes(norm(t)))) return null;
  const brandOk = !marca || full.includes(marca) || (marcaMl && full.includes(marcaMl));
  if (!brandOk) return null;
  const categoryOk = categoryTerms.some((t) => full.includes(norm(t)));
  if (!categoryOk) return null;
  const tokenHits = tokenSet.filter((t) => full.includes(t) || fullCompact.includes(compact(t)));
  const specificHits = mustHaveAny.filter((t) => hasPhrase(full, t) || hasCompact(fullCompact, t));
  const reviewHit = REVIEW_TERMS.some((t) => full.includes(norm(t)));
  const exactModel = [modelo, submodelo].filter(Boolean).some((t) => hasPhrase(full, t) || hasCompact(fullCompact, t));
  const lineHit = Boolean(linea && (hasPhrase(full, linea) || hasCompact(fullCompact, linea)));
  if (!(exactModel || lineHit || specificHits.length >= 2 || tokenHits.length >= 3)) return null;
  const relevance = tokenHits.length + specificHits.length * 2 + (exactModel ? 4 : 0) + (lineHit ? 2 : 0);
  return { ...v, _relevance: relevance, _reviewBonus: reviewHit ? 2 : 0, _total: relevance + (reviewHit ? 2 : 0) };
}
const search = $('Get Videos YT').first().json.items || [];
const scored = search.map(scoreVideo).filter(Boolean);
const ids = scored.map((v) => v.id && v.id.videoId).filter(Boolean);
const stats = {};
if (ids.length) {
  const res = await this.helpers.httpRequest({ method: 'GET', url: 'https://www.googleapis.com/youtube/v3/videos', qs: { part: 'statistics', id: ids.join(','), key: API_KEY }, json: true });
  for (const it of (res.items || [])) stats[it.id] = it.statistics || {};
}
const ranked = scored.map((v) => ({ ...v, statistics: stats[v.id.videoId] || {}, _views: parseInt((stats[v.id.videoId] || {}).viewCount || '0', 10) })).sort((a, b) => (b._total - a._total) || (b._views - a._views)).slice(0, 3);
return [{ json: { items: ranked, youtube_filter: { source_count: search.length, accepted_count: ranked.length, marca, linea, modelo, submodelo, category_terms: categoryTerms } } }];`;
}

function patchFreeYoutubeTranscripts(workflow) {
  const node = findNode(workflow, "Transcripciones");
  node.parameters.jsCode = `// Transcripciones v4: solo captions publicas de YouTube; sin Supadata
const videos = $('Top videos').first().json.items || [];

const partes = [];
let conTranscripcion = 0;
let viaYoutube = 0;

function decodeHtml(value) {
  return (value || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/');
}

function stripTranscriptXml(xml) {
  return decodeHtml(String(xml || '')
    .replace(/<text[^>]*>/g, ' ')
    .replace(/<\\/text>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\\s+/g, ' ')
    .trim());
}

async function getFreeYoutubeTranscript(videoId) {
  try {
    const html = await this.helpers.httpRequest({
      method: 'GET',
      url: 'https://www.youtube.com/watch',
      qs: { v: videoId, hl: 'es' },
      headers: {
        'user-agent': 'Mozilla/5.0',
        'accept-language': 'es-MX,es;q=0.9,en;q=0.8',
      },
    });

    const match = String(html).match(/"captionTracks":(\\[.*?\\])/);
    if (!match) return '';

    const tracks = JSON.parse(match[1].replace(/\\\\u0026/g, '&'));
    const chosen = tracks.find(t => /^es/i.test(t.languageCode || ''))
      || tracks.find(t => /^en/i.test(t.languageCode || ''))
      || tracks[0];
    if (!chosen || !chosen.baseUrl) return '';

    const transcriptXml = await this.helpers.httpRequest({
      method: 'GET',
      url: chosen.baseUrl,
      headers: { 'user-agent': 'Mozilla/5.0' },
    });

    return stripTranscriptXml(transcriptXml).slice(0, 6000);
  } catch(e) {
    return '';
  }
}

for (let i = 0; i < videos.length; i++) {
  const v = videos[i].snippet || {};
  const id = videos[i].id.videoId;
  let transcript = '';
  let fuente = 'descripcion';

  transcript = await getFreeYoutubeTranscript.call(this, id);
  if (transcript) {
    viaYoutube++;
    fuente = 'youtube-captions';
  }

  if (transcript) conTranscripcion++;
  const idioma = transcript && !transcript.match(/[áéíóúñ¿¡]/) ? ' [EN]' : '';
  const cuerpo = transcript
    ? transcript
    : \`(sin transcripción disponible) Descripción: \${v.description || 'n/d'}\`;

  partes.push(
    \`VIDEO \${i + 1}\${idioma}\\nFUENTE_TRANSCRIPCION: \${fuente}\\nCANAL: \${v.channelTitle}\\nTÍTULO: \${v.title}\\nCONTENIDO: \${cuerpo}\`
  );
}

return [{ json: {
  bloque_videos: partes.join('\\n\\n---\\n\\n'),
  num_videos_con_transcripcion: conTranscripcion,
  transcripciones_gratis_youtube: viaYoutube,
  transcripciones_supadata: 0,
}}];`;
}

function patchBuildPromptV4(workflow) {
  const node = findNode(workflow, "Build Abacus Prompt");
  let code = node.parameters.jsCode;

  if (!code.includes("const currentYear = new Date().getFullYear();")) {
    code = code.replace(
      "const lang = LANGS[idioma] || 'español';",
      "const lang = LANGS[idioma] || 'español';\nconst currentYear = new Date().getFullYear();",
    );
  }

  if (!code.includes("CAPA V4 DE DECISION DE COMPRA")) {
    code = code.replace(
      "ESTRUCTURA DEL ARTÍCULO",
      `CAPA V4 DE DECISION DE COMPRA (obligatoria):
- Genera "riesgos_compra_ml" con 3-5 riesgos concretos antes de comprar en Mercado Libre: garantia, version exacta, compatibilidad, reputacion del vendedor, importacion/region o accesorios incluidos. No repitas logistica generica.
- Genera "checklist_antes_de_comprar" con 3-5 verificaciones accionables que el lector pueda hacer antes de pagar.
- Genera "comparativa_editorial" con exactamente 3 objetos: "opcion mas barata", "mejor valor" y "premium". Usa datos de similaresMl si existen; si no, describe tipos de alternativa sin inventar modelos especificos.
- Genera "mejor_alternativa" eligiendo una alternativa solo si hay razon clara. Si no, usa null.
- Genera "keyword_targets" con 3-5 busquedas long-tail reales para Mexico/Mercado Libre.
- Genera "evidencia_limitaciones" explicando en una frase que el analisis cruza especificaciones, fuentes externas y compradores. No uses esta limitacion como castigo de score.
- El "seo_title" debe usar el ano \${currentYear} si incluye ano. Prohibido usar anos viejos.
- CALIBRACION DEL SCORE: nunca bajes el score por no tener prueba propia; este sitio siempre trabaja con investigacion editorial, especificaciones, reviews externas y compradores ML. Tampoco penalices por "opiniones poco detalladas" salvo que existan quejas concretas. El score mide valor de compra estimado, no rigor de laboratorio. Reserva scores menores a 7.5 para fallas del producto, mala relacion precio/valor, quejas recurrentes, specs debiles, incompatibilidades o publicacion riesgosa. Si el producto es bueno pero incremental, normalmente queda en 7.8-8.5.

ESTRUCTURA DEL ARTÍCULO`,
    );
  }

  code = code.replace(
    `- Genera "comparativa_editorial" con exactamente 3 objetos: "opcion mas barata", "mejor valor" y "premium". Usa datos de similaresMl si existen; si no, describe tipos de alternativa sin inventar modelos especificos.`,
    `- Genera "comparativa_editorial" con exactamente 4 objetos: "modelo anterior o inferior", "mejor valor", "premium" y "alternativa fuera del ecosistema". Para cada uno explica diferencia concreta contra el producto analizado. Si no hay modelo exacto en similaresMl, compara por tipo/categoria sin inventar SKUs específicos.`,
  );
  code = code.replace(
    `ANÁLISIS EN VIDEO DE CREADORES INDEPENDIENTES:`,
    `ANÁLISIS EN VIDEO DE CREADORES INDEPENDIENTES:
IMPORTANTE: este bloque ya fue filtrado para evitar videos de otra categoria. Si el bloque viene vacío o dice sin videos, NO cites videos ni canales como evidencia. Escribe con seguridad basada en specs, compradores y ML, pero no finjas pruebas externas.`,
  );
  code = code.replace(
    `ESTRUCTURA DEL ARTÍCULO (~800 palabras, markdown): 1) Veredicto rápido honesto, 2) Qué es y qué cambió (compara vs. el modelo anterior si las fuentes lo mencionan), 3) Lo bueno con evidencia, 4) Lo malo / a tener en cuenta concreto, 5) Para quién sí / para quién no, 6) Conclusión con CTA para comprar en Mercado Libre.`,
    `ESTRUCTURA DEL ARTÍCULO (~800 palabras, markdown): 1) Veredicto rápido honesto, 2) Qué es y qué cambió, comparando contra modelo anterior o inferior, 3) Lo bueno con evidencia, 4) Lo malo / a tener en cuenta concreto, 5) Comparativa de compra contra mejor valor, premium y alternativa fuera del ecosistema cuando aplique, 6) Para quién sí / para quién no, 7) Conclusión con CTA para comprar en Mercado Libre.`,
  );

  if (!code.includes("riesgos_compra_ml: { type")) {
    code = code.replace(
      "seo_title:       { type: \"string\" },",
      `riesgos_compra_ml: { type: "array", items: { type: "string" } },
    checklist_antes_de_comprar: { type: "array", items: { type: "string" } },
    comparativa_editorial: {
      type: "array",
      items: {
        type: "object",
        properties: { tipo:{type:"string"}, titulo:{type:"string"}, resumen:{type:"string"} },
        required: ["tipo","titulo","resumen"],
        additionalProperties: false
      }
    },
    mejor_alternativa: {
      anyOf: [
        {
          type: "object",
          properties: { tipo:{type:"string"}, titulo:{type:"string"}, razon:{type:"string"} },
          required: ["tipo","titulo","razon"],
          additionalProperties: false
        },
        { type: "null" }
      ]
    },
    keyword_targets: { type: "array", items: { type: "string" } },
    evidencia_limitaciones: { type: "string" },
    seo_title:       { type: "string" },`,
    );

    code = code.replace(
      "\"seo_title\",\"seo_description\",\"articulo_html\"",
      "\"riesgos_compra_ml\",\"checklist_antes_de_comprar\",\"comparativa_editorial\",\"mejor_alternativa\",\"keyword_targets\",\"evidencia_limitaciones\",\n    \"seo_title\",\"seo_description\",\"articulo_html\"",
    );
    code = code.replace(
      "\"seo_title\", \"seo_description\", \"articulo_html\"",
      "\"riesgos_compra_ml\", \"checklist_antes_de_comprar\", \"comparativa_editorial\", \"mejor_alternativa\", \"keyword_targets\", \"evidencia_limitaciones\",\n    \"seo_title\", \"seo_description\", \"articulo_html\"",
    );
  }

  node.parameters.jsCode = code;
}

function patchBuildFinalJsonV4(workflow) {
  const node = findNode(workflow, "Build Final JSON");
  let code = node.parameters.jsCode;

  code = code
    .replaceAll("An?lisis", "Análisis")
    .replaceAll("an?lisis", "análisis")
    .replaceAll("rese?as", "reseñas")
    .replaceAll("Rese?as", "Reseñas")
    .replaceAll("M?xico", "México")
    .replaceAll("l?nea", "línea");

  if (!code.includes("buildEditorialSlug")) {
    code = code.replace(
      /\/\/[^\n]*SLUG LIMPIO[\s\S]*?const slug = slugParts[\s\S]*?\.slice\(0, 60\);/,
      `// Slug editorial limpio: marca + familia/modelo comercial + specs distintivas.
const getAttr = (n) => (item.attributes.find(a => a.name === n) || {}).value_name || '';
const slugify = (s) => (s || '').toLowerCase()
  .normalize('NFD').replace(/[\\u0300-\\u036f]/g, '')
  .replace(/[^a-z0-9\\s]/g, ' ').trim()
  .replace(/\\s+/g, '-');
const isCode = (s) => Boolean(s && ((/\\d/.test(s) && /-/.test(s)) || /^[A-Z0-9]{5,}$/.test(s)));
const isMeaningful = (s) => Boolean(s && s.length > 1 && !/^\\d+$/.test(s) && !isCode(s));
const marca     = getAttr('Marca');
const fabricante = getAttr('Fabricante');
const modelo    = getAttr('Modelo');
const submodelo = getAttr('Submodelo');
const linea     = getAttr('Línea') || getAttr('Linea');

function buildEditorialSlug() {
  const fullName = item.name || '';
  const appleWatch = fullName.match(/\bapple\s+watch\s+series\s+(\d+)\b/i);
  if (appleWatch) {
    const watchParts = ['apple', 'watch', 'series', appleWatch[1]];
    const watchSize = fullName.match(/\b(\d{2})\s*mm\b/i)?.[1];
    if (watchSize) watchParts.push(\`\${watchSize}mm\`);
    return watchParts.join('-');
  }
  const noise = new Set([
    'de','del','la','el','los','las','para','con','sin','por','una','uno','un','y','mexico','mx',
    'color','modelo','version','edicion','nuevo','original','distribuidor','autorizado',
    'chip','cpu','gpu','nucleos','neural','engine','pulgadas','inch','inches',
    'caja','correa','aluminio','deportiva','generacion','gen','mm',
    'negro','blanco','azul','rojo','dorado','plateado','plata','neon','medianoche'
  ]);
  const parts = [];
  const add = (value) => {
    const clean = slugify(value).replace(/^de-longhi$/, 'delonghi');
    if (!clean) return;
    for (const token of clean.split('-')) {
      if (!token || token.length < 2 || noise.has(token)) continue;
      if (!parts.includes(token)) parts.push(token);
    }
  };
  add(fabricante || marca);
  add(linea);
  add(modelo);
  add(submodelo);
  for (const token of slugify(item.name || '').split('-')) {
    if (parts.length >= 5) break;
    if (!token || token.length < 2 || noise.has(token) || /^\\d+$/.test(token)) continue;
    if (!parts.includes(token)) parts.push(token);
  }
  const size = (item.name || '').match(/\\b(\\d{2}(?:\\.\\d)?)\\s*(?:\\"|pulgadas|inch|inches)\\b/i)?.[1];
  if (size) {
    const sizeToken = size.replace('.', '-');
    if (!parts.includes(sizeToken)) parts.push(sizeToken);
  }
  const storage = (item.name || '').match(/\\b(\\d+)\\s*(gb|tb)\\b/i);
  if (storage) {
    const token = (storage[1] + storage[2]).toLowerCase();
    if (!parts.includes(token)) parts.push(token);
  }
  return parts.join('-').replace(/-+/g, '-').slice(0, 70);
}

const slug = buildEditorialSlug();`,
    );
  }

  if (!code.includes("riesgos_compra_ml:")) {
    code = code.replace(
      "alternativas:  parsedAbacus.alternativas || [],",
      `alternativas:  parsedAbacus.alternativas || [],
    riesgos_compra_ml: parsedAbacus.riesgos_compra_ml || [],
    checklist_antes_de_comprar: parsedAbacus.checklist_antes_de_comprar || [],
    comparativa_editorial: parsedAbacus.comparativa_editorial || [],
    mejor_alternativa: parsedAbacus.mejor_alternativa || null,
    keyword_targets: parsedAbacus.keyword_targets || [],
    evidencia_limitaciones: parsedAbacus.evidencia_limitaciones || null,`,
    );
  }

  code = code.replace(
    ".filter(it => it.id !== currentId && it.title && it.price)",
    ".filter(it => it.id !== currentId && it.title && it.price && it.permalink)",
  );

  code = code.replace(
    `return ($('Get Similar Products').first().json.results || [])
        .filter(it => it.id !== currentId && it.title && it.price && it.permalink)
        .slice(0, 5)
        .map(it => ({`,
    `const similarResults = ($('Get Similar Products').first().json.results || [])
        .filter(it => it.id !== currentId && it.title && it.price && it.permalink)
        .slice(0, 5);
      return similarResults.map(it => ({`,
  );

  node.parameters.jsCode = code;
}
