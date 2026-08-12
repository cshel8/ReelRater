import { Router, type Request, type Response } from 'express';
import type { AccountIdentityVerifier } from '../accounts/types.js';
import {
  SocialGraphError,
  type SocialGraphService,
} from './types.js';

const readBearerToken = (authorization: string | undefined) =>
  authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length).trim()
    : '';

const routeParam = (value: string | string[] | undefined) =>
  typeof value === 'string' ? value : '';

export function createSocialRouter(
  identityVerifier: AccountIdentityVerifier,
  socialGraph: SocialGraphService
) {
  const router = Router();

  const withIdentity = (
    handler: (userId: string, request: Request) => Promise<unknown>
  ) => async (request: Request, response: Response) => {
    const token = readBearerToken(request.get('Authorization'));
    if (!token) {
      response.status(401).json({ error: { message: 'Authentication required.' } });
      return;
    }

    let identity;
    try {
      identity = await identityVerifier.verify(token);
    } catch {
      response.status(401).json({ error: { message: 'Authentication required.' } });
      return;
    }

    try {
      const result = await handler(identity.userId, request);
      response.status(200).json(result ?? { ok: true });
    } catch (error) {
      if (error instanceof SocialGraphError) {
        response.status(error.statusCode).json({ error: { message: error.message } });
        return;
      }
      response.status(500).json({ error: { message: 'Unable to update the social graph.' } });
    }
  };

  router.post('/counters', withIdentity(async (userId) => {
    await socialGraph.initializeCounters(userId);
    return { ok: true };
  }));

  router.post('/follows/:followedUserId', withIdentity(async (userId, request) =>
    socialGraph.follow(userId, routeParam(request.params.followedUserId))
  ));

  router.delete('/follows/:followedUserId', withIdentity(async (userId, request) =>
    socialGraph.unfollow(userId, routeParam(request.params.followedUserId))
  ));

  router.delete('/followers/:followerId', withIdentity(async (userId, request) =>
    socialGraph.removeFollower(userId, routeParam(request.params.followerId))
  ));

  router.post('/follow-requests/:followerId/approve', withIdentity(async (userId, request) =>
    socialGraph.approveFollower(userId, routeParam(request.params.followerId))
  ));

  router.delete('/follow-requests/:followerId', withIdentity(async (userId, request) =>
    socialGraph.rejectFollower(userId, routeParam(request.params.followerId))
  ));

  return router;
}
