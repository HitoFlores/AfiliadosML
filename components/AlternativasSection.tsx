import type { Alternativa } from "@/lib/product";

const ICONS: Record<string, string> = {
  economica: "$",
  barata: "$",
  premium: "*",
  cara: "*",
  "mas cara": "*",
};

function getIcon(tipo: string): string {
  const lower = tipo
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  for (const [key, icon] of Object.entries(ICONS)) {
    if (lower.includes(key)) return icon;
  }
  return ">";
}

function buildMlSearchUrl(alt: Alternativa): string {
  const query = `${alt.tipo} ${alt.descripcion}`
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2)
    .slice(0, 8)
    .join(" ");

  return `https://listado.mercadolibre.com.mx/${encodeURIComponent(query)}`;
}

export default function AlternativasSection({
  alternativas,
}: {
  alternativas: Alternativa[];
}) {
  if (!alternativas || alternativas.length === 0) return null;

  return (
    <section className="my-10">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">
        No te convencio? Considera tambien
      </h2>
      <p className="text-gray-500 text-sm mb-5">
        Alternativas segun tu presupuesto y prioridades
      </p>
      <div className="grid md:grid-cols-2 gap-4">
        {alternativas.map((alt, i) => (
          <div
            key={i}
            className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg font-black text-green-700">{getIcon(alt.tipo)}</span>
              <h3 className="font-bold text-gray-900 text-sm">{alt.tipo}</h3>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">
              {alt.descripcion}
            </p>
            <a
              href={buildMlSearchUrl(alt)}
              target="_blank"
              rel="nofollow noopener noreferrer"
              className="mt-4 inline-flex text-xs font-bold text-green-700 hover:text-green-800"
            >
              Buscar esta alternativa en Mercado Libre
            </a>
          </div>
        ))}
      </div>
    </section>
  );
}
