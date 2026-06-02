import Link from "next/link";
import { readdir, readFile } from "fs/promises";
import { join } from "path";
import type { Product } from "@/lib/product";

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
      const raw = JSON.parse(await readFile(join(dir, file), "utf-8")) as Product;
      if (!raw.meta?.slug || !raw.editorial?.score) continue;
      cards.push({
        slug:      raw.meta.slug,
        nombre:    raw.producto?.nombre ?? file.replace(".json", ""),
        marca:     raw.producto?.marca ?? "",
        imagen:    raw.producto?.imagenes?.[0] ?? "",
        score:     raw.editorial.score,
        precio:    raw.precio?.actual ?? 0,
        descuento: raw.precio?.descuento_pct ?? 0,
        veredicto: raw.editorial.veredicto_corto ?? "",
        actualizado: raw.autoria?.actualizado ?? "",
      });
    } catch {}
  }

  return cards.sort((a, b) => b.score - a.score);
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 8.5 ? "bg-green-600" :
    score >= 7.0 ? "bg-yellow-500" :
    "bg-red-500";
  return (
    <span className={`${color} text-white text-sm font-bold px-2.5 py-1 rounded-lg`}>
      {score.toFixed(1)}
    </span>
  );
}

export default async function HomePage() {
  const reviews = await getReviews();

  return (
    <main className="max-w-5xl mx-auto px-4 py-12">
      {/* Hero */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-3">
          Reviews independientes
        </h1>
        <p className="text-lg text-gray-500 max-w-xl mx-auto">
          Análisis honestos de productos en Mercado Libre México — sin publicidad disfrazada.
        </p>
      </div>

      {reviews.length === 0 ? (
        <p className="text-center text-gray-400">No hay reviews publicadas aún.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {reviews.map((r) => (
            <Link
              key={r.slug}
              href={`/reviews/${r.slug}`}
              className="group bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-lg hover:border-green-300 transition-all flex flex-col"
            >
              {/* Imagen */}
              {r.imagen && (
                <div className="h-48 bg-gray-50 overflow-hidden">
                  <img
                    src={r.imagen}
                    alt={r.nombre}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
              )}

              <div className="p-4 flex flex-col flex-1 gap-2">
                {/* Marca */}
                <p className="text-xs font-semibold uppercase tracking-wider text-green-600">
                  {r.marca}
                </p>

                {/* Nombre */}
                <h2 className="font-bold text-gray-900 text-sm leading-snug line-clamp-2 group-hover:text-green-700 transition-colors">
                  {r.nombre}
                </h2>

                {/* Veredicto */}
                <p className="text-xs text-gray-500 line-clamp-2 flex-1">
                  {r.veredicto}
                </p>

                {/* Footer: score + precio */}
                <div className="flex items-center justify-between pt-2 border-t border-gray-100 mt-auto">
                  <div>
                    <p className="text-base font-bold text-gray-900">
                      ${r.precio.toLocaleString("es-MX")}
                      {r.descuento > 0 && (
                        <span className="ml-1.5 text-xs font-semibold text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
                          -{r.descuento}%
                        </span>
                      )}
                    </p>
                    {r.actualizado && (
                      <p className="text-xs text-gray-400">{r.actualizado}</p>
                    )}
                  </div>
                  <ScoreBadge score={r.score} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
