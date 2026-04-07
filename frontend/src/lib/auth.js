/**
 * Token management abstraction for secure auth state handling.
 * We wrap localStorage securely so we can easily swap to cookies
 * or memory-based tokens in the future with zero UI impact.
 */

const TOKEN_KEY = 'campusloom_access_token';

/**
 * Retrieves the currently securely stored auth token.
 * @returns {string | null}
 */
export const getToken = () => {
  return localStorage.getItem(TOKEN_KEY);
};

/**
 * Persists the auth token.
 * @param {string} token 
 */
export const setToken = (token) => {
  localStorage.setItem(TOKEN_KEY, token);
};

/**
 * Clears the auth token upon logout or session expiry.
 */
export const removeToken = () => {
  localStorage.removeItem(TOKEN_KEY);
};
