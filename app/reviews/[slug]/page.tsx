import { notFound } from "next/navigation";
import fs from "fs";
import path from "path";
import type { Metadata } from "next";
import ImageGallery from "@/components/ImageGallery";
import ScoreBadge from "@/components/ScoreBadge";
import SpecsTable from "@/components/SpecsTable";
import BuyerReviews from "@/components/BuyerReviews";
import VideoSection from "@/components/VideoSection";
import ProsContras from "@/components/ProsContras";
import AffiliateCTA from "@/components/AffiliateCTA";

interface ProductData {
  meta: {
    producto_id: string;
    slug: string;
    categoria: string;
    generado_en: string;
  };
  producto: {
    nombre: string;
    marca: string;
    modelo: string;
    descripcion: string;
    caracteristicas_principales: string[];
    specs: Record<string, string>;
    imagenes: string[];
  };
  precio: {
    actual: number;
    original: number;
    descuento_pct: number;
    moneda: string;
    envio_gratis: boolean;
    garantia: string;
  };
  vendedor: {
    item_id: string;
    nombre: string;
    reputacion: string;
    power_seller: string;
    transacciones: number;
  };
  link_afiliado: string | null;
  reviews_ml: {
    total: number;
    con_comentario: number;
    calificacion_promedio: number;
    destacadas: Array<{
      titulo: string;
      contenido: string;
      calificacion: number;
      likes: number;
      fecha: string;
      foto: string;
    }>;
  };
  videos_yt: Array<{
    video_id: string;
    titulo: string;
    canal: string;
    url: string;
    thumbnail: string;
    publicado: string;
  }>;
  editorial: {
    score: number;
    seo_title: string;
    seo_description: string;
    mejor_para: string[];
    no_ideal_para: string[];
    articulo_html: string;
  };
}

function loadProductBySlug(slug: string): ProductData | null {
  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) return null;

  const files = fs.readdirSync(dataDir).filter((f) => f.endsWith(".json"));
  for (const file of files) {
    const raw = fs.readFileSync(path.join(dataDir, file), "utf-8");
    const data: ProductData = JSON.parse(raw);
    if (data.meta?.slug === slug) return data;
  }
  return null;
}

export async function generateStaticParams() {
  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) return [];
  const files = fs.readdirSync(dataDir).filter((f) => f.endsWith(".json"));
  return files.map((file) => {
    const raw = fs.readFileSync(path.join(dataDir, file), "utf-8");
    const data: ProductData = JSON.parse(raw);
    return { slug: data.meta.slug };
  });
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
    title: data.editorial.seo_title,
    description: data.editorial.seo_description,
    openGraph: {
      title: data.editorial.seo_title,
      description: data.editorial.seo_description,
      images: [{ url: data.producto.imagenes[0] }],
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

  const { producto, precio, reviews_ml, videos_yt, editorial, link_afiliado } = data;
  const affiliateUrl = link_afiliado ?? "#";

  const scoreColor =
    editorial.score >= 9
      ? "text-green-600"
      : editorial.score >= 7
      ? "text-yellow-500"
      : "text-red-500";

  return (
    <article className="max-w-6xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500 mb-6 flex items-center gap-2">
        <a href="/" className="hover:text-green-600">Inicio</a>
        <span>/</span>
        <a href="/reviews" className="hover:text-green-600">Reviews</a>
        <span>/</span>
        <span className="text-gray-800 font-medium">{producto.nombre}</span>
      </nav>

      {/* Hero */}
      <div className="grid lg:grid-cols-2 gap-10 mb-12">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="bg-green-100 text-green-700 text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wide">
              Análisis Editorial
            </span>
            <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-3 py-1 rounded-full">
              {producto.specs["Tipo de consola"]}
            </span>
          </div>

          <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-4 leading-tight">
            {editorial.seo_title}
          </h1>

          <p className="text-gray-600 text-lg mb-6 leading-relaxed">
            {editorial.seo_description}
          </p>

          {/* Score badge */}
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

          {/* Price + CTA */}
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
            <div className="flex items-center gap-2 mb-4 text-sm text-gray-500">
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
            <AffiliateCTA href={affiliateUrl} productName={producto.nombre} />
          </div>
        </div>

        {/* Galería */}
        <ImageGallery images={producto.imagenes} altBase={producto.nombre} />
      </div>

      {/* Pros y Contras */}
      <ProsContras
        mejorPara={editorial.mejor_para}
        noIdealPara={editorial.no_ideal_para}
      />

      {/* Características principales */}
      <section className="my-10">
        <h2 className="text-2xl font-bold text-gray-900 mb-5">
          Características destacadas
        </h2>
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

      {/* Artículo editorial */}
      <section className="my-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          Nuestro análisis
        </h2>
        <div
          className="prose-review bg-white rounded-2xl border border-gray-200 p-6 md:p-8 shadow-sm"
          dangerouslySetInnerHTML={{ __html: editorial.articulo_html }}
        />
      </section>

      {/* CTA intermedio */}
      <div className="my-10 bg-green-50 border border-green-200 rounded-2xl p-6 text-center">
        <p className="text-lg font-semibold text-gray-800 mb-1">
          ¿Listo para comprar?
        </p>
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

      {/* CTA final */}
      <div className="mt-12 bg-gray-900 rounded-2xl p-8 text-center text-white">
        <div className={`text-5xl font-black mb-2 ${scoreColor}`}>
          {editorial.score}
          <span className="text-2xl text-gray-400">/10</span>
        </div>
        <h3 className="text-2xl font-bold mb-2">{producto.nombre}</h3>
        <p className="text-gray-400 mb-6 max-w-xl mx-auto">
          Una consola híbrida excepcional que redefine el estándar de Nintendo.
          Recomendada por nuestro equipo editorial.
        </p>
        <AffiliateCTA href={affiliateUrl} productName={producto.nombre} size="lg" variant="white" />
      </div>
    </article>
  );
}
