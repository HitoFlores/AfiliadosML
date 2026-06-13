import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  canonicalCandidateKey,
  cleanCandidateName,
  isGenericCandidateName,
  isSelfCandidate,
  meaningfulName,
  norm,
  sameCandidateName,
  slugify,
  splitCompositeCandidateName,
} from "./candidate-normalization.mjs";

export { canonicalCandidateKey, cleanCandidateName, isGenericCandidateName, isSelfCandidate, meaningfulName, norm, sameCandidateName, slugify, splitCompositeCandidateName };

export function tierFromText(value) {
  const text = norm(value);
  if (/premium|superior|pro|ultra/.test(text)) return "superior";
  if (/modelo anterior|inferior|economico|barato|barat/.test(text)) return "economico";
  if (/mejor valor|similar|alternativa/.test(text)) return "similar";
  return "";
}

export function classifyCandidateTier(input) {
  return (
    tierFromText(input.candidate_tier) ||
    tierFromText(input.tipo) ||
    tierFromText([input.relation_type, input.reason, input.mentioned_in].filter(Boolean).join(" ")) ||
    "unknown"
  );
}

export function readPublishedReviews(dataDir = path.join(process.cwd(), "data")) {
  return fs
    .readdirSync(dataDir)
    .filter((file) => file.endsWith(".json"))
    .map((file) => {
      const review = JSON.parse(fs.readFileSync(path.join(dataDir, file), "utf8").replace(/^\uFEFF/, ""));
      return { file, review };
    });
}

export function publishedReviewMeta(entries) {
  return {
    slugs: entries.map(({ review }) => review.meta?.slug).filter(Boolean),
    candidateIds: entries.map(({ review }) => review.meta?.candidate_id).filter(Boolean),
    productIds: entries.map(({ review }) => review.meta?.producto_id).filter(Boolean),
    reviews: entries.map(({ review }) => ({
      slug: review.meta?.slug || "",
      candidate_id: review.meta?.candidate_id || "",
      product_id: review.meta?.producto_id || "",
      title: [review.producto?.display_title, review.producto?.nombre].filter(Boolean).join(" "),
    })),
  };
}

function isPublishedName(candidateName, publishedReviews) {
  const candidate = canonicalCandidateKey(candidateName);
  if (!candidate || candidate.length < 10) return false;
  return publishedReviews.some((review) => {
    const title = canonicalCandidateKey(review.title);
    return title && (title.includes(candidate.slice(0, 80)) || candidate.includes(title.slice(0, 80)));
  });
}

function hasRealCandidateName(value) {
  const name = cleanCandidateName(value);
  if (!name || name.length > 120) return false;
  return !isGenericCandidateName(value);
}

export function buildBackfillCandidates({
  entries,
  existingCandidates = [],
  now = new Date().toISOString(),
} = {}) {
  const sourceEntries = entries || readPublishedReviews();
  const meta = publishedReviewMeta(sourceEntries);
  const existingIds = new Set(existingCandidates.map((row) => String(row.candidate_id || "").trim()).filter(Boolean));
  const existingNames = new Set(existingCandidates.map((row) => canonicalCandidateKey(row.candidate_name)).filter(Boolean));
  const publishedCandidateIds = new Set(meta.candidateIds);
  const publishedProductIds = new Set(meta.productIds.map(String));
  const rows = [];
  const seen = new Set(existingIds);
  const seenNames = existingCandidates.map((row) => row.candidate_name).filter(Boolean);

  const push = (review, input) => {
    const sourceSlug = String(review.meta?.slug || "").trim();
    const sourceProductId = String(review.meta?.producto_id || "").trim();
    const rawName = String(input.candidate_name || "").replace(/\s+/g, " ").trim();
    const relation = String(input.relation_type || "").trim();
    const candidateMlId = String(input.candidate_ml_id || "").trim();
    const names = splitCompositeCandidateName(rawName);

    for (const name of names) {
      const canonicalKey = canonicalCandidateKey(name);
      const candidateId = [sourceSlug, slugify(name)].filter(Boolean).join(":");

      if (!sourceSlug || !relation || !hasRealCandidateName(rawName) || isGenericCandidateName(name)) continue;
      if (isSelfCandidate({ candidate_name: rawName }, review) || isSelfCandidate({ candidate_name: name }, review)) continue;
      if (!candidateId || seen.has(candidateId)) continue;
      if (existingNames.has(canonicalKey)) continue;
      if (seenNames.some((existingName) => sameCandidateName(existingName, name))) continue;
      if (publishedCandidateIds.has(candidateId)) continue;
      if (candidateMlId && publishedProductIds.has(candidateMlId)) continue;
      if (isPublishedName(name, meta.reviews)) continue;

      seen.add(candidateId);
      seenNames.push(name);
      rows.push({
        candidate_id: candidateId,
        source_slug: sourceSlug,
        source_product_id: sourceProductId,
        relation_type: relation,
        candidate_tier: classifyCandidateTier(input),
        candidate_name: name,
        candidate_query: cleanCandidateName(input.candidate_query || name) || name,
        candidate_ml_url: input.candidate_ml_url || "",
        candidate_ml_id: candidateMlId,
        affiliate_url: "",
        target_slug: "",
        status: "pending",
        priority_score: input.priority_score ?? 50,
        reason: input.reason || "",
        mentioned_in: input.mentioned_in || "",
        shown_batch_id: "",
        shown_index: "",
        shown_at: "",
        created_at: now,
        updated_at: now,
        error_msg: "",
      });
    }
  };

  for (const { review } of sourceEntries) {
    for (const item of review.editorial?.comparativa_editorial || []) {
      push(review, {
        relation_type: "comparativa_editorial",
        tipo: item.tipo,
        candidate_name: item.titulo,
        candidate_query: item.titulo,
        priority_score: 70,
        reason: item.resumen || "",
        mentioned_in: "comparativa_editorial",
      });
    }

    if (review.editorial?.mejor_alternativa?.titulo) {
      push(review, {
        relation_type: "mejor_alternativa",
        tipo: review.editorial.mejor_alternativa.tipo,
        candidate_name: review.editorial.mejor_alternativa.titulo,
        candidate_query: review.editorial.mejor_alternativa.titulo,
        priority_score: 85,
        reason: review.editorial.mejor_alternativa.razon || "",
        mentioned_in: "mejor_alternativa",
      });
    }

    for (const item of review.editorial?.alternativas || []) {
      if (!item.titulo) continue;
      push(review, {
        relation_type: "alternativa_editorial",
        tipo: item.tipo,
        candidate_name: item.titulo,
        candidate_query: item.titulo,
        priority_score: 60,
        reason: item.descripcion || "",
        mentioned_in: "alternativas",
      });
    }

    for (const item of review.productos_similares_ml || []) {
      push(review, {
        relation_type: "similar_ml",
        candidate_name: item.titulo,
        candidate_query: item.titulo,
        candidate_ml_url: item.permalink,
        candidate_ml_id: item.id,
        priority_score: 50,
        reason: item.precio ? "Candidato real detectado por Mercado Libre en rango comparable." : "Candidato real detectado por Mercado Libre.",
        mentioned_in: "productos_similares_ml",
      });
    }
  }

  return rows;
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const rows = buildBackfillCandidates();
  console.log(JSON.stringify(rows, null, 2));
}
