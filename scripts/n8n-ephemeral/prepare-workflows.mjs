import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const sourceDir = path.join(root, "n8n-backup");
const outDir = path.join(root, ".tmp", "n8n-ephemeral", "workflows");
const publishedReviewMeta = readPublishedReviewMeta();

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const files = fs.readdirSync(sourceDir).filter((file) => file.endsWith(".json"));

for (const file of files) {
  const sourcePath = path.join(sourceDir, file);
  const workflow = JSON.parse(fs.readFileSync(sourcePath, "utf8").replace(/^\uFEFF/, ""));

  if (workflow.name === "AfiliadosML - Telegram Poll") {
    patchTelegramPoll(workflow);
    patchTelegramPollReviewCandidates(workflow);
    patchPollExecuteWorkflowNodes(workflow);
    addExecuteTrigger(workflow, "Poll Telegram");
  }

  if (workflow.name === "AfiliadosML - Scheduler 7am") {
    patchSchedulerReviewCandidates(workflow);
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

const mainSourcePath = path.join(sourceDir, "iSQ59pcFepjqmBvC_AfiliadosML.json");
const mainSourceWorkflow = JSON.parse(fs.readFileSync(mainSourcePath, "utf8").replace(/^\uFEFF/, ""));
const freshnessWorkflow = buildFreshnessWorkflow(mainSourceWorkflow);
sanitizeWorkflowForImport(freshnessWorkflow);
fs.writeFileSync(
  path.join(outDir, "freshness_AfiliadosML - Freshness.json"),
  JSON.stringify(freshnessWorkflow, null, 2),
);

console.log(`Prepared ${files.length + 1} workflows in ${path.relative(root, outDir)}`);

function readPublishedReviewMeta() {
  const dataDir = path.join(root, "data");
  const meta = { slugs: [], candidateIds: [] };
  if (!fs.existsSync(dataDir)) return meta;

  for (const file of fs.readdirSync(dataDir).filter((entry) => entry.endsWith(".json"))) {
    try {
      const review = JSON.parse(fs.readFileSync(path.join(dataDir, file), "utf8").replace(/^\uFEFF/, ""));
      if (review?.meta?.slug) meta.slugs.push(String(review.meta.slug));
      if (review?.meta?.candidate_id) meta.candidateIds.push(String(review.meta.candidate_id));
    } catch {
      // Ignore draft or malformed local files; audit scripts report those separately.
    }
  }

  return {
    slugs: [...new Set(meta.slugs)].sort(),
    candidateIds: [...new Set(meta.candidateIds)].sort(),
  };
}

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
    if (node.name !== "Run Main" && node.name !== "Run Main New" && node.name !== "Run Main Candidate") continue;
    node.type = "n8n-nodes-base.noOp";
    node.typeVersion = 1;
    node.parameters = {};
  }
}

function reviewCandidatesSheetName() {
  return {
    __rl: true,
    value: "review_candidates",
    mode: "name",
    cachedResultName: "review_candidates",
  };
}

function buildFreshnessWorkflow(mainWorkflow) {
  const getTokens = structuredClone(findNode(mainWorkflow, "Get tokens"));
  const refreshToken = structuredClone(findNode(mainWorkflow, "Refresh Token"));
  const putTokens = structuredClone(findNode(mainWorkflow, "Put Tokens"));
  const markDone = findNode(mainWorkflow, "Mark Done");

  getTokens.id = "freshness-get-tokens";
  getTokens.name = "Get tokens";
  getTokens.position = [-240, 0];
  refreshToken.id = "freshness-refresh-token";
  refreshToken.name = "Refresh Token";
  refreshToken.position = [0, 0];
  putTokens.id = "freshness-put-tokens";
  putTokens.name = "Put Tokens";
  putTokens.position = [240, 0];

  return {
    id: "freshnessAfML2026",
    name: "AfiliadosML - Freshness",
    active: false,
    nodes: [
      {
        id: "freshness-trigger",
        name: "Ephemeral Execute Trigger",
        type: "n8n-nodes-base.executeWorkflowTrigger",
        typeVersion: 1,
        position: [-480, 0],
        parameters: {},
      },
      getTokens,
      refreshToken,
      putTokens,
      {
        id: "freshness-check",
        name: "Check Freshness",
        type: "n8n-nodes-base.code",
        typeVersion: 2,
        position: [480, 0],
        parameters: {
          jsCode: `const accessToken = $('Refresh Token').first().json.access_token;
const githubToken = $env.GITHUB_TOKEN;
const owner = 'HitoFlores';
const repo = 'AfiliadosML';
const checkedAt = new Date().toISOString();

if (!githubToken) {
  throw new Error('GITHUB_TOKEN is required for freshness metadata commits');
}

const gh = async (method, path, body) => this.helpers.httpRequest({
  method,
  url: 'https://api.github.com/repos/' + owner + '/' + repo + path,
  headers: {
    Authorization: 'Bearer ' + githubToken,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  },
  body: body ? JSON.stringify(body) : undefined,
  json: true,
});

const ml = async (path) => this.helpers.httpRequest({
  method: 'GET',
  url: 'https://api.mercadolibre.com' + path,
  headers: { Authorization: 'Bearer ' + accessToken },
  ignoreResponseCode: true,
  json: true,
});

const files = (await gh('GET', '/contents/data?ref=main'))
  .filter((entry) => entry.type === 'file' && entry.name.endsWith('.json'));

const stale = [];
const checked = [];

for (const file of files) {
  const current = await gh('GET', '/contents/data/' + encodeURIComponent(file.name) + '?ref=main');
  const review = JSON.parse(Buffer.from(current.content, 'base64').toString('utf8'));
  const itemId = review.vendedor?.item_id;
  const catalogProductId = review.meta?.producto_id;
  const previousPrice = Number(review.precio?.actual || 0);
  const priorFreshness = review.freshness || {};

  const freshness = {
    checked_at: checkedAt,
    item_id: itemId || null,
    catalog_product_id: catalogProductId || null,
    status: 'unknown',
    is_available: false,
    stale: true,
    stale_reason: 'missing_item_id',
    price_previous: previousPrice || null,
    price_current: null,
    price_delta_pct: null,
    available_quantity: null,
    permalink: null,
    error_msg: null,
  };

  if (catalogProductId) {
    try {
      const response = await ml('/products/' + catalogProductId + '/items?limit=20');
      if (response?.error || response?.statusCode >= 400 || response?.status === 403) {
        freshness.status = 'api_error';
        freshness.error_msg = response.message || response.error || 'ml_api_error';
        freshness.stale_reason = 'api_error';
      } else {
        const results = Array.isArray(response.results) ? response.results : [];
        const item = results.find((entry) => entry.item_id === itemId) || results[0] || null;
        if (!item) {
          freshness.status = 'no_seller_items';
          freshness.error_msg = 'ML returned no seller items for catalog product';
          freshness.stale_reason = 'no_seller_items';
        } else {
          const currentPrice = Number(item.price || 0);
          const deltaPct = previousPrice > 0 && currentPrice > 0
            ? Number((((currentPrice - previousPrice) / previousPrice) * 100).toFixed(2))
            : null;
          const availableQuantityRaw = item.available_quantity;
          const availableQuantity = availableQuantityRaw === undefined || availableQuantityRaw === null
            ? null
            : Number(availableQuantityRaw);
          const status = String(item.status || (currentPrice > 0 ? 'active_inferred' : 'unknown'));
          const inactive = !['active', 'active_inferred'].includes(status);
          const noStock = availableQuantity !== null && availableQuantity <= 0;
          const missingPrice = currentPrice <= 0;
          const priceTooHigh = deltaPct !== null && deltaPct >= 20;

          freshness.item_id = item.item_id || itemId || null;
          freshness.status = status;
          freshness.is_available = !inactive && !noStock && !missingPrice;
          freshness.stale = inactive || noStock || missingPrice || priceTooHigh;
          freshness.stale_reason = inactive
            ? 'inactive_listing'
            : noStock
            ? 'no_stock'
            : missingPrice
            ? 'missing_price'
            : priceTooHigh
            ? 'price_increased_20pct'
            : '';
          freshness.price_current = currentPrice || null;
          freshness.price_delta_pct = deltaPct;
          freshness.available_quantity = availableQuantity;
          freshness.permalink = item.permalink || null;
        }
      }
    } catch (error) {
      freshness.status = 'exception';
      freshness.error_msg = error.message || String(error);
      freshness.stale_reason = 'exception';
    }
  }

  const changed = JSON.stringify(priorFreshness) !== JSON.stringify(freshness);
  review.freshness = freshness;
  checked.push({
    slug: review.meta?.slug,
    item_id: itemId,
    status: freshness.status,
    stale: freshness.stale,
    stale_reason: freshness.stale_reason,
    price_delta_pct: freshness.price_delta_pct,
    changed,
  });

  if (freshness.stale) stale.push(checked[checked.length - 1]);

  if (changed) {
    await gh('PUT', '/contents/data/' + encodeURIComponent(file.name), {
      message: 'chore: refresh ' + review.meta.slug + ' freshness',
      content: Buffer.from(JSON.stringify(review, null, 2)).toString('base64'),
      sha: current.sha,
    });
  }
}

return [{
  json: {
    checked_at: checkedAt,
    checked_count: checked.length,
    changed_count: checked.filter((entry) => entry.changed).length,
    stale_count: stale.length,
    checked,
    stale,
  },
}];`,
        },
      },
      {
        id: "freshness-get-candidates",
        name: "Get Review Candidates",
        type: "n8n-nodes-base.googleSheets",
        typeVersion: 4.5,
        position: [720, 0],
        continueOnFail: true,
        alwaysOutputData: true,
        parameters: {
          documentId: markDone.parameters.documentId,
          sheetName: reviewCandidatesSheetName(),
          options: {},
        },
        credentials: markDone.credentials,
      },
      {
        id: "freshness-build-stale-alert",
        name: "Build Stale Alert",
        type: "n8n-nodes-base.code",
        typeVersion: 2,
        position: [720, 240],
        parameters: {
          jsCode: `const result = $('Check Freshness').first().json;
const stale = result.stale || [];
if (!stale.length) return [];

const lines = stale.slice(0, 10).map((entry, index) => {
  const delta = entry.price_delta_pct === null || entry.price_delta_pct === undefined
    ? ''
    : ' (' + entry.price_delta_pct + '%)';
  return (index + 1) + '. ' + entry.slug + ' - ' + entry.stale_reason + delta;
});

return [{
  json: {
    text: 'Freshness detecto ' + stale.length + ' review(s) stale\\n\\n' + lines.join('\\n') + '\\n\\nSe repriorizaran candidatos relacionados si existen.',
  },
}];`,
        },
      },
      {
        id: "freshness-send-stale-alert",
        name: "Notify Stale Alert",
        type: "n8n-nodes-base.httpRequest",
        typeVersion: 4.2,
        position: [960, 240],
        parameters: {
          method: "POST",
          url: "=https://api.telegram.org/bot{{ $env.TELEGRAM_BOT_TOKEN }}/sendMessage",
          sendBody: true,
          contentType: "raw",
          rawContentType: "application/json",
          body: "={{ JSON.stringify({ chat_id: $env.TELEGRAM_CHAT_ID, text: $json.text }) }}",
          options: {},
        },
      },
      {
        id: "freshness-reprioritize",
        name: "Reprioritize Candidates",
        type: "n8n-nodes-base.code",
        typeVersion: 2,
        position: [960, 0],
        parameters: {
          jsCode: `const stale = $('Check Freshness').first().json.stale || [];
const staleBySlug = new Map(stale.map((entry) => [entry.slug, entry]));
if (!staleBySlug.size) return [];

const rows = $input.all().map((item) => item.json).filter((row) => !row.error);
const updates = [];
for (const row of rows) {
  const status = String(row.status || '').toLowerCase().trim();
  const staleSource = staleBySlug.get(row.source_slug);
  if (!staleSource || status !== 'pending' || !row.row_number) continue;

  const currentScore = Number(row.priority_score || 0);
  const boost = staleSource.stale_reason === 'price_increased_20pct' ? 15 : 25;
  const nextScore = Math.min(100, Math.max(currentScore, currentScore + boost));
  const reason = String(row.reason || '').replace(/^Freshness: [^|]+\\|\\s*/i, '');

  updates.push({
    json: {
      row_number: row.row_number,
      priority_score: nextScore,
      reason: 'Freshness: ' + staleSource.stale_reason + ' en ' + staleSource.slug + ' | ' + reason,
      updated_at: new Date().toISOString(),
    },
  });
}

return updates;`,
        },
      },
      {
        id: "freshness-update-candidates",
        name: "Update Candidate Priority",
        type: "n8n-nodes-base.googleSheets",
        typeVersion: 4.5,
        position: [1200, 0],
        parameters: {
          operation: "update",
          documentId: markDone.parameters.documentId,
          sheetName: reviewCandidatesSheetName(),
          columns: {
            mappingMode: "defineBelow",
            value: {
              row_number: "={{ $json.row_number }}",
              priority_score: "={{ $json.priority_score }}",
              reason: "={{ $json.reason }}",
              updated_at: "={{ $json.updated_at }}",
            },
            matchingColumns: ["row_number"],
            schema: [],
            attemptToConvertTypes: false,
            convertFieldsToString: true,
          },
          options: {},
        },
        credentials: markDone.credentials,
      },
    ],
    connections: {
      "Ephemeral Execute Trigger": {
        main: [[{ node: "Get tokens", type: "main", index: 0 }]],
      },
      "Get tokens": {
        main: [[{ node: "Refresh Token", type: "main", index: 0 }]],
      },
      "Refresh Token": {
        main: [[{ node: "Put Tokens", type: "main", index: 0 }]],
      },
      "Put Tokens": {
        main: [[{ node: "Check Freshness", type: "main", index: 0 }]],
      },
      "Check Freshness": {
        main: [[
          { node: "Get Review Candidates", type: "main", index: 0 },
          { node: "Build Stale Alert", type: "main", index: 0 },
        ]],
      },
      "Build Stale Alert": {
        main: [[{ node: "Notify Stale Alert", type: "main", index: 0 }]],
      },
      "Get Review Candidates": {
        main: [[{ node: "Reprioritize Candidates", type: "main", index: 0 }]],
      },
      "Reprioritize Candidates": {
        main: [[{ node: "Update Candidate Priority", type: "main", index: 0 }]],
      },
    },
    settings: {
      executionOrder: "v1",
    },
  };
}

function patchSchedulerReviewCandidates(workflow) {
  if (workflow.nodes.some((node) => node.name === "Leer Review Candidates")) return;

  const leerSheet = findNode(workflow, "Leer Sheet");
  const crearWaiting = findNode(workflow, "Crear waiting_link");
  const pedir = findNode(workflow, "Pedir Articulo del Dia");

  workflow.nodes.push(
    {
      id: "sched-review-candidates-read",
      name: "Leer Review Candidates",
      type: "n8n-nodes-base.googleSheets",
      typeVersion: 4.5,
      position: [1340, 420],
      continueOnFail: true,
      alwaysOutputData: true,
      parameters: {
        documentId: leerSheet.parameters.documentId,
        sheetName: reviewCandidatesSheetName(),
        options: {},
      },
      credentials: leerSheet.credentials,
    },
    {
      id: "sched-review-candidates-build",
      name: "Armar Mensaje Candidates",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [1560, 420],
      parameters: {
        jsCode: `const sd = $getWorkflowStaticData('global');
const rows = $input.all().map(i => i.json).filter(r => !r.error);
const publishedSlugs = new Set(${JSON.stringify(publishedReviewMeta.slugs)});
const publishedCandidateIds = new Set(${JSON.stringify(publishedReviewMeta.candidateIds)});
const hiddenStatuses = new Set(['done', 'ready', 'processing', 'discarded']);
const tierRank = (tier) => {
  const t = String(tier || 'unknown').toLowerCase().trim();
  if (t === 'superior') return 0;
  if (t === 'economico') return 1;
  if (t === 'similar') return 2;
  return 3;
};
const pending = rows
  .filter(r => String(r.status || '').toLowerCase().trim() === 'pending')
  .filter(r => !hiddenStatuses.has(String(r.status || '').toLowerCase().trim()))
  .filter(r => !publishedSlugs.has(String(r.target_slug || '').trim()))
  .filter(r => !publishedCandidateIds.has(String(r.candidate_id || '').trim()))
  .sort((a, b) => (tierRank(a.candidate_tier) - tierRank(b.candidate_tier)) || (Number(b.priority_score || 0) - Number(a.priority_score || 0)))
  .slice(0, 3);

const base = 'Candidatos para el siguiente review';
if (!pending.length) {
  return [{ json: {
    text: 'Buenos dias! Que articulo analizamos hoy?\\n\\nMandame el link del producto en Mercado Libre (responde a ESTE mensaje):',
    has_candidates: false,
  }}];
}

const shorten = (value, max = 90) => {
  const text = String(value || '').replace(/\\s+/g, ' ').trim();
  return text.length > max ? text.slice(0, max - 1).trim().replace(/[.,;:]$/, '') + '...' : text;
};

const batchId = 'sched-' + Date.now();
const lines = pending.map((c, idx) => (idx + 1) + ' - ' + shorten(c.candidate_name));
sd.review_candidate_snapshot = pending.map((c, idx) => ({
  index: idx + 1,
  candidate_id: c.candidate_id,
  row_number: c.row_number,
  batch_id: batchId,
  shown_at: new Date().toISOString(),
}));

return [{ json: {
  text: base + '\\n\\n' + lines.join('\\n') + '\\n\\nResponde con una linea por candidato:\\n1 - https://meli.la/...\\n2 - descartar',
  has_candidates: true,
  snapshot: sd.review_candidate_snapshot,
}}];`,
      },
    },
    {
      id: "sched-review-candidates-snapshot-build",
      name: "Build Candidate Snapshot Updates",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [1780, 640],
      parameters: {
        jsCode: `const snapshot = $('Armar Mensaje Candidates').first().json.snapshot || [];
return snapshot
  .filter(entry => entry.row_number)
  .map(entry => ({
    json: {
      row_number: entry.row_number,
      shown_batch_id: entry.batch_id,
      shown_index: entry.index,
      shown_at: entry.shown_at,
    },
  }));`,
      },
    },
    {
      id: "sched-review-candidates-snapshot-save",
      name: "Persist Candidate Snapshot",
      type: "n8n-nodes-base.googleSheets",
      typeVersion: 4.5,
      position: [2000, 640],
      continueOnFail: true,
      parameters: {
        operation: "update",
        documentId: leerSheet.parameters.documentId,
        sheetName: reviewCandidatesSheetName(),
        columns: {
          mappingMode: "defineBelow",
          value: {
            row_number: "={{ $json.row_number }}",
            shown_batch_id: "={{ $json.shown_batch_id }}",
            shown_index: "={{ $json.shown_index }}",
            shown_at: "={{ $json.shown_at }}",
          },
          matchingColumns: ["row_number"],
          schema: [],
          attemptToConvertTypes: false,
          convertFieldsToString: true,
        },
        options: {},
      },
      credentials: leerSheet.credentials,
    },
    {
      id: "sched-review-candidates-waiting-link",
      name: "Needs Waiting Link",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [1780, 560],
      parameters: {
        jsCode: `const msg = $('Armar Mensaje Candidates').first().json;
if (msg.has_candidates) return [];
return [{ json: { create_waiting_link: true } }];`,
      },
    },
  );

  workflow.connections["Crear waiting_link"] = {
    main: [],
  };
  workflow.connections["Leer Review Candidates"] = {
    main: [[{ node: "Armar Mensaje Candidates", type: "main", index: 0 }]],
  };
  workflow.connections["Armar Mensaje Candidates"] = {
    main: [[
      { node: "Pedir Articulo del Dia", type: "main", index: 0 },
      { node: "Build Candidate Snapshot Updates", type: "main", index: 0 },
      { node: "Needs Waiting Link", type: "main", index: 0 },
    ]],
  };
  workflow.connections["Build Candidate Snapshot Updates"] = {
    main: [[{ node: "Persist Candidate Snapshot", type: "main", index: 0 }]],
  };
  workflow.connections["Needs Waiting Link"] = {
    main: [[{ node: "Crear waiting_link", type: "main", index: 0 }]],
  };

  const switchTargets = workflow.connections["Ya existe?"]?.main ?? [];
  if (switchTargets[2]) {
    switchTargets[2] = [{ node: "Leer Review Candidates", type: "main", index: 0 }];
    workflow.connections["Ya existe?"].main = switchTargets;
  }

  pedir.position = [1780, 420];
  pedir.parameters.body =
    '={{ JSON.stringify({ chat_id: $env.TELEGRAM_CHAT_ID, text: $(\'Armar Mensaje Candidates\').first().json.text, reply_markup: { force_reply: true, input_field_placeholder: "1 - https://meli.la/..." } }) }}';
}

function patchTelegramPollReviewCandidates(workflow) {
  if (workflow.nodes.some((node) => node.name === "Leer Candidates Poll")) return;

  const getQueue = findNode(workflow, "Get Queue Poll");
  const tipo = findNode(workflow, "Tipo Mensaje");
  const addToQueue = findNode(workflow, "Add to Queue");

  findNode(workflow, "Poll Telegram").parameters.jsCode = `const sd    = $getWorkflowStaticData('global');
let offset  = sd.tg_offset || 0;
const TOKEN = $env.TELEGRAM_BOT_TOKEN;
const CHAT  = $env.TELEGRAM_CHAT_ID;

const tg = async (text, extra = {}) => this.helpers.httpRequest({
  method: 'POST',
  url: 'https://api.telegram.org/bot' + TOKEN + '/sendMessage',
  body: { chat_id: CHAT, text, parse_mode: 'Markdown', ...extra },
  json: true,
});

const bumpError = async () => {
  sd.consecutive_errors = (sd.consecutive_errors || 0) + 1;
  if (sd.consecutive_errors >= 2) {
    await tg('ALERTA: Dos errores seguidos. Deteniendo el procesamiento. Revisa el flujo y reactiva el Poll desde n8n cuando estes listo.');
    sd.consecutive_errors = 0;
    return true;
  }
  return false;
};

const res = await this.helpers.httpRequest({
  method: 'GET',
  url: 'https://api.telegram.org/bot' + TOKEN + '/getUpdates',
  qs: offset ? { offset } : {},
  json: true,
});
const updates = res.result || [];
if (!updates.length) return [];

let maxId = offset - 1;
let referido = null;
let askLink = false;
let nuevoArticulo = null;
let shouldStop = false;
let confirmFlag = false;
const candidateActions = [];

const isMlLink = (t) => Boolean(t && (t.includes('meli.la/') || t.includes('mercadolibre')));
const looksLikeLink = (t) => Boolean(t && (t.startsWith('http') || t.startsWith('www.') || t.startsWith('meli')));
const discardWords = new Set(['descartar', 'eliminar', 'basura', 'drop', 'delete']);
const isSchedulerReply = (rt) =>
  rt.includes('articulo') || rt.includes('Mercado Libre') || rt.includes('Buenos dias') || rt.includes('Candidatos para el siguiente review');
const isReferidoReply = (rt) =>
  rt.includes('ML Partners') || rt.includes('link de afiliado') || rt.includes('mejor vendedor') || rt.includes('genera el link');

const candidateHintForIndex = (replyText, index) => {
  const pattern = new RegExp('^\\\\s*' + index + '\\\\s*[-.)]\\\\s*(.+)$');
  const line = String(replyText || '').split(/\\n+/).map(x => x.trim()).find(x => pattern.test(x));
  if (!line) return '';
  return (line.match(pattern)?.[1] || '').replace(/\\s+/g, ' ').trim();
};

const parseCandidateActions = (text, replyText = '') => {
  const lines = String(text || '').split(/\\n+/).map(line => line.trim()).filter(Boolean);
  if (!lines.length) return { actions: [], invalid: false };
  const actions = [];
  let sawNumber = false;
  let invalid = false;

  for (const line of lines) {
    const match = line.match(/^(\\d+)\\s*(?:[-.)]\\s*)?(\\S+)(?:\\s+.*)?$/);
    if (!match) {
      if (/^\\d+\\b/.test(line)) invalid = true;
      continue;
    }
    sawNumber = true;
    const index = Number(match[1]);
    const value = match[2];
    const actionWord = value.toLowerCase().trim();
    if (looksLikeLink(value) && isMlLink(value)) {
      actions.push({ candidate_index: index, candidate_name_hint: candidateHintForIndex(replyText, index), action: 'ready', referido: value });
    } else if (discardWords.has(actionWord)) {
      actions.push({ candidate_index: index, candidate_name_hint: candidateHintForIndex(replyText, index), action: 'discard' });
    } else {
      invalid = true;
    }
  }

  return { actions, invalid: invalid || (sawNumber && !actions.length) };
};

const resolveMeliLa = async (meliUrl) => {
  try {
    const html = await this.helpers.httpRequest({
      method: 'GET', url: meliUrl,
      followRedirects: true, ignoreResponseCode: true,
    });
    const htmlStr = typeof html === 'string' ? html : JSON.stringify(html);
    const mlmMatch = htmlStr.match(/MLM[0-9]{6,}/);
    if (!mlmMatch) return null;
    const mlmId = mlmMatch[0];
    const hrefMatch = htmlStr.match(/href="https?:\\/\\/www\\.mercadolibre\\.com\\.mx\\/([^\\/\\?"]+)\\/p\\/(MLM[0-9]+)/);
    let nombre = mlmId;
    if (hrefMatch && hrefMatch[1]) {
      nombre = hrefMatch[1].split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
    const precioMatch = htmlStr.match(/\\$\\s*([\\d,]+(?:\\.\\d{2})?)/);
    const precio = precioMatch ? '$' + precioMatch[1] + ' MXN' : '';
    return { catalogUrl: 'https://www.mercadolibre.com.mx/p/' + mlmId, mlmId, nombre, precio };
  } catch(e) { return null; }
};

for (const u of updates) {
  if (shouldStop) break;
  if (u.update_id > maxId) maxId = u.update_id;
  const msg = u.message || {};
  const text = (msg.text || '').trim();
  const replyTo = (msg.reply_to_message && msg.reply_to_message.text) || '';
  const isCandidateReply = /Candidatos para el siguiente review/i.test(replyTo);

  if (/^\\/articulo_correcto/i.test(text)) {
    const url = sd.pending_articulo || 'CONFIRM_FROM_SHEET';
    if (url) {
      sd.consecutive_errors = 0;
      delete sd.pending_articulo; delete sd.pending_nombre;
      nuevoArticulo = url;
      await tg('Perfecto! Buscando el mejor vendedor para *' + (sd.pending_nombre || 'el articulo confirmado') + '*...');
    } else {
      await tg('No hay ningun articulo pendiente de confirmacion.');
    }
    continue;
  }

  if (/^\\/articulo_incorrecto/i.test(text)) {
    delete sd.pending_articulo; delete sd.pending_nombre;
    shouldStop = await bumpError();
    if (!shouldStop) {
      await tg('Entendido. Manda el link correcto (intento ' + sd.consecutive_errors + ' de 2).', {
        reply_markup: { force_reply: true, input_field_placeholder: 'https://meli.la/...' }
      });
    }
    continue;
  }

  const parsedCandidates = parseCandidateActions(text, replyTo);
  if (parsedCandidates.invalid || (isCandidateReply && !parsedCandidates.actions.length)) {
    await tg('Formato invalido. Usa una linea por candidato:\\n1 - https://meli.la/...\\n2 - descartar\\n3 - https://meli.la/...', {
      reply_markup: { force_reply: true, input_field_placeholder: '1 - https://meli.la/...' }
    });
    continue;
  }
  if (parsedCandidates.actions.length) {
    candidateActions.push(...parsedCandidates.actions);
    sd.consecutive_errors = 0;
    continue;
  }

  const m = text.match(/^\\/referido\\s+(\\S+)/i);
  if (m) { referido = m[1]; sd.consecutive_errors = 0; continue; }
  if (/^\\/referido\\s*$/i.test(text)) { askLink = true; continue; }

  if (isReferidoReply(replyTo) && looksLikeLink(text)) {
    referido = text.split(/\\s+/)[0];
    sd.consecutive_errors = 0;
    continue;
  }

  if (/link del referido/i.test(replyTo) || /pegalo en la sheet/i.test(replyTo)) {
    referido = text.split(/\\s+/)[0];
    sd.consecutive_errors = 0;
    continue;
  }

  if (!isCandidateReply && (isSchedulerReply(replyTo) || looksLikeLink(text))) {
    const candidato = text.split(/\\s+/)[0];
    if (!isMlLink(candidato)) {
      shouldStop = await bumpError();
      if (!shouldStop) {
        await tg('Ese link no parece ser de Mercado Libre (intento ' + (sd.consecutive_errors) + ' de 2).\\n\\nMandame el link de afiliado (meli.la/...).', {
          reply_markup: { force_reply: true, input_field_placeholder: 'https://meli.la/...' }
        });
      }
      continue;
    }

    await tg('Verificando tu link...');
    const info = await resolveMeliLa(candidato);
    if (info) {
      sd.pending_articulo = info.catalogUrl;
      sd.pending_nombre = info.nombre;
      confirmFlag = true;
      await tg(
        'Encontre este producto:\\n\\n*' + info.nombre + '*' +
        (info.precio ? '\\n' + info.precio : '') +
        '\\nID: ' + info.mlmId +
        '\\n\\n¿Es correcto?',
      { reply_markup: { keyboard: [[{text: '/articulo_correcto'}, {text: '/articulo_incorrecto'}]], resize_keyboard: true, one_time_keyboard: true } }
      );
    } else {
      shouldStop = await bumpError();
      if (!shouldStop) {
        await tg('No pude identificar el producto (intento ' + (sd.consecutive_errors) + ' de 2).\\n\\nIntenta con el link directo:\\nhttps://www.mercadolibre.com.mx/p/MLM...', {
          reply_markup: { force_reply: true, input_field_placeholder: 'https://meli.la/...' }
        });
      }
    }
    continue;
  }
}

sd.tg_offset = maxId + 1;
if (updates.length) {
  try {
    await this.helpers.httpRequest({
      method: 'GET',
      url: 'https://api.telegram.org/bot' + TOKEN + '/getUpdates',
      qs: { offset: sd.tg_offset, limit: 1 },
      json: true,
    });
  } catch (e) {}
}

if (shouldStop) return [];
if (candidateActions.length) return candidateActions.map(entry => ({ json: { tipo: 'candidate_affiliate', ...entry } }));
if (referido) return [{ json: { tipo: 'referido', referido } }];
if (nuevoArticulo) return [{ json: { tipo: 'nuevo_articulo', articulo_link: nuevoArticulo } }];
if (askLink) {
  await tg('Pega el link del referido (responde a ESTE mensaje):', {
    reply_markup: { force_reply: true, input_field_placeholder: 'https://meli.la/...' }
  });
}
if (confirmFlag) return [{ json: { tipo: 'confirmar_articulo', articulo_link: sd.pending_articulo || '', nombre: sd.pending_nombre || '' } }];
return [];`;

  tipo.parameters.output =
    "={{ $json.tipo === 'nuevo_articulo' ? 0 : $json.tipo === 'confirmar_articulo' ? 2 : $json.tipo === 'candidate_affiliate' ? 3 : 1 }}";

  workflow.nodes.push(
    {
      id: "poll-candidates-read",
      name: "Leer Candidates Poll",
      type: "n8n-nodes-base.googleSheets",
      typeVersion: 4.5,
      position: [900, 520],
      continueOnFail: true,
      alwaysOutputData: true,
      parameters: {
        documentId: getQueue.parameters.documentId,
        sheetName: reviewCandidatesSheetName(),
        options: {},
      },
      credentials: getQueue.credentials,
    },
    {
      id: "poll-candidates-find",
      name: "Find Candidate Affiliate",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [1120, 520],
      parameters: {
        jsCode: `const requests = $('Poll Telegram').all()
  .map(i => i.json)
  .filter(item => item.tipo === 'candidate_affiliate');
const sd = $getWorkflowStaticData('global');
const rows = $input.all().map(i => i.json).filter(r => !r.error);
const publishedSlugs = new Set(${JSON.stringify(publishedReviewMeta.slugs)});
const publishedCandidateIds = new Set(${JSON.stringify(publishedReviewMeta.candidateIds)});
const hiddenStatuses = new Set(['done', 'ready', 'processing', 'discarded']);
const tierRank = (tier) => {
  const t = String(tier || 'unknown').toLowerCase().trim();
  if (t === 'superior') return 0;
  if (t === 'economico') return 1;
  if (t === 'similar') return 2;
  return 3;
};
const pending = rows
  .filter(r => String(r.status || '').toLowerCase().trim() === 'pending')
  .filter(r => !hiddenStatuses.has(String(r.status || '').toLowerCase().trim()))
  .filter(r => !publishedSlugs.has(String(r.target_slug || '').trim()))
  .filter(r => !publishedCandidateIds.has(String(r.candidate_id || '').trim()))
  .sort((a, b) => (tierRank(a.candidate_tier) - tierRank(b.candidate_tier)) || (Number(b.priority_score || 0) - Number(a.priority_score || 0)));
const snapshot = Array.isArray(sd.review_candidate_snapshot) ? sd.review_candidate_snapshot : [];
const shownRows = rows
  .filter(r => String(r.shown_batch_id || '').trim() && Number(r.shown_index || 0) > 0)
  .sort((a, b) => Date.parse(b.shown_at || '') - Date.parse(a.shown_at || ''));
const latestShownBatch = String(shownRows[0]?.shown_batch_id || '').trim();
const norm = (value) => String(value || '')
  .toLowerCase()
  .normalize('NFD').replace(/[\\u0300-\\u036f]/g, '')
  .replace(/[^a-z0-9\\s]/g, ' ')
  .replace(/\\s+/g, ' ')
  .trim();
const matchesHint = (row, hint) => {
  const h = norm(hint).replace(/\\s+\\.\\.\\.$/, '').trim();
  if (!h || h.length < 6) return false;
  const name = norm(row.candidate_name);
  return name.includes(h) || h.includes(name) || name.startsWith(h.slice(0, 48));
};

const out = [];
for (const request of requests) {
  const snapshotHit = snapshot.find(entry => Number(entry.index) === Number(request.candidate_index || 0));
  const candidateId = request.candidate_id || snapshotHit?.candidate_id || '';
  const candidateIndex = Number(request.candidate_index || 0);
  const referido = request.referido;
  const action = request.action === 'discard' ? 'discard' : 'ready';
  const snapshotRow = candidateId ? rows.find(r => r.candidate_id === candidateId) : null;
  const persistedRow = latestShownBatch
    ? rows.find(r => String(r.shown_batch_id || '').trim() === latestShownBatch && Number(r.shown_index || 0) === candidateIndex)
    : null;
  const row = snapshotRow || persistedRow || pending.find(r => matchesHint(r, request.candidate_name_hint)) || pending[candidateIndex - 1];

  if (!row) {
    await this.helpers.httpRequest({
      method: 'POST',
      url: 'https://api.telegram.org/bot' + $env.TELEGRAM_BOT_TOKEN + '/sendMessage',
      body: {
        chat_id: $env.TELEGRAM_CHAT_ID,
        text: 'No encontre el candidato ' + candidateIndex + ' en review_candidates. Filas leidas: ' + rows.length + ', pending visibles: ' + pending.length + ', ultimo lote: ' + (latestShownBatch || 'n/d') + (request.candidate_name_hint ? ', texto: ' + request.candidate_name_hint : ''),
      },
      json: true,
    });
    continue;
  }

  if (action === 'ready' && !referido) continue;

  out.push({ json: {
    row_number: row.row_number,
    candidate_id: row.candidate_id,
    candidate_name: row.candidate_name,
    source_slug: row.source_slug,
    referido: referido || '',
    articulo: row.candidate_ml_url || referido,
    target_slug: row.target_slug || '',
    candidate_action: action,
    status: action === 'discard' ? 'discarded' : 'ready',
    error_msg: action === 'discard' ? 'discarded by user' : '',
  }});
}

return out;`,
      },
    },
    {
      id: "poll-candidates-update",
      name: "Mark Candidate Ready",
      type: "n8n-nodes-base.googleSheets",
      typeVersion: 4.5,
      position: [1340, 520],
      parameters: {
        operation: "update",
        documentId: getQueue.parameters.documentId,
        sheetName: reviewCandidatesSheetName(),
        columns: {
          mappingMode: "defineBelow",
          value: {
            row_number: "={{ $json.row_number }}",
            affiliate_url: "={{ $json.referido }}",
            status: "={{ $json.status }}",
            updated_at: "={{ new Date().toISOString() }}",
            error_msg: "={{ $json.error_msg }}",
          },
          matchingColumns: ["row_number"],
          schema: [],
          attemptToConvertTypes: false,
          convertFieldsToString: true,
        },
        options: {},
      },
      credentials: getQueue.credentials,
    },
    {
      id: "poll-candidates-ready-only",
      name: "Filter Candidate Queue Adds",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [1450, 520],
      parameters: {
        jsCode: `return $('Find Candidate Affiliate').all()
  .map(i => i.json)
  .filter(item => item.status === 'ready')
  .map(json => ({ json }));`,
      },
    },
    {
      id: "poll-candidates-add-queue",
      name: "Add Candidate to Queue",
      type: "n8n-nodes-base.googleSheets",
      typeVersion: 4.5,
      position: [1670, 520],
      parameters: {
        operation: "append",
        documentId: addToQueue.parameters.documentId,
        sheetName: addToQueue.parameters.sheetName,
        columns: {
          mappingMode: "defineBelow",
          value: {
            articulo: "={{ $json.articulo }}",
            referido: "={{ $json.referido }}",
            idioma: "es",
            estatus: "ready",
            candidate_id: "={{ $json.candidate_id }}",
          },
          matchingColumns: [],
          schema: [],
          attemptToConvertTypes: false,
          convertFieldsToString: true,
        },
        options: {},
      },
      credentials: addToQueue.credentials,
    },
    {
      id: "poll-candidates-notify",
      name: "Notify Candidate Ready",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [1890, 520],
      parameters: {
        method: "POST",
        url: "=https://api.telegram.org/bot{{ $env.TELEGRAM_BOT_TOKEN }}/sendMessage",
        sendBody: true,
        contentType: "raw",
        rawContentType: "application/json",
        body: "={{ JSON.stringify({ chat_id: $env.TELEGRAM_CHAT_ID, text: 'Candidato listo para generar review:\\n' + $json.candidate_name }) }}",
        options: {},
      },
    },
    {
      id: "poll-candidates-run-main",
      name: "Run Main Candidate",
      type: "n8n-nodes-base.noOp",
      typeVersion: 1,
      position: [2110, 520],
      parameters: {},
    },
  );

  const outputs = workflow.connections["Tipo Mensaje"].main;
  outputs[3] = [{ node: "Leer Candidates Poll", type: "main", index: 0 }];
  workflow.connections["Tipo Mensaje"].main = outputs;
  workflow.connections["Leer Candidates Poll"] = {
    main: [[{ node: "Find Candidate Affiliate", type: "main", index: 0 }]],
  };
  workflow.connections["Find Candidate Affiliate"] = {
    main: [[{ node: "Mark Candidate Ready", type: "main", index: 0 }]],
  };
  workflow.connections["Mark Candidate Ready"] = {
    main: [[{ node: "Filter Candidate Queue Adds", type: "main", index: 0 }]],
  };
  workflow.connections["Filter Candidate Queue Adds"] = {
    main: [[{ node: "Add Candidate to Queue", type: "main", index: 0 }]],
  };
  workflow.connections["Add Candidate to Queue"] = {
    main: [[{ node: "Notify Candidate Ready", type: "main", index: 0 }]],
  };
  workflow.connections["Notify Candidate Ready"] = {
    main: [[{ node: "Run Main Candidate", type: "main", index: 0 }]],
  };
}

function patchMainReviewWorkflow(workflow) {
  patchForceRegeneration(workflow);
  patchRouteRowCandidateId(workflow);
  patchSimilarProducts(workflow);
  patchStrictYoutubeMatching(workflow);
  patchFreeYoutubeTranscripts(workflow);
  patchBuildPromptV4(workflow);
  patchBuildFinalJsonV4(workflow);
  patchReviewCandidates(workflow);
  patchCandidateCompletion(workflow);
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
    rows.find((r) => norm(r.estatus) === 'pending') ||
    rows.find((r) => norm(r.estatus) === 'processing' && r.candidate_id && r.referido)
  );`,
  );

  code = code.replace(
    "_pass:      estatus === 'ready' ? 'pass2' : 'pass1',",
    "_pass:      forceSlug ? 'pass2' : ((estatus === 'ready' || (estatus === 'processing' && pick.candidate_id && pick.referido)) ? 'pass2' : 'pass1'),",
  );

  node.parameters.jsCode = code;
}

function patchRouteRowCandidateId(workflow) {
  const node = findNode(workflow, "Route Row");
  let code = node.parameters.jsCode;

  if (!code.includes("candidate_id: (pick.candidate_id")) {
    code = code.replace(
      "idioma:     ((pick.idioma || 'es').toString().trim() || 'es').toLowerCase(),",
      "idioma:     ((pick.idioma || 'es').toString().trim() || 'es').toLowerCase(),\n    candidate_id: (pick.candidate_id || '').toString(),",
    );
  }

  if (!code.includes("resolveShortMlLink")) {
    const start = code.indexOf("if (link.includes('meli.la/')) {");
    const end = code.indexOf("\n\n//", start + 1);
    if (start !== -1 && end !== -1) {
      code =
        code.slice(0, start) +
        `async function resolveShortMlLink(startUrl) {
  let current = startUrl;
  for (let i = 0; i < 6; i++) {
    const response = await this.helpers.httpRequest({
      method: 'GET',
      url: current,
      followRedirect: false,
      followRedirects: false,
      returnFullResponse: true,
      ignoreResponseCode: true,
    });
    const headers = response.headers || {};
    const location = headers.location || headers.Location;
    if (!location) {
      const body = typeof response.body === 'string' ? response.body : JSON.stringify(response.body || response);
      return { url: current, body };
    }
    current = new URL(location, current).toString();
    const idFromUrl = current.match(/\\/p\\/(ML[A-Z]?[0-9]+)/i) || current.match(/(ML[A-Z][0-9]{6,})/i);
    if (idFromUrl) return { url: current, product_id: idFromUrl[1].toUpperCase(), body: '' };
  }
  return { url: current, body: '' };
}

if (link.includes('meli.la/')) {
  try {
    const resolved = await resolveShortMlLink.call(this, link);
    const html = resolved.body || '';
    const firstMlm = resolved.product_id || (html.match(/MLM[0-9]{6,}/)?.[0] || '');
    if (firstMlm) {
      product_id = firstMlm.toUpperCase();
      link = resolved.url && resolved.url.includes('mercadolibre')
        ? resolved.url
        : 'https://www.mercadolibre.com.mx/p/' + product_id;
    }
  } catch(e) {
    // Si falla la resolucion, product_id queda vacio y el pipeline lo manejara.
  }
}` +
        code.slice(end);
    }
  }

  node.parameters.jsCode = code;
}

function patchSimilarProducts(workflow) {
  const node = findNode(workflow, "Get Similar Products");
  node.parameters.url =
    "=https://api.mercadolibre.com/sites/MLM/search?q={{ encodeURIComponent((() => { const item = $('Get Data ML').first().json; const attrs = item.attributes || []; const get = (...names) => { for (const n of names) { const v = (attrs.find(a => a.name === n) || {}).value_name; if (v) return v; } return ''; }; const marca = get('Fabricante','Marca').replace(/\\bde\\s+m[eé]xico\\b/i, '').trim(); const linea = get('Línea','Linea','LÃ­nea','L?nea'); const modelo = get('Modelo'); const name = item.name || ''; const text = [item.domain_id, name, linea, modelo].join(' ').toLowerCase(); if (/switch|consol/.test(text)) return 'Nintendo Switch consola'; if (/macbook|laptop|notebook|comput/.test(text)) return [marca || 'Apple', linea || 'MacBook Air', 'laptop'].filter(Boolean).join(' '); if (/watch|smartwatch|reloj/.test(text)) return [marca || 'Apple', 'watch smartwatch'].filter(Boolean).join(' '); if (/cafetera|espresso|coffee|cafe/.test(text)) return [marca || 'DeLonghi', 'cafetera espresso'].filter(Boolean).join(' '); return [marca, linea, modelo].filter(Boolean).join(' ') || name.split(' ').slice(0,4).join(' '); })()) }}&price={{ Math.max(1, Math.round((($('Get Item Sellers').first().json.results || [])[0] || {}).price * 0.35 || 1)) }}-{{ Math.round((($('Get Item Sellers').first().json.results || [])[0] || {}).price * 2.8 || 999999) }}&sort=relevance&limit=30";
  return;
  node.parameters.url =
    "=https://api.mercadolibre.com/sites/MLM/search?q={{ encodeURIComponent([(($('Get Data ML').first().json.attributes.find(a => a.name === 'Marca') || {}).value_name || ''), (($('Get Data ML').first().json.attributes.find(a => a.name === 'Línea') || {}).value_name || ''), (($('Get Data ML').first().json.attributes.find(a => a.name === 'Modelo') || {}).value_name || ''), ($('Get Data ML').first().json.name || '').split(' ').slice(0,3).join(' ')].filter(Boolean).join(' ')) }}&price={{ Math.round((($('Get Item Sellers').first().json.results || [])[0] || {}).price * 0.65 || 0) }}-{{ Math.round((($('Get Item Sellers').first().json.results || [])[0] || {}).price * 1.6 || 0) }}&sort=relevance&limit=10";
}

function patchStrictYoutubeMatching(workflow) {
  const node = findNode(workflow, "Top videos");
  node.parameters.jsCode = `// Top videos v6: multi-query evidence builder with explainable scoring.
const API_KEY = $env.YOUTUBE_API_KEY;
const item = $('Get Data ML').first().json;
const attrs = item.attributes || [];
const getAttr = (...names) => {
  for (const n of names) {
    const v = (attrs.find((a) => a.name === n) || {}).value_name;
    if (v) return v;
  }
  return '';
};
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').replace(/[^a-z0-9\\s]/g, ' ').replace(/\\s+/g, ' ').trim();
const words = (s) => norm(s).split(' ').filter(Boolean);
const uniq = (arr) => [...new Set(arr.filter(Boolean))];
const titleCase = (s) => words(s).map((w) => w.length <= 3 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)).join(' ');
const productName = item.name || '';
const marcaRaw = getAttr('Fabricante', 'Marca');
const marca = marcaRaw.replace(/\\bde\\s+m[eé]xico\\b/i, '').trim() || getAttr('Marca');
const linea = getAttr('Línea', 'Linea', 'LÃ­nea', 'L?nea');
const modelo = getAttr('Modelo');
const submodelo = getAttr('Submodelo');
const domain = item.domain_id || '';
const text = norm([domain, productName, marca, linea, modelo, submodelo].join(' '));
const profile = (() => {
  if (/macbook|laptop|notebook|comput/.test(text)) return { kind: 'laptop', category: ['macbook','laptop','notebook','computadora'], bad: ['iphone','ipad','airpods','watch','imac','mac mini','studio display','playstation','xbox','switch'] };
  if (/watch|smartwatch|reloj/.test(text)) return { kind: 'smartwatch', category: ['watch','smartwatch','reloj'], bad: ['iphone','ipad','airpods','macbook','laptop','playstation','xbox','switch'] };
  if (/switch|consol/.test(text)) return { kind: 'console', category: ['switch','consola','nintendo'], bad: ['macbook','iphone','ipad','airpods','watch','kindle'] };
  if (/cafetera|espresso|coffee|cafe/.test(text)) return { kind: 'coffee', category: ['cafetera','espresso','coffee','cafe','delonghi'], bad: ['capsulas','nespresso vertuo capsulas','molino solo','macbook','iphone','switch','playstation','xbox'] };
  if (/celular|smartphone|phone/.test(text)) return { kind: 'phone', category: ['celular','smartphone','phone'], bad: ['macbook','laptop','watch','airpods','ipad'] };
  return { kind: 'generic', category: words([linea, modelo, submodelo].join(' ')).slice(0, 4), bad: [] };
})();
const STOP = new Set(['de','del','la','el','los','las','para','con','sin','por','una','uno','un','y','color','modelo','version','edicion','nuevo','original','distribuidor','autorizado','gb','tb','ssd','ram','cpu','gpu','chip','nucleos','pulgadas','inch','inches','mx','mexico','negro','blanco','azul','rojo','plata','plateado','medianoche']);
const identityTokens = uniq(words([marca, linea, modelo, submodelo, productName].join(' ')).filter((w) => w.length > 2 && !STOP.has(w)));
const productChips = uniq(text.match(/\\bm\\d\\b/g) || []);
const commercialName = (() => {
  if (profile.kind === 'laptop' && /macbook/.test(text)) return titleCase([marca || 'Apple', linea || 'MacBook Air', /\\bm\\d\\b/i.exec(productName)?.[0] || /\\bm\\d\\b/i.exec(modelo)?.[0] || ''].join(' '));
  if (profile.kind === 'console' && /switch/.test(text)) return titleCase([marca || 'Nintendo', 'Switch', /oled/i.test(productName + ' ' + linea + ' ' + modelo) ? 'OLED' : ''].join(' '));
  if (profile.kind === 'smartwatch' && /watch/.test(text)) return titleCase([marca || 'Apple', 'Watch', linea || modelo].join(' '));
  if (profile.kind === 'coffee') return titleCase([marca || 'DeLonghi', linea || modelo || 'cafetera espresso'].join(' '));
  return titleCase([marca, linea, modelo, submodelo].filter(Boolean).join(' '));
})();
const querySeeds = uniq([
  commercialName,
  [marca, linea, modelo].filter(Boolean).join(' '),
  [marca, linea, submodelo].filter(Boolean).join(' '),
  productName.split(/[,:|-]/)[0],
].map((q) => q.trim()).filter((q) => q.length > 3));
const suffixes = ['review', 'analisis', 'reseña', 'vale la pena', 'comparativa'];
const queries = uniq(querySeeds.flatMap((q) => suffixes.slice(0, q === commercialName ? 5 : 3).map((s) => (q + ' ' + s).trim()))).slice(0, 8);
const REVIEW_TERMS = ['review','analisis','resena','reseña','vale la pena','hands on','comparativa','comparacion','opinion','should you buy','is it worth','first look','unboxing',' vs','vs ','overview','prueba','long term','after'];
const NON_REVIEW_TERMS = ['gameplay','playthrough',"let's play",'lets play','scratch test','drop test','bend test','durability test','teardown','tear down','disassembly','water test','torture test','relaxing','asmr','satisfying','walkthrough','longplay','full game','shorts','music video'];
const byId = new Map();
const queryLog = [];
for (const q of queries) {
  try {
    const res = await this.helpers.httpRequest({
      method: 'GET',
      url: 'https://www.googleapis.com/youtube/v3/search',
      qs: { part: 'snippet', q, type: 'video', order: 'relevance', regionCode: 'MX', maxResults: 10, key: API_KEY },
      json: true,
    });
    const items = res.items || [];
    queryLog.push({ q, count: items.length });
    for (const v of items) {
      const id = v.id?.videoId;
      if (!id) continue;
      if (!byId.has(id)) byId.set(id, { ...v, _queries: [q] });
      else byId.get(id)._queries.push(q);
    }
  } catch (e) {
    queryLog.push({ q, error: String(e.message || e).slice(0, 160) });
  }
}
const candidates = [...byId.values()];
function scoreVideo(v) {
  const title = norm(v.snippet?.title || '');
  const desc = norm(v.snippet?.description || '');
  const full = [title, desc].join(' ');
  const reasons = [];
  let score = 0;
  const videoChips = uniq(full.match(/\\bm\\d\\b/g) || []);
  const wrongChipOnly = productChips.length && videoChips.some((t) => !productChips.includes(t)) && !productChips.some((t) => full.includes(t));
  if (wrongChipOnly) return { accepted: false, score: -12, reason: 'generation_mismatch:' + videoChips.join(',') };
  const badTerm = profile.bad.find((t) => full.includes(norm(t)) && !text.includes(norm(t)));
  if (badTerm) return { accepted: false, score: -20, reason: 'cross_category:' + badTerm };
  const nonReview = NON_REVIEW_TERMS.find((t) => full.includes(norm(t)));
  if (nonReview) score -= 6, reasons.push('non_review:' + nonReview);
  const brandHit = marca && full.includes(norm(marca));
  if (brandHit) score += 3, reasons.push('brand');
  const categoryHits = profile.category.filter((t) => full.includes(norm(t)));
  score += Math.min(4, categoryHits.length * 2);
  if (categoryHits.length) reasons.push('category:' + categoryHits.join(','));
  const exactHits = [linea, modelo, submodelo].filter(Boolean).filter((t) => full.includes(norm(t)) || norm(t).replace(/\\s+/g, '') && full.replace(/\\s+/g, '').includes(norm(t).replace(/\\s+/g, '')));
  score += exactHits.length * 4;
  if (exactHits.length) reasons.push('exact:' + exactHits.join(','));
  const tokenHits = identityTokens.filter((t) => full.includes(t));
  score += Math.min(6, tokenHits.length);
  if (tokenHits.length) reasons.push('tokens:' + tokenHits.slice(0, 6).join(','));
  const reviewHits = REVIEW_TERMS.filter((t) => full.includes(norm(t)));
  if (reviewHits.length) score += 3, reasons.push('review:' + reviewHits[0]);
  if (v._queries?.length > 1) score += 1;
  let match_level = 'none';
  if (exactHits.length >= 2 || (brandHit && exactHits.length >= 1 && categoryHits.length)) match_level = 'exact';
  else if (brandHit && (categoryHits.length || tokenHits.length >= 2)) match_level = 'line';
  else if (categoryHits.length && tokenHits.length >= 2) match_level = 'category';
  const accepted = score >= 7 && match_level !== 'none';
  return { accepted, score, match_level, reason: reasons.join('|') || 'weak_match' };
}
const scored = candidates.map((v) => ({ v, s: scoreVideo(v) }));
const accepted = scored.filter((x) => x.s.accepted);
const ids = accepted.map((x) => x.v.id.videoId).filter(Boolean);
const stats = {};
if (ids.length) {
  const res = await this.helpers.httpRequest({ method: 'GET', url: 'https://www.googleapis.com/youtube/v3/videos', qs: { part: 'statistics', id: ids.join(','), key: API_KEY }, json: true });
  for (const it of (res.items || [])) stats[it.id] = it.statistics || {};
}
const ranked = accepted
  .map(({ v, s }) => ({ ...v, statistics: stats[v.id.videoId] || {}, match_level: s.match_level, evidence_score: s.score, evidence_reason: s.reason, _views: parseInt((stats[v.id.videoId] || {}).viewCount || '0', 10) }))
  .sort((a, b) => (b.evidence_score - a.evidence_score) || (b._views - a._views))
  .slice(0, 3);
const rejected = scored.filter((x) => !x.s.accepted).slice(0, 12).map(({ v, s }) => ({ title: v.snippet?.title || '', score: s.score, reason: s.reason, match_level: s.match_level }));
return [{ json: {
  items: ranked,
  youtube_filter: {
    version: 'v6',
    commercial_name: commercialName,
    queries,
    query_log: queryLog,
    source_count: candidates.length,
    accepted_count: ranked.length,
    rejected_sample: rejected,
    category: profile.kind,
    identity_tokens: identityTokens.slice(0, 12),
  }
} }];`;
  return;
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

  code = code.replace(
    /- Genera "comparativa_editorial" con exactamente 4 objetos:[^\n]+/,
    `- Genera "comparativa_editorial" con exactamente 4 objetos: "modelo anterior o inferior", "mejor valor", "premium" y "alternativa fuera del ecosistema". Usa primero ALTERNATIVAS EDITORIALES con candidatos reales de ML. El slot premium NUNCA puede ser el producto analizado; debe ser generacion/gama superior o un producto claramente mas caro con ventaja concreta. Si no hay candidato real, escribe que no se encontro alternativa confiable sin inventar SKUs.`,
  );

  if (!code.includes("alternativasReales")) {
    code = code.replace(
      "const idioma = ($('Route Row').first().json.idioma || 'es').toLowerCase();",
      `let alternativasReales = '';
try {
  const current = $('Get Data ML').first().json;
  const sellers = $('Get Item Sellers').first().json.results || [];
  const currentPrice = Number((sellers[0] || {}).price || 0);
  const normAlt = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').replace(/[^a-z0-9\\s]/g, ' ').replace(/\\s+/g, ' ').trim();
  const currentText = normAlt([current.name, current.domain_id].join(' '));
  const sameProduct = (it) => {
    const t = normAlt(it.title);
    if (it.id === current.id) return true;
    const currentTokens = new Set(currentText.split(' ').filter(w => w.length > 3));
    const hits = t.split(' ').filter(w => currentTokens.has(w)).length;
    return hits >= 7 && Math.abs(Number(it.price || 0) - currentPrice) / Math.max(currentPrice, 1) < 0.12;
  };
  const classify = (it) => {
    const title = normAlt(it.title);
    const price = Number(it.price || 0);
    const ratio = currentPrice ? price / currentPrice : 1;
    if (/switch\\s*2|ultra|pro|max|premium|superautomatic|super automatic|dinamica|rivelia|oracle|barista/.test(title) && ratio > 1.05) return 'premium';
    if (ratio >= 1.2) return 'premium';
    if (ratio <= 0.78) return 'economica';
    return 'mejor_valor';
  };
  const rows = ($('Get Similar Products').first().json.results || [])
    .filter(it => it.id !== current.id && it.title && it.price && it.permalink && !sameProduct(it))
    .map(it => ({ ...it, slot: classify(it) }))
    .sort((a, b) => Math.abs(Number(a.price || 0) - currentPrice) - Math.abs(Number(b.price || 0) - currentPrice));
  const pick = (slot) => rows.filter(it => it.slot === slot).slice(0, 4);
  const fmt = (slot, label) => {
    const items = pick(slot);
    return items.length
      ? label + ':\\n' + items.map(it => \`- \${it.title} | $\${Number(it.price || 0).toLocaleString('es-MX')} MXN | \${it.permalink}\`).join('\\n')
      : label + ': (sin candidato real confiable en ML)';
  };
  alternativasReales = [fmt('economica', 'ECONOMICA'), fmt('mejor_valor', 'MEJOR_VALOR'), fmt('premium', 'PREMIUM')].join('\\n\\n');
} catch(e) { alternativasReales = '(sin candidatos reales confiables)'; }

const idioma = ($('Route Row').first().json.idioma || 'es').toLowerCase();`,
    );

    code = code.replace(
      "ALTERNATIVAS EDITORIALES: los siguientes productos aparecen en ML en rango de precio similar:",
      `ALTERNATIVAS EDITORIALES: estos candidatos fueron clasificados desde Mercado Libre. Usa modelos concretos si existen. Prohibido recomendar el mismo producto como alternativa. Si un slot dice "sin candidato real confiable", dilo sin inventar marca/modelo.
\${alternativasReales}

ALTERNATIVAS EDITORIALES: los siguientes productos aparecen en ML en rango de precio similar:`,
    );
  }

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
  const appleWatchSeries = /\\bapple\\b/i.test(fullName) && /\\bwatch\\b/i.test(fullName)
    ? fullName.match(/\\bseries\\s+(\\d+)\\b/i)?.[1]
    : null;
  if (appleWatchSeries) {
    const watchParts = ['apple', 'watch', 'series', appleWatchSeries];
    const watchSize = fullName.match(/\\b(\\d{2})\\s*mm\\b/i)?.[1];
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

  if (!code.includes("display_title")) {
    code = code.replace(
      "const slug = buildEditorialSlug();",
      `const slug = buildEditorialSlug();

function buildDisplayTitle() {
  const name = item.name || '';
  const cleanSpec = (s) => String(s || '').replace(/\\b(distribuidor autorizado|nuevo|original)\\b/gi, '').replace(/\\s+/g, ' ').trim();
  const chip = (name.match(/\\bM\\d\\b/i) || modelo.match?.(/\\bM\\d\\b/i) || [''])[0].toUpperCase();
  const storage = (name.match(/\\b\\d+\\s*(?:GB|TB)\\b/i) || [''])[0].replace(/\\s+/g, ' ');
  const sizeIn = (name.match(/\\b\\d{2}(?:\\.\\d)?\\s*(?:\\"|pulgadas|inch|inches)\\b/i) || [''])[0].replace(/pulgadas|inch|inches/ig, '"').replace(/\\s+/g, '');
  const watchSeries = /\\bapple\\b/i.test(name) && /\\bwatch\\b/i.test(name) ? (name.match(/\\bseries\\s+\\d+\\b/i) || [''])[0] : '';
  const watchSize = (name.match(/\\b\\d{2}\\s*mm\\b/i) || [''])[0].replace(/\\s+/g, '');
  let title = '';
  if (/macbook/i.test([name, linea, modelo].join(' '))) title = ['Apple', linea || 'MacBook Air', sizeIn, chip, storage].filter(Boolean).join(' ');
  else if (watchSeries) title = ['Apple Watch', watchSeries.replace(/^apple\\s+watch\\s+/i, ''), watchSize].filter(Boolean).join(' ');
  else if (/switch/i.test([name, linea, modelo].join(' '))) title = ['Nintendo Switch', /oled/i.test(name + ' ' + linea + ' ' + modelo) ? 'OLED' : '', storage].filter(Boolean).join(' ');
  else if (/cafetera|espresso|coffee/i.test([name, linea, modelo].join(' '))) title = [marca || fabricante || 'DeLonghi', linea || modelo, modelo && !String(linea).includes(modelo) ? modelo : ''].filter(Boolean).join(' ');
  else title = [fabricante || marca, linea, modelo, submodelo].filter(Boolean).join(' ');
  title = cleanSpec(title || name).replace(/\\b(cpu|gpu|nucleos|neural engine|color|caja|correa)\\b/gi, '').replace(/\\s+/g, ' ').trim();
  return title.length > 60 ? title.slice(0, 57).trim().replace(/[,:;-]$/, '') + '...' : title;
}

const displayTitle = buildDisplayTitle();`,
    );

    code = code.replace(
      "nombre:   item.name,",
      "nombre:   item.name,\n    display_title: displayTitle,\n    nombre_original: item.name,",
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

  if (!code.includes("function buildSimilarProductsPayload")) {
    code = code.replace(
      "const numVids = $('Transcripciones').first().json.num_videos_con_transcripcion;",
      `const numVids = $('Transcripciones').first().json.num_videos_con_transcripcion;

function buildSimilarProductsPayload() {
  const debug = {
    source: 'Get Similar Products',
    query: null,
    received_count: 0,
    valid_count: 0,
    saved_count: 0,
    empty_reason: null,
    error_msg: null,
  };

  try {
    const currentId = $('Get Data ML').first().json.id;
    const response = $('Get Similar Products').first().json || {};
    const results = Array.isArray(response.results) ? response.results : [];
    debug.query = response.query || null;
    debug.received_count = results.length;

    const valid = results.filter(it => it.id !== currentId && it.title && it.price && it.permalink);
    debug.valid_count = valid.length;

    const productos = valid.slice(0, 5).map(it => ({
      id:             it.id,
      titulo:         it.title,
      precio:         it.price,
      precio_original: it.original_price || it.price,
      thumbnail:      it.thumbnail ? it.thumbnail.replace('http://', 'https://') : null,
      permalink:      it.permalink,
      envio_gratis:   it.shipping?.free_shipping || false,
    }));

    debug.saved_count = productos.length;
    if (debug.received_count === 0) debug.empty_reason = 'ml_returned_no_results';
    else if (debug.valid_count === 0) debug.empty_reason = 'no_valid_candidates_after_filter';
    else if (productos.length === 0) debug.empty_reason = 'valid_candidates_not_saved';

    return { productos, debug };
  } catch (e) {
    debug.empty_reason = 'exception';
    debug.error_msg = e.message || String(e);
    return { productos: [], debug };
  }
}

const similarPayload = buildSimilarProductsPayload();`,
      );

    code = code.replace(
      "youtube_debug: $('Top videos').first().json.youtube_filter || null,",
      "youtube_debug: $('Top videos').first().json.youtube_filter || null,\n  ml_search_debug: similarPayload.debug,",
    );

    code = code.replace(
      /productos_similares_ml: \(\(\) => \{\n    try \{\n      const currentId = \$\('Get Data ML'\)\.first\(\)\.json\.id;\n      const similarResults = \$\('Get Similar Products'\)\.first\(\)\.json\.results \|\| \[\]\)\n        \.filter\(it => it\.id !== currentId && it\.title && it\.price && it\.permalink\)\n        \.slice\(0, 5\);\n      return similarResults\.map\(it => \(\{\n          id:             it\.id,\n          titulo:         it\.title,\n          precio:         it\.price,\n          precio_original: it\.original_price \|\| it\.price,\n          thumbnail:      it\.thumbnail \? it\.thumbnail\.replace\('http:\/\/', 'https:\/\/'\) : null,\n          permalink:      it\.permalink,\n          envio_gratis:   it\.shipping\?\.free_shipping \|\| false,\n        \}\)\);\n    \} catch\(e\) \{ return \[\]; \}\n  \}\)\(\),/,
      "productos_similares_ml: similarPayload.productos,",
    );

    if (!code.includes("productos_similares_ml: similarPayload.productos")) {
      const start = code.indexOf("productos_similares_ml: (() => {");
      const end = code.indexOf("  autoria:", start);
      if (start !== -1 && end !== -1) {
        code =
          code.slice(0, start) +
          "productos_similares_ml: similarPayload.productos,\n" +
          code.slice(end);
      }
    }
  }

  code = code.replace(
    "vistas:    parseInt(v.statistics?.viewCount || '0', 10),",
    "vistas:    parseInt(v.statistics?.viewCount || '0', 10),\n  match_level: v.match_level || null,\n  evidence_score: v.evidence_score || null,\n  evidence_reason: v.evidence_reason || null,",
  );

  if (!code.includes("youtube_debug:")) {
    code = code.replace(
      "videos_yt: videosYT,",
      "videos_yt: videosYT,\n  youtube_debug: $('Top videos').first().json.youtube_filter || null,",
    );
  }

  if (code.includes("function buildSimilarProductsPayload") && !code.includes("ml_search_debug:")) {
    code = code.replace(
      "youtube_debug: $('Top videos').first().json.youtube_filter || null,",
      "youtube_debug: $('Top videos').first().json.youtube_filter || null,\n  ml_search_debug: similarPayload.debug,",
    );
  }

  if (!code.includes("comparativaEditorialClean")) {
    code = code.replace(
      "const similarPayload = buildSimilarProductsPayload();",
      `const similarPayload = buildSimilarProductsPayload();

function isSelfComparisonTitle(title) {
  const raw = String(title || '');
  if (/\\beste\\s+modelo\\b/i.test(raw)) return true;
  const stop = new Set(['de','del','la','el','los','las','para','con','sin','por','una','uno','un','y','review','analisis','premium','opcion','apple','watch','smartwatch','gps','mm','caja','color','aluminio','correa']);
  const tokens = (value) => String(value || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\\u0300-\\u036f]/g, '')
    .replace(/[^a-z0-9\\s]/g, ' ')
    .split(/\\s+/)
    .filter((token) => token.length > 2 && !stop.has(token));
  const current = tokens([displayTitle, item.name].filter(Boolean).join(' '));
  const candidate = tokens(raw);
  if (current.length < 2 || candidate.length < 2) return false;
  const hits = candidate.filter((token) => current.includes(token)).length;
  return hits >= Math.min(candidate.length, current.length, 3);
}

const comparativaEditorialClean = (parsedAbacus.comparativa_editorial || [])
  .filter((entry) => !isSelfComparisonTitle(entry?.titulo));`,
    );

    code = code.replace(
      "comparativa_editorial: parsedAbacus.comparativa_editorial || [],",
      "comparativa_editorial: comparativaEditorialClean,",
    );
  }

  if (!code.includes("candidate_id: $('Route Row').first().json.candidate_id")) {
    code = code.replace(
      "slug,",
      "slug,\n    candidate_id: $('Route Row').first().json.candidate_id || '',",
    );
  }

  node.parameters.jsCode = code;
}

function patchReviewCandidates(workflow) {
  if (workflow.nodes.some((node) => node.name === "Build Review Candidates")) return;

  const markDone = findNode(workflow, "Mark Done");
  const doc = markDone.parameters.documentId;
  const credentials = markDone.credentials;
  const sheetName = {
    __rl: true,
    value: "review_candidates",
    mode: "name",
    cachedResultName: "review_candidates",
  };

  workflow.nodes.push(
    {
      id: "review-candidates-read",
      name: "Get Review Candidates",
      type: "n8n-nodes-base.googleSheets",
      typeVersion: 4.5,
      position: [1696, 208],
      continueOnFail: true,
      alwaysOutputData: true,
      parameters: {
        documentId: doc,
        sheetName,
        options: {},
      },
      credentials,
    },
    {
      id: "review-candidates-build",
      name: "Build Review Candidates",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [1904, 208],
      parameters: {
        jsCode: `const review = $('Build Final JSON').first().json;
const now = new Date().toISOString();
const sourceSlug = review.meta?.slug || '';
const sourceProductId = review.meta?.producto_id || '';
const existing = new Set(
  $input.all()
    .map(i => i.json?.candidate_id)
    .filter(Boolean)
);

const norm = (s) => String(s || '')
  .toLowerCase()
  .normalize('NFD').replace(/[\\u0300-\\u036f]/g, '')
  .replace(/[^a-z0-9\\s]/g, ' ')
  .replace(/\\s+/g, ' ')
  .trim();
const slugify = (s) => norm(s).replace(/\\s+/g, '-').slice(0, 80);
const money = (n) => Number.isFinite(Number(n)) ? Number(n) : null;
const currentPrice = money(review.precio?.actual);
const scorePrice = (price) => {
  const p = money(price);
  if (!currentPrice || !p) return 50;
  const distance = Math.abs(p - currentPrice) / Math.max(currentPrice, 1);
  return Math.max(35, Math.round(90 - distance * 60));
};
const tierFromText = (value) => {
  const text = norm(value);
  if (/premium|superior|pro|max|ultra|gama alta|mas caro|mas potente/.test(text)) return 'superior';
  if (/barat|econom|inferior|anterior|basico|entrada|menor precio/.test(text)) return 'economico';
  if (/similar|mejor valor|valor|alternativa/.test(text)) return 'similar';
  return '';
};
const tierFromPrice = (price) => {
  const p = money(price);
  if (!currentPrice || !p) return '';
  const ratio = p / Math.max(currentPrice, 1);
  if (ratio >= 1.12) return 'superior';
  if (ratio <= 0.88) return 'economico';
  return 'similar';
};
const classifyTier = (input) => {
  const explicit = tierFromText(input.candidate_tier);
  if (explicit) return explicit;
  if (input.relation_type === 'mejor_alternativa') return tierFromText(input.tipo) || 'superior';
  const priced = tierFromPrice(input.price);
  if (priced) return priced;
  const typed = tierFromText([input.relation_type, input.tipo, input.reason, input.mentioned_in].filter(Boolean).join(' '));
  if (typed) return typed;
  return 'unknown';
};

const rows = [];
const push = (input) => {
  const name = String(input.candidate_name || '').trim();
  const relation = String(input.relation_type || '').trim();
  if (name.length > 120) return;
  if (!name || !relation) return;

  const candidateId = [
    sourceSlug,
    input.candidate_ml_id || slugify(name),
  ].filter(Boolean).join(':');

  if (existing.has(candidateId) || rows.some(r => r.candidate_id === candidateId)) return;

  rows.push({
    candidate_id: candidateId,
    source_slug: sourceSlug,
    source_product_id: sourceProductId,
    relation_type: relation,
    candidate_tier: classifyTier(input),
    candidate_name: name,
    candidate_query: input.candidate_query || name,
    candidate_ml_url: input.candidate_ml_url || '',
    candidate_ml_id: input.candidate_ml_id || '',
    affiliate_url: '',
    target_slug: '',
    status: 'pending',
    priority_score: input.priority_score ?? 50,
    reason: input.reason || '',
    mentioned_in: input.mentioned_in || '',
    created_at: now,
    updated_at: now,
    error_msg: '',
  });
};

for (const item of review.productos_similares_ml || []) {
  push({
    relation_type: 'similar_ml',
    candidate_name: item.titulo,
    candidate_query: item.titulo,
    candidate_ml_url: item.permalink,
    candidate_ml_id: item.id,
    price: item.precio,
    priority_score: scorePrice(item.precio),
    reason: item.precio ? 'Candidato real detectado por Mercado Libre en rango comparable.' : 'Candidato real detectado por Mercado Libre.',
    mentioned_in: 'productos_similares_ml',
  });
}

for (const item of review.editorial?.comparativa_editorial || []) {
  push({
    relation_type: 'comparativa_editorial',
    tipo: item.tipo,
    candidate_name: item.titulo,
    candidate_query: item.titulo,
    priority_score: 70,
    reason: item.resumen || '',
    mentioned_in: 'comparativa_editorial',
  });
}

for (const item of review.editorial?.alternativas || []) {
  if (!item.titulo) continue;
  push({
    relation_type: 'alternativa_editorial',
    candidate_name: item.titulo,
    candidate_query: item.titulo,
    priority_score: 60,
    reason: item.descripcion || '',
    mentioned_in: 'alternativas',
  });
}

if (review.editorial?.mejor_alternativa?.titulo) {
  push({
    relation_type: 'mejor_alternativa',
    tipo: review.editorial.mejor_alternativa.tipo,
    candidate_name: review.editorial.mejor_alternativa.titulo,
    candidate_query: review.editorial.mejor_alternativa.titulo,
    priority_score: 85,
    reason: review.editorial.mejor_alternativa.razon || '',
    mentioned_in: 'mejor_alternativa',
  });
}

return rows.map(json => ({ json }));`,
      },
    },
    {
      id: "review-candidates-append",
      name: "Append Review Candidates",
      type: "n8n-nodes-base.googleSheets",
      typeVersion: 4.5,
      position: [2112, 208],
      continueOnFail: true,
      parameters: {
        operation: "append",
        documentId: doc,
        sheetName,
        columns: {
          mappingMode: "defineBelow",
          value: {
            candidate_id: "={{ $json.candidate_id }}",
            source_slug: "={{ $json.source_slug }}",
            source_product_id: "={{ $json.source_product_id }}",
            relation_type: "={{ $json.relation_type }}",
            candidate_tier: "={{ $json.candidate_tier }}",
            candidate_name: "={{ $json.candidate_name }}",
            candidate_query: "={{ $json.candidate_query }}",
            candidate_ml_url: "={{ $json.candidate_ml_url }}",
            candidate_ml_id: "={{ $json.candidate_ml_id }}",
            affiliate_url: "={{ $json.affiliate_url }}",
            target_slug: "={{ $json.target_slug }}",
            status: "={{ $json.status }}",
            priority_score: "={{ $json.priority_score }}",
            reason: "={{ $json.reason }}",
            mentioned_in: "={{ $json.mentioned_in }}",
            created_at: "={{ $json.created_at }}",
            updated_at: "={{ $json.updated_at }}",
            error_msg: "={{ $json.error_msg }}",
          },
          matchingColumns: [],
          schema: [],
          attemptToConvertTypes: false,
          convertFieldsToString: true,
        },
        options: {},
      },
      credentials,
    },
  );

  const markDoneTargets = workflow.connections["Mark Done"]?.main?.[0] ?? [];
  if (!markDoneTargets.some((target) => target.node === "Get Review Candidates")) {
    markDoneTargets.push({ node: "Get Review Candidates", type: "main", index: 0 });
  }
  workflow.connections["Mark Done"] = { main: [markDoneTargets] };
  workflow.connections["Get Review Candidates"] = {
    main: [[{ node: "Build Review Candidates", type: "main", index: 0 }]],
  };
  workflow.connections["Build Review Candidates"] = {
    main: [[{ node: "Append Review Candidates", type: "main", index: 0 }]],
  };
}

function patchCandidateCompletion(workflow) {
  if (workflow.nodes.some((node) => node.name === "Find Completed Candidate")) return;

  const markDone = findNode(workflow, "Mark Done");

  workflow.nodes.push(
    {
      id: "completed-candidate-find",
      name: "Find Completed Candidate",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [1904, 384],
      parameters: {
        jsCode: `const candidateId = $('Route Row').first().json.candidate_id || '';
if (!candidateId) return [];

const rows = $('Get Review Candidates').all().map(i => i.json).filter(r => !r.error);
const row = rows.find(r => r.candidate_id === candidateId);
if (!row) return [];

return [{ json: {
  row_number: row.row_number,
  candidate_id: candidateId,
  target_slug: $('Build Final JSON').first().json.meta.slug,
}}];`,
      },
    },
    {
      id: "completed-candidate-update",
      name: "Mark Completed Candidate",
      type: "n8n-nodes-base.googleSheets",
      typeVersion: 4.5,
      position: [2112, 384],
      parameters: {
        operation: "update",
        documentId: markDone.parameters.documentId,
        sheetName: reviewCandidatesSheetName(),
        columns: {
          mappingMode: "defineBelow",
          value: {
            row_number: "={{ $json.row_number }}",
            status: "done",
            target_slug: "={{ $json.target_slug }}",
            updated_at: "={{ new Date().toISOString() }}",
            error_msg: "",
          },
          matchingColumns: ["row_number"],
          schema: [],
          attemptToConvertTypes: false,
          convertFieldsToString: true,
        },
        options: {},
      },
      credentials: markDone.credentials,
    },
  );

  const getTargets = workflow.connections["Get Review Candidates"]?.main?.[0] ?? [];
  if (!getTargets.some((target) => target.node === "Find Completed Candidate")) {
    getTargets.push({ node: "Find Completed Candidate", type: "main", index: 0 });
  }
  workflow.connections["Get Review Candidates"] = { main: [getTargets] };
  workflow.connections["Find Completed Candidate"] = {
    main: [[{ node: "Mark Completed Candidate", type: "main", index: 0 }]],
  };
}
