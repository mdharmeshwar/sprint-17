import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { isDevelopmentOrigin, resolveAllowedOrigins } from './config/cors.js';

import authRoutes from './routes/authRoutes.js';
import taskRoutes from './routes/taskRoutes.js';
import stripeRoutes from './routes/stripeRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import { errorHandler, notFound } from './middleware/errorMiddleware.js';

const app = express();
const trustedProxyHops = Number(process.env.TRUST_PROXY_HOPS || 0);
if (Number.isInteger(trustedProxyHops) && trustedProxyHops > 0) {
  app.set('trust proxy', trustedProxyHops);
}

const production = process.env.NODE_ENV === 'production';
const configuredOrigins = resolveAllowedOrigins(process.env.CLIENT_URL, production);

const isAllowedOrigin = (origin: string | undefined) => {
  if (!origin) return true;

  if (configuredOrigins.has(origin)) return true;
  return !production && isDevelopmentOrigin(origin);
};

app.use(
  cors({
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }

      callback(Object.assign(new Error('Origin is not allowed by CORS.'), { status: 403 }));
    },
    credentials: false,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.status(200).json({ success: true, message: 'API is healthy.' });
});

app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/stripe', stripeRoutes);
app.use('/api/ai', aiRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
