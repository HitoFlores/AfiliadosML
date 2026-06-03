import Link from "next/link";
import { readdir, readFile } from "fs/promises";
import { join } from "path";

interface ReviewCard {
  slug: string;
  nombre: string;
  marca: string;
  imagen: string;
  score: number;
  precio: number;
  descuento: number;
  veredicto: string;
  actualizado: string;
}

async function getReviews(): Promise<ReviewCard[]> {
  const dir = join(process.cwd(), "data");
  const files = (await readdir(dir)).filter((f) => f.endsWith(".json"));

  const cards: ReviewCard[] = [];
  for (const file of files) {
    try {
      const raw = JSON.parse(await readFile(join(dir, file), "utf-8"));
      if (!raw.meta?.slug || !raw.editorial?.score) continue;
      cards.push({
        slug:       raw.meta.slug,
        nombre:     raw.producto?.nombre ?? file.replace(".json", ""),
        marca:      raw.producto?.marca ?? "",
        imagen:     raw.producto?.imagenes?.[0] ?? "",
        score:      raw.editorial.score,
        precio:     raw.precio?.actual ?? 0,
        descuento:  raw.precio?.descuento_pct ?? 0,
        veredicto:  raw.editorial.veredicto_corto ?? raw.editorial.seo_description ?? "",
        actualizado: raw.autoria?.actualizado ?? "",
      });
    } catch {}
  }

  return cards.sort((a, b) => b.score - a.score);
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function scoreColor(score: number) {
  if (score >= 8.5) return "bg-green-500";
  if (score >= 7.0) return "bg-amber-500";
  return "bg-red-500";
}

function ScorePill({ score }: { score: number }) {
  return (
    <span
      className={`${scoreColor(score)} text-white text-sm font-bold tabular-nums px-3 py-1 rounded-full`}
    >
      {score.toFixed(1)}
    </span>
  );
}

function formatPrice(n: number) {
  return n.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });
}

/* ── Featured card (horizontal, full-width) ──────────────────────────────── */

function FeaturedCard({ r }: { r: ReviewCard }) {
  return (
    <Link
      href={`/reviews/${r.slug}`}
      className="group grid md:grid-cols-2 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md overflow-hidden transition-shadow"
    >
      {/* Image */}
      {r.imagen && (
        <div className="h-60 md:h-auto bg-gray-50 overflow-hidden">
          <img
            src={r.imagen}
            alt={r.nombre}
            className="w-full h-full object-contain md:object-cover group-hover:scale-[1.02] transition-transform duration-500"
          />
        </div>
      )}

      {/* Content */}
      <div className="p-7 flex flex-col justify-between gap-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-widest text-green-600">
              {r.marca}
            </span>
            <span className="text-xs text-gray-300">·</span>
            <span className="text-xs text-gray-400">Análisis destacado</span>
          </div>

          <h2 className="text-xl font-bold text-gray-900 leading-snug group-hover:text-green-700 transition-colors">
            {r.nombre}
          </h2>

          <p className="text-gray-500 text-sm leading-relaxed line-clamp-3">
            {r.veredicto}
          </p>
        </div>

        <div className="flex items-end justify-between pt-4 border-t border-gray-100">
          <div>
            <p className="text-xl font-bold text-gray-900">
              {formatPrice(r.precio)}
              {r.descuento > 0 && (
                <span className="ml-2 text-sm font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                  -{r.descuento}%
                </span>
              )}
            </p>
            {r.actualizado && (
              <p className="text-xs text-gray-400 mt-0.5">
                Actualizado {r.actualizado}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1">
            <ScorePill score={r.score} />
            <span className="text-xs text-gray-400">nuestra nota</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

/* ── Small card (grid) ───────────────────────────────────────────────────── */

function ReviewCard({ r }: { r: ReviewCard }) {
  return (
    <Link
      href={`/reviews/${r.slug}`}
      className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md overflow-hidden flex flex-col transition-shadow"
    >
      {r.imagen && (
        <div className="h-44 bg-gray-50 overflow-hidden">
          <img
            src={r.imagen}
            alt={r.nombre}
            className="w-full h-full object-contain group-hover:scale-[1.03] transition-transform duration-500"
          />
        </div>
      )}

      <div className="p-4 flex flex-col flex-1 gap-2">
        <span className="text-[11px] font-bold uppercase tracking-widest text-green-600">
          {r.marca}
        </span>

        <h3 className="font-bold text-gray-900 text-sm leading-snug line-clamp-2 group-hover:text-green-700 transition-colors">
          {r.nombre}
        </h3>

        <p className="text-xs text-gray-400 line-clamp-2 flex-1 leading-relaxed">
          {r.veredicto}
        </p>

        <div className="flex items-center justify-between pt-3 border-t border-gray-50 mt-auto">
          <div>
            <p className="text-sm font-bold text-gray-900">
              {formatPrice(r.precio)}
              {r.descuento > 0 && (
                <span className="ml-1.5 text-xs font-semibold text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">
                  -{r.descuento}%
                </span>
              )}
            </p>
            {r.actualizado && (
              <p className="text-[11px] text-gray-400">{r.actualizado}</p>
            )}
          </div>
          <ScorePill score={r.score} />
        </div>
      </div>
    </Link>
  );
}

/* ── Page ────────────────────────────────────────────────────────────────── */

export default async function HomePage() {
  const reviews = await getReviews();
  const [featured, ...rest] = reviews;

  return (
    <div className="max-w-6xl mx-auto px-4">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="pt-14 pb-10 border-b border-gray-100">
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-widest text-green-600 mb-3">
            Reviews editoriales · Mercado Libre México
          </p>
          <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 leading-tight mb-4">
            Comprá mejor.<br />
            <span className="text-green-600">Sin publicidad disfrazada.</span>
          </h1>
          <p className="text-gray-500 text-lg leading-relaxed max-w-lg">
            Cada análisis se basa en reseñas independientes de usuarios y
            creadores reales. Sin contenido patrocinado, sin notas infladas.
          </p>

          {/* Stats */}
          <div className="flex items-center gap-6 mt-6 text-sm text-gray-500">
            <span>
              <strong className="text-gray-900 font-bold">{reviews.length}</strong>{" "}
              {reviews.length === 1 ? "review" : "reviews"}
            </span>
            <span className="text-gray-200">|</span>
            <span>Actualizado continuamente</span>
            <span className="text-gray-200">|</span>
            <span>Solo Mercado Libre MX</span>
          </div>
        </div>
      </section>

      {/* ── Contenido ────────────────────────────────────────────────────── */}
      {reviews.length === 0 ? (
        <p className="text-center text-gray-400 py-20">
          No hay reviews publicadas aún.
        </p>
      ) : (
        <section id="reviews" className="py-12 space-y-12">

          {/* Featured */}
          {featured && (
            <div>
              <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">
                Análisis destacado
              </h2>
              <FeaturedCard r={featured} />
            </div>
          )}

          {/* Grid */}
          {rest.length > 0 && (
            <div>
              <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">
                Todos los análisis
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {rest.map((r) => (
                  <ReviewCard key={r.slug} r={r} />
                ))}
              </div>
            </div>
          )}

        </section>
      )}

      {/* ── Trust bar ────────────────────────────────────────────────────── */}
      <section className="border-t border-gray-100 py-10 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-sm">
          {[
            {
              icon: "🔍",
              title: "Fuentes independientes",
              desc: "Cada análisis sintetiza reseñas de compradores reales y creadores de contenido sin afiliación comercial.",
            },
            {
              icon: "✦",
              title: "Sin notas infladas",
              desc: "No recibimos pago por mencionar ningún producto. El score refleja lo que encontramos, bueno y malo.",
            },
            {
              icon: "📖",
              title: "Metodología abierta",
              desc: "Mostramos de dónde viene cada conclusión: cuántos videos, cuántas opiniones y qué modelos similares usamos.",
            },
          ].map((item) => (
            <div key={item.title} className="flex flex-col gap-2">
              <span className="text-2xl">{item.icon}</span>
              <p className="font-bold text-gray-900">{item.title}</p>
              <p className="text-gray-500 leading-relaxed text-xs">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
}
