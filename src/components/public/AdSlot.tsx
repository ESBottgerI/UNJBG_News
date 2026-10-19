// Slot de publicidad del sitio publico.
//
// Por ahora renderiza un placeholder (Fase 6). Cuando se active AdSense, este
// componente es el unico lugar donde hay que inyectar el script de Google y
// reemplazar el contenido del placeholder por <ins class="adsbygoogle">.
//
// Variantes:
//   - "box":    300x250 (columna derecha)
//   - "tall":   160x600 (columna izquierda)
//   - "in-feed": banner horizontal entre noticias

export type AdVariant = "box" | "tall" | "in-feed";

const SIZES: Record<AdVariant, string> = {
  box: "h-[250px] w-full max-w-[300px]",
  tall: "h-[600px] w-full max-w-[160px]",
  "in-feed": "h-[90px] w-full",
};

const LABELS: Record<AdVariant, string> = {
  box: "300 x 250",
  tall: "160 x 600",
  "in-feed": "banner",
};

export function AdSlot({
  variant = "box",
  className = "",
}: {
  variant?: AdVariant;
  className?: string;
}) {
  return (
    <div
      data-ad-slot={variant}
      aria-hidden="true"
      className={`mx-auto flex flex-col items-center justify-center border border-[#ccc] bg-[#f0f0f0] text-center ${SIZES[variant]} ${className}`}
    >
      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#888]">
        Publicidad
      </span>
      <span className="mt-1 text-[10px] text-[#aaa]">{LABELS[variant]}</span>
    </div>
  );
}
