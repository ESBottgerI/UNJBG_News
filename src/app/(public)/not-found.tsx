import Link from "next/link";

export default function PublicNotFound() {
  return (
    <div className="py-12 text-center">
      <h1 className="text-4xl font-bold text-[#0b3d91]">404</h1>
      <p className="mt-2 text-sm text-[#555]">
        La noticia o pagina que buscas no existe o ya no esta disponible.
      </p>
      <p className="mt-4">
        <Link
          href="/"
          className="border border-[#0b3d91] bg-[#0b3d91] px-4 py-2 text-sm font-medium text-white hover:bg-[#0a347c]"
        >
          Volver al inicio
        </Link>
      </p>
    </div>
  );
}
