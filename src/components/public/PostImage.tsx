// Imagen de portada del sitio publico con fallback.
//
// - Sin src: muestra un recuadro gris.
// - src local (/media/...): usa <Image fill> de Next (optimizado, lazy).
//   El padre debe ser `relative` con una relacion de aspecto definida.
//   Se usa un <img> plano porque next/image no acepta rutas ya procesadas
//   de forma segura y evita requerir dimensiones exactas en la tarjeta.
export function PostImage({
  src,
  alt,
  className = "",
  sizes = "(max-width: 1024px) 100vw, 600px",
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
  sizes?: string;
}) {
  if (!src) {
    return (
      <div className={`flex items-center justify-center bg-[#ececec] ${className}`}>
        <span className="text-xs text-[#999]">Sin imagen</span>
      </div>
    );
  }

  return (
    // Las imagenes ya vienen procesadas por el pipeline (sharp) y no se guardan
    // dimensiones exactas por noticia, asi que next/image no aporta aca.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      sizes={sizes}
      className={`h-full w-full object-cover ${className}`}
    />
  );
}
