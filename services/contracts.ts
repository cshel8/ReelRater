import type {
  AuthUser,
  AccountPrivacy,
  CommunityReview,
  CreateReviewInput,
  CreateUserProfileInput,
  FollowRelationship,
  MovieCatalogId,
  MovieDetails,
  MovieSearchOptions,
  MovieSearchPage,
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
 * Provider-independent access to movie search and details.
 *
 * A TMDB, another vendor, or a local cache adapter can implement this
 * contract without changing screens or review services.
 */
export interface MovieCatalogService {
  search(
    query: string,
    options?: MovieSearchOptions
  ): Promise<MovieSearchPage>;
  getById(catalogId: MovieCatalogId): Promise<MovieDetails | null>;
}

export interface SettingsService {
  get(userId: string): Promise<UserSettings | null>;
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
}

export interface ReviewService {
  listForUser(userId: string): Promise<ReviewListResult>;
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

export interface CommunityFeedService {
  list(viewerId: string, maximumResults?: number): Promise<CommunityFeedResult>;
}

export interface RemoteCommunityReviewService {
  listVisibleFromAuthors(
    viewerId: string,
    authorIds: string[],
    maximumResults?: number
  ): Promise<SharedReview[]>;
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

export interface UserDirectoryService {
  getById(userId: string): Promise<PublicUserProfile | null>;
  searchByHandle(
    searchTerm: string,
    excludeUserId?: string,
    maximumResults?: number
  ): Promise<PublicUserProfile[]>;
}
