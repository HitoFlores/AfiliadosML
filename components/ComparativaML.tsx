import type { ProductoSimilarML } from "@/lib/product";

export default function ComparativaML({
  productos,
}: {
  productos: ProductoSimilarML[];
}) {
  if (!productos || productos.length === 0) return null;

  return (
    <section className="my-10">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">
        Comparado con la competencia en ML
      </h2>
      <p className="text-gray-500 text-sm mb-5">
        Productos similares disponibles en Mercado Libre en rango de precio comparable
      </p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {productos.map((p) => (
          <a
            key={p.id}
            href={p.permalink}
            target="_blank"
            rel="nofollow noopener noreferrer"
            className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col gap-3 group"
          >
            {p.thumbnail && (
              <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-gray-50 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.thumbnail}
                  alt={p.titulo}
                  className="object-contain w-full h-full group-hover:scale-105 transition-transform"
                />
              </div>
            )}
            <div className="flex-1 flex flex-col gap-1">
              <p className="text-sm font-semibold text-gray-800 line-clamp-2 leading-snug">
                {p.titulo}
              </p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-base font-bold text-gray-900">
                  ${p.precio.toLocaleString("es-MX")}
                </span>
                {p.precio_original > p.precio && (
                  <span className="text-xs text-gray-400 line-through">
                    ${p.precio_original.toLocaleString("es-MX")}
                  </span>
                )}
              </div>
              {p.envio_gratis && (
                <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Envío gratis
                </span>
              )}
            </div>
            <span className="text-xs text-green-600 font-semibold flex items-center gap-1 mt-auto">
              Ver en Mercado Libre
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}
