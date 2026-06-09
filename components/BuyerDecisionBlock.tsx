import type { NormalizedProduct } from "@/lib/product";

export default function BuyerDecisionBlock({ product }: { product: NormalizedProduct }) {
  const { editorial, vendedor } = product;
  const hasDecisionData =
    editorial.riesgosCompraMl.length > 0 ||
    editorial.checklistAntesDeComprar.length > 0 ||
    editorial.comparativaEditorial.length > 0 ||
    editorial.evidenciaLimitaciones;

  if (!hasDecisionData) return null;

  return (
    <section className="my-10 grid lg:grid-cols-[1.2fr_0.8fr] gap-6">
      <div className="bg-zinc-950 text-white rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <span className="bg-amber-400 text-zinc-950 text-xs font-black px-3 py-1 rounded-full uppercase tracking-wide">
            Antes de comprar en ML
          </span>
          {vendedor.power_seller && (
            <span className="text-xs text-zinc-400">Vendedor {vendedor.power_seller}</span>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          {editorial.riesgosCompraMl.length > 0 && (
            <div>
              <h2 className="text-lg font-bold mb-3">Riesgos a revisar</h2>
              <ul className="space-y-2">
                {editorial.riesgosCompraMl.map((item, i) => (
                  <li key={i} className="flex gap-2 text-sm text-zinc-300 leading-relaxed">
                    <span className="text-amber-300 mt-0.5">!</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {editorial.checklistAntesDeComprar.length > 0 && (
            <div>
              <h2 className="text-lg font-bold mb-3">Checklist rapido</h2>
              <ul className="space-y-2">
                {editorial.checklistAntesDeComprar.map((item, i) => (
                  <li key={i} className="flex gap-2 text-sm text-zinc-300 leading-relaxed">
                    <span className="text-green-300 mt-0.5">OK</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <aside className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <h2 className="text-lg font-bold text-gray-900 mb-2">Fuerza de evidencia</h2>
        <p className="text-sm text-gray-600 leading-relaxed mb-4">
          {editorial.evidenciaLimitaciones}
        </p>

        {editorial.mejorAlternativa && (
          <div className="border-t border-gray-100 pt-4 mb-4">
            <p className="text-xs font-bold text-green-700 uppercase tracking-wide mb-1">
              Mejor alternativa
            </p>
            <h3 className="font-bold text-gray-900 text-sm">{editorial.mejorAlternativa.titulo}</h3>
            <p className="text-sm text-gray-600 leading-relaxed mt-1">
              {editorial.mejorAlternativa.razon}
            </p>
          </div>
        )}

        {editorial.keywordTargets.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {editorial.keywordTargets.slice(0, 4).map((keyword) => (
              <span key={keyword} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                {keyword}
              </span>
            ))}
          </div>
        )}
      </aside>

      {editorial.comparativaEditorial.length > 0 && (
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Comparativa editorial</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {editorial.comparativaEditorial.slice(0, 3).map((item, i) => (
              <div key={`${item.tipo}-${i}`} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">
                  {item.tipo}
                </p>
                <h3 className="font-bold text-gray-900 text-sm mb-2">{item.titulo}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{item.resumen}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
