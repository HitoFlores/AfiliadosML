import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Catalogo MX — Reviews editoriales de Mercado Libre",
  description:
    "Análisis independientes y honestos de los mejores productos en Mercado Libre México. Sin publicidad disfrazada.",
  openGraph: {
    title: "Catalogo MX — Reviews editoriales de Mercado Libre",
    description:
      "Análisis independientes y honestos de los mejores productos en Mercado Libre México. Sin publicidad disfrazada.",
    type: "website",
    locale: "es_MX",
    siteName: "Catalogo MX",
  },
  twitter: {
    card: "summary",
    title: "Catalogo MX — Reviews editoriales de Mercado Libre",
    description:
      "Análisis independientes y honestos de los mejores productos en Mercado Libre México. Sin publicidad disfrazada.",
  },
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
              {/* Ícono: usa public/logo.png si existe, si no muestra placeholder */}
              <div className="w-8 h-8 flex items-center justify-center">
                <img
                  src="/logo.png"
                  alt="Catalogo MX"
                  className="w-8 h-8 object-contain"
                />
              </div>
              <span className="font-bold text-white text-base tracking-tight">
                Catalogo MX
              </span>
            </a>

            {/* Nav — sin Inicio (el logo ya lo hace) */}
            <nav className="flex items-center gap-6 text-sm">
              <a
                href="/#reviews"
                className="text-zinc-400 hover:text-white transition-colors"
              >
                Reviews
              </a>
              <a
                href="/rankings"
                className="text-zinc-400 hover:text-white transition-colors"
              >
                Rankings
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
                <img
                  src="/logo.png"
                  alt="Catalogo MX"
                  className="w-5 h-5 object-contain"
                  style={{ mixBlendMode: "screen" }}
                />
                <span className="font-bold text-white text-sm">Catalogo MX</span>
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
                © {new Date().getFullYear()} Catalogo MX
              </span>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
