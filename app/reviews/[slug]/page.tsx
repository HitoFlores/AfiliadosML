import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { loadProductBySlug, allSlugs } from "@/lib/product";
import { buildToc } from "@/lib/toc";
import ImageGallery from "@/components/ImageGallery";
import ScoreBadge from "@/components/ScoreBadge";
import SpecsTable from "@/components/SpecsTable";
import BuyerReviews from "@/components/BuyerReviews";
import VideoSection from "@/components/VideoSection";
import AffiliateCTA from "@/components/AffiliateCTA";
import JsonLd from "@/components/JsonLd";
import SubScores from "@/components/SubScores";
import Verdict from "@/components/Verdict";
import TableOfContents from "@/components/TableOfContents";
import { Byline, SourcesBlock } from "@/components/Byline";

const SITE_URL = "https://catalogomx.com";

export async function generateStaticParams() {
  return allSlugs();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = loadProductBySlug(slug);
  if (!data) return { title: "Review no encontrada" };
  return {
    title: data.editorial.seoTitle,
    description: data.editorial.seoDescription,
    openGraph: {
      title: data.editorial.seoTitle,
      description: data.editorial.seoDescription,
      images: [{ url: data.producto.imagenes[0] }],
      type: "article",
    },
  };
}

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = loadProductBySlug(slug);
  if (!data) notFound();

  const { producto, precio, reviews_ml, videos_yt, editorial, autoria } = data;
  const affiliateUrl = data.link_afiliado ?? "#";
  const pageUrl = `${SITE_URL}/reviews/${slug}`;

  // Inyecta ids a los <h2> y arma la tabla de contenidos.
  const { html: articleHtml, toc } = buildToc(editorial.articuloHtml);

  const scoreColor =
    editorial.score >= 9
      ? "text-green-600"
      : editorial.score >= 7
      ? "text-yellow-500"
      : "text-red-500";

  return (
    <article className="max-w-6xl mx-auto px-4 py-8">
      <JsonLd product={data} url={pageUrl} />

      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500 mb-6 flex items-center gap-2 flex-wrap">
        <a href="/" className="hover:text-green-600">Inicio</a>
        <span>/</span>
        <a href="/reviews" className="hover:text-green-600">Reviews</a>
        <span>/</span>
        <span className="text-gray-800 font-medium">{producto.nombre}</span>
      </nav>

      {/* Hero */}
      <div className="grid lg:grid-cols-2 gap-10 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="bg-green-100 text-green-700 text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wide">
              Análisis Editorial
            </span>
            {producto.specs["Tipo de consola"] && (
              <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-3 py-1 rounded-full">
                {producto.specs["Tipo de consola"]}
              </span>
            )}
          </div>

          <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-4 leading-tight">
            {editorial.seoTitle}
          </h1>

          {/* Byline — capa de confianza */}
          <div className="mb-5">
            <Byline autoria={autoria} />
          </div>

          {/* Score + rating */}
          <div className="flex items-center gap-6 mb-6">
            <ScoreBadge score={editorial.score} />
            <div>
              <div className="flex items-center gap-1 mb-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <svg
                    key={s}
                    className={`w-5 h-5 ${
                      s <= Math.round(reviews_ml.calificacion_promedio)
                        ? "text-yellow-400"
                        : "text-gray-300"
                    }`}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.967a1 1 0 00.95.69h4.173c.969 0 1.371 1.24.588 1.81l-3.376 2.455a1 1 0 00-.364 1.118l1.287 3.966c.3.921-.755 1.688-1.54 1.118l-3.376-2.455a1 1 0 00-1.175 0l-3.376 2.455c-.784.57-1.838-.197-1.539-1.118l1.287-3.966a1 1 0 00-.364-1.118L2.05 9.394c-.783-.57-.38-1.81.588-1.81h4.173a1 1 0 00.95-.69l1.288-3.967z" />
                  </svg>
                ))}
              </div>
              <p className="text-sm text-gray-600">
                <span className="font-bold text-gray-900">
                  {reviews_ml.calificacion_promedio}
                </span>{" "}
                · {reviews_ml.total.toLocaleString("es-MX")} opiniones en ML
              </p>
            </div>
          </div>

          {/* Precio + CTA */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <div className="flex items-baseline gap-3 mb-1">
              <span className="text-3xl font-extrabold text-gray-900">
                ${precio.actual.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
              </span>
              <span className="text-base text-gray-400 line-through">
                ${precio.original.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
              </span>
              <span className="bg-red-100 text-red-600 text-sm font-bold px-2 py-0.5 rounded-lg">
                -{precio.descuento_pct}%
              </span>
            </div>
            <div className="flex items-center gap-2 mb-2 text-sm text-gray-500">
              {precio.envio_gratis && (
                <span className="flex items-center gap-1 text-green-600 font-medium">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Envío gratis
                </span>
              )}
              <span>·</span>
              <span>{precio.moneda}</span>
            </div>
            <p className="text-[11px] text-gray-400 mb-4">
              Precio relevado el {autoria.actualizado} · puede variar
            </p>
            <AffiliateCTA href={affiliateUrl} productName={producto.nombre} />
          </div>
        </div>

        {/* Galería */}
        <ImageGallery images={producto.imagenes} altBase={producto.nombre} />
      </div>

      {/* Veredicto TL;DR — above the fold */}
      <Verdict
        veredicto={editorial.veredictoCorto}
        compraloSi={editorial.compraloSi}
        saltateloSi={editorial.saltateloSi}
      />

      {/* Sub-scores desglosados */}
      <SubScores subScores={editorial.subScores} scoreJustificacion={editorial.scoreJustificacion} />

      {/* Pros y Contras reales (schema v2) */}
      {(editorial.pros.length > 0 || editorial.contras.length > 0) && (
        <section className="my-10 grid md:grid-cols-2 gap-6">
          {editorial.pros.length > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-2xl p-5">
              <h2 className="text-lg font-bold text-green-800 mb-4">Lo bueno</h2>
              <ul className="space-y-3">
                {editorial.pros.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="text-green-500 mt-0.5 shrink-0">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {editorial.contras.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
              <h2 className="text-lg font-bold text-red-800 mb-4">A tener en cuenta</h2>
              <ul className="space-y-3">
                {editorial.contras.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="text-red-400 mt-0.5 shrink-0">✕</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* Características destacadas */}
      <section className="my-10">
        <h2 className="text-2xl font-bold text-gray-900 mb-5">Características destacadas</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {producto.caracteristicas_principales.map((feat, i) => (
            <div
              key={i}
              className="bg-white border border-gray-200 rounded-xl p-4 flex items-start gap-3 shadow-sm"
            >
              <div className="shrink-0 w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm text-gray-700">{feat}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Artículo + TOC sticky */}
      <section className="my-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Nuestro análisis</h2>
        {toc.length >= 2 ? (
          <div className="grid lg:grid-cols-[220px_1fr] gap-8">
            <TableOfContents items={toc} />
            <div
              className="prose-review bg-white rounded-2xl border border-gray-200 p-6 md:p-8 shadow-sm scroll-mt-24"
              dangerouslySetInnerHTML={{ __html: articleHtml }}
            />
          </div>
        ) : (
          <div
            className="prose-review bg-white rounded-2xl border border-gray-200 p-6 md:p-8 shadow-sm"
            dangerouslySetInnerHTML={{ __html: articleHtml }}
          />
        )}
      </section>

      {/* CTA intermedio */}
      <div className="my-10 bg-green-50 border border-green-200 rounded-2xl p-6 text-center">
        <p className="text-lg font-semibold text-gray-800 mb-1">¿Listo para comprar?</p>
        <p className="text-gray-500 text-sm mb-4">
          Precio actual en Mercado Libre México con envío gratis
        </p>
        <div className="flex justify-center items-baseline gap-3 mb-4">
          <span className="text-2xl font-extrabold text-gray-900">
            ${precio.actual.toLocaleString("es-MX", { minimumFractionDigits: 2 })} {precio.moneda}
          </span>
          <span className="bg-red-100 text-red-600 text-sm font-bold px-2 py-0.5 rounded-lg">
            -{precio.descuento_pct}%
          </span>
        </div>
        <AffiliateCTA href={affiliateUrl} productName={producto.nombre} size="lg" />
      </div>

      {/* Specs */}
      <SpecsTable specs={producto.specs} />

      {/* Videos */}
      <VideoSection videos={videos_yt} />

      {/* Reviews de compradores */}
      <BuyerReviews reviews={reviews_ml} />

      {/* Metodología + fuentes citadas */}
      <SourcesBlock autoria={autoria} fuentes={editorial.fuentesCitadas} />

      {/* CTA final */}
      <div className="mt-12 bg-gray-900 rounded-2xl p-8 text-center text-white">
        <div className={`text-5xl font-black mb-2 ${scoreColor}`}>
          {editorial.score}
          <span className="text-2xl text-gray-400">/10</span>
        </div>
        <h3 className="text-2xl font-bold mb-2">{producto.nombre}</h3>
        <p className="text-gray-400 mb-6 max-w-xl mx-auto">{editorial.veredictoCorto}</p>
        <AffiliateCTA href={affiliateUrl} productName={producto.nombre} size="lg" variant="white" />
      </div>
    </article>
  );
}
