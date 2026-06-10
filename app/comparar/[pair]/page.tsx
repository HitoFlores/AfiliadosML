import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { comparisonPairs, loadComparisonPair } from "@/lib/product";
import AffiliateCTA from "@/components/AffiliateCTA";
import ScoreBadge from "@/components/ScoreBadge";

export const dynamicParams = false;

export async function generateStaticParams() {
  const pairs = comparisonPairs().map(({ pair }) => ({ pair }));
  return pairs.length > 0 ? pairs : [{ pair: "_placeholder" }];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ pair: string }>;
}): Promise<Metadata> {
  const { pair } = await params;
  const data = loadComparisonPair(pair);
  if (!data) return { title: "Comparativa no encontrada" };

  const sourceTitle = data.source.producto.display_title ?? data.source.producto.nombre;
  const targetTitle = data.target.producto.display_title ?? data.target.producto.nombre;
  return {
    title: `${sourceTitle} vs ${targetTitle}: comparativa Catalogo MX`,
    description: `Comparativa editorial entre ${sourceTitle} y ${targetTitle}, con precio, score y veredicto de compra.`,
  };
}

export default async function ComparePage({
  params,
}: {
  params: Promise<{ pair: string }>;
}) {
  const { pair } = await params;
  const data = loadComparisonPair(pair);
  if (!data) notFound();

  const products = [data.source, data.target];

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <nav className="text-sm text-gray-500 mb-6 flex items-center gap-2 flex-wrap">
        <a href="/" className="hover:text-green-600">Inicio</a>
        <span>/</span>
        <span className="text-gray-800 font-medium">Comparativa</span>
      </nav>

      <header className="mb-8">
        <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 leading-tight">
          {products[0].producto.display_title ?? products[0].producto.nombre} vs{" "}
          {products[1].producto.display_title ?? products[1].producto.nombre}
        </h1>
        <p className="text-gray-600 mt-3 max-w-3xl">
          Comparativa basada en reviews publicados por Catalogo MX. Los precios pueden cambiar en Mercado Libre.
        </p>
      </header>

      <section className="grid lg:grid-cols-2 gap-5 mb-10">
        {products.map((product) => {
          const title = product.producto.display_title ?? product.producto.nombre;
          return (
            <article key={product.meta.slug} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <div className="flex gap-5">
                {product.producto.imagenes[0] && (
                  <img
                    src={product.producto.imagenes[0]}
                    alt={title}
                    className="h-28 w-28 rounded-lg object-contain bg-gray-50 border border-gray-100"
                  />
                )}
                <div className="min-w-0">
                  <h2 className="text-xl font-bold text-gray-900">{title}</h2>
                  <p className="text-sm text-gray-600 mt-2">{product.editorial.veredictoCorto}</p>
                </div>
              </div>
              <div className="flex items-center justify-between gap-4 mt-5">
                <ScoreBadge score={product.editorial.score} />
                <div className="text-right">
                  <div className="text-2xl font-extrabold text-gray-900">
                    ${product.precio.actual.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-xs text-gray-500">{product.precio.moneda}</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-5">
                <a
                  href={`/reviews/${product.meta.slug}`}
                  className="inline-flex rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:border-green-300 hover:text-green-700"
                >
                  Leer review
                </a>
                <AffiliateCTA href={product.link_afiliado ?? "#"} productName={title} />
              </div>
            </article>
          );
        })}
      </section>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-600">
            <tr>
              <th className="px-4 py-3 font-semibold">Criterio</th>
              {products.map((product) => (
                <th key={product.meta.slug} className="px-4 py-3 font-semibold">
                  {product.producto.display_title ?? product.producto.nombre}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            <tr>
              <td className="px-4 py-3 font-semibold text-gray-700">Score</td>
              {products.map((product) => (
                <td key={product.meta.slug} className="px-4 py-3">{product.editorial.score}/10</td>
              ))}
            </tr>
            <tr>
              <td className="px-4 py-3 font-semibold text-gray-700">Precio</td>
              {products.map((product) => (
                <td key={product.meta.slug} className="px-4 py-3">
                  ${product.precio.actual.toLocaleString("es-MX", { minimumFractionDigits: 2 })} {product.precio.moneda}
                </td>
              ))}
            </tr>
            <tr>
              <td className="px-4 py-3 font-semibold text-gray-700">Mejor para</td>
              {products.map((product) => (
                <td key={product.meta.slug} className="px-4 py-3">
                  {product.editorial.compraloSi[0] ?? product.editorial.veredictoCorto}
                </td>
              ))}
            </tr>
            <tr>
              <td className="px-4 py-3 font-semibold text-gray-700">Evitalo si</td>
              {products.map((product) => (
                <td key={product.meta.slug} className="px-4 py-3">
                  {product.editorial.saltateloSi[0] ?? "Valida condiciones de compra antes de decidir."}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </section>
    </main>
  );
}
