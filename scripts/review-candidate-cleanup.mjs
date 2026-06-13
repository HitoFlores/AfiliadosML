import {
  canonicalCandidateKey,
  cleanCandidateName,
  isGenericCandidateName,
  isSelfCandidate,
  splitCompositeCandidateName,
} from "./candidate-normalization.mjs";
import { fileURLToPath } from "node:url";

function protectedRank(row) {
  const status = String(row.status || "").toLowerCase().trim();
  if (status === "done") return 4;
  if (status === "ready") return 3;
  if (String(row.affiliate_url || "").trim()) return 2;
  if (status === "processing") return 1;
  return 0;
}

export function buildCandidateCleanupUpdates({ rows = [], reviews = [], now = new Date().toISOString() } = {}) {
  const reviewBySlug = new Map(reviews.map((review) => [String(review?.meta?.slug || "").trim(), review]));
  const byKey = new Map();

  for (const row of rows) {
    const key = canonicalCandidateKey(row.candidate_name);
    if (!key) continue;
    const list = byKey.get(key) || [];
    list.push(row);
    byKey.set(key, list);
  }

  const updates = [];
  const preferredByKey = new Map();

  for (const [key, siblings] of byKey) {
    const preferred = [...siblings].sort((a, b) => {
      const rankDiff = protectedRank(b) - protectedRank(a);
      if (rankDiff) return rankDiff;
      const scoreDiff = Number(b.priority_score || 0) - Number(a.priority_score || 0);
      if (scoreDiff) return scoreDiff;
      return Number(a.row_number || 999999) - Number(b.row_number || 999999);
    })[0];
    preferredByKey.set(key, preferred);
  }

  for (const row of rows) {
    const status = String(row.status || "").toLowerCase().trim();
    if (status !== "pending" || !row.row_number) continue;

    const rawName = String(row.candidate_name || "").trim();
    const cleanName = cleanCandidateName(rawName);
    const key = canonicalCandidateKey(rawName);
    const sourceReview = reviewBySlug.get(String(row.source_slug || "").trim());
    const siblings = key ? byKey.get(key) || [] : [];
    const preferred = key ? preferredByKey.get(key) : null;
    const hasBetterDuplicate = siblings.some((other) => {
      if (other === row) return false;
      if (protectedRank(other) > protectedRank(row)) return true;
      return cleanCandidateName(other.candidate_name) === cleanName && preferred !== row;
    });

    let reason = "";
    if (hasBetterDuplicate) reason = "cleanup: duplicate candidate";
    else if (splitCompositeCandidateName(rawName).length > 1) reason = "cleanup: composite candidate";
    else if (isSelfCandidate({ candidate_name: rawName }, sourceReview)) reason = "cleanup: self candidate";
    else if (isGenericCandidateName(rawName)) reason = "cleanup: generic candidate";

    if (!reason) continue;
    updates.push({
      row_number: row.row_number,
      status: "discarded",
      updated_at: now,
      error_msg: reason,
    });
  }

  return updates;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const rows = JSON.parse(process.argv[2] || "[]");
  console.log(JSON.stringify(buildCandidateCleanupUpdates({ rows }), null, 2));
}
