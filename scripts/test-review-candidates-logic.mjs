const hiddenStatuses = new Set(["done", "ready", "processing", "discarded"]);
const discardWords = new Set(["descartar", "eliminar", "basura", "drop", "delete"]);

function tierRank(tier) {
  const value = String(tier || "unknown").toLowerCase().trim();
  if (value === "superior") return 0;
  if (value === "economico") return 1;
  if (value === "similar") return 2;
  return 3;
}

function selectCandidates(rows, published = { slugs: [], candidateIds: [] }) {
  const publishedSlugs = new Set(published.slugs || []);
  const publishedCandidateIds = new Set(published.candidateIds || []);
  return rows
    .filter((row) => String(row.status || "").toLowerCase().trim() === "pending")
    .filter((row) => !hiddenStatuses.has(String(row.status || "").toLowerCase().trim()))
    .filter((row) => !publishedSlugs.has(String(row.target_slug || "").trim()))
    .filter((row) => !publishedCandidateIds.has(String(row.candidate_id || "").trim()))
    .sort(
      (a, b) =>
        tierRank(a.candidate_tier) - tierRank(b.candidate_tier) ||
        Number(b.priority_score || 0) - Number(a.priority_score || 0),
    )
    .slice(0, 3);
}

function norm(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tierFromText(value) {
  const text = norm(value);
  if (/premium|superior|pro|max|ultra|gama alta|mas caro|mas potente/.test(text)) return "superior";
  if (/barat|econom|inferior|anterior|basico|entrada|menor precio/.test(text)) return "economico";
  if (/similar|mejor valor|valor|alternativa/.test(text)) return "similar";
  return "";
}

function classifyTier(input, currentPrice) {
  const explicit = tierFromText(input.candidate_tier);
  if (explicit) return explicit;
  if (input.relation_type === "mejor_alternativa") return tierFromText(input.tipo) || "superior";
  const price = Number(input.price || 0);
  if (currentPrice > 0 && price > 0) {
    const ratio = price / currentPrice;
    if (ratio >= 1.12) return "superior";
    if (ratio <= 0.88) return "economico";
    return "similar";
  }
  const typed = tierFromText(
    [input.relation_type, input.tipo, input.reason, input.mentioned_in].filter(Boolean).join(" "),
  );
  if (typed) return typed;
  return "unknown";
}

function makeSnapshot(rows) {
  return rows.map((row, index) => ({ index: index + 1, candidate_id: row.candidate_id }));
}

function looksLikeLink(value) {
  return Boolean(value && /^(https?:\/\/|www\.|meli)/i.test(value));
}

function isMlLink(value) {
  return Boolean(value && /(meli\.la\/|mercadolibre)/i.test(value));
}

function candidateHintForIndex(replyText, index) {
  const pattern = new RegExp(`^\\s*${index}\\s*[-.)]\\s*(.+)$`);
  const line = String(replyText || "")
    .split(/\n+/)
    .map((entry) => entry.trim())
    .find((entry) => pattern.test(entry));
  if (!line) return "";
  return (line.match(pattern)?.[1] || "").replace(/\s+/g, " ").trim();
}

function parseCandidateActions(text, replyText = "") {
  const lines = String(text || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const actions = [];
  let sawNumber = false;
  let invalid = false;

  for (const line of lines) {
    const match = line.match(/^(\d+)\s*(?:[-.)]\s*)?(\S+)(?:\s+.*)?$/);
    if (!match) {
      if (/^\d+\b/.test(line)) invalid = true;
      continue;
    }

    sawNumber = true;
    const index = Number(match[1]);
    const value = match[2];
    const actionWord = value.toLowerCase().trim();
    if (looksLikeLink(value) && isMlLink(value)) {
      actions.push({
        candidate_index: index,
        candidate_name_hint: candidateHintForIndex(replyText, index),
        action: "ready",
        referido: value,
      });
    } else if (discardWords.has(actionWord)) {
      actions.push({
        candidate_index: index,
        candidate_name_hint: candidateHintForIndex(replyText, index),
        action: "discard",
      });
    } else {
      invalid = true;
    }
  }

  return { actions, invalid: invalid || (sawNumber && !actions.length) };
}

function resolveActions(actions, rows, snapshot) {
  const shownRows = rows
    .filter((row) => String(row.shown_batch_id || "").trim() && Number(row.shown_index || 0) > 0)
    .sort((a, b) => Date.parse(b.shown_at || "") - Date.parse(a.shown_at || ""));
  const latestShownBatch = String(shownRows[0]?.shown_batch_id || "").trim();

  return actions.map((action) => {
    const hit = snapshot.find((entry) => Number(entry.index) === Number(action.candidate_index));
    const hint = norm(action.candidate_name_hint).slice(0, 48);
    const row =
      rows.find((entry) => entry.candidate_id === hit?.candidate_id) ||
      rows.find(
        (entry) =>
          latestShownBatch &&
          String(entry.shown_batch_id || "").trim() === latestShownBatch &&
          Number(entry.shown_index || 0) === Number(action.candidate_index),
      ) ||
      rows.find((entry) => hint && norm(entry.candidate_name).startsWith(hint));
    if (!row) return null;
    return {
      candidate_id: row.candidate_id,
      status: action.action === "discard" ? "discarded" : "ready",
      createsQueueRow: action.action === "ready",
    };
  }).filter(Boolean);
}

function assertEqual(name, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error(`${name}: expected ${e}, got ${a}`);
  }
}

const rows = [
  { candidate_id: "src:economico-1", candidate_tier: "economico", status: "pending", priority_score: 95 },
  { candidate_id: "src:similar-1", candidate_tier: "similar", status: "pending", priority_score: 99 },
  { candidate_id: "src:superior-1", candidate_tier: "superior", status: "pending", priority_score: 50 },
  { candidate_id: "src:economico-2", candidate_tier: "economico", status: "pending", priority_score: 70 },
  { candidate_id: "src:unknown-1", candidate_tier: "", status: "pending", priority_score: 100 },
  { candidate_id: "src:ready-1", candidate_tier: "superior", status: "ready", priority_score: 100 },
  { candidate_id: "src:published-1", candidate_tier: "superior", status: "pending", priority_score: 100 },
  { candidate_id: "src:target-published", candidate_tier: "superior", status: "pending", priority_score: 100, target_slug: "already-live" },
];

assertEqual("price classifies superior", classifyTier({ relation_type: "similar_ml", price: 130 }, 100), "superior");
assertEqual("price classifies economico", classifyTier({ relation_type: "similar_ml", price: 70 }, 100), "economico");
assertEqual("comparativa tipo classifies superior", classifyTier({ relation_type: "comparativa_editorial", tipo: "premium" }, 100), "superior");
assertEqual("mejor alternativa defaults superior", classifyTier({ relation_type: "mejor_alternativa" }, 100), "superior");

const selected = selectCandidates(rows, {
  slugs: ["already-live"],
  candidateIds: ["src:published-1"],
});
assertEqual(
  "selects max 3 with tier priority and economico fill",
  selected.map((row) => row.candidate_id),
  ["src:superior-1", "src:economico-1", "src:economico-2"],
);

assertEqual(
  "non selected stay pending",
  rows.find((row) => row.candidate_id === "src:similar-1").status,
  "pending",
);

const mixed = parseCandidateActions([
  "1 - https://meli.la/abc",
  "2 - descartar",
  "3 - https://www.mercadolibre.com.mx/p/MLM123",
].join("\n"));
assertEqual("mixed message parses", mixed, {
  actions: [
    { candidate_index: 1, candidate_name_hint: "", action: "ready", referido: "https://meli.la/abc" },
    { candidate_index: 2, candidate_name_hint: "", action: "discard" },
    { candidate_index: 3, candidate_name_hint: "", action: "ready", referido: "https://www.mercadolibre.com.mx/p/MLM123" },
  ],
  invalid: false,
});

const replyHint = [
  "Candidatos para el siguiente review",
  "1 - Samsung Galaxy Watch...",
].join("\n");
assertEqual("reply text carries candidate hint", parseCandidateActions("1 - https://meli.la/abc", replyHint), {
  actions: [
    {
      candidate_index: 1,
      candidate_name_hint: "Samsung Galaxy Watch...",
      action: "ready",
      referido: "https://meli.la/abc",
    },
  ],
  invalid: false,
});

for (const word of discardWords) {
  assertEqual(`discard word ${word}`, parseCandidateActions(`9 - ${word}`).actions, [
    { candidate_index: 9, candidate_name_hint: "", action: "discard" },
  ]);
}

assertEqual("invalid numbered format", parseCandidateActions("1 - ejemplo").invalid, true);

const snapshot = makeSnapshot(selected);
const changedRows = [
  { candidate_id: "new:first", candidate_tier: "superior", status: "pending", priority_score: 999 },
  ...rows,
];
assertEqual(
  "snapshot keeps index stable after sheet changes",
  resolveActions([{ candidate_index: 1, candidate_name_hint: "", action: "ready", referido: "https://meli.la/abc" }], changedRows, snapshot),
  [{ candidate_id: "src:superior-1", status: "ready", createsQueueRow: true }],
);

assertEqual(
  "discard does not create queue row",
  resolveActions([{ candidate_index: 2, candidate_name_hint: "", action: "discard" }], rows, snapshot),
  [{ candidate_id: "src:economico-1", status: "discarded", createsQueueRow: false }],
);

assertEqual(
  "reply hint resolves when scheduler snapshot is unavailable",
  resolveActions(
    [{ candidate_index: 1, candidate_name_hint: "Samsung Galaxy Watch...", action: "ready", referido: "https://meli.la/abc" }],
    [{ candidate_id: "src:samsung", candidate_name: "Samsung Galaxy Watch7 44mm Reloj", status: "pending" }],
    [],
  ),
  [{ candidate_id: "src:samsung", status: "ready", createsQueueRow: true }],
);

assertEqual(
  "persisted latest batch wins over stale telegram quote",
  resolveActions(
    [{ candidate_index: 1, candidate_name_hint: "Samsung Galaxy Watch...", action: "ready", referido: "https://meli.la/mac" }],
    [
      {
        candidate_id: "src:samsung",
        candidate_name: "Samsung Galaxy Watch7 44mm Reloj",
        status: "pending",
        shown_batch_id: "old",
        shown_index: 1,
        shown_at: "2026-06-12T17:00:00Z",
      },
      {
        candidate_id: "src:macbook",
        candidate_name: "Apple MacBook Air 13 M5 512GB",
        status: "pending",
        shown_batch_id: "new",
        shown_index: 1,
        shown_at: "2026-06-12T18:00:00Z",
      },
    ],
    [],
  ),
  [{ candidate_id: "src:macbook", status: "ready", createsQueueRow: true }],
);

console.log("Review candidate logic test passed.");
