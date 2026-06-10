import type { RelatedReview } from "@/lib/product";

interface RelatedReviewsProps {
  reviews: RelatedReview[];
}

export default function RelatedReviews({ reviews }: RelatedReviewsProps) {
  if (reviews.length === 0) return null;

  return (
    <section className="my-10">
      <div className="mb-5">
        <h2 className="text-2xl font-bold text-gray-900">Reviews relacionados</h2>
        <p className="text-sm text-gray-500 mt-1">
          Alternativas que ya pasaron por el mismo flujo editorial.
        </p>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {reviews.map(({ product, sourceSlug, targetSlug, relationId }) => {
          const title = product.producto.display_title ?? product.producto.nombre;
          return (
            <article
              key={relationId}
              className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm"
            >
              <div className="flex gap-4">
                {product.producto.imagenes[0] && (
                  <img
                    src={product.producto.imagenes[0]}
                    alt={title}
                    className="h-20 w-20 rounded-lg object-contain bg-gray-50 border border-gray-100"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-green-700 uppercase">
                    {product.editorial.score}/10
                  </div>
                  <h3 className="font-bold text-gray-900 leading-snug mt-1">{title}</h3>
                  <p className="text-sm text-gray-600 line-clamp-2 mt-1">
                    {product.editorial.veredictoCorto}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-4">
                <a
                  href={`/reviews/${targetSlug}`}
                  className="inline-flex items-center rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white hover:bg-gray-800"
                >
                  Ver review
                </a>
                <a
                  href={`/comparar/${sourceSlug}-vs-${targetSlug}`}
                  className="inline-flex items-center rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:border-green-300 hover:text-green-700"
                >
                  Comparar
                </a>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
