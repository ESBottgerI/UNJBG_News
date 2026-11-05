// Configuracion del sitio publico.
// SITE_URL se usa para URLs absolutas (metadataBase, sitemap, Open Graph).
// En produccion debe apuntar al dominio real (p. ej. https://ncaunjbg.pe).
export const SITE_URL = (process.env.SITE_URL ?? "http://localhost:3000").replace(
  /\/+$/,
  "",
);

export const SITE_NAME = "NCA UNJBG";
export const SITE_FULL_NAME = "News Center Access UNJBG";
export const SITE_DESCRIPTION =
  "Noticias de Tacna y la region, compiladas automaticamente de WhatsApp, Facebook y sitios web.";
