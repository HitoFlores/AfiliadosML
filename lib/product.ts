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

interface RawComparativaEditorial {
  tipo: string;
  titulo: string;
  resumen: string;
}

interface RawMejorAlternativa {
  tipo: string;
  titulo: string;
  razon: string;
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
  riesgos_compra_ml?: string[];
  checklist_antes_de_comprar?: string[];
  comparativa_editorial?: RawComparativaEditorial[];
  mejor_alternativa?: RawMejorAlternativa | null;
  keyword_targets?: string[];
  evidencia_limitaciones?: string;
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
    candidate_id?: string;
  };
  producto: {
    nombre: string;
    display_title?: string;
    nombre_original?: string;
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
    match_level?: string | null;
    evidence_score?: number | null;
    evidence_reason?: string | null;
  }>;
  youtube_debug?: Record<string, unknown> | null;
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

export interface ComparativaEditorial {
  tipo: string;
  titulo: string;
  resumen: string;
}

export interface MejorAlternativa {
  tipo: string;
  titulo: string;
  razon: string;
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
    riesgosCompraMl: string[];
    checklistAntesDeComprar: string[];
    comparativaEditorial: ComparativaEditorial[];
    mejorAlternativa: MejorAlternativa | null;
    keywordTargets: string[];
    evidenciaLimitaciones: string;
    seoTitle: string;
    seoDescription: string;
    articuloHtml: string;
  };
  autoria: Autoria;
}

export interface RelatedReview {
  relationId: string;
  sourceSlug: string;
  targetSlug: string;
  product: NormalizedProduct;
}

export interface ComparisonPair {
  pair: string;
  source: NormalizedProduct;
  target: NormalizedProduct;
}

export interface RankingCategory {
  slug: string;
  label: string;
  products: NormalizedProduct[];
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
  const fallbackRiesgos = [
    raw.precio.garantia
      ? `Revisa que la garantia publicada cubra tu caso: ${raw.precio.garantia}.`
      : "Confirma la garantia publicada antes de pagar.",
    raw.vendedor.reputacion
      ? `Valida reputacion del vendedor (${raw.vendedor.reputacion}) y ventas recientes.`
      : "Valida reputacion y ventas recientes del vendedor.",
    "Confirma que el modelo, version y compatibilidad coincidan con lo que necesitas.",
  ];
  const fallbackChecklist = [
    "Compara el precio final con envio incluido.",
    "Revisa si el producto es nacional, importado o de otra region.",
    "Lee preguntas y opiniones recientes, no solo la calificacion promedio.",
  ];
  const fallbackComparativa = (e.alternativas ?? []).map((alt) => ({
    tipo: alt.tipo,
    titulo: alt.tipo,
    resumen: alt.descripcion,
  }));
  const fallbackKeywords = [
    `${raw.producto.marca} ${raw.producto.modelo}`.trim(),
    `${raw.producto.marca} opiniones Mercado Libre`.trim(),
    `${raw.producto.marca} vale la pena Mexico`.trim(),
  ].filter((entry, index, arr) => entry.length > 3 && arr.indexOf(entry) === index);

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
      riesgosCompraMl: e.riesgos_compra_ml ?? fallbackRiesgos,
      checklistAntesDeComprar: e.checklist_antes_de_comprar ?? fallbackChecklist,
      comparativaEditorial: e.comparativa_editorial ?? fallbackComparativa,
      mejorAlternativa: e.mejor_alternativa ?? null,
      keywordTargets: e.keyword_targets ?? fallbackKeywords,
      evidenciaLimitaciones:
        e.evidencia_limitaciones ??
        "Este analisis cruza especificaciones, fuentes externas y senales de compradores en Mercado Libre.",
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
    try {
      const raw: RawProduct = JSON.parse(
        fs.readFileSync(path.join(dir, file), "utf-8").replace(/^﻿/, "")
      );
      if (raw.meta?.slug === slug) return normalize(raw);
    } catch {
      // archivo corrupto o schema incompatible — se ignora
    }
  }
  return null;
}

export function allSlugs(): { slug: string }[] {
  const dir = dataDir();
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .flatMap((file) => {
      try {
        const raw: RawProduct = JSON.parse(
          fs.readFileSync(path.join(dir, file), "utf-8").replace(/^﻿/, "")
        );
        return raw.meta?.slug ? [{ slug: raw.meta.slug }] : [];
      } catch {
        return [];
      }
    });
}

export function loadAllProducts(): NormalizedProduct[] {
  const dir = dataDir();
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .flatMap((file) => {
      try {
        const raw: RawProduct = JSON.parse(
          fs.readFileSync(path.join(dir, file), "utf-8").replace(/^\uFEFF/, "")
        );
        return raw.meta?.slug ? [normalize(raw)] : [];
      } catch {
        return [];
      }
    });
}

export function relatedReviewsForSlug(slug: string): RelatedReview[] {
  return loadAllProducts()
    .flatMap((product) => {
      const candidateId = product.meta.candidate_id ?? "";
      const [sourceSlug] = candidateId.split(":");
      if (!sourceSlug || sourceSlug !== slug || product.meta.slug === slug) return [];
      return [
        {
          relationId: candidateId,
          sourceSlug,
          targetSlug: product.meta.slug,
          product,
        },
      ];
    })
    .sort((a, b) => b.product.editorial.score - a.product.editorial.score);
}

export function comparisonPairs(): ComparisonPair[] {
  const products = loadAllProducts();
  const bySlug = new Map(products.map((product) => [product.meta.slug, product]));
  return products
    .flatMap((target) => {
      const candidateId = target.meta.candidate_id ?? "";
      const [sourceSlug] = candidateId.split(":");
      const source = sourceSlug ? bySlug.get(sourceSlug) : null;
      if (!source || source.meta.slug === target.meta.slug) return [];
      return [
        {
          pair: `${source.meta.slug}-vs-${target.meta.slug}`,
          source,
          target,
        },
      ];
    })
    .sort((a, b) => a.pair.localeCompare(b.pair));
}

export function loadComparisonPair(pair: string): ComparisonPair | null {
  return comparisonPairs().find((entry) => entry.pair === pair) ?? null;
}

function slugifyRanking(value: string): string {
  return String(value || "otros")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .trim()
    .replace(/\s+/g, "-");
}

function categoryLabel(value: string): string {
  const cleaned = String(value || "Otros").replace(/^MLM-?/i, "").replace(/-/g, " ");
  return cleaned
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

export function rankingCategories(): RankingCategory[] {
  const grouped = new Map<string, NormalizedProduct[]>();
  for (const product of loadAllProducts()) {
    const category = product.meta.categoria || "otros";
    grouped.set(category, [...(grouped.get(category) ?? []), product]);
  }

  return [...grouped.entries()]
    .map(([category, products]) => ({
      slug: slugifyRanking(category),
      label: categoryLabel(category),
      products: products.sort((a, b) => b.editorial.score - a.editorial.score),
    }))
    .sort((a, b) => b.products.length - a.products.length || a.label.localeCompare(b.label));
}

export function loadRankingCategory(slug: string): RankingCategory | null {
  return rankingCategories().find((category) => category.slug === slug) ?? null;
}
