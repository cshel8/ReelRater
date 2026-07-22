// Swap these adapters for HTTP implementations when the AWS API is ready.
export { firebaseAuthService as authService } from '@/services/firebase/authService';
export { firebaseAccountDeletionService as accountDeletionService } from '@/services/firebase/accountDeletionService';
export { firebaseFollowService as followService } from '@/services/firebase/followService';
export { firebaseProfileService as profileService } from '@/services/firebase/profileService';
export { firebaseSettingsService as settingsService } from '@/services/firebase/settingsService';
export { firebaseUserDirectoryService as userDirectoryService } from '@/services/firebase/userDirectoryService';

import { createCommunityFeedService } from '@/services/community/communityFeedService';
import { firebaseCommunityReviewService } from '@/services/firebase/communityReviewService';
import { firebaseFollowService } from '@/services/firebase/followService';
import { firebaseUserDirectoryService } from '@/services/firebase/userDirectoryService';
import { firebaseReviewService } from '@/services/firebase/reviewService';
import { httpMovieCatalogService } from '@/services/http/movieCatalogService';
import { sqliteCachedReviewRepository } from '@/services/local/sqliteCachedReviewRepository';
import { sqliteMovieCacheRepository } from '@/services/local/sqliteMovieCacheRepository';
import { sqlitePendingReviewRepository } from '@/services/local/sqlitePendingReviewRepository';
import { sqlitePosterCacheRepository } from '@/services/local/sqlitePosterCacheRepository';
import { netInfoConnectivityService } from '@/services/local/netInfoConnectivityService';
import { expoPosterFileStore } from '@/services/local/expoPosterFileStore';
import { createCachedMovieCatalogService } from '@/services/movies/cachedMovieCatalogService';
import { createMovieCacheMaintenanceService } from '@/services/movies/movieCacheMaintenanceService';
import { createOfflineReviewService } from '@/services/reviews/offlineReviewService';
import { createCatalogAwareReviewService } from '@/services/reviews/catalogAwareReviewService';
import { createPosterAwareReviewService } from '@/services/reviews/posterAwareReviewService';
import { createPosterCacheService } from '@/services/movies/posterCacheService';

const offlineReviewService = createOfflineReviewService(
  sqlitePendingReviewRepository,
  sqliteCachedReviewRepository,
  firebaseReviewService,
  netInfoConnectivityService
);

export const communityFeedService = createCommunityFeedService(
  firebaseFollowService,
  firebaseUserDirectoryService,
  firebaseCommunityReviewService
);

export const movieCatalogService = createCachedMovieCatalogService(
  httpMovieCatalogService,
  sqliteMovieCacheRepository
);

const catalogAwareReviewService = createCatalogAwareReviewService(
  offlineReviewService,
  movieCatalogService
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
    httpMovieCatalogService,
    sqliteMovieCacheRepository
  );
