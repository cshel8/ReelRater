import type {
  CommunityExactMediaSearchRequest,
  CommunityExactMediaSearchResult,
  CommunityExactMediaSearchService,
  CommunityFeedService,
  EveryoneCommunityFeedService,
} from '@/services/contracts';
import { isValidCommunitySelectedMedia } from '@/services/community/communitySearch';

/**
 * Coordinates the existing scope-specific Community sources without making
 * either source aware of presentation. Following remains intentionally
 * bounded; Everyone retains its repository cursor.
 */
export function createExactMediaCommunitySearchService(
  following: CommunityFeedService,
  everyone: EveryoneCommunityFeedService
): CommunityExactMediaSearchService {
  return {
    async search(viewerId, request): Promise<CommunityExactMediaSearchResult> {
      if (!isValidCommunitySelectedMedia(request.selectedMedia)) {
        throw new Error('An exact Community search requires a valid media identity.');
      }

      // Exact identity is authoritative for this request. It constrains the
      // broad type locally without changing the user's saved filter choice.
      const options = {
        mediaFilter: request.selectedMedia.mediaType,
        sort: request.sort,
        exactMedia: request.selectedMedia,
      } as const;

      if (request.scope === 'following') {
        const result = await following.list(viewerId, {
          ...options,
          maximumResults: request.maximumResults,
        });
        return {
          reviews: result.reviews,
          pagination: { retrieval: 'bounded', nextCursor: null },
        };
      }

      const page = await everyone.listPage(viewerId, {
        ...options,
        cursor: request.cursor,
        maximumResults: request.maximumResults,
      });
      return {
        reviews: page.reviews,
        pagination: { retrieval: 'paginated', nextCursor: page.nextCursor },
      };
    },
  };
}
