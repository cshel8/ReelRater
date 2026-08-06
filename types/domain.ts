export type AuthUser = {
  id: string;
};

export type AccountPrivacy = 'public' | 'private';

export type UserProfile = {
  id: string;
  displayName: string;
  handle: string;
  handleNormalized: string;
  profileImage: string | null;
  accountPrivacy: AccountPrivacy;
};

export type PublicUserProfile = Pick<
  UserProfile,
  | 'id'
  | 'displayName'
  | 'handle'
  | 'handleNormalized'
  | 'profileImage'
  | 'accountPrivacy'
>;

export type CreateUserProfileInput = Pick<
  UserProfile,
  'displayName' | 'handle' | 'handleNormalized' | 'accountPrivacy'
>;

/**
 * An opaque identifier supplied by the configured media catalog.
 *
 * App features should store and pass this value without parsing it or
 * assuming which external provider created it.
 */
export type MediaCatalogId = string;

/** @deprecated Prefer MediaCatalogId for new code. */
export type MovieCatalogId = MediaCatalogId;

/**
 * The supported combinations of catalog media and review target.
 *
 * Keeping these as a discriminated union prevents invalid combinations such
 * as a movie season. Season and episode targets can be added here later
 * without changing existing movie or series reviews.
 */
export type ReviewMediaTarget =
  | {
      mediaType: 'movie';
      reviewTargetType: 'movie';
    }
  | {
      mediaType: 'tv';
      reviewTargetType: 'series';
    };

export type MediaSummary = ReviewMediaTarget & {
  catalogId: MediaCatalogId;
  title: string;
  releaseYear: number | null;
  genres: string[];
  posterUrl: string | null;
  /** Present when this result came from a retention-managed local cache. */
  catalogDataRetention?: CatalogDataRetention;
};

export type MediaDetails = MediaSummary & {
  overview: string | null;
};

export type MediaSearchOptions = {
  /**
   * An opaque continuation value returned by the preceding search.
   */
  cursor?: string;
  maximumResults?: number;
  mediaType?: ReviewMediaTarget['mediaType'];
};

export type MediaSearchPage = {
  items: MediaSummary[];
  nextCursor: string | null;
};

/** @deprecated Prefer MediaSummary for new code. */
export type MovieSummary = MediaSummary;
/** @deprecated Prefer MediaDetails for new code. */
export type MovieDetails = MediaDetails;
/** @deprecated Prefer MediaSearchOptions for new code. */
export type MovieSearchOptions = MediaSearchOptions;
/** @deprecated Prefer MediaSearchPage for new code. */
export type MovieSearchPage = MediaSearchPage;

export type CatalogDataRetention = {
  fetchedAt: string;
  refreshAfter: string;
  expiresAt: string;
};

type ReviewMediaFields = Omit<
  MediaSummary,
  | 'catalogId'
  | 'catalogDataRetention'
  | 'mediaType'
  | 'reviewTargetType'
>;

type ReviewCatalogMatch =
  | {
      matchStatus: 'matched';
      catalogId: MediaCatalogId;
      /** Missing metadata from legacy snapshots is treated as expired. */
      catalogDataRetention?: CatalogDataRetention;
      /** Device-only display URI. Snapshot serializers intentionally omit it. */
      localPosterUri?: string;
    }
  | {
      matchStatus: 'manual';
      catalogId: null;
    };

/**
 * The catalog-independent media information saved with a review.
 *
 * A snapshot lets reviews render and synchronize without contacting the
 * catalog again. Manual entries can be matched to a catalog item later.
 */
export type ReviewMediaSnapshot = ReviewMediaFields &
  ReviewMediaTarget &
  ReviewCatalogMatch;

/** @deprecated Prefer ReviewMediaSnapshot for new code. */
export type ReviewMovieSnapshot = ReviewMediaSnapshot;

export type Review = {
  id: string;
  movieTitle: string;
  /**
   * Optional only for backward compatibility with reviews created before
   * catalog integration. The `movie` property name is retained while older
   * persisted reviews are supported; new code should use its media snapshot.
   */
  movie?: ReviewMediaSnapshot;
  reviewText: string;
  rating: string;
  visibility: ReviewVisibility;
  createdAt: string;
  syncStatus: 'synced' | 'pending' | 'failed';
};

export type CreateReviewInput = Omit<
  Review,
  'id' | 'createdAt' | 'syncStatus'
>;

export type ReviewVisibility = 'public' | 'followers' | 'private';

export type CommunityMediaFilter = 'all' | 'movie' | 'tv';
export type CommunitySort = 'newest' | 'oldest' | 'highest' | 'lowest';
export type CommunityDefaultSort =
  | 'newest'
  | 'oldest'
  | 'highestRated'
  | 'lowestRated';

export const DEFAULT_COMMUNITY_PREFERENCES = {
  defaultMediaFilter: 'all',
  defaultSort: 'newest',
} as const satisfies {
  defaultMediaFilter: CommunityMediaFilter;
  defaultSort: CommunityDefaultSort;
};

export type CommunityActivePreferences = {
  mediaFilter: CommunityMediaFilter;
  sort: CommunitySort;
};

export type UserSettings = {
  accountPrivacy: AccountPrivacy;
  defaultReviewVisibility: ReviewVisibility;
  /** Cross-device account default, distinct from the active Community filter. */
  defaultMediaFilter: CommunityMediaFilter;
  /** Cross-device account default, distinct from the active Community sort. */
  defaultSort: CommunityDefaultSort;
};

export type SharedReview = Review & {
  authorId: string;
  visibility: Exclude<ReviewVisibility, 'private'>;
};

export type CommunityReview = SharedReview & {
  author: PublicUserProfile;
};

export type FollowStatus = 'active' | 'pending';

export type FollowRelationship = {
  followerId: string;
  followedUserId: string;
  status: FollowStatus;
  createdAt: string;
  acceptedAt: string | null;
};
