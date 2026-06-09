import type { NormalizedProduct } from "@/lib/product";

export default function BuyerDecisionBlock({ product }: { product: NormalizedProduct }) {
  const { editorial, vendedor } = product;
  const evidenceText = editorial.evidenciaLimitaciones
    .replace(/^No hicimos prueba propia(?: de laboratorio)?;\s*/i, "")
    .trim();
  const hasChecklistData =
    editorial.riesgosCompraMl.length > 0 || editorial.checklistAntesDeComprar.length > 0;
  const hasEvidenceData =
    Boolean(evidenceText) ||
    Boolean(editorial.mejorAlternativa) ||
    editorial.keywordTargets.length > 0;
  const hasDecisionData = hasChecklistData || hasEvidenceData || editorial.comparativaEditorial.length > 0;
  const topPanelCount = Number(hasChecklistData) + Number(hasEvidenceData);
  const sectionClassName =
    topPanelCount >= 2 ? "my-10 grid lg:grid-cols-2 gap-6" : "my-10 space-y-6";

  if (!hasDecisionData) return null;

  return (
    <section className={sectionClassName}>
      {hasChecklistData && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-5">
            <span className="bg-amber-100 text-amber-800 text-xs font-black px-3 py-1 rounded-full uppercase tracking-wide">
              Antes de comprar en ML
            </span>
            {vendedor.power_seller && (
              <span className="text-xs text-gray-500">Vendedor {vendedor.power_seller}</span>
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            {editorial.riesgosCompraMl.length > 0 && (
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-3">Riesgos a revisar</h2>
                <ul className="space-y-2">
                  {editorial.riesgosCompraMl.map((item, i) => (
                    <li key={i} className="flex gap-2 text-sm text-gray-700 leading-relaxed">
                      <span className="text-amber-600 mt-0.5 font-bold">!</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {editorial.checklistAntesDeComprar.length > 0 && (
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-3">Checklist rápido</h2>
                <ul className="space-y-2">
                  {editorial.checklistAntesDeComprar.map((item, i) => (
                    <li key={i} className="flex gap-2 text-sm text-gray-700 leading-relaxed">
                      <span className="text-green-600 mt-0.5 font-bold">OK</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {hasEvidenceData && (
        <aside className="bg-gray-950 text-white rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-bold mb-2">Base del análisis</h2>
          {evidenceText && (
            <p className="text-sm text-zinc-300 leading-relaxed mb-4">
              {evidenceText}
            </p>
          )}

          {editorial.mejorAlternativa && (
            <div className="border-t border-zinc-800 pt-4 mb-4">
              <p className="text-xs font-bold text-green-300 uppercase tracking-wide mb-1">
                Mejor alternativa
              </p>
              <h3 className="font-bold text-white text-sm">{editorial.mejorAlternativa.titulo}</h3>
              <p className="text-sm text-zinc-300 leading-relaxed mt-1">
                {editorial.mejorAlternativa.razon}
              </p>
            </div>
          )}

          {editorial.keywordTargets.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {editorial.keywordTargets.slice(0, 4).map((keyword) => (
                <span key={keyword} className="text-xs bg-zinc-800 text-zinc-300 px-2 py-1 rounded-full">
                  {keyword}
                </span>
              ))}
            </div>
          )}
        </aside>
      )}

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
