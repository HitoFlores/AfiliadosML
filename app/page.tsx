import Link from "next/link";

export default function Home() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-16 text-center">
      <h1 className="text-4xl font-bold text-gray-900 mb-4">
        Reviews Profesionales de Tecnología
      </h1>
      <p className="text-xl text-gray-600 mb-8">
        Análisis detallados al estilo Wirecutter para ayudarte a tomar la mejor decisión de compra.
      </p>
      <Link
        href="/reviews/consola-nintendo-switch-2"
        className="inline-block bg-green-600 text-white font-semibold px-8 py-3 rounded-xl hover:bg-green-700 transition-colors"
      >
        Ver review: Nintendo Switch 2 →
      </Link>
    </div>
  );
}
