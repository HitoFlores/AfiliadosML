interface VerdictProps {
  veredicto: string;
  compraloSi: string[];
  saltateloSi: string[];
}

/**
 * Bloque "veredicto en 30 segundos" — patrón Tom's Guide / TechRadar.
 * Lo esencial para quien escanea sin leer todo el artículo.
 */
export default function Verdict({ veredicto, compraloSi, saltateloSi }: VerdictProps) {
  return (
    <section className="bg-white rounded-2xl border-2 border-gray-900 p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <span className="bg-gray-900 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">
          Veredicto
        </span>
        <span className="text-gray-400 text-xs">Lo esencial en 30 segundos</span>
      </div>

      <p className="text-gray-800 text-lg leading-relaxed font-medium mb-5">{veredicto}</p>

      {(compraloSi.length > 0 || saltateloSi.length > 0) && (
        <div className="grid sm:grid-cols-2 gap-4 pt-4 border-t border-gray-100">
          {compraloSi.length > 0 && (
            <div>
              <p className="text-xs font-bold text-green-700 uppercase tracking-wide mb-2">
                Cómpralo si
              </p>
              <ul className="space-y-1.5">
                {compraloSi.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="text-green-500 mt-0.5">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {saltateloSi.length > 0 && (
            <div>
              <p className="text-xs font-bold text-red-600 uppercase tracking-wide mb-2">
                Sáltatelo si
              </p>
              <ul className="space-y-1.5">
                {saltateloSi.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="text-red-400 mt-0.5">✕</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
