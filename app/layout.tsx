import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AfiliadosML — Reviews y Análisis",
  description: "Reviews profesionales de productos en Mercado Libre México",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className={`${inter.className} bg-gray-50 text-gray-900`} suppressHydrationWarning>
        <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
            <a href="/" className="font-bold text-xl text-green-600">
              AfiliadosML
            </a>
            <nav className="hidden md:flex gap-6 text-sm font-medium text-gray-600">
              <a href="/" className="hover:text-green-600 transition-colors">Inicio</a>
              <a href="/reviews" className="hover:text-green-600 transition-colors">Reviews</a>
            </nav>
          </div>
        </header>
        <main>{children}</main>
        <footer className="bg-gray-800 text-gray-400 text-sm text-center py-6 mt-16">
          <p>© {new Date().getFullYear()} AfiliadosML · Análisis independientes de productos</p>
          <p className="mt-1 text-xs text-gray-500">
            Algunos enlaces son de afiliado. Al comprar a través de ellos, apoyás este sitio sin costo extra para vos.
          </p>
        </footer>
      </body>
    </html>
  );
}
