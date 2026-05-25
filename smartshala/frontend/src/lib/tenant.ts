export function schoolIdFromPath(pathname: string) {
  const first = pathname.split("/").filter(Boolean)[0];
  return first && /^[A-Z0-9]{8}$/.test(first) ? first : null;
}

export function withSchoolPath(path: string, pathname?: string | null) {
  const source = pathname ?? (typeof window !== "undefined" ? window.location.pathname : "");
  const schoolId = schoolIdFromPath(source);
  return schoolId ? `/${schoolId}${path}` : path;
}

export function withResolvedSchoolPath(path: string, schoolId?: string | null) {
  return schoolId && /^[A-Z0-9]{8}$/.test(schoolId) ? `/${schoolId}${path}` : withSchoolPath(path);
}

export function tenantApiBase(baseUrl: string, path?: string) {
  if (typeof window === "undefined") return baseUrl;
  let schoolId = schoolIdFromPath(window.location.pathname);

  const cleanPath = path ? path.replace(/^\//, "") : "";
  const isPublicAuth =
    cleanPath.startsWith("auth/login") ||
    cleanPath.startsWith("auth/register") ||
    cleanPath.startsWith("auth/forgot-password");

  if (!schoolId && !isPublicAuth) {
    try {
      const storedUser = window.localStorage.getItem("smartshala.user");
      if (storedUser) {
        const user = JSON.parse(storedUser);
        const storedId = user?.tenantSchoolId;
        if (storedId && /^[A-Z0-9]{8}$/.test(storedId)) {
          schoolId = storedId;
        }
      }
    } catch {
      // Ignore
    }
  }

  if (!schoolId) return baseUrl;

  const url = new URL(baseUrl, window.location.origin);
  url.pathname = `/${schoolId}${url.pathname}`;
  return url.toString().replace(/\/$/, "");
}
