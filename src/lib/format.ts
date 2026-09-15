// Formateo de fechas para las vistas del admin.
export function formatDate(d: Date | null | undefined): string {
  if (!d) return "-";
  return d.toLocaleString("es-PE", { dateStyle: "medium", timeStyle: "short" });
}