import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { after, before, test } from 'node:test';
import { createApp } from '../app.js';
import type { SocialGraphService } from './types.js';

let server: Server;
let baseUrl: string;
const calls: string[] = [];

const socialGraph: SocialGraphService = {
  async initializeCounters(userId) {
    calls.push(`initialize:${userId}`);
  },
  async follow(followerId, followedUserId) {
    calls.push(`follow:${followerId}:${followedUserId}`);
    return { status: 'active' };
  },
  async unfollow(followerId, followedUserId) {
    calls.push(`unfollow:${followerId}:${followedUserId}`);
    return { status: null };
  },
  async removeFollower(followedUserId, followerId) {
    calls.push(`remove:${followedUserId}:${followerId}`);
    return { status: null };
  },
  async approveFollower(followedUserId, followerId) {
    calls.push(`approve:${followedUserId}:${followerId}`);
    return { status: 'active' };
  },
  async rejectFollower(followedUserId, followerId) {
    calls.push(`reject:${followedUserId}:${followerId}`);
    return { status: null };
  },
};

before(async () => {
  server = createApp({
    accountIdentityVerifier: {
      async verify(token) {
        if (token === 'invalid') {
          throw new Error('invalid');
        }
        return { userId: 'verified-user', authenticatedAt: new Date() };
      },
    },
    socialGraph,
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

test('social routes require a valid Firebase identity token', async () => {
  const missing = await fetch(`${baseUrl}/api/v1/social/follows/alex`, {
    method: 'POST',
  });
  const invalid = await fetch(`${baseUrl}/api/v1/social/follows/alex`, {
    method: 'POST',
    headers: { Authorization: 'Bearer invalid' },
  });

  assert.equal(missing.status, 401);
  assert.equal(invalid.status, 401);
  assert.deepEqual(calls, []);
});

test('social routes derive the actor from the verified token', async () => {
  const headers = { Authorization: 'Bearer valid' };
  const responses = [];
  responses.push(
    await fetch(`${baseUrl}/api/v1/social/counters`, { method: 'POST', headers })
  );
  responses.push(
    await fetch(`${baseUrl}/api/v1/social/follows/alex`, { method: 'POST', headers })
  );
  responses.push(
    await fetch(`${baseUrl}/api/v1/social/follows/alex`, { method: 'DELETE', headers })
  );
  responses.push(
    await fetch(`${baseUrl}/api/v1/social/followers/alex`, { method: 'DELETE', headers })
  );
  responses.push(
    await fetch(`${baseUrl}/api/v1/social/follow-requests/alex/approve`, {
      method: 'POST',
      headers,
    })
  );
  responses.push(
    await fetch(`${baseUrl}/api/v1/social/follow-requests/alex`, {
      method: 'DELETE',
      headers,
    })
  );

  assert.deepEqual(responses.map((response) => response.status), [200, 200, 200, 200, 200, 200]);
  assert.deepEqual(calls, [
    'initialize:verified-user',
    'follow:verified-user:alex',
    'unfollow:verified-user:alex',
    'remove:verified-user:alex',
    'approve:verified-user:alex',
    'reject:verified-user:alex',
  ]);
});
