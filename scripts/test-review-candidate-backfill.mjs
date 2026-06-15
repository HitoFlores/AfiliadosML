import {
  buildBackfillCandidates,
  canonicalCandidateKey,
  classifyCandidateTier,
  cleanCandidateName,
  isGenericCandidateName,
  isSelfCandidate,
  splitCompositeCandidateName,
} from "./review-candidate-backfill.mjs";
import { buildCandidateCleanupUpdates } from "./review-candidate-cleanup.mjs";

function assertEqual(name, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error(`${name}: expected ${e}, got ${a}`);
  }
}

function assertIncludes(name, values, expected) {
  if (!values.includes(expected)) {
    throw new Error(`${name}: expected to include ${expected}, got ${JSON.stringify(values)}`);
  }
}

const rows = buildBackfillCandidates({ now: "2026-06-12T00:00:00.000Z" });
const names = rows.map((row) => row.candidate_name);

assertEqual("MacBook backfill skips published Pro", names.includes("MacBook Pro M5 Pro 14 pulgadas"), false);
assertEqual("MacBook backfill removes commercial M2", names.includes("MacBook Air M2 (reacondicionado o segunda mano)"), false);
assertEqual("MacBook backfill removes commercial M3", names.includes("MacBook Air M3 con descuento"), false);
assertEqual("MacBook backfill skips generic Windows processor alternative", names.includes("Laptop Windows con Intel Core Ultra o AMD Ryzen AI (gama alta)"), false);
assertEqual("Switch backfill skips published Lite", names.includes("Nintendo Switch Lite"), false);
assertIncludes("Switch backfill includes Switch 2", names, "Nintendo Switch 2");
assertIncludes("Switch backfill includes Steam Deck", names, "Steam Deck Valve");
assertEqual("Coffee backfill skips published Arte", names.includes("De'Longhi La Specialista Arte EC9155M"), false);
assertIncludes("Coffee backfill includes Dedica", names, "De'Longhi Dedica EC685");
assertEqual("Coffee backfill skips published Eletta", names.includes("De'Longhi Eletta Explore ECAM450.86.T"), false);
assertIncludes("Coffee backfill includes Sage", names, "Sage Breville Barista Touch Impress");
assertEqual(
  "garbage title is ignored",
  names.includes("Sin candidato real confiable identificado en ML"),
  false,
);

assertEqual(
  "commercial suffix normalizes away",
  cleanCandidateName("Apple Watch Series 10 (reacondicionado o en oferta)"),
  "Apple Watch Series 10",
);
assertEqual(
  "commercial duplicate shares canonical key",
  canonicalCandidateKey("Apple Watch Series 10 (reacondicionado o en oferta)"),
  canonicalCandidateKey("Apple Watch Series 10"),
);
assertEqual(
  "composite candidate splits into clean models",
  splitCompositeCandidateName("Samsung Galaxy Watch 7 o Garmin Forerunner serie 265"),
  ["Samsung Galaxy Watch 7", "Garmin Forerunner 265"],
);
assertEqual("standalone size is generic", isGenericCandidateName("15 pulgadas"), true);
assertEqual(
  "condition words are removed from candidate name",
  cleanCandidateName("De'Longhi Eletta Explore nueva (no reacondicionada)"),
  "De'Longhi Eletta Explore",
);
assertEqual(
  "size alternative in parentheses does not create stray candidate",
  splitCompositeCandidateName("MacBook Air M4 (13 o 15 pulgadas)"),
  ["MacBook Air M4"],
);
assertEqual("o similar candidate is generic", isGenericCandidateName("Samsung Galaxy Watch 7 o similar"), true);
assertEqual(
  "this model candidate is self candidate",
  isSelfCandidate(
    { candidate_name: "Apple Watch SE 3 (este modelo)" },
    { meta: { slug: "apple-watch-se-3" }, producto: { display_title: "Apple Watch SE 3" } },
  ),
  true,
);
assertEqual("M2 stays in canonical key", canonicalCandidateKey("MacBook Air M2"), "macbook air m2");
assertEqual("M3 stays in canonical key", canonicalCandidateKey("MacBook Air M3 con descuento"), "macbook air m3");
assertEqual(
  "MacBook Air M2 is not self candidate for M5 review",
  isSelfCandidate(
    { candidate_name: "MacBook Air M2 (reacondicionado o segunda mano)" },
    { meta: { slug: "apple-macbook-air-13-m5-512gb" }, producto: { display_title: "Apple MacBook Air 13 M5 512GB" } },
  ),
  false,
);

assertEqual("tier superior text", classifyCandidateTier({ tipo: "premium" }), "superior");
assertEqual("tier economico text", classifyCandidateTier({ tipo: "modelo anterior o inferior" }), "economico");
assertEqual("tier similar text", classifyCandidateTier({ tipo: "mejor valor" }), "similar");
assertEqual("tier fallback", classifyCandidateTier({ tipo: "raro" }), "unknown");

const syntheticEntries = [
  {
    file: "source.json",
    review: {
      meta: { slug: "source-review", producto_id: "MLM1" },
      producto: { display_title: "Source Product" },
      editorial: {
        comparativa_editorial: [
          { tipo: "premium", titulo: "Duplicate Candidate", resumen: "same id" },
          { tipo: "premium", titulo: "Duplicate Candidate", resumen: "same id again" },
          { tipo: "premium", titulo: "Existing Name Candidate", resumen: "same name" },
          { tipo: "premium", titulo: "Existing Name Candidate (reacondicionado o en oferta)", resumen: "same clean name" },
          { tipo: "premium", titulo: "", resumen: "empty" },
          { tipo: "premium", titulo: "Published Target", resumen: "already live" },
          { tipo: "premium", titulo: "Samsung Galaxy Watch 7 o Garmin Forerunner serie 265", resumen: "split models" },
          { tipo: "premium", titulo: "Samsung Galaxy Watch 7 o similar", resumen: "generic" },
        ],
      },
      productos_similares_ml: [
        { id: "MLM999", titulo: "Future Similar Product 300", permalink: "https://www.mercadolibre.com.mx/p/MLM999" },
      ],
    },
  },
  {
    file: "published.json",
    review: {
      meta: { slug: "published-target", producto_id: "MLM2" },
      producto: { display_title: "Published Target" },
      editorial: {},
    },
  },
];

const synthetic = buildBackfillCandidates({
  entries: syntheticEntries,
  existingCandidates: [
    { candidate_id: "source-review:duplicate-candidate" },
    { candidate_id: "old-format-id", candidate_name: "Existing Name Candidate" },
  ],
  now: "2026-06-12T00:00:00.000Z",
});

assertEqual(
  "does not duplicate existing candidates",
  synthetic.some((row) => row.candidate_name === "Duplicate Candidate"),
  false,
);
assertEqual(
  "does not duplicate existing candidates by name",
  synthetic.some((row) => row.candidate_name === "Existing Name Candidate"),
  false,
);
assertEqual(
  "does not propose already published reviews by name",
  synthetic.some((row) => row.candidate_name === "Published Target"),
  false,
);
assertEqual(
  "keeps stable candidate id from candidate name for ML similar products",
  synthetic.find((row) => row.candidate_name === "Future Product 300")?.candidate_id,
  "source-review:future-product-300",
);
assertEqual(
  "splits composite candidates",
  synthetic
    .filter((row) => ["Samsung Galaxy Watch 7", "Garmin Forerunner 265"].includes(row.candidate_name))
    .map((row) => row.candidate_name),
  ["Samsung Galaxy Watch 7", "Garmin Forerunner 265"],
);
assertEqual(
  "does not keep generic o similar candidate",
  synthetic.some((row) => row.candidate_name === "Samsung Galaxy Watch 7 o similar"),
  false,
);

const cleanupRows = [
  { row_number: 2, candidate_name: "Apple Watch Series 10", status: "ready", affiliate_url: "https://meli.la/ok" },
  { row_number: 3, candidate_name: "Apple Watch Series 10 (reacondicionado o en oferta)", status: "pending" },
  { row_number: 4, candidate_name: "Samsung Galaxy Watch 7 o Garmin Forerunner serie 265", status: "pending" },
  { row_number: 5, candidate_name: "Apple Watch SE 3 (este modelo)", source_slug: "apple-watch-se-3", status: "pending" },
  { row_number: 6, candidate_name: "Samsung Galaxy Watch 7 o similar", status: "pending" },
  { row_number: 7, candidate_name: "Garmin Forerunner 265", status: "ready" },
  { row_number: 8, candidate_name: "Historical Done (o similar)", status: "done" },
  { row_number: 9, candidate_name: "MacBook Air M3 (si se consigue con descuento)", status: "pending", priority_score: 70 },
  { row_number: 10, candidate_name: "MacBook Air M3 con descuento", status: "pending", priority_score: 85 },
];
assertEqual(
  "cleanup discards only pending bad rows",
  buildCandidateCleanupUpdates({
    rows: cleanupRows,
    reviews: [{ meta: { slug: "apple-watch-se-3" }, producto: { display_title: "Apple Watch SE 3" } }],
    now: "2026-06-12T00:00:00.000Z",
  }),
  [
    {
      row_number: 3,
      status: "discarded",
      updated_at: "2026-06-12T00:00:00.000Z",
      error_msg: "cleanup: duplicate candidate",
    },
    {
      row_number: 4,
      status: "discarded",
      updated_at: "2026-06-12T00:00:00.000Z",
      error_msg: "cleanup: composite candidate",
    },
    {
      row_number: 5,
      status: "discarded",
      updated_at: "2026-06-12T00:00:00.000Z",
      error_msg: "cleanup: self candidate",
    },
    {
      row_number: 6,
      status: "discarded",
      updated_at: "2026-06-12T00:00:00.000Z",
      error_msg: "cleanup: generic candidate",
    },
    {
      row_number: 9,
      status: "discarded",
      updated_at: "2026-06-12T00:00:00.000Z",
      error_msg: "cleanup: duplicate candidate",
    },
  ],
);

console.log("Review candidate backfill test passed.");
