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
    addExecuteTrigger(workflow, "Poll Telegram");
  }

  if (workflow.name === "AfiliadosML - Scheduler 7am") {
    addExecuteTrigger(workflow, "Leer Sheet");
  }

  if (workflow.name === "AfiliadosML") {
    patchMainReviewWorkflow(workflow);
  }

  sanitizeWorkflowForImport(workflow);

  // CLI execution is explicit; do not let imported schedules run as daemons.
  workflow.active = false;

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

function patchMainReviewWorkflow(workflow) {
  patchSimilarProducts(workflow);
  patchFreeYoutubeTranscripts(workflow);
  patchBuildPromptV4(workflow);
  patchBuildFinalJsonV4(workflow);
}

function patchSimilarProducts(workflow) {
  const node = findNode(workflow, "Get Similar Products");
  node.parameters.url =
    "=https://api.mercadolibre.com/sites/MLM/search?q={{ encodeURIComponent([(($('Get Data ML').first().json.attributes.find(a => a.name === 'Marca') || {}).value_name || ''), (($('Get Data ML').first().json.attributes.find(a => a.name === 'Línea') || {}).value_name || ''), (($('Get Data ML').first().json.attributes.find(a => a.name === 'Modelo') || {}).value_name || ''), ($('Get Data ML').first().json.name || '').split(' ').slice(0,3).join(' ')].filter(Boolean).join(' ')) }}&price={{ Math.round((($('Get Item Sellers').first().json.results || [])[0] || {}).price * 0.65 || 0) }}-{{ Math.round((($('Get Item Sellers').first().json.results || [])[0] || {}).price * 1.6 || 0) }}&sort=relevance&limit=10";
}

function patchFreeYoutubeTranscripts(workflow) {
  const node = findNode(workflow, "Transcripciones");
  node.parameters.jsCode = `// Transcripciones v3: captions publicas gratis primero; Supadata solo fallback
const SUPADATA_API_KEY = $env.SUPADATA_API_KEY;
const videos = $('Top videos').first().json.items || [];

const partes = [];
let conTranscripcion = 0;
let viaYoutube = 0;
let viaSupadata = 0;

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

async function getSupadataTranscript(videoId, lang) {
  if (!SUPADATA_API_KEY) return '';
  try {
    const res = await this.helpers.httpRequest({
      method: 'GET',
      url: 'https://api.supadata.ai/v1/youtube/transcript',
      qs: { videoId, text: 'true', lang },
      headers: { 'x-api-key': SUPADATA_API_KEY },
      json: true,
    });
    return (res.content || '').toString().slice(0, 6000);
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

  if (!transcript) {
    transcript = await getSupadataTranscript.call(this, id, 'es')
      || await getSupadataTranscript.call(this, id, 'en');
    if (transcript) {
      viaSupadata++;
      fuente = 'supadata';
    }
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
  transcripciones_supadata: viaSupadata,
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
- Genera "evidencia_limitaciones" explicando en una frase que no hubo prueba propia y que se sintetizaron fuentes externas, compradores y especificaciones.
- El "seo_title" debe usar el ano \${currentYear} si incluye ano. Prohibido usar anos viejos.
- CALIBRACION DEL SCORE: no castigues dos veces por "sin prueba propia" o por "opiniones poco detalladas". Eso debe aparecer en evidencia_limitaciones, pero el score debe reflejar el valor real del producto segun especificaciones, compradores y fuentes externas. Si el producto tiene fortalezas claras y los problemas son principalmente salto incremental o evidencia parcial, normalmente debe quedar en 7.8-8.4, no en 7.0-7.4. Reserva scores menores a 7.5 para fallas concretas, mala relacion precio/valor, quejas recurrentes, specs debiles o incompatibilidades importantes.

ESTRUCTURA DEL ARTÍCULO`,
    );
  }

  if (!code.includes("riesgos_compra_ml")) {
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
      const sellerFallback = similarResults.length > 0 ? [] : ($('Get Item Sellers').first().json.results || [])
        .filter(it => it.item_id !== bestSeller.item_id && it.item_id && it.price)
        .slice(0, 5)
        .map(it => ({
          id:             it.item_id,
          title:          item.name,
          price:          it.price,
          original_price: it.original_price || it.price,
          thumbnail:      item.pictures?.[0]?.url || null,
          permalink:      'https://articulo.mercadolibre.com.mx/' + it.item_id.replace(/^(ML[A-Z])/i, '$1-'),
          shipping:       { free_shipping: it.shipping?.free_shipping || false },
        }));
      const sourceResults = similarResults.length > 0 ? similarResults : sellerFallback;
      return sourceResults.map(it => ({`,
  );

  node.parameters.jsCode = code;
}
