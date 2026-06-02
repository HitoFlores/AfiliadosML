export interface TocItem {
  id: string;
  text: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quita acentos
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60);
}

/**
 * Recorre el HTML del artículo, le inyecta `id` a cada <h2>
 * y devuelve el HTML modificado + la lista para la tabla de contenidos.
 */
export function buildToc(html: string): { html: string; toc: TocItem[] } {
  const toc: TocItem[] = [];
  const seen = new Set<string>();

  // Captura h2 y h3 (los artículos a veces usan uno u otro para las secciones)
  const newHtml = html.replace(
    /<(h2|h3)([^>]*)>([\s\S]*?)<\/\1>/gi,
    (_match, tag: string, attrs: string, inner: string) => {
      const text = inner.replace(/<[^>]+>/g, "").trim();
      if (!text) return _match;
      let id = slugify(text) || `seccion-${toc.length + 1}`;
      // evita ids duplicados
      let n = 2;
      const base = id;
      while (seen.has(id)) id = `${base}-${n++}`;
      seen.add(id);
      toc.push({ id, text });
      return `<${tag} id="${id}"${attrs}>${inner}</${tag}>`;
    }
  );

  return { html: newHtml, toc };
}
