export function schoolIdFromPath(pathname: string) {
  const first = pathname.split("/").filter(Boolean)[0];
  return first && /^[A-Z0-9]{8}$/.test(first) ? first : null;
}

export function withSchoolPath(path: string, pathname?: string | null) {
  const source = pathname ?? (typeof window !== "undefined" ? window.location.pathname : "");
  const schoolId = schoolIdFromPath(source);
  return schoolId ? `/${schoolId}${path}` : path;
}

export function tenantApiBase(baseUrl: string) {
  if (typeof window === "undefined") return baseUrl;
  const schoolId = schoolIdFromPath(window.location.pathname);
  if (!schoolId) return baseUrl;

  const url = new URL(baseUrl, window.location.origin);
  url.pathname = `/${schoolId}${url.pathname}`;
  return url.toString().replace(/\/$/, "");
}
