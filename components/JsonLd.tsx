import type { NormalizedProduct } from "@/lib/product";

interface JsonLdProps {
  product: NormalizedProduct;
  url: string;
}

/**
 * Structured data Product + Review + AggregateRating.
 * Habilita estrellas de rating en los resultados de Google (rich snippets).
 */
export default function JsonLd({ product, url }: JsonLdProps) {
  const { producto, precio, reviews_ml, editorial, autoria } = product;

  const schema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: producto.nombre,
    image: producto.imagenes,
    description: editorial.seoDescription,
    brand: { "@type": "Brand", name: producto.marca },
    sku: product.meta.producto_id,
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: reviews_ml.calificacion_promedio,
      reviewCount: reviews_ml.total,
      bestRating: 5,
      worstRating: 1,
    },
    review: {
      "@type": "Review",
      // Score editorial 0-10 → escala 0-5 para schema
      reviewRating: {
        "@type": "Rating",
        ratingValue: Number((editorial.score / 2).toFixed(1)),
        bestRating: 5,
        worstRating: 0,
      },
      author: { "@type": "Organization", name: autoria.nombre },
      datePublished: autoria.actualizado,
      reviewBody: editorial.veredictoCorto,
    },
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: precio.moneda,
      price: precio.actual,
      availability: "https://schema.org/InStock",
      ...(precio.envio_gratis && {
        shippingDetails: {
          "@type": "OfferShippingDetails",
          shippingRate: { "@type": "MonetaryAmount", value: 0, currency: precio.moneda },
        },
      }),
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
