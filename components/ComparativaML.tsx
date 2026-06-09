import type { ProductoSimilarML } from "@/lib/product";

export default function ComparativaML({
  productos,
  precioActual,
}: {
  productos: ProductoSimilarML[];
  precioActual?: number | null;
}) {
  if (!productos || productos.length === 0) return null;

  function getPriceLabel(precio: number) {
    if (!precioActual || precioActual <= 0) return "Alternativa ML";
    const diff = Math.round(((precio - precioActual) / precioActual) * 100);
    if (diff <= -12) return `${Math.abs(diff)}% mas barato`;
    if (diff >= 12) return `${diff}% mas caro`;
    return "Precio similar";
  }

  function getTone(precio: number) {
    if (!precioActual || precioActual <= 0) return "bg-gray-100 text-gray-600";
    const diff = ((precio - precioActual) / precioActual) * 100;
    if (diff <= -12) return "bg-green-100 text-green-700";
    if (diff >= 12) return "bg-amber-100 text-amber-700";
    return "bg-blue-100 text-blue-700";
  }

  return (
    <section className="my-10">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">
        Opciones comparables en ML
      </h2>
      <p className="text-gray-500 text-sm mb-5">
        Productos similares o publicaciones del mismo catalogo detectadas en Mercado Libre. Los enlaces son nofollow y pueden no ser afiliados.
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
              <span className={`self-start text-[11px] font-bold px-2 py-0.5 rounded-full ${getTone(p.precio)}`}>
                {getPriceLabel(p.precio)}
              </span>
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
