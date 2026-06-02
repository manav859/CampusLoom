/**
 * In-memory access token store.
 * Lost on page refresh — recovered via /auth/refresh
 * (the httpOnly refresh cookie is sent automatically).
 * Never stored in localStorage, sessionStorage, or the DOM.
 */

let _accessToken: string | null = null;

export const tokenStore = {
  get: (): string | null => _accessToken,
  set: (token: string): void => { _accessToken = token; },
  clear: (): void => { _accessToken = null; },
};
