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
  const staleYear = title.match(/\b(20[0-9]{2})\b/)?.[1];
  if (staleYear && Number(staleYear) < currentYear) {
    fail(label, `seo_title usa ano viejo (${staleYear})`);
  }

  if ((review.editorial?.faq ?? []).length < 3) {
    warn(label, "tiene menos de 3 FAQ");
  }

  if ((review.productos_similares_ml ?? []).length === 0) {
    warn(label, "no tiene productos_similares_ml");
  }

  const currentProductId = review.meta?.producto_id;
  const includesCurrent = (review.productos_similares_ml ?? []).some(
    (item) => item.id === currentProductId,
  );
  if (includesCurrent) {
    fail(label, "productos_similares_ml incluye el producto actual");
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
