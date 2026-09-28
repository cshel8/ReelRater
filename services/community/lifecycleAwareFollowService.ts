import type { FollowService } from '@/services/contracts';
import type { CommunityCacheLifecycleService } from '@/services/community/communityCacheLifecycleService';

/** Adds local privacy lifecycle work without changing mutation providers. */
export function createLifecycleAwareFollowService(
  remote: FollowService,
  lifecycle: CommunityCacheLifecycleService
): FollowService {
  return {
    ...remote,
    async unfollow(followerId, followedUserId) {
      await remote.unfollow(followerId, followedUserId);
      await lifecycle.handleSuccessfulSelfUnfollow(followerId, followedUserId);
    },
  };
}
