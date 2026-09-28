// Swap these adapters for HTTP implementations when the AWS API is ready.
export { firebaseAccountDeletionService as accountDeletionService } from '@/services/firebase/accountDeletionService';
export { httpSocialGraphInitializationService as socialGraphInitializationService } from '@/services/http/socialGraphService';
export { firebaseProfileService as profileService } from '@/services/firebase/profileService';
export { firebaseSettingsService as settingsService } from '@/services/firebase/settingsService';
export { firebaseUserDirectoryService as userDirectoryService } from '@/services/firebase/userDirectoryService';

import { createCommunityFeedService } from '@/services/community/communityFeedService';
import { createCommunityCacheLifecycleService } from '@/services/community/communityCacheLifecycleService';
import { createCommunityReconnectReconciliationService } from '@/services/community/communityReconnectReconciliationService';
import { createCachedFollowingCommunityFeedService } from '@/services/community/cachedFollowingCommunityFeedService';
import { createEveryoneCommunityFeedService } from '@/services/community/everyoneCommunityFeedService';
import { createCachedEveryoneCommunityFeedService } from '@/services/community/cachedEveryoneCommunityFeedService';
import { createPublicProfileReviewService } from '@/services/community/publicProfileReviewService';
import { firebaseCommunityReviewService } from '@/services/firebase/communityReviewService';
import { firebasePublicReviewRepository } from '@/services/firebase/publicReviewRepository';
import { firebaseFollowService } from '@/services/firebase/followService';
import { firebaseUserDirectoryService } from '@/services/firebase/userDirectoryService';
import { firebaseReviewService } from '@/services/firebase/reviewService';
import { httpMediaCatalogService } from '@/services/http/movieCatalogService';
import { sqliteCachedReviewRepository } from '@/services/local/sqliteCachedReviewRepository';
import { sqliteCommunityCacheRepository } from '@/services/local/sqliteCommunityCacheRepository';
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
import { createLifecycleAwareFollowService } from '@/services/community/lifecycleAwareFollowService';
import { createLifecycleAwareAuthService } from '@/services/community/lifecycleAwareAuthService';
import { firebaseAuthService } from '@/services/firebase/authService';
import { httpFollowService } from '@/services/http/followService';

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

export const everyoneCommunityFeedService = createEveryoneCommunityFeedService(
  firebasePublicReviewRepository,
  firebaseUserDirectoryService
);

export const communityPreferenceRepository =
  asyncStorageCommunityPreferenceRepository;

/**
 * Device-local Community persistence only. Feed/cache policy remains outside
 * this adapter so Community UI never depends on SQLite directly.
 */
export const communityCacheRepository = sqliteCommunityCacheRepository;

const communityCacheLifecycleService = createCommunityCacheLifecycleService(
  communityCacheRepository
);

export const authService = createLifecycleAwareAuthService(
  firebaseAuthService,
  communityCacheLifecycleService
);

export const followService = createLifecycleAwareFollowService(
  httpFollowService,
  communityCacheLifecycleService
);

export const communityReconnectReconciliationService =
  createCommunityReconnectReconciliationService(
    communityCacheRepository,
    firebaseFollowService,
    firebaseCommunityReviewService
  );

export const cachedFollowingCommunityFeedService =
  createCachedFollowingCommunityFeedService(
    communityFeedService,
    communityCacheRepository
  );

export const cachedEveryoneCommunityFeedService =
  createCachedEveryoneCommunityFeedService(
    everyoneCommunityFeedService,
    communityCacheRepository
  );

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
