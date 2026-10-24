import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const environment = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
  if (mode === 'production') {
    const apiUrl = environment.VITE_API_URL?.trim();
    let parsedApiUrl: URL | undefined;
    try {
      if (apiUrl) parsedApiUrl = new URL(apiUrl);
    } catch {
      throw new Error('VITE_API_URL must be a valid absolute URL for production builds.');
    }

    const isLocalHost = parsedApiUrl
      ? ['localhost', '127.0.0.1', '[::1]'].includes(parsedApiUrl.hostname)
        || parsedApiUrl.hostname.endsWith('.localhost')
      : false;
    if (
      !parsedApiUrl
      || parsedApiUrl.protocol !== 'https:'
      || isLocalHost
      || parsedApiUrl.pathname.replace(/\/+$/, '') !== '/api'
      || parsedApiUrl.username
      || parsedApiUrl.password
      || parsedApiUrl.search
      || parsedApiUrl.hash
    ) {
      throw new Error('Production VITE_API_URL must be an HTTPS API URL ending in /api.');
    }
  }

  return {
    plugins: [react()],
    server: {
      port: 5173,
      host: '0.0.0.0',
    },
    preview: {
      port: 4173,
      host: '0.0.0.0',
    },
  };
});
