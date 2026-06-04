import type { Alternativa } from "@/lib/product";

const ICONS: Record<string, string> = {
  económica: "💰",
  economica: "💰",
  barata: "💰",
  premium: "⭐",
  cara: "⭐",
  "más cara": "⭐",
};

function getIcon(tipo: string): string {
  const lower = tipo.toLowerCase();
  for (const [key, icon] of Object.entries(ICONS)) {
    if (lower.includes(key)) return icon;
  }
  return "🔄";
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
        ¿No te convenció? Considera también
      </h2>
      <p className="text-gray-500 text-sm mb-5">
        Alternativas según tu presupuesto y prioridades
      </p>
      <div className="grid md:grid-cols-2 gap-4">
        {alternativas.map((alt, i) => (
          <div
            key={i}
            className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">{getIcon(alt.tipo)}</span>
              <h3 className="font-bold text-gray-900 text-sm">{alt.tipo}</h3>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">
              {alt.descripcion}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
