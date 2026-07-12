import express from 'express';

export const createApp = () => {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json());

  app.get('/health', (_request, response) => {
    response.set('Cache-Control', 'no-store');
    response.status(200).json({ status: 'ok' });
  });

  return app;
};
