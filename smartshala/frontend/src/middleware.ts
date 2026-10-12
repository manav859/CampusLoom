import { NextResponse, type NextRequest } from "next/server";
import { isHiddenPath } from "@/lib/hiddenFeatures";

/**
 * Hidden modules answer with the 404 page, whether or not the URL carries the
 * school code. Rewriting to a path no route matches is what gives the 404 its
 * status; calling notFound() from a layout renders the page but keeps the 200.
 */
function hiddenModuleNotFound(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/hidden-module";
  return NextResponse.rewrite(url);
}

export function middleware(request: NextRequest) {
  const segments = request.nextUrl.pathname.split("/").filter(Boolean);
  const schoolId = segments[0];

  if (!schoolId || !/^[A-Z0-9]{8}$/.test(schoolId)) {
    if (isHiddenPath(request.nextUrl.pathname)) {
      return hiddenModuleNotFound(request);
    }

    return NextResponse.next();
  }

  if (segments[1] === "login") {
    return NextResponse.next();
  }

  const path = `/${segments.slice(1).join("/") || "dashboard"}`;

  if (isHiddenPath(path)) {
    return hiddenModuleNotFound(request);
  }

  const url = request.nextUrl.clone();
  url.pathname = path;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!_next|favicon.ico|modern-classroom.png).*)"]
};
