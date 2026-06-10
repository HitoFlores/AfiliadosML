import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const dataDir = path.join(root, "data");
const currentYear = new Date().getFullYear();
const mojibake = /(Ã.|Â.|�|ï»¿|An\?lisis|rese\?as|M\?xico|EnvÃ|Â¿|â[^\s]?)/;

const files = fs.readdirSync(dataDir).filter((file) => file.endsWith(".json"));
let errors = 0;
let warnings = 0;

for (const file of files) {
  const fullPath = path.join(dataDir, file);
  const rawText = fs.readFileSync(fullPath, "utf8");
  const label = path.relative(root, fullPath);
  let review;

  try {
    review = JSON.parse(rawText.replace(/^\uFEFF/, ""));
  } catch (error) {
    fail(label, `JSON invalido: ${error.message}`);
    continue;
  }

  if (mojibake.test(rawText)) {
    fail(label, "contiene mojibake o caracteres corruptos");
  }

  const title = review.editorial?.seo_title ?? "";
  const displayTitle = review.producto?.display_title ?? "";
  const staleYear = title.match(/\b(20[0-9]{2})\b/)?.[1];
  if (staleYear && Number(staleYear) < currentYear) {
    fail(label, `seo_title usa ano viejo (${staleYear})`);
  }

  if ((review.editorial?.faq ?? []).length < 3) {
    warn(label, "tiene menos de 3 FAQ");
  }

  if (!displayTitle) {
    warn(label, "falta producto.display_title");
  } else if (displayTitle.length > 65) {
    fail(label, `producto.display_title demasiado largo (${displayTitle.length})`);
  }

  const currentProductId = review.meta?.producto_id;
  const includesCurrent = (review.productos_similares_ml ?? []).some(
    (item) => item.id === currentProductId,
  );
  if (includesCurrent) {
    fail(label, "productos_similares_ml incluye el producto actual");
  }

  const deadSimilarLink = (review.productos_similares_ml ?? []).find(
    (item) => !item.permalink || /mercadolibre\.com\.mx\/-\d+/i.test(item.permalink),
  );
  if (deadSimilarLink) {
    fail(label, `productos_similares_ml tiene link invalido (${deadSimilarLink.id})`);
  }

  const mlSearchDebug = review.ml_search_debug;
  if (
    mlSearchDebug &&
    Number(mlSearchDebug.valid_count || 0) > 0 &&
    (review.productos_similares_ml ?? []).length === 0
  ) {
    fail(
      label,
      `ML devolvio ${mlSearchDebug.valid_count} candidatos validos pero productos_similares_ml quedo vacio`,
    );
  }

  for (const field of [
    "riesgos_compra_ml",
    "checklist_antes_de_comprar",
    "comparativa_editorial",
    "evidencia_limitaciones",
  ]) {
    if (!(field in (review.editorial ?? {}))) {
      warn(label, `falta campo v4 editorial.${field}`);
    }
  }

  const currentTitle = normalize([review.producto?.display_title, review.producto?.nombre].filter(Boolean).join(" "));
  const selfComparison = (review.editorial?.comparativa_editorial ?? []).find((item) => {
    const title = normalize(item?.titulo);
    return title.includes("este modelo") || sameProductText(currentTitle, title);
  });
  if (selfComparison) {
    fail(label, `comparativa_editorial parece repetir el producto actual (${selfComparison.titulo})`);
  }
}

if (errors > 0) {
  console.error(`Review audit failed: ${errors} errores, ${warnings} warnings.`);
  process.exit(1);
}

console.log(`Review audit passed: ${files.length} archivos, ${warnings} warnings.`);

function fail(label, message) {
  errors += 1;
  console.error(`ERROR ${label}: ${message}`);
}

function warn(label, message) {
  warnings += 1;
  console.warn(`WARN  ${label}: ${message}`);
}

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sameProductText(current, candidate) {
  if (!current || !candidate) return false;
  const stop = new Set([
    "de",
    "del",
    "la",
    "el",
    "los",
    "las",
    "para",
    "con",
    "sin",
    "por",
    "una",
    "uno",
    "un",
    "y",
    "review",
    "analisis",
    "premium",
    "opcion",
    "apple",
    "watch",
    "smartwatch",
    "gps",
    "mm",
    "caja",
    "color",
    "aluminio",
    "correa",
  ]);
  const tokens = current.split(" ").filter((t) => t.length > 2 && !stop.has(t));
  if (tokens.length < 3) return false;
  const hits = tokens.filter((t) => candidate.includes(t)).length;
  return hits >= Math.min(tokens.length, 5);
}
