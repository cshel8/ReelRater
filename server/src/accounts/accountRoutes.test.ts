import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { after, before, test } from 'node:test';
import { createApp } from '../app.js';

let server: Server;
let baseUrl: string;
const deletedUserIds: string[] = [];

before(async () => {
  server = createApp({
    accountIdentityVerifier: {
      async verify(token) {
        if (token === 'invalid') throw new Error('invalid');
        return {
          userId: 'user-1',
          authenticatedAt: new Date(
            token === 'stale' ? Date.now() - 10 * 60 * 1000 : Date.now()
          ),
        };
      },
    },
    accountDataDeleter: {
      async deleteAll(userId) {
        deletedUserIds.push(userId);
      },
    },
  }).listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No test port');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve()))
  );
});

test('account deletion requires a valid, recently authenticated user', async () => {
  const missing = await fetch(`${baseUrl}/api/v1/account`, { method: 'DELETE' });
  assert.equal(missing.status, 401);

  const invalid = await fetch(`${baseUrl}/api/v1/account`, {
    method: 'DELETE',
    headers: { Authorization: 'Bearer invalid' },
  });
  assert.equal(invalid.status, 401);

  const stale = await fetch(`${baseUrl}/api/v1/account`, {
    method: 'DELETE',
    headers: { Authorization: 'Bearer stale' },
  });
  assert.equal(stale.status, 401);
  assert.deepEqual(deletedUserIds, []);
});

test('account deletion derives the user id from the verified token', async () => {
  const response = await fetch(`${baseUrl}/api/v1/account`, {
    method: 'DELETE',
    headers: { Authorization: 'Bearer recent' },
  });
  assert.equal(response.status, 204);
  assert.deepEqual(deletedUserIds, ['user-1']);
});
