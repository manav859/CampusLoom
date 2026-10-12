/**
 * Payroll and Transport are hidden for now, and nothing about them is deleted:
 * the pages and their sidebar links stay where they are, these paths are
 * filtered out of the navigation, and middleware.ts sends every request for
 * them to the 404 page. The API 404s them too. Empty this list to bring both
 * modules back.
 */
export const hiddenPaths = ["/payroll", "/transport", "/reports/transport", "/teacher/salary"];

/** True for a hidden path itself and for anything below it. */
export function isHiddenPath(pathname: string) {
  return hiddenPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}
