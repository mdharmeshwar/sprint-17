const configuredApiUrl = (import.meta.env.VITE_API_URL as string | undefined)?.trim();

if (import.meta.env.PROD) {
  if (!configuredApiUrl) {
    throw new Error('VITE_API_URL must be configured for production builds.');
  }

  let productionApiUrl: URL;
  try {
    productionApiUrl = new URL(configuredApiUrl);
  } catch {
    throw new Error('VITE_API_URL must be a valid absolute URL.');
  }

  const isLocalHost = ['localhost', '127.0.0.1', '[::1]'].includes(productionApiUrl.hostname)
    || productionApiUrl.hostname.endsWith('.localhost');
  if (
    productionApiUrl.protocol !== 'https:'
    || isLocalHost
    || productionApiUrl.pathname.replace(/\/+$/, '') !== '/api'
    || productionApiUrl.username
    || productionApiUrl.password
    || productionApiUrl.search
    || productionApiUrl.hash
  ) {
    throw new Error('Production VITE_API_URL must be an HTTPS API URL ending in /api.');
  }
}

const BASE_URL = (configuredApiUrl || 'http://localhost:5000/api').replace(/\/+$/, '');

export const api = {
  async request<T>(endpoint: string, options: RequestInit = {}, token?: string): Promise<T> {
    const headers = new Headers(options.headers || {});
    headers.set('Content-Type', 'application/json');

    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const response = await fetch(`${BASE_URL}${endpoint}`, { ...options, headers });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload.message || 'Request failed');
    }

    return payload;
  },
  get<T>(endpoint: string, token?: string) {
    return this.request<T>(endpoint, { method: 'GET' }, token);
  },
  post<T>(endpoint: string, body: unknown, token?: string) {
    return this.request<T>(endpoint, { method: 'POST', body: JSON.stringify(body) }, token);
  },
  put<T>(endpoint: string, body: unknown, token?: string) {
    return this.request<T>(endpoint, { method: 'PUT', body: JSON.stringify(body) }, token);
  },
  delete<T>(endpoint: string, token?: string) {
    return this.request<T>(endpoint, { method: 'DELETE' }, token);
  },
};
