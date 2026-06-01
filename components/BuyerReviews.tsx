import Image from "next/image";

interface Review {
  titulo: string;
  contenido: string;
  calificacion: number;
  likes: number;
  fecha: string;
  foto: string;
}

interface ReviewsML {
  total: number;
  con_comentario: number;
  calificacion_promedio: number;
  destacadas: Review[];
}

interface BuyerReviewsProps {
  reviews: ReviewsML;
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

export default function BuyerReviews({ reviews }: BuyerReviewsProps) {
  return (
    <section className="my-12">
      <div className="flex items-baseline gap-4 mb-6">
        <h2 className="text-2xl font-bold text-gray-900">
          Opiniones de compradores
        </h2>
        <span className="text-gray-500 text-sm">
          {reviews.total.toLocaleString("es-MX")} opiniones · {reviews.con_comentario.toLocaleString("es-MX")} con comentario
        </span>
      </div>

      {/* Summary bar */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6 flex items-center gap-6 shadow-sm">
        <div className="text-center">
          <div className="text-5xl font-black text-gray-900">
            {reviews.calificacion_promedio}
          </div>
          <Stars n={Math.round(reviews.calificacion_promedio)} />
          <p className="text-xs text-gray-500 mt-1">de 5</p>
        </div>
        <div className="flex-1">
          {[5, 4, 3, 2, 1].map((star) => {
            const pct = star === 5 ? 92 : star === 4 ? 5 : star === 3 ? 2 : 1;
            return (
              <div key={star} className="flex items-center gap-2 mb-1">
                <span className="text-xs w-3 text-gray-500">{star}</span>
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-yellow-400 rounded-full"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs text-gray-400 w-8">{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Review cards */}
      <div className="grid md:grid-cols-3 gap-5">
        {reviews.destacadas.map((review, i) => (
          <div
            key={i}
            className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm flex flex-col"
          >
            <div className="flex items-start gap-3 mb-3">
              <div className="relative w-12 h-12 rounded-full overflow-hidden shrink-0 bg-gray-100">
                <Image
                  src={review.foto}
                  alt="Foto del comprador"
                  fill
                  className="object-cover"
                  sizes="48px"
                />
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm">{review.titulo}</p>
                <Stars n={review.calificacion} />
                <p className="text-xs text-gray-400 mt-0.5">
                  {new Date(review.fecha).toLocaleDateString("es-MX", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
            </div>
            <p className="text-gray-700 text-sm leading-relaxed flex-1">
              &ldquo;{review.contenido}&rdquo;
            </p>
            <div className="mt-3 flex items-center gap-1 text-xs text-gray-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
              </svg>
              {review.likes} personas encontraron esto útil
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
