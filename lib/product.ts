import fs from "fs";
import path from "path";

/* ----------------------------- Tipos crudos ----------------------------- */
// Lo que puede venir en el JSON: campos nuevos (schema v2) y viejos (v1).

interface RawSubScore {
  dimension: string;
  score: number;
  justificacion?: string;
}

interface RawFuente {
  tipo: string;
  autor: string;
  aporte: string;
}

interface RawFaq {
  pregunta: string;
  respuesta: string;
}

interface RawAlternativa {
  tipo: string;
  descripcion: string;
}

interface RawProductoSimilarML {
  id: string;
  titulo: string;
  precio: number;
  precio_original: number;
  thumbnail: string | null;
  permalink: string;
  envio_gratis: boolean;
}

interface RawEditorial {
  score: number;
  score_justificacion?: string;
  sub_scores?: RawSubScore[];
  veredicto_corto?: string;
  // v2
  compralo_si?: string[];
  saltatelo_si?: string[];
  pros?: string[];
  contras?: string[];
  fuentes_citadas?: RawFuente[];
  // v3 — FAQ, precio-valor, alternativas
  faq?: RawFaq[];
  precio_valor?: string;
  alternativas?: RawAlternativa[];
  // v1 (legacy)
  mejor_para?: string[];
  no_ideal_para?: string[];
  seo_title: string;
  seo_description: string;
  articulo_html: string;
}

interface RawAutoria {
  nombre?: string;
  tagline?: string;
  metodologia?: string;
  actualizado?: string;
}

export interface RawProduct {
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
  productos_similares_ml?: RawProductoSimilarML[];
  reviews_ml: {
    total: number;
    con_comentario: number;
    calificacion_promedio: number;
    destacadas: Array<{
      titulo: string;
      contenido: string;
      sentimiento?: string;
      // legacy (schema viejo)
      calificacion?: number;
      likes?: number;
      fecha?: string;
      foto?: string | null;
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
  editorial: RawEditorial;
  autoria?: RawAutoria;
}

/* -------------------------- Tipo normalizado ----------------------------- */
// Una sola forma estable que consume toda la UI.

export interface SubScore {
  dimension: string;
  score: number;
  justificacion?: string;
}

export interface Fuente {
  tipo: string;
  autor: string;
  aporte: string;
}

export interface Autoria {
  nombre: string;
  tagline: string;
  metodologia: string;
  actualizado: string;
}

export interface FaqItem {
  pregunta: string;
  respuesta: string;
}

export interface Alternativa {
  tipo: string;
  descripcion: string;
}

export interface ProductoSimilarML {
  id: string;
  titulo: string;
  precio: number;
  precio_original: number;
  thumbnail: string | null;
  permalink: string;
  envio_gratis: boolean;
}

export interface NormalizedProduct extends Omit<RawProduct, "editorial" | "autoria"> {
  editorial: {
    score: number;
    scoreJustificacion?: string;
    subScores: SubScore[];
    veredictoCorto: string;
    compraloSi: string[];
    saltateloSi: string[];
    pros: string[];
    contras: string[];
    fuentesCitadas: Fuente[];
    // v3
    faq: FaqItem[];
    precioValor: string | null;
    alternativas: Alternativa[];
    seoTitle: string;
    seoDescription: string;
    articuloHtml: string;
  };
  autoria: Autoria;
}

/* ------------------------------ Normalizador ----------------------------- */

function normalize(raw: RawProduct): NormalizedProduct {
  const e = raw.editorial;

  // Si no hay fuentes_citadas (schema viejo), las derivamos de los videos + compradores.
  const fuentesCitadas: Fuente[] =
    e.fuentes_citadas && e.fuentes_citadas.length > 0
      ? e.fuentes_citadas
      : [
          ...raw.videos_yt.map((v) => ({
            tipo: "video",
            autor: v.canal.trim(),
            aporte: v.titulo,
          })),
          {
            tipo: "compradores",
            autor: "Compradores verificados de Mercado Libre",
            aporte: `${raw.reviews_ml.total.toLocaleString("es-MX")} opiniones (${raw.reviews_ml.calificacion_promedio}★ promedio)`,
          },
        ];

  const fechaDefault = raw.meta.generado_en?.slice(0, 10) ?? "";

  return {
    ...raw,
    editorial: {
      score: e.score,
      scoreJustificacion: e.score_justificacion,
      subScores: e.sub_scores ?? [],
      // v2 → fallback al campo v1 → fallback a la meta description
      veredictoCorto: e.veredicto_corto ?? e.seo_description,
      compraloSi: e.compralo_si ?? e.mejor_para ?? [],
      saltateloSi: e.saltatelo_si ?? e.no_ideal_para ?? [],
      pros: e.pros ?? [],
      contras: e.contras ?? [],
      fuentesCitadas,
      faq: e.faq ?? [],
      precioValor: e.precio_valor ?? null,
      alternativas: e.alternativas ?? [],
      seoTitle: e.seo_title,
      seoDescription: e.seo_description,
      articuloHtml: e.articulo_html,
    },
    autoria: {
      nombre: raw.autoria?.nombre ?? "Hito Flores",
      tagline:
        raw.autoria?.tagline ??
        "Análisis independiente de productos en Mercado Libre México",
      metodologia:
        raw.autoria?.metodologia ??
        `Este análisis sintetiza ${raw.videos_yt.length} reseñas en video de creadores independientes y ${raw.reviews_ml.total.toLocaleString("es-MX")} opiniones de compradores verificados de Mercado Libre.`,
      actualizado: raw.autoria?.actualizado ?? fechaDefault,
    },
  };
}

/* ------------------------------- Loaders --------------------------------- */

function dataDir() {
  return path.join(process.cwd(), "data");
}

export function loadProductBySlug(slug: string): NormalizedProduct | null {
  const dir = dataDir();
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  for (const file of files) {
    const raw: RawProduct = JSON.parse(fs.readFileSync(path.join(dir, file), "utf-8"));
    if (raw.meta?.slug === slug) return normalize(raw);
  }
  return null;
}

export function allSlugs(): { slug: string }[] {
  const dir = dataDir();
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((file) => {
      const raw: RawProduct = JSON.parse(fs.readFileSync(path.join(dir, file), "utf-8"));
      return { slug: raw.meta.slug };
    });
}
