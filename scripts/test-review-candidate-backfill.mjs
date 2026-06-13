import {
  buildBackfillCandidates,
  classifyCandidateTier,
} from "./review-candidate-backfill.mjs";

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

assertIncludes("MacBook backfill includes M2", names, "MacBook Air M2 (reacondicionado o segunda mano)");
assertIncludes("MacBook backfill includes M3", names, "MacBook Air M3 con descuento");
assertIncludes("MacBook backfill includes Pro", names, "MacBook Pro M5 Pro (14 pulgadas)");
assertIncludes("MacBook backfill includes Windows alternative", names, "Laptop Windows con Intel Core Ultra o AMD Ryzen AI (gama alta)");
assertIncludes("Switch backfill includes Lite", names, "Nintendo Switch Lite");
assertIncludes("Switch backfill includes Switch 2", names, "Nintendo Switch 2");
assertIncludes("Switch backfill includes Steam Deck", names, "Steam Deck (Valve)");
assertIncludes("Coffee backfill includes Arte", names, "De'Longhi La Specialista Arte EC9155M");
assertIncludes("Coffee backfill includes Eletta", names, "De'Longhi Eletta Explore ECAM450.86.T");
assertIncludes("Coffee backfill includes Sage", names, "Sage (Breville) Barista Touch Impress");
assertEqual(
  "garbage title is ignored",
  names.includes("Sin candidato real confiable identificado en ML"),
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
          { tipo: "premium", titulo: "", resumen: "empty" },
          { tipo: "premium", titulo: "Published Target", resumen: "already live" },
        ],
      },
      productos_similares_ml: [
        { id: "MLM999", titulo: "Future Similar Product", permalink: "https://www.mercadolibre.com.mx/p/MLM999" },
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
  synthetic.find((row) => row.candidate_name === "Future Similar Product")?.candidate_id,
  "source-review:future-similar-product",
);

console.log("Review candidate backfill test passed.");
