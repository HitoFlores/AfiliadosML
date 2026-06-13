export function norm(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function slugify(value) {
  return norm(value).replace(/\s+/g, "-").slice(0, 80);
}

export function meaningfulName(value) {
  return norm(value)
    .split(" ")
    .filter((token) => token.length > 2 || /^[0-9]+$/.test(token))
    .join(" ");
}

export function cleanCandidateName(value) {
  let name = String(value || "").replace(/\s+/g, " ").trim();
  if (!name) return "";

  name = name.replace(/\(([^)]*)\)/g, (_, content) => {
    const text = norm(content);
    if (
      !text ||
      /reacondicionado|segunda mano|usad[oa]?|oferta|descuento|similar|este modelo|si se consigue/.test(text)
    ) {
      return " ";
    }
    return ` ${content} `;
  });

  name = name
    .replace(/\bserie\s+(\d+)/gi, "$1")
    .replace(/\b(reacondicionado|reacondicionada|segunda mano|usado|usada)\b/gi, " ")
    .replace(/\b(en oferta|con descuento|descuento|oferta)\b/gi, " ")
    .replace(/\bsi se consigue\b.*$/gi, " ")
    .replace(/\beste modelo\b/gi, " ")
    .replace(/\bo similar\b.*$/gi, " ")
    .replace(/\bsimilar\b/gi, " ")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:])$/g, "$1")
    .trim();

  return name.replace(/^[,.;:\-/\s]+|[,.;:\-/\s]+$/g, "").trim();
}

export function splitCompositeCandidateName(value) {
  const raw = String(value || "").replace(/\s+/g, " ").trim();
  if (!raw) return [];
  const normalized = norm(raw);
  if (/\bo similar\b/.test(normalized)) return [];
  const rawForSplit = cleanCandidateName(raw);

  const parts = rawForSplit
    .split(/\s+(?:o|y|vs\.?|versus)\s+|(?:\s*\/\s*)/i)
    .map((part) => cleanCandidateName(part))
    .filter(Boolean);

  if (parts.length <= 1) {
    const clean = rawForSplit;
    return clean ? [clean] : [];
  }

  const realParts = parts.filter((part) => !isGenericCandidateName(part));
  return realParts.length >= 2 ? [...new Set(realParts)] : [];
}

export function canonicalCandidateKey(value) {
  return meaningfulName(cleanCandidateName(value));
}

export function isGenericCandidateName(value) {
  const raw = String(value || "");
  const clean = cleanCandidateName(raw);
  const text = norm(clean);
  const rawText = norm(raw);
  if (!text || text.length < 6) return true;
  if (/sin candidato real confiable/.test(text)) return true;
  if (/\bo similar\b/.test(rawText)) return true;

  const tokens = text.split(" ").filter(Boolean);
  const meaningful = tokens.filter((token) => token.length > 2 || /^[0-9]+$/.test(token));
  if (meaningful.length < 2) return true;

  const genericOnly = new Set([
    "laptop",
    "windows",
    "android",
    "smartwatch",
    "cafetera",
    "consola",
    "modelo",
    "anterior",
    "inferior",
    "premium",
    "barata",
    "valor",
    "alta",
    "gama",
    "producto",
    "alternativa",
    "opcion",
  ]);
  const hasModelSignal = tokens.some((token) => /\d/.test(token)) || /\b(m\d|ecam\d|ec\d|oled|lite|pro|ultra|air|series|forerunner|galaxy|switch|steam deck)\b/.test(text);
  const nonGeneric = meaningful.filter((token) => !genericOnly.has(token));
  if (!hasModelSignal && nonGeneric.length < 2) return true;
  if (/^(laptop windows|smartwatch|cafetera|consola|alternativa|opcion)\b/.test(text)) return true;
  if (/^(intel core|amd ryzen)\b/.test(text)) return true;

  return false;
}

export function isSelfCandidate(candidate, sourceReview) {
  const raw = String(candidate?.candidate_name ?? candidate ?? "");
  if (/\beste\s+modelo\b/i.test(raw)) return true;
  const candidateKey = canonicalCandidateKey(raw);
  const sourceTitle = [
    sourceReview?.producto?.display_title,
    sourceReview?.producto?.nombre,
    sourceReview?.meta?.slug,
  ].filter(Boolean).join(" ");
  const sourceKey = canonicalCandidateKey(sourceTitle);
  if (!candidateKey || !sourceKey) return false;
  return candidateKey === sourceKey || sourceKey.includes(candidateKey) || candidateKey.includes(sourceKey);
}

export function sameCandidateName(left, right) {
  const a = canonicalCandidateKey(left);
  const b = canonicalCandidateKey(right);
  if (!a || !b || a.length < 6 || b.length < 6) return false;
  return a === b || a.includes(b) || b.includes(a);
}
