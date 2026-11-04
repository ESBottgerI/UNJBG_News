// Formateo de fechas para las vistas del admin.
export function formatDate(d: Date | null | undefined): string {
  if (!d) return "-";
  return d.toLocaleString("es-PE", { dateStyle: "medium", timeStyle: "short" });
}

// Fecha larga para el sitio publico: "18 de octubre de 2026, 10:30".
export function formatDateLong(d: Date | null | undefined): string {
  if (!d) return "";
  return d.toLocaleString("es-PE", { dateStyle: "long", timeStyle: "short" });
}

// Fecha sin hora para listados: "18 de octubre de 2026".
export function formatDateShort(d: Date | null | undefined): string {
  if (!d) return "";
  return d.toLocaleDateString("es-PE", { dateStyle: "long" });
}

// Quita etiquetas HTML y colapsa espacios. Se usa para resumenes y metadatos.
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Resumen corto de un cuerpo HTML, cortado en un limite de palabra.
export function excerpt(html: string, max = 180): string {
  const text = stripHtml(html);
  if (text.length <= max) return text;
  return text.slice(0, max).replace(/\s+\S*$/, "") + "…";
}