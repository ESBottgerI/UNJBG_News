import Link from "next/link";

// 404 global para rutas fuera del sitio publico (por ejemplo, URLs inventadas).
// Se renderiza dentro del layout raiz, por eso no incluye <html>/<body>.
export default function RootNotFound() {
  return (
    <div className="p-12 text-center">
      <h1 className="text-4xl font-bold text-[#0b3d91]">404</h1>
      <p className="mt-2 text-sm text-[#555]">La pagina que buscas no existe.</p>
      <p className="mt-4">
        <Link href="/" className="text-[#0b3d91] hover:underline">
          Volver al inicio
        </Link>
      </p>
    </div>
  );
}
