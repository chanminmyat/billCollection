export const USER_ACCESS_TOKEN_KEY = 'billflow_access_token';
export const SUPER_ADMIN_ACCESS_TOKEN_KEY = 'super_admin_access_token';

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000').replace(/\/$/, '');

declare global {
  interface Window {
    __billflowAuthenticatedFetchInstalled?: boolean;
  }
}

const getAccessToken = () => {
  if (typeof window === 'undefined') return null;
  const isSuperAdminRoute = window.location.pathname.startsWith('/super-admin');
  const storageKey = isSuperAdminRoute ? SUPER_ADMIN_ACCESS_TOKEN_KEY : USER_ACCESS_TOKEN_KEY;
  return window.localStorage.getItem(storageKey);
};

export const installAuthenticatedFetch = () => {
  if (typeof window === 'undefined' || window.__billflowAuthenticatedFetchInstalled) return;

  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const requestUrl = input instanceof Request ? input.url : String(input);
    const token = requestUrl.startsWith(API_BASE_URL) ? getAccessToken() : null;

    if (!token) {
      return nativeFetch(input, init);
    }

    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }
    if (!headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    return nativeFetch(input, { ...init, headers });
  };
  window.__billflowAuthenticatedFetchInstalled = true;
};
