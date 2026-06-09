import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const dataDir = path.join(root, "data");
const currentYear = String(new Date().getFullYear());

const files = fs.readdirSync(dataDir).filter((file) => file.endsWith(".json"));

for (const file of files) {
  const fullPath = path.join(dataDir, file);
  const raw = JSON.parse(fs.readFileSync(fullPath, "utf8").replace(/^\uFEFF/, ""));
  const fixed = fixValue(raw);
  const editorial = fixed.editorial ?? {};
  const producto = fixed.producto ?? {};
  const precio = fixed.precio ?? {};
  const vendedor = fixed.vendedor ?? {};

  if (editorial.seo_title) {
    editorial.seo_title = editorial.seo_title.replace(/\b20(2[0-5])\b/g, currentYear);
  }

  editorial.riesgos_compra_ml ??= [
    precio.garantia
      ? `Revisa garantia publicada: ${precio.garantia}.`
      : "Confirma garantia y politicas de devolucion antes de pagar.",
    vendedor.reputacion
      ? `Valida reputacion del vendedor (${vendedor.reputacion}) y ventas recientes.`
      : "Valida reputacion y ventas recientes del vendedor.",
    "Confirma version exacta, compatibilidad y accesorios incluidos.",
  ];

  editorial.checklist_antes_de_comprar ??= [
    "Compara precio final con envio incluido.",
    "Revisa preguntas recientes y opiniones con comentario.",
    "Verifica que marca, modelo y variante coincidan con la publicacion.",
  ];

  editorial.comparativa_editorial ??= (editorial.alternativas ?? []).map((alt) => ({
    tipo: alt.tipo,
    titulo: alt.tipo,
    resumen: alt.descripcion,
  }));

  editorial.mejor_alternativa ??= null;

  editorial.keyword_targets ??= [
    `${producto.marca ?? ""} ${producto.modelo ?? ""} opiniones Mercado Libre`.trim(),
    `${producto.marca ?? ""} ${producto.modelo ?? ""} vale la pena Mexico`.trim(),
    `${producto.marca ?? ""} ${producto.modelo ?? ""} review Mercado Libre`.trim(),
  ].filter(Boolean);

  editorial.evidencia_limitaciones ??=
    "Este analisis sintetiza especificaciones, fuentes externas y opiniones de compradores en Mercado Libre.";

  fixed.editorial = editorial;
  fs.writeFileSync(fullPath, `${JSON.stringify(fixed, null, 2)}\n`, "utf8");
  console.log(`Backfilled ${path.relative(root, fullPath)}`);
}

function fixValue(value) {
  if (Array.isArray(value)) return value.map(fixValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, val]) => [fixString(key), fixValue(val)]));
  }
  if (typeof value === "string") return fixString(value);
  return value;
}

function fixString(value) {
  let output = value;
  if (/[ÃÂâï]/.test(output)) {
    const decoded = Buffer.from(output, "latin1").toString("utf8");
    if (scoreText(decoded) > scoreText(output)) output = decoded;
  }

  return output
    .replace(/An\?lisis/g, "Analisis")
    .replace(/an\?lisis/g, "analisis")
    .replace(/M\?xico/g, "Mexico")
    .replace(/rese\?as/g, "resenas")
    .replace(/Rese\?as/g, "Resenas")
    .replace(/l\?nea/g, "linea")
    .replace(/L\?nea/g, "Linea")
    .replace(/Env\?o/g, "Envio")
    .replace(/env\?o/g, "envio");
}

function scoreText(value) {
  const bad = (value.match(/[ÃÂâï�]/g) ?? []).length;
  const good = (value.match(/[áéíóúñüÁÉÍÓÚÑ¿¡★–—]/g) ?? []).length;
  return good - bad * 3;
}
