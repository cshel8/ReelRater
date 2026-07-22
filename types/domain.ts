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
 * An opaque identifier supplied by the configured movie catalog.
 *
 * App features should store and pass this value without parsing it or
 * assuming which external provider created it.
 */
export type MovieCatalogId = string;

export type MovieSummary = {
  catalogId: MovieCatalogId;
  title: string;
  releaseYear: number | null;
  genres: string[];
  posterUrl: string | null;
  /** Present when this result came from a retention-managed local cache. */
  catalogDataRetention?: CatalogDataRetention;
};

export type MovieDetails = MovieSummary & {
  overview: string | null;
};

export type MovieSearchOptions = {
  /**
   * An opaque continuation value returned by the preceding search.
   */
  cursor?: string;
  maximumResults?: number;
};

export type MovieSearchPage = {
  movies: MovieSummary[];
  nextCursor: string | null;
};

export type CatalogDataRetention = {
  fetchedAt: string;
  refreshAfter: string;
  expiresAt: string;
};

type ReviewMovieFields = Omit<
  MovieSummary,
  'catalogId' | 'catalogDataRetention'
>;

/**
 * The movie information saved with a review.
 *
 * A snapshot lets reviews render and synchronize without contacting the
 * catalog again. Manual entries can be matched to a catalog movie later.
 */
export type ReviewMovieSnapshot =
  | (ReviewMovieFields & {
      matchStatus: 'matched';
      catalogId: MovieCatalogId;
      /** Missing metadata from legacy snapshots is treated as expired. */
      catalogDataRetention?: CatalogDataRetention;
      /** Device-only display URI. Snapshot serializers intentionally omit it. */
      localPosterUri?: string;
    })
  | (ReviewMovieFields & {
      matchStatus: 'manual';
      catalogId: null;
    });

export type Review = {
  id: string;
  movieTitle: string;
  /**
   * Optional only for backward compatibility with reviews created before
   * movie catalog integration. New reviews always provide this snapshot.
   */
  movie?: ReviewMovieSnapshot;
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

export type UserSettings = {
  accountPrivacy: AccountPrivacy;
  defaultReviewVisibility: ReviewVisibility;
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
