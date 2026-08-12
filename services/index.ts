// Swap these adapters for HTTP implementations when the AWS API is ready.
export { firebaseAuthService as authService } from '@/services/firebase/authService';
export { firebaseAccountDeletionService as accountDeletionService } from '@/services/firebase/accountDeletionService';
export { httpFollowService as followService } from '@/services/http/followService';
export { httpSocialGraphInitializationService as socialGraphInitializationService } from '@/services/http/socialGraphService';
export { firebaseProfileService as profileService } from '@/services/firebase/profileService';
export { firebaseSettingsService as settingsService } from '@/services/firebase/settingsService';
export { firebaseUserDirectoryService as userDirectoryService } from '@/services/firebase/userDirectoryService';

import { createCommunityFeedService } from '@/services/community/communityFeedService';
import { createPublicProfileReviewService } from '@/services/community/publicProfileReviewService';
import { firebaseCommunityReviewService } from '@/services/firebase/communityReviewService';
import { firebaseFollowService } from '@/services/firebase/followService';
import { firebaseUserDirectoryService } from '@/services/firebase/userDirectoryService';
import { firebaseReviewService } from '@/services/firebase/reviewService';
import { httpMediaCatalogService } from '@/services/http/movieCatalogService';
import { sqliteCachedReviewRepository } from '@/services/local/sqliteCachedReviewRepository';
import { sqliteMovieCacheRepository } from '@/services/local/sqliteMovieCacheRepository';
import { sqlitePendingReviewRepository } from '@/services/local/sqlitePendingReviewRepository';
import { sqlitePosterCacheRepository } from '@/services/local/sqlitePosterCacheRepository';
import { sqliteReviewTargetIdentityRepository } from '@/services/local/sqliteReviewTargetIdentityRepository';
import { asyncStorageCommunityPreferenceRepository } from '@/services/local/asyncStorageCommunityPreferenceRepository';
import { netInfoConnectivityService } from '@/services/local/netInfoConnectivityService';
import { expoPosterFileStore } from '@/services/local/expoPosterFileStore';
import { createCachedMediaCatalogService } from '@/services/movies/cachedMovieCatalogService';
import { createMovieCacheMaintenanceService } from '@/services/movies/movieCacheMaintenanceService';
import { createOfflineReviewService } from '@/services/reviews/offlineReviewService';
import { createCatalogAwareReviewService } from '@/services/reviews/catalogAwareReviewService';
import { createPosterAwareReviewService } from '@/services/reviews/posterAwareReviewService';
import { createPosterCacheService } from '@/services/movies/posterCacheService';

const offlineReviewService = createOfflineReviewService(
  sqlitePendingReviewRepository,
  sqliteCachedReviewRepository,
  firebaseReviewService,
  netInfoConnectivityService,
  undefined,
  sqliteReviewTargetIdentityRepository
);

export const communityFeedService = createCommunityFeedService(
  firebaseFollowService,
  firebaseUserDirectoryService,
  firebaseCommunityReviewService
);

export const communityPreferenceRepository =
  asyncStorageCommunityPreferenceRepository;

export const publicProfileReviewService = createPublicProfileReviewService(
  firebaseFollowService,
  firebaseCommunityReviewService
);

export const mediaCatalogService = createCachedMediaCatalogService(
  httpMediaCatalogService,
  sqliteMovieCacheRepository
);

/** @deprecated Prefer mediaCatalogService for new code. */
export const movieCatalogService = mediaCatalogService;

const catalogAwareReviewService = createCatalogAwareReviewService(
  offlineReviewService,
  mediaCatalogService
);

export const posterCacheService = createPosterCacheService(
  sqlitePosterCacheRepository,
  expoPosterFileStore
);

export const reviewService = createPosterAwareReviewService(
  catalogAwareReviewService,
  posterCacheService
);

export const movieCacheMaintenanceService =
  createMovieCacheMaintenanceService(
    httpMediaCatalogService,
    sqliteMovieCacheRepository
  );
