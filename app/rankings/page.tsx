import type { Metadata } from "next";
import { rankingCategories } from "@/lib/product";

export const metadata: Metadata = {
  title: "Rankings Catalogo MX",
  description: "Rankings editoriales por categoria con productos revisados en Mercado Libre Mexico.",
};

export default function RankingsPage() {
  const categories = rankingCategories();

  return (
    <main className="max-w-6xl mx-auto px-4 py-10">
      <nav className="text-sm text-gray-500 mb-6 flex items-center gap-2 flex-wrap">
        <a href="/" className="hover:text-green-600">Inicio</a>
        <span>/</span>
        <span className="text-gray-800 font-medium">Rankings</span>
      </nav>

      <header className="mb-8">
        <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900">
          Rankings por categoria
        </h1>
        <p className="text-gray-600 mt-3 max-w-3xl">
          Listas generadas desde reviews publicados, ordenadas por score editorial y actualizadas con cada nuevo JSON.
        </p>
      </header>

      <section className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map((category) => {
          const top = category.products[0];
          const title = top.producto.display_title ?? top.producto.nombre;
          return (
            <a
              key={category.slug}
              href={`/rankings/${category.slug}`}
              className="group bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:border-green-300 hover:shadow-md transition"
            >
              <div className="text-xs font-bold uppercase tracking-widest text-green-600">
                {category.products.length} {category.products.length === 1 ? "review" : "reviews"}
              </div>
              <h2 className="text-xl font-bold text-gray-900 mt-2 group-hover:text-green-700">
                {category.label}
              </h2>
              <p className="text-sm text-gray-500 mt-3 line-clamp-2">
                Mejor calificado: {title} ({top.editorial.score}/10)
              </p>
            </a>
          );
        })}
      </section>
    </main>
  );
}
