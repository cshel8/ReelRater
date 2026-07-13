import express from 'express';
import { hostname } from 'node:os';

export const createApp = () => {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json());

  app.get('/health', (_request, response) => {
    response.set('Cache-Control', 'no-store');
    response.status(200).json({
      ok: true,
      app: 'reelrater',
      served_by: hostname(),
      time: new Date().toISOString(),
    });
  });

  return app;
};
