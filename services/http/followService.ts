import type { FollowService } from '@/services/contracts';
import { firebaseFollowService } from '@/services/firebase/followService';
import { httpSocialGraphMutations } from './socialGraphService';

/**
 * Reads remain direct Firestore queries, while every relationship mutation is
 * sent to the trusted API. This keeps the screen-facing contract stable while
 * preventing the mobile app from changing authoritative counters.
 */
export const httpFollowService: FollowService = {
  async follow(_followerId, followedUserId) {
    await httpSocialGraphMutations.follow(followedUserId);
  },
  async unfollow(_followerId, followedUserId) {
    await httpSocialGraphMutations.unfollow(followedUserId);
  },
  async removeFollower(_followedUserId, followerId) {
    await httpSocialGraphMutations.removeFollower(followerId);
  },
  async approveFollower(_followedUserId, followerId) {
    await httpSocialGraphMutations.approveFollower(followerId);
  },
  async rejectFollower(_followedUserId, followerId) {
    await httpSocialGraphMutations.rejectFollower(followerId);
  },
  listFollowers: firebaseFollowService.listFollowers,
  listFollowing: firebaseFollowService.listFollowing,
  listPendingRequests: firebaseFollowService.listPendingRequests,
  isFollowing: firebaseFollowService.isFollowing,
  getStatus: firebaseFollowService.getStatus,
};
