const developmentOrigins = ['http://localhost:5173', 'http://localhost:5174'];
const localHostnames = new Set(['localhost', '127.0.0.1', '[::1]']);

export const resolveAllowedOrigins = (clientUrl: string | undefined, production: boolean) => {
  const origins = clientUrl
    ? clientUrl.split(',').map((origin) => origin.trim()).filter(Boolean)
    : production ? [] : developmentOrigins;

  if (production && origins.length === 0) {
    throw new Error('CLIENT_URL must contain at least one production frontend origin.');
  }

  return new Set(origins.map((origin) => {
    if (origin === '*') {
      throw new Error('CLIENT_URL must contain exact origins without paths or credentials.');
    }

    let parsed: URL;
    try {
      parsed = new URL(origin);
    } catch {
      throw new Error('CLIENT_URL contains an invalid frontend origin.');
    }

    if (origin === '*' || parsed.origin !== origin || parsed.username || parsed.password || parsed.search || parsed.hash) {
      throw new Error('CLIENT_URL must contain exact origins without paths or credentials.');
    }

    if (production && (parsed.protocol !== 'https:' || localHostnames.has(parsed.hostname) || parsed.hostname.endsWith('.localhost'))) {
      throw new Error('Production CLIENT_URL origins must use HTTPS and a public hostname.');
    }

    return parsed.origin;
  }));
};

export const isDevelopmentOrigin = (origin: string) => {
  try {
    const parsed = new URL(origin);
    return parsed.protocol === 'http:' && localHostnames.has(parsed.hostname) && parsed.origin === origin;
  } catch {
    return false;
  }
};