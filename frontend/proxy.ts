import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const hasRefreshCookie = Boolean(
    request.cookies.get("finwise_refresh")?.value,
  );
  const isAuthRoute =
    request.nextUrl.pathname === "/login" ||
    request.nextUrl.pathname.startsWith("/login/") ||
    request.nextUrl.pathname === "/signup" ||
    request.nextUrl.pathname.startsWith("/signup/") ||
    request.nextUrl.pathname.startsWith("/auth");
  if (!hasRefreshCookie && !isAuthRoute) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
