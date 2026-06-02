import type { Autoria, Fuente } from "@/lib/product";

interface BylineProps {
  autoria: Autoria;
}

/** Byline + fecha. Capa de confianza (E-E-A-T). */
export function Byline({ autoria }: BylineProps) {
  const fecha = autoria.actualizado
    ? new Date(autoria.actualizado).toLocaleDateString("es-MX", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <div className="flex items-center gap-3 text-sm">
      <div className="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center text-white font-bold shrink-0">
        AM
      </div>
      <div>
        <p className="font-semibold text-gray-900">{autoria.nombre}</p>
        {fecha && <p className="text-gray-500 text-xs">Actualizado el {fecha}</p>}
      </div>
    </div>
  );
}

/** Bloque de metodología + fuentes citadas. Va al pie del análisis. */
export function SourcesBlock({
  autoria,
  fuentes,
}: {
  autoria: Autoria;
  fuentes: Fuente[];
}) {
  return (
    <section className="my-12 bg-gray-50 border border-gray-200 rounded-2xl p-6">
      <h2 className="text-lg font-bold text-gray-900 mb-2">Cómo hicimos este análisis</h2>
      <p className="text-sm text-gray-600 leading-relaxed mb-5">{autoria.metodologia}</p>

      {fuentes.length > 0 && (
        <>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
            Fuentes consultadas
          </p>
          <ul className="space-y-2">
            {fuentes.map((f, i) => (
              <li key={i} className="flex items-start gap-3 text-sm">
                <span
                  className={`shrink-0 mt-0.5 text-xs font-semibold px-2 py-0.5 rounded ${
                    f.tipo === "video"
                      ? "bg-red-100 text-red-700"
                      : "bg-blue-100 text-blue-700"
                  }`}
                >
                  {f.tipo === "video" ? "▶ Video" : "★ ML"}
                </span>
                <span className="text-gray-700">
                  <span className="font-medium text-gray-900">{f.autor}</span>
                  {f.aporte && <span className="text-gray-500"> — {f.aporte}</span>}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="text-xs text-gray-400 mt-5 pt-4 border-t border-gray-200">
        Contenido asistido por IA a partir de fuentes reales y verificables. Algunos enlaces
        son de afiliado: si comprás a través de ellos, apoyás este sitio sin costo extra para vos.
      </p>
    </section>
  );
}
