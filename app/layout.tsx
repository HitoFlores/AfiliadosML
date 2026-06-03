import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CatálogoMX — Reviews editoriales de Mercado Libre",
  description:
    "Análisis independientes y honestos de los mejores productos en Mercado Libre México. Sin publicidad disfrazada.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body
        className={`${inter.className} bg-white text-gray-900 antialiased`}
        suppressHydrationWarning
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <header className="bg-zinc-950 sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
            {/* Logo */}
            <a href="/" className="flex items-center gap-2.5 group">
              <span className="w-7 h-7 rounded bg-green-500 flex items-center justify-center font-black text-white text-xs select-none">
                C
              </span>
              <span className="font-bold text-white text-base tracking-tight">
                CatálogoMX
              </span>
            </a>

            {/* Nav */}
            <nav className="flex items-center gap-6 text-sm">
              <a
                href="/"
                className="text-zinc-400 hover:text-white transition-colors"
              >
                Inicio
              </a>
              <a
                href="/#reviews"
                className="text-zinc-400 hover:text-white transition-colors"
              >
                Reviews
              </a>
              <a
                href="https://github.com/HitoFlores/AfiliadosML"
                target="_blank"
                rel="noopener noreferrer"
                className="hidden md:inline text-zinc-600 hover:text-zinc-300 transition-colors text-xs"
              >
                Open source ↗
              </a>
            </nav>
          </div>
        </header>

        {/* ── Content ────────────────────────────────────────────────────── */}
        <main>{children}</main>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <footer className="bg-zinc-950 border-t border-zinc-800 mt-20">
          <div className="max-w-6xl mx-auto px-4 py-10 flex flex-col md:flex-row justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-5 h-5 rounded bg-green-500 flex items-center justify-center font-black text-white text-[10px]">
                  C
                </span>
                <span className="font-bold text-white text-sm">CatálogoMX</span>
              </div>
              <p className="text-zinc-500 text-xs max-w-xs leading-relaxed">
                Reviews editoriales independientes de productos en Mercado Libre
                México. Sin publicidad disfrazada, sin patrocinadores.
              </p>
            </div>
            <p className="text-zinc-600 text-xs max-w-xs md:text-right self-end leading-relaxed">
              Algunos enlaces son de afiliado. Al comprar a través de ellos,
              apoyás este sitio sin costo extra para vos.
              <br />
              <span className="text-zinc-700">
                © {new Date().getFullYear()} CatálogoMX
              </span>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
