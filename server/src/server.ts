import { createApp } from './app.js';

const port = Number.parseInt(process.env.PORT ?? '3000', 10);
const app = createApp();

const server = app.listen(port, '0.0.0.0', () => {
  console.log(`ReelRater API listening on port ${port}`);
});

const shutDown = (signal: string) => {
  console.log(`${signal} received; shutting down`);
  server.close((error) => {
    if (error) {
      console.error('Error while shutting down', error);
      process.exit(1);
    }

    process.exit(0);
  });
};

process.on('SIGTERM', () => shutDown('SIGTERM'));
process.on('SIGINT', () => shutDown('SIGINT'));
