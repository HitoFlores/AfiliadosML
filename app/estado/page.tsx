import type { Metadata } from "next";
import { comparisonPairs, loadAllProducts, rankingCategories } from "@/lib/product";

export const metadata: Metadata = {
  title: "Estado Catalogo MX",
  description: "Resumen operativo estatico de reviews, freshness, rankings y comparadores.",
};

export default function EstadoPage() {
  const products = loadAllProducts();
  const rankings = rankingCategories();
  const comparisons = comparisonPairs();
  const stale = products.filter((product) => product.freshness?.stale);
  const freshnessDates = products
    .map((product) => product.freshness?.checked_at)
    .filter(Boolean)
    .sort()
    .reverse();
  const lastFreshness = freshnessDates[0] ?? "sin freshness";

  const cards = [
    { label: "Reviews", value: products.length },
    { label: "Rankings", value: rankings.length },
    { label: "Comparadores", value: comparisons.length },
    { label: "Stale", value: stale.length },
  ];

  return (
    <main className="max-w-6xl mx-auto px-4 py-10">
      <nav className="text-sm text-gray-500 mb-6 flex items-center gap-2 flex-wrap">
        <a href="/" className="hover:text-green-600">Inicio</a>
        <span>/</span>
        <span className="text-gray-800 font-medium">Estado</span>
      </nav>

      <header className="mb-8">
        <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900">
          Estado operativo
        </h1>
        <p className="text-gray-600 mt-3 max-w-3xl">
          Resumen generado desde los JSON publicados. Ultimo freshness: {lastFreshness}.
        </p>
      </header>

      <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {cards.map((card) => (
          <div key={card.label} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <div className="text-sm text-gray-500">{card.label}</div>
            <div className="text-3xl font-black text-gray-900 mt-2">{card.value}</div>
          </div>
        ))}
      </section>

      <section className="grid lg:grid-cols-2 gap-5">
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Freshness</h2>
          <div className="space-y-3">
            {products.map((product) => {
              const title = product.producto.display_title ?? product.producto.nombre;
              return (
                <div key={product.meta.slug} className="flex items-start justify-between gap-4 text-sm">
                  <div>
                    <a href={`/reviews/${product.meta.slug}`} className="font-semibold text-gray-900 hover:text-green-700">
                      {title}
                    </a>
                    <div className="text-gray-500">{product.freshness?.checked_at ?? "sin freshness"}</div>
                  </div>
                  <span className={product.freshness?.stale ? "text-red-600 font-bold" : "text-green-700 font-bold"}>
                    {product.freshness?.stale ? product.freshness.stale_reason : "ok"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Cobertura</h2>
          <div className="space-y-3">
            {rankings.map((ranking) => (
              <div key={ranking.slug} className="flex items-center justify-between gap-4 text-sm">
                <a href={`/rankings/${ranking.slug}`} className="font-semibold text-gray-900 hover:text-green-700">
                  {ranking.label}
                </a>
                <span className="text-gray-500">{ranking.products.length} reviews</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
