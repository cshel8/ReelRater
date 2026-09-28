import type { AuthService } from '@/services/contracts';
import type { CommunityCacheLifecycleService } from '@/services/community/communityCacheLifecycleService';

/** Clears viewer-scoped Community state after a successful auth sign-out. */
export function createLifecycleAwareAuthService(
  remote: AuthService,
  lifecycle: CommunityCacheLifecycleService
): AuthService {
  return {
    ...remote,
    async signOut(userId) {
      await remote.signOut();
      if (userId) {
        await lifecycle.handleSuccessfulSignOut(userId);
      }
    },
  };
}
