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

console.log("Candidate completion logic test passed.");
