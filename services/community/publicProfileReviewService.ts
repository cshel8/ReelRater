import type {
  FollowService,
  PublicProfileReviewService,
  RemoteCommunityReviewService,
} from '@/services/contracts';

export function createPublicProfileReviewService(
  followService: FollowService,
  remoteReviewService: RemoteCommunityReviewService
): PublicProfileReviewService {
  const canViewFollowersOnly = async (
    viewerId: string,
    profileUserId: string
  ) =>
    viewerId === profileUserId ||
    (await followService.getStatus(viewerId, profileUserId)) === 'active';

  const isMissingIndexError = (error: unknown) => {
    const code =
      error && typeof error === 'object' && 'code' in error
        ? String(error.code)
        : '';
    const message = error instanceof Error ? error.message : String(error);
    return (
      code.includes('failed-precondition') ||
      message.includes('failed-precondition') ||
      message.toLowerCase().includes('requires an index')
    );
  };

  return {
    async list(viewerId, profileUserId, maximumResults = 20) {
      const canSeeFollowersOnly = await canViewFollowersOnly(
        viewerId,
        profileUserId
      );

      return {
        reviews: await remoteReviewService.listVisibleFromAuthor(
          viewerId,
          profileUserId,
          canSeeFollowersOnly,
          maximumResults
        ),
        canSeeFollowersOnly,
      };
    },

    async listPage(viewerId, profileUserId, options) {
      const canSeeFollowersOnly = await canViewFollowersOnly(
        viewerId,
        profileUserId
      );
      let page;
      try {
        page = await remoteReviewService.listVisibleFromAuthorPage(
          viewerId,
          profileUserId,
          canSeeFollowersOnly,
          options
        );
      } catch (error) {
        if (!isMissingIndexError(error) || options?.cursor) {
          throw error;
        }

        console.log(
          'Paginated profile reviews need a Firestore index. Using the temporary bounded fallback:',
          error instanceof Error ? error.message : error
        );
        page = {
          reviews: await remoteReviewService.listVisibleFromAuthor(
            viewerId,
            profileUserId,
            canSeeFollowersOnly,
            options?.maximumResults
          ),
          nextCursor: null,
        };
      }

      return {
        ...page,
        canSeeFollowersOnly,
      };
    },

    async getById(viewerId, profileUserId, reviewId) {
      const includeFollowersOnly = await canViewFollowersOnly(
        viewerId,
        profileUserId
      );
      return remoteReviewService.getVisibleFromAuthor(
        viewerId,
        profileUserId,
        reviewId,
        includeFollowersOnly
      );
    },
  };
}
