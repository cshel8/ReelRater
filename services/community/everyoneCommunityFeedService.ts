import type { EveryoneCommunityFeedService, PublicReviewRepository, UserDirectoryService } from '@/services/contracts';
import { httpSocialGraphMutations } from '@/services/http/socialGraphService';
import type { FollowStatus, PublicUserProfile } from '@/types/domain';

export function createEveryoneCommunityFeedService(
  publicReviews: PublicReviewRepository,
  users: UserDirectoryService
): EveryoneCommunityFeedService {
  return {
    async listPage(viewerId, options) {
      const page = await publicReviews.listPublicPage(options);
      const authorIds = [...new Set(page.reviews.map((review) => review.authorId))];
      const [profiles, statuses] = await Promise.all([
        Promise.all(authorIds.map(async (id) => [id, await users.getById(id)] as const)),
        httpSocialGraphMutations.relationshipStatuses(authorIds.filter((id) => id !== viewerId)),
      ]);
      const byId = new Map<string, PublicUserProfile>(profiles.filter((entry): entry is readonly [string, PublicUserProfile] => entry[1] !== null));
      return {
        nextCursor: page.nextCursor,
        reviews: page.reviews.flatMap((review) => {
          const author = byId.get(review.authorId);
          const status = review.authorId === viewerId ? null : statuses[review.authorId] ?? null;
          return author ? [{ ...review, author, relationshipStatus: status as FollowStatus | null }] : [];
        }),
      };
    },
  };
}
