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
  }

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
