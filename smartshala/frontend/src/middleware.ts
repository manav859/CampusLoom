import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const segments = request.nextUrl.pathname.split("/").filter(Boolean);
  const schoolId = segments[0];

  if (!schoolId || !/^[A-Z0-9]{8}$/.test(schoolId)) {
    return NextResponse.next();
  }

  if (segments[1] === "login") {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = `/${segments.slice(1).join("/") || "dashboard"}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!_next|favicon.ico|modern-classroom.png).*)"]
};
