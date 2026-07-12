import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { Server } from 'node:http';
import { createApp } from './app.js';

let server: Server;
let baseUrl: string;

before(async () => {
  server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Test server did not bind to a TCP port');
  }

  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

test('GET /health returns an ALB-compatible success response', async () => {
  const response = await fetch(`${baseUrl}/health`);
  const body = (await response.json()) as {
    ok: boolean;
    app: string;
    served_by: string;
    time: string;
  };

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/json; charset=utf-8');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(body.ok, true);
  assert.equal(body.app, 'reelrater');
  assert.equal(body.served_by.length > 0, true);
  assert.equal(Number.isNaN(Date.parse(body.time)), false);
});
