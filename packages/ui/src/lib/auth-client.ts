/**
 * Auth API Client
 * Handles authentication API calls and token management
 */

// API base URL - can be overridden by environment variable
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

// Token storage keys
const ACCESS_TOKEN_KEY = 'trades_access_token';
const REFRESH_TOKEN_KEY = 'trades_refresh_token';
const USER_KEY = 'trades_user';

export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: 'SMB' | 'PRO' | 'OPERATOR' | 'ADMIN';
  orgId?: string;
  permissions?: string[];
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  role?: 'SMB' | 'PRO';
}

export interface AuthResponse {
  success: boolean;
  data?: {
    user: User;
    tokens: AuthTokens;
  };
  error?: string;
  message?: string;
}

export interface ApiError {
  success: false;
  error: string;
  message?: string;
  statusCode?: number;
}

// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined';

/**
 * Token Storage Functions
 */
export const tokenStorage = {
  getAccessToken: (): string | null => {
    if (!isBrowser) return null;
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  },

  getRefreshToken: (): string | null => {
    if (!isBrowser) return null;
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  },

  setTokens: (tokens: AuthTokens): void => {
    if (!isBrowser) return;
    localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
  },

  clearTokens: (): void => {
    if (!isBrowser) return;
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },

  getUser: (): User | null => {
    if (!isBrowser) return null;
    const userStr = localStorage.getItem(USER_KEY);
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  },

  setUser: (user: User): void => {
    if (!isBrowser) return;
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
};

/**
 * Create headers for API requests
 */
function createHeaders(includeAuth = true): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (includeAuth) {
    const token = tokenStorage.getAccessToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  return headers;
}

/**
 * Handle API response
 */
async function handleResponse<T>(response: Response): Promise<T> {
  const data = await response.json();

  if (!response.ok) {
    const error: ApiError = {
      success: false,
      error: data.error || data.message || 'An error occurred',
      message: data.message,
      statusCode: response.status,
    };
    throw error;
  }

  return data;
}

/**
 * Auth API Functions
 */
export const authApi = {
  /**
   * Login with email and password
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: createHeaders(false),
      body: JSON.stringify(credentials),
    });

    const data = await handleResponse<AuthResponse>(response);

    if (data.success && data.data) {
      tokenStorage.setTokens(data.data.tokens);
      tokenStorage.setUser(data.data.user);
    }

    return data;
  },

  /**
   * Register a new user
   */
  async register(userData: RegisterData): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: createHeaders(false),
      body: JSON.stringify(userData),
    });

    const data = await handleResponse<AuthResponse>(response);

    if (data.success && data.data) {
      tokenStorage.setTokens(data.data.tokens);
      tokenStorage.setUser(data.data.user);
    }

    return data;
  },

  /**
   * Logout - clear tokens and optionally notify server
   */
  async logout(): Promise<void> {
    try {
      const token = tokenStorage.getAccessToken();
      if (token) {
        await fetch(`${API_BASE}/auth/logout`, {
          method: 'POST',
          headers: createHeaders(true),
        });
      }
    } catch (error) {
      // Ignore errors during logout - we'll clear tokens anyway
      console.warn('Logout API call failed:', error);
    } finally {
      tokenStorage.clearTokens();
    }
  },

  /**
   * Refresh the access token
   */
  async refreshToken(): Promise<AuthTokens | null> {
    const refreshToken = tokenStorage.getRefreshToken();
    if (!refreshToken) return null;

    try {
      const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: createHeaders(false),
        body: JSON.stringify({ refreshToken }),
      });

      const data = await handleResponse<{ success: boolean; data: AuthTokens }>(response);

      if (data.success && data.data) {
        tokenStorage.setTokens(data.data);
        return data.data;
      }

      return null;
    } catch (error) {
      // Refresh failed - clear tokens
      tokenStorage.clearTokens();
      return null;
    }
  },

  /**
   * Get current user from API
   */
  async getCurrentUser(): Promise<User | null> {
    const token = tokenStorage.getAccessToken();
    if (!token) return null;

    try {
      const response = await fetch(`${API_BASE}/auth/me`, {
        method: 'GET',
        headers: createHeaders(true),
      });

      const data = await handleResponse<{ success: boolean; data: User }>(response);

      if (data.success && data.data) {
        tokenStorage.setUser(data.data);
        return data.data;
      }

      return null;
    } catch (error) {
      // Token might be expired, try refresh
      const newTokens = await authApi.refreshToken();
      if (newTokens) {
        return authApi.getCurrentUser();
      }
      return null;
    }
  },

  /**
   * Request password reset
   */
  async forgotPassword(email: string): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${API_BASE}/auth/forgot-password`, {
      method: 'POST',
      headers: createHeaders(false),
      body: JSON.stringify({ email }),
    });

    return handleResponse(response);
  },

  /**
   * Reset password with token
   */
  async resetPassword(token: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${API_BASE}/auth/reset-password`, {
      method: 'POST',
      headers: createHeaders(false),
      body: JSON.stringify({ token, newPassword }),
    });

    return handleResponse(response);
  },

  /**
   * Verify email with token
   */
  async verifyEmail(token: string): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${API_BASE}/auth/verify-email`, {
      method: 'POST',
      headers: createHeaders(false),
      body: JSON.stringify({ token }),
    });

    return handleResponse(response);
  },

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return !!tokenStorage.getAccessToken();
  },
};

export default authApi;
