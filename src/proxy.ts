import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Guard ligero del panel admin: si no hay cookie de sesion, redirige al login.
// La verificacion real (firma + vencimiento) ocurre en las paginas y Server
// Actions con requireUser(), no solo aca (ver docs de Next sobre Proxy).
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/admin") && !pathname.startsWith("/admin/login")) {
    const session = request.cookies.get("unjbg_session")?.value;
    if (!session) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/admin/:path*",
};