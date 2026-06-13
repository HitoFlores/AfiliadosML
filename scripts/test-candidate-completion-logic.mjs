function norm(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactUrl(value) {
  return String(value || "").trim().replace(/\?.*$/, "").replace(/\/$/, "").toLowerCase();
}

function findCompletedCandidate({ route, review, rows }) {
  const candidateId = route.candidate_id || review.meta?.candidate_id || "";
  const activeStatuses = new Set(["ready", "processing", "pending"]);
  const candidates = rows.filter((row) =>
    activeStatuses.has(String(row.status || "").toLowerCase().trim()),
  );

  let row = candidateId ? rows.find((entry) => entry.candidate_id === candidateId) : null;
  if (!row && route.referido) {
    row = candidates.find((entry) => compactUrl(entry.affiliate_url) === compactUrl(route.referido));
  }
  if (!row && route.product_id) {
    row = candidates.find(
      (entry) =>
        String(entry.candidate_ml_id || "").toUpperCase() === String(route.product_id || "").toUpperCase(),
    );
  }
  if (!row && route.articulo) {
    const articulo = compactUrl(route.articulo);
    row = candidates.find(
      (entry) => compactUrl(entry.candidate_ml_url) === articulo || compactUrl(entry.affiliate_url) === articulo,
    );
  }
  if (!row) {
    const title = norm([review.producto?.display_title, review.producto?.nombre].filter(Boolean).join(" "));
    row = candidates.find((entry) => {
      const candidate = norm(entry.candidate_name);
      return candidate && title && (title.includes(candidate.slice(0, 60)) || candidate.includes(title.slice(0, 60)));
    });
  }
  return row || null;
}

function reconcilePublishedCandidates(rows, published) {
  const titleMatches = (candidateName, reviewTitle) => {
    const candidate = norm(candidateName)
      .split(" ")
      .filter((token) => token.length > 2)
      .join(" ");
    const title = norm(reviewTitle)
      .split(" ")
      .filter((token) => token.length > 2)
      .join(" ");
    if (!candidate || !title || candidate.length < 10 || title.length < 10) return false;
    return title.includes(candidate.slice(0, 80)) || candidate.includes(title.slice(0, 80));
  };
  const activeStatuses = new Set(["pending", "ready", "processing"]);
  const out = [];

  for (const row of rows) {
    const status = String(row.status || "").toLowerCase().trim();
    if (!row.row_number || !activeStatuses.has(status)) continue;
    const match = published.find((review) => {
      if (row.candidate_id && review.candidate_id && row.candidate_id === review.candidate_id) return true;
      if (row.target_slug && row.target_slug === review.slug) return true;
      if (
        row.candidate_ml_id &&
        review.product_id &&
        String(row.candidate_ml_id).toUpperCase() === String(review.product_id).toUpperCase()
      ) {
        return true;
      }
      return titleMatches(row.candidate_name, review.title);
    });
    if (match) out.push({ row_number: row.row_number, target_slug: match.slug, status: "done" });
  }
  return out;
}

function assertEqual(name, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${name}: expected ${e}, got ${a}`);
}

const rows = [
  {
    row_number: 7,
    candidate_id: "source:macbook-air-m5",
    candidate_name: "Apple MacBook Air 13 M5 512 GB",
    candidate_ml_id: "MLM1066159881",
    candidate_ml_url: "https://www.mercadolibre.com.mx/p/MLM1066159881",
    affiliate_url: "https://meli.la/12JhaLr",
    status: "ready",
  },
];

const review = {
  meta: { slug: "apple-macbook-air-13-m5-512gb" },
  producto: {
    display_title: "Apple MacBook Air 13\" M5 512 GB",
    nombre: "MacBook Air de 13 pulgadas chip M5 512 GB",
  },
};

assertEqual(
  "candidate_id match wins",
  findCompletedCandidate({ route: { candidate_id: "source:macbook-air-m5" }, review, rows })?.candidate_id,
  "source:macbook-air-m5",
);

assertEqual(
  "affiliate fallback closes orphan candidate",
  findCompletedCandidate({ route: { referido: "https://meli.la/12JhaLr" }, review, rows })?.candidate_id,
  "source:macbook-air-m5",
);

assertEqual(
  "product id fallback closes orphan candidate",
  findCompletedCandidate({ route: { product_id: "MLM1066159881" }, review, rows })?.candidate_id,
  "source:macbook-air-m5",
);

assertEqual(
  "title fallback closes orphan candidate",
  findCompletedCandidate({ route: {}, review, rows })?.candidate_id,
  "source:macbook-air-m5",
);

assertEqual(
  "schema reconciliation closes published orphan by title",
  reconcilePublishedCandidates(
    [
      {
        row_number: 9,
        candidate_id: "source:macbook-air-m5",
        candidate_name: "Apple MacBook Air 13 M5 512 GB",
        status: "ready",
      },
    ],
    [
      {
        slug: "apple-macbook-air-13-m5-512gb",
        candidate_id: "",
        product_id: "MLM1066159881",
        title: "Apple MacBook Air 13\" M5 512 GB MacBook Air de 13 pulgadas chip M5",
      },
    ],
  ),
  [{ row_number: 9, target_slug: "apple-macbook-air-13-m5-512gb", status: "done" }],
);

console.log("Candidate completion logic test passed.");
