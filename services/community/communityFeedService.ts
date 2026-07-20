import type {
  CommunityFeedService,
  FollowService,
  RemoteCommunityReviewService,
  UserDirectoryService,
} from '@/services/contracts';
import type { PublicUserProfile } from '@/types/domain';

export function createCommunityFeedService(
  followService: FollowService,
  userDirectoryService: UserDirectoryService,
  remoteReviewService: RemoteCommunityReviewService
): CommunityFeedService {
  return {
    async list(viewerId, maximumResults = 20) {
      const relationships = await followService.listFollowing(viewerId);
      const authorIds = relationships.map(
        (relationship) => relationship.followedUserId
      );

      if (authorIds.length === 0) {
        return {
          reviews: [],
          followsAnyone: false,
        };
      }

      const sharedReviews = await remoteReviewService.listVisibleFromAuthors(
        viewerId,
        authorIds,
        maximumResults
      );
      const uniqueAuthorIds = [
        ...new Set(sharedReviews.map((review) => review.authorId)),
      ];
      const authorEntries = await Promise.all(
        uniqueAuthorIds.map(async (authorId) => {
          const profile = await userDirectoryService.getById(authorId);
          return [authorId, profile] as const;
        })
      );
      const authors = new Map<string, PublicUserProfile>(
        authorEntries.filter(
          (
            entry
          ): entry is readonly [string, PublicUserProfile] => entry[1] !== null
        )
      );

      return {
        reviews: sharedReviews.flatMap((review) => {
          const author = authors.get(review.authorId);
          return author ? [{ ...review, author }] : [];
        }),
        followsAnyone: true,
      };
    },
  };
}
