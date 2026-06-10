import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { loadRankingCategory, rankingCategories } from "@/lib/product";

export const dynamicParams = false;

export async function generateStaticParams() {
  return rankingCategories().map(({ slug }) => ({ category: slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category } = await params;
  const data = loadRankingCategory(category);
  if (!data) return { title: "Ranking no encontrado" };

  return {
    title: `Mejores ${data.label} en Mercado Libre Mexico`,
    description: `Ranking editorial de ${data.label} revisados por Catalogo MX.`,
  };
}

export default async function RankingCategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  const data = loadRankingCategory(category);
  if (!data) notFound();

  return (
    <main className="max-w-6xl mx-auto px-4 py-10">
      <nav className="text-sm text-gray-500 mb-6 flex items-center gap-2 flex-wrap">
        <a href="/" className="hover:text-green-600">Inicio</a>
        <span>/</span>
        <a href="/rankings" className="hover:text-green-600">Rankings</a>
        <span>/</span>
        <span className="text-gray-800 font-medium">{data.label}</span>
      </nav>

      <header className="mb-8">
        <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900">
          Mejores {data.label}
        </h1>
        <p className="text-gray-600 mt-3 max-w-3xl">
          Ordenado por score editorial. Cada posicion enlaza al review completo y al producto en Mercado Libre cuando existe link afiliado.
        </p>
      </header>

      <section className="space-y-4">
        {data.products.map((product, index) => {
          const title = product.producto.display_title ?? product.producto.nombre;
          return (
            <article
              key={product.meta.slug}
              className="bg-white border border-gray-200 rounded-xl p-4 md:p-5 shadow-sm"
            >
              <div className="grid md:grid-cols-[64px_120px_1fr_auto] gap-4 md:items-center">
                <div className="text-3xl font-black text-gray-300">#{index + 1}</div>
                {product.producto.imagenes[0] && (
                  <img
                    src={product.producto.imagenes[0]}
                    alt={title}
                    className="h-24 w-full rounded-lg object-contain bg-gray-50 border border-gray-100"
                  />
                )}
                <div className="min-w-0">
                  <h2 className="text-lg font-bold text-gray-900">{title}</h2>
                  <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                    {product.editorial.veredictoCorto}
                  </p>
                  <div className="text-sm font-semibold text-gray-900 mt-2">
                    ${product.precio.actual.toLocaleString("es-MX", { minimumFractionDigits: 2 })} {product.precio.moneda}
                  </div>
                </div>
                <div className="flex md:flex-col gap-2 md:items-end">
                  <div className="rounded-full bg-gray-900 px-3 py-1 text-sm font-bold text-white">
                    {product.editorial.score}/10
                  </div>
                  <a
                    href={`/reviews/${product.meta.slug}`}
                    className="inline-flex rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:border-green-300 hover:text-green-700"
                  >
                    Leer review
                  </a>
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
