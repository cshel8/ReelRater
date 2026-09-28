import {
  beginCommunitySessionForUser,
  invalidateFollowingAuthorForSession,
} from '@/services/community/communitySessionState';
import type { CommunityCacheRepository } from '@/services/local/communityCacheTypes';

/**
 * Coordinates definitive local account/relationship lifecycle events with
 * viewer-scoped Community persistence. It deliberately knows no SQLite SQL
 * and is invoked only after an authoritative mutation succeeds.
 */
export function createCommunityCacheLifecycleService(
  cache: CommunityCacheRepository
) {
  return {
    async handleSuccessfulSelfUnfollow(
      viewerId: string,
      authorId: string
    ): Promise<void> {
      // Mark first: should local persistence fail, the current app session
      // remains fail-closed for this author's protected content.
      invalidateFollowingAuthorForSession(viewerId, authorId);
      try {
        await cache.invalidateFollowingAuthor(viewerId, authorId);
      } catch (error) {
        console.log(
          'Community cache cleanup failed after a successful unfollow:',
          error instanceof Error ? error.message : error
        );
      }
    },

    async handleSuccessfulSignOut(viewerId: string): Promise<void> {
      // Clear in-memory state even if persistence cannot be cleared. This is
      // intentionally best-effort and must never turn a completed sign-out
      // into an error.
      beginCommunitySessionForUser(null);
      try {
        await cache.clearForViewer(viewerId);
      } catch (error) {
        console.log(
          'Community cache cleanup failed after sign-out:',
          error instanceof Error ? error.message : error
        );
      }
    },
  };
}

export type CommunityCacheLifecycleService = ReturnType<
  typeof createCommunityCacheLifecycleService
>;
