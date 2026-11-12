import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  ADMIN_LOGIN_PATH,
  isProtectedPath,
} from "@/lib/navigation/registry";

// Guard ligero del panel admin: si no hay cookie de sesion, redirige al login.
// La verificacion real (firma + vencimiento + rol) ocurre en las paginas y
// Server Actions con requireUser()/requireAdmin(), no solo aca (ver docs de
// Next sobre Proxy). El espacio de navegacion vive en lib/navigation/registry.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isProtectedPath(pathname)) {
    const session = request.cookies.get("nca_unjbg_session")?.value;
    if (!session) {
      const url = request.nextUrl.clone();
      url.pathname = ADMIN_LOGIN_PATH;
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/admin/:path*",
};