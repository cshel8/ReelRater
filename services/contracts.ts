import type {
  AuthUser,
  AccountPrivacy,
  CommunityReview,
  CommunityMediaFilter,
  CommunitySort,
  CreateReviewInput,
  CreateUserProfileInput,
  FollowRelationship,
  MediaCatalogId,
  MediaDetails,
  MediaSearchOptions,
  MediaSearchPage,
  MediaSummary,
  PublicUserProfile,
  Review,
  SharedReview,
  UserSettings,
  UserProfile,
} from '@/types/domain';

export interface AuthService {
  signUp(email: string, password: string): Promise<AuthUser>;
  signIn(email: string, password: string): Promise<AuthUser>;
  signOut(): Promise<void>;
  getAccessToken(): Promise<string | null>;
  observeAuthState(
    callback: (user: AuthUser | null) => void
  ): () => void;
}

export interface AccountDeletionService {
  deleteCurrentAccount(password: string): Promise<void>;
}

export interface ConnectivityService {
  isOnline(): Promise<boolean>;
}

export interface ProfileService {
  create(userId: string, input: CreateUserProfileInput): Promise<UserProfile>;
  get(userId: string): Promise<UserProfile | null>;
  uploadImage(userId: string, localUri: string): Promise<string>;
}

/**
 * Provider-independent access to media search and details.
 *
 * A TMDB, another vendor, or a local cache adapter can implement this
 * contract without changing screens or review services.
 */
export interface MediaCatalogService {
  search(
    query: string,
    options?: MediaSearchOptions
  ): Promise<MediaSearchPage>;
  getById(catalogId: MediaCatalogId): Promise<MediaDetails | null>;
}

/** @deprecated Prefer MediaCatalogService for new code. */
export type MovieCatalogService = MediaCatalogService;

export interface SettingsService {
  get(userId: string): Promise<UserSettings | null>;
  initializeForNewUser(
    userId: string,
    defaultReviewVisibility: UserSettings['defaultReviewVisibility']
  ): Promise<void>;
  setDefaultReviewVisibility(
    userId: string,
    visibility: UserSettings['defaultReviewVisibility']
  ): Promise<void>;
  setPrivacyPreferences(
    userId: string,
    preferences: {
      accountPrivacy: AccountPrivacy;
      defaultReviewVisibility: UserSettings['defaultReviewVisibility'];
    }
  ): Promise<void>;
  setCommunityDefaults(
    userId: string,
    preferences: Pick<
      UserSettings,
      'defaultMediaFilter' | 'defaultSort'
    >
  ): Promise<void>;
}

export interface ReviewService {
  listForUser(userId: string): Promise<ReviewListResult>;
  findForMedia(userId: string, media: MediaSummary): Promise<Review | null>;
  create(userId: string, input: CreateReviewInput): Promise<Review>;
  update(userId: string, review: Review): Promise<Review>;
  remove(userId: string, reviewId: string): Promise<void>;
  syncPending(userId: string): Promise<ReviewSyncResult>;
}

export interface ReviewListResult {
  reviews: Review[];
  pendingCount: number;
  remoteAvailable: boolean;
  remoteError: string | null;
}

export interface ReviewSyncResult {
  syncedCount: number;
  failedCount: number;
  pendingCount: number;
}

export interface RemoteReviewService {
  listForUser(userId: string): Promise<Review[]>;
  save(userId: string, review: Review): Promise<void>;
  remove(userId: string, reviewId: string): Promise<void>;
}

export interface CommunityFeedResult {
  reviews: CommunityReview[];
  followsAnyone: boolean;
}

export type CommunityReviewMediaFilter = CommunityMediaFilter;
export type CommunityReviewSort = CommunitySort;

export type CommunityFeedOptions = {
  maximumResults?: number;
  mediaFilter?: CommunityReviewMediaFilter;
  /**
   * A temporary, on-screen search term. It is intentionally not a saved
   * Community preference.
   */
  searchQuery?: string;
  sort?: CommunityReviewSort;
};

export interface CommunityFeedService {
  list(
    viewerId: string,
    options?: CommunityFeedOptions
  ): Promise<CommunityFeedResult>;
}

export interface PublicProfileReviewResult {
  reviews: SharedReview[];
  canSeeFollowersOnly: boolean;
}

export interface PublicProfileReviewPageResult
  extends PublicProfileReviewResult {
  nextCursor: string | null;
}

export interface PublicProfileReviewService {
  list(
    viewerId: string,
    profileUserId: string,
    maximumResults?: number
  ): Promise<PublicProfileReviewResult>;
  listPage(
    viewerId: string,
    profileUserId: string,
    options?: {
      cursor?: string;
      maximumResults?: number;
    }
  ): Promise<PublicProfileReviewPageResult>;
  getById(
    viewerId: string,
    profileUserId: string,
    reviewId: string
  ): Promise<SharedReview | null>;
}

export interface RemoteCommunityReviewService {
  listVisibleFromAuthors(
    viewerId: string,
    authorIds: string[],
    options?: CommunityFeedOptions
  ): Promise<SharedReview[]>;
  listVisibleFromAuthorPage(
    viewerId: string,
    authorId: string,
    includeFollowersOnly: boolean,
    options?: {
      cursor?: string;
      maximumResults?: number;
    }
  ): Promise<{
    reviews: SharedReview[];
    nextCursor: string | null;
  }>;
  listVisibleFromAuthor(
    viewerId: string,
    authorId: string,
    includeFollowersOnly: boolean,
    maximumResults?: number
  ): Promise<SharedReview[]>;
  getVisibleFromAuthor(
    viewerId: string,
    authorId: string,
    reviewId: string,
    includeFollowersOnly: boolean
  ): Promise<SharedReview | null>;
}

export interface FollowService {
  follow(followerId: string, followedUserId: string): Promise<void>;
  unfollow(followerId: string, followedUserId: string): Promise<void>;
  removeFollower(followedUserId: string, followerId: string): Promise<void>;
  approveFollower(followedUserId: string, followerId: string): Promise<void>;
  rejectFollower(followedUserId: string, followerId: string): Promise<void>;
  listFollowers(userId: string): Promise<FollowRelationship[]>;
  listFollowing(userId: string): Promise<FollowRelationship[]>;
  listPendingRequests(userId: string): Promise<FollowRelationship[]>;
  isFollowing(followerId: string, followedUserId: string): Promise<boolean>;
  getStatus(
    followerId: string,
    followedUserId: string
  ): Promise<FollowRelationship['status'] | null>;
}

export interface SocialGraphInitializationService {
  initializeCounters(userId: string): Promise<void>;
}

export interface UserDirectoryService {
  getById(userId: string): Promise<PublicUserProfile | null>;
  searchByHandle(
    searchTerm: string,
    excludeUserId?: string,
    maximumResults?: number
  ): Promise<PublicUserProfile[]>;
}
