interface Destacada {
  titulo: string;
  contenido: string;
  sentimiento?: string;
}

interface ReviewsML {
  total: number;
  con_comentario: number;
  calificacion_promedio: number;
  destacadas: Destacada[];
}

function Stars({ n }: { n: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <svg
          key={s}
          className={`w-4 h-4 ${s <= n ? "text-yellow-400" : "text-gray-300"}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.967a1 1 0 00.95.69h4.173c.969 0 1.371 1.24.588 1.81l-3.376 2.455a1 1 0 00-.364 1.118l1.287 3.966c.3.921-.755 1.688-1.54 1.118l-3.376-2.455a1 1 0 00-1.175 0l-3.376 2.455c-.784.57-1.838-.197-1.539-1.118l1.287-3.966a1 1 0 00-.364-1.118L2.05 9.394c-.783-.57-.38-1.81.588-1.81h4.173a1 1 0 00.95-.69l1.288-3.967z" />
        </svg>
      ))}
    </div>
  );
}

const sentTone: Record<string, { badge: string; label: string; icon: string }> = {
  positivo: { badge: "bg-green-100 text-green-700", label: "A favor", icon: "▲" },
  negativo: { badge: "bg-red-100 text-red-700", label: "En contra", icon: "▼" },
  mixto: { badge: "bg-gray-100 text-gray-600", label: "Mixto", icon: "◆" },
};

export default function BuyerReviews({ reviews }: { reviews: ReviewsML }) {
  return (
    <section className="my-12">
      <div className="flex items-baseline gap-4 mb-6 flex-wrap">
        <h2 className="text-2xl font-bold text-gray-900">Qué dicen los compradores</h2>
        <span className="text-gray-500 text-sm">
          {reviews.total.toLocaleString("es-MX")} opiniones · {reviews.con_comentario.toLocaleString("es-MX")} con comentario
        </span>
      </div>

      {/* Resumen agregado (datos reales) */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6 flex items-center gap-6 shadow-sm">
        <div className="text-center shrink-0">
          <div className="text-5xl font-black text-gray-900">{reviews.calificacion_promedio}</div>
          <Stars n={Math.round(reviews.calificacion_promedio)} />
          <p className="text-xs text-gray-500 mt-1">de 5</p>
        </div>
        <div className="flex-1 border-l border-gray-100 pl-6">
          <p className="text-sm text-gray-600 leading-relaxed">
            Calificación promedio de{" "}
            <span className="font-bold text-gray-900">
              {reviews.total.toLocaleString("es-MX")}
            </span>{" "}
            compradores verificados de Mercado Libre.
            {reviews.destacadas.length > 0 && " Abajo, una síntesis de los temas que más mencionan."}
          </p>
        </div>
      </div>

      {/* Temas destacados (síntesis parafraseada) */}
      {reviews.destacadas.length > 0 && (
      <div className="grid md:grid-cols-2 gap-5">
        {reviews.destacadas.map((d, i) => {
          const tone = sentTone[(d.sentimiento || "mixto").toLowerCase()] ?? sentTone.mixto;
          return (
            <div key={i} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-gray-900">{d.titulo}</h3>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${tone.badge}`}>
                  {tone.icon} {tone.label}
                </span>
              </div>
              <p className="text-gray-700 text-sm leading-relaxed">{d.contenido}</p>
            </div>
          );
        })}
      </div>
      )}

      {reviews.destacadas.length > 0 && (
        <p className="text-xs text-gray-400 mt-4">
          Síntesis editorial de las opiniones de compradores verificados. No se reproducen reseñas
          textuales.
        </p>
      )}
    </section>
  );
}
