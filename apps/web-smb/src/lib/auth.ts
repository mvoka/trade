const ACCESS_TOKEN_KEY = 'trades_access_token';
const REFRESH_TOKEN_KEY = 'trades_refresh_token';
const TOKEN_EXPIRY_KEY = 'trades_token_expiry';

// Check if we're in browser environment
const isBrowser = typeof window !== 'undefined';

export function getAccessToken(): string | null {
  if (!isBrowser) return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (!isBrowser) return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function getTokenExpiry(): number | null {
  if (!isBrowser) return null;
  const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
  return expiry ? parseInt(expiry, 10) : null;
}

export function setTokens(accessToken: string, refreshToken: string, expiresIn: number): void {
  if (!isBrowser) return;
  const expiryTime = Date.now() + expiresIn * 1000;
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  localStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString());
}

export function clearTokens(): void {
  if (!isBrowser) return;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
}

export function isTokenExpired(): boolean {
  const expiry = getTokenExpiry();
  if (!expiry) return true;
  // Consider token expired 30 seconds before actual expiry for safety
  return Date.now() > expiry - 30000;
}

export function isAuthenticated(): boolean {
  const token = getAccessToken();
  if (!token) return false;
  return !isTokenExpired();
}

// Parse JWT token (without verification - server should verify)
export function parseToken(token: string): { sub: string; email: string; role: string } | null {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

export function getCurrentUser(): { id: string; email: string; role: string } | null {
  const token = getAccessToken();
  if (!token) return null;
  const payload = parseToken(token);
  if (!payload) return null;
  return {
    id: payload.sub,
    email: payload.email,
    role: payload.role,
  };
}
