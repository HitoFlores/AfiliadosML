function classifyFreshness({ previousPrice, item }) {
  const currentPrice = Number(item?.price || 0);
  const deltaPct =
    previousPrice > 0 && currentPrice > 0
      ? Number((((currentPrice - previousPrice) / previousPrice) * 100).toFixed(2))
      : null;
  const availableQuantityRaw = item?.available_quantity;
  const availableQuantity =
    availableQuantityRaw === undefined || availableQuantityRaw === null
      ? null
      : Number(availableQuantityRaw);
  const status = String(item?.status || (currentPrice > 0 ? "active_inferred" : "unknown"));
  const inactive = !["active", "active_inferred"].includes(status);
  const noStock = availableQuantity !== null && availableQuantity <= 0;
  const missingPrice = currentPrice <= 0;
  const priceTooHigh = deltaPct !== null && deltaPct >= 20;

  return {
    status,
    is_available: !inactive && !noStock && !missingPrice,
    stale: inactive || noStock || missingPrice || priceTooHigh,
    stale_reason: inactive
      ? "inactive_listing"
      : noStock
      ? "no_stock"
      : missingPrice
      ? "missing_price"
      : priceTooHigh
      ? "price_increased_20pct"
      : "",
    price_current: currentPrice || null,
    price_delta_pct: deltaPct,
    available_quantity: availableQuantity,
  };
}

const cases = [
  {
    name: "active inferred with price",
    previousPrice: 100,
    item: { price: 100 },
    expected: { stale: false, stale_reason: "", is_available: true },
  },
  {
    name: "inactive listing",
    previousPrice: 100,
    item: { price: 100, status: "closed" },
    expected: { stale: true, stale_reason: "inactive_listing", is_available: false },
  },
  {
    name: "no stock",
    previousPrice: 100,
    item: { price: 100, status: "active", available_quantity: 0 },
    expected: { stale: true, stale_reason: "no_stock", is_available: false },
  },
  {
    name: "missing price",
    previousPrice: 100,
    item: { price: 0, status: "active" },
    expected: { stale: true, stale_reason: "missing_price", is_available: false },
  },
  {
    name: "price increased 20pct",
    previousPrice: 100,
    item: { price: 120, status: "active" },
    expected: { stale: true, stale_reason: "price_increased_20pct", is_available: true },
  },
];

let errors = 0;
for (const testCase of cases) {
  const actual = classifyFreshness(testCase);
  for (const [key, expected] of Object.entries(testCase.expected)) {
    if (actual[key] !== expected) {
      errors += 1;
      console.error(
        `ERROR ${testCase.name}: ${key} expected ${expected}, got ${actual[key]}`,
      );
    }
  }
}

if (errors > 0) {
  console.error(`Freshness logic test failed: ${errors} error(s).`);
  process.exit(1);
}

console.log(`Freshness logic test passed: ${cases.length} cases.`);
