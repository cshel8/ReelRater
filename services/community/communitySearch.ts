import type {
  CommunityExactMediaSearchRequest,
  CommunitySelectedMedia,
} from '@/services/contracts';
import type { MediaSummary, SharedReview } from '@/types/domain';

const targetFor = (mediaType: CommunitySelectedMedia['mediaType']) =>
  mediaType === 'tv'
    ? ({ mediaType: 'tv', reviewTargetType: 'series' } as const)
    : ({ mediaType: 'movie', reviewTargetType: 'movie' } as const);

/**
 * Validates that a catalog ID carries a non-empty provider namespace without
 * parsing a provider-specific identifier. The separately stored explicit
 * media type prevents a movie and TV entry with the same provider ID from
 * colliding.
 */
export const isProviderQualifiedCommunityCatalogId = (catalogId: string) => {
  const segments = catalogId.split(':');
  return (
    segments.length >= 2 &&
    segments.every((segment) => segment.trim().length > 0)
  );
};

/**
 * Removes display metadata from a catalog suggestion before it becomes an
 * exact-review search target. Invalid or unqualified IDs cannot enter
 * exact Community search.
 */
export const toCommunitySelectedMedia = (
  media: MediaSummary
): CommunitySelectedMedia | null => {
  const expectedTarget = targetFor(media.mediaType);
  if (
    media.reviewTargetType !== expectedTarget.reviewTargetType ||
    !isProviderQualifiedCommunityCatalogId(media.catalogId)
  ) {
    return null;
  }

  return {
    catalogId: media.catalogId,
    mediaType: media.mediaType,
    reviewTargetType: media.reviewTargetType,
  };
};

/** Runtime validation for provider-neutral service boundaries. */
export const isValidCommunitySelectedMedia = (
  value: unknown
): value is CommunitySelectedMedia => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.catalogId !== 'string' ||
    !isProviderQualifiedCommunityCatalogId(candidate.catalogId) ||
    (candidate.mediaType !== 'movie' && candidate.mediaType !== 'tv') ||
    (candidate.reviewTargetType !== 'movie' &&
      candidate.reviewTargetType !== 'series')
  ) {
    return false;
  }
  return (
    (candidate.mediaType === 'movie' &&
      candidate.reviewTargetType === 'movie') ||
    (candidate.mediaType === 'tv' && candidate.reviewTargetType === 'series')
  );
};

/**
 * Exact catalog matching intentionally excludes manual and legacy-unmatched
 * snapshots. A title alone must never make a manual review appear matched.
 */
export const matchesCommunitySelectedMedia = (
  review: Pick<SharedReview, 'movie'>,
  selectedMedia: CommunitySelectedMedia
) => {
  const movie = review.movie;
  return (
    movie?.matchStatus === 'matched' &&
    movie.catalogId === selectedMedia.catalogId &&
    movie.mediaType === selectedMedia.mediaType &&
    movie.reviewTargetType === selectedMedia.reviewTargetType
  );
};

/** Preserves the current case-insensitive title-or-review-text semantics. */
export const matchesCommunityReviewKeyword = (
  review: Pick<SharedReview, 'movieTitle' | 'reviewText'>,
  searchQuery: string
) => {
  const normalizedQuery = searchQuery.trim().toLocaleLowerCase();
  if (!normalizedQuery) {
    return true;
  }
  return (
    review.movieTitle.toLocaleLowerCase().includes(normalizedQuery) ||
    review.reviewText.toLocaleLowerCase().includes(normalizedQuery)
  );
};

export type CommunityExactMediaQueryPlan =
  | {
      scope: 'everyone';
      visibility: 'public';
      selectedMedia: CommunitySelectedMedia;
      sort: CommunityExactMediaSearchRequest['sort'];
      cursor: CommunityExactMediaSearchRequest['cursor'];
      retrieval: 'paginated';
    }
  | {
      scope: 'following';
      visibleToActiveFollowedAuthorsOnly: true;
      selectedMedia: CommunitySelectedMedia;
      sort: CommunityExactMediaSearchRequest['sort'];
      maximumResults: number | undefined;
      retrieval: 'bounded';
    };

/**
 * A pure plan for later adapters. It deliberately describes no Firestore
 * query, so UI code remains independent of Firestore and catalog providers.
 */
export const createCommunityExactMediaQueryPlan = (
  request: CommunityExactMediaSearchRequest
): CommunityExactMediaQueryPlan => {
  if (request.scope === 'everyone') {
    return {
      scope: 'everyone',
      visibility: 'public',
      selectedMedia: request.selectedMedia,
      sort: request.sort,
      cursor: request.cursor,
      retrieval: 'paginated',
    };
  }

  return {
    scope: 'following',
    visibleToActiveFollowedAuthorsOnly: true,
    selectedMedia: request.selectedMedia,
    sort: request.sort,
    maximumResults: request.maximumResults,
    retrieval: 'bounded',
  };
};
