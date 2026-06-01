interface AffiliateCTAProps {
  href: string;
  productName: string;
  size?: "default" | "lg";
  variant?: "green" | "white";
}

export default function AffiliateCTA({
  href,
  productName,
  size = "default",
  variant = "green",
}: AffiliateCTAProps) {
  const base =
    "inline-flex items-center justify-center gap-2 font-bold rounded-xl transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2";

  const sizeClass =
    size === "lg" ? "px-8 py-4 text-base" : "w-full px-5 py-3 text-sm";

  const variantClass =
    variant === "white"
      ? "bg-white text-green-700 hover:bg-green-50 focus:ring-white"
      : "bg-green-600 text-white hover:bg-green-700 focus:ring-green-500 shadow-md hover:shadow-lg";

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer sponsored"
      className={`${base} ${sizeClass} ${variantClass}`}
      aria-label={`Comprar ${productName} en Mercado Libre`}
    >
      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
      Comprar en Mercado Libre
      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>
    </a>
  );
}
