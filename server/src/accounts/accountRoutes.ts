import { Router } from 'express';
import type {
  AccountDataDeleter,
  AccountIdentityVerifier,
} from './types.js';

const MAXIMUM_AUTH_AGE_MS = 5 * 60 * 1000;

export function createAccountRouter(
  identityVerifier: AccountIdentityVerifier,
  dataDeleter: AccountDataDeleter
) {
  const router = Router();

  router.delete('/', async (request, response) => {
    const authorization = request.get('Authorization');
    const idToken = authorization?.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length).trim()
      : '';
    if (!idToken) {
      response.status(401).json({ error: { message: 'Authentication required.' } });
      return;
    }

    let identity;
    try {
      identity = await identityVerifier.verify(idToken);
    } catch {
      response.status(401).json({ error: { message: 'Authentication required.' } });
      return;
    }
    if (Date.now() - identity.authenticatedAt.getTime() > MAXIMUM_AUTH_AGE_MS) {
      response.status(401).json({
        error: { code: 'recent-login-required', message: 'Please sign in again before deleting your account.' },
      });
      return;
    }

    try {
      await dataDeleter.deleteAll(identity.userId);
      response.status(204).send();
    } catch (error) {
      console.error('Account deletion failed:', error);
      response.status(409).json({
        error: {
          code: 'account-deletion-incomplete',
          message:
            'Some account data may already have been removed. Please try again to finish deleting your account.',
        },
      });
    }
  });

  return router;
}
