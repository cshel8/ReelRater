// Swap these adapters for HTTP implementations when the AWS API is ready.
export { firebaseAuthService as authService } from '@/services/firebase/authService';
export { firebaseFollowService as followService } from '@/services/firebase/followService';
export { firebaseProfileService as profileService } from '@/services/firebase/profileService';
export { firebaseSettingsService as settingsService } from '@/services/firebase/settingsService';
export { firebaseUserDirectoryService as userDirectoryService } from '@/services/firebase/userDirectoryService';

import { createCommunityFeedService } from '@/services/community/communityFeedService';
import { firebaseCommunityReviewService } from '@/services/firebase/communityReviewService';
import { firebaseFollowService } from '@/services/firebase/followService';
import { firebaseUserDirectoryService } from '@/services/firebase/userDirectoryService';
import { firebaseReviewService } from '@/services/firebase/reviewService';
import { sqliteCachedReviewRepository } from '@/services/local/sqliteCachedReviewRepository';
import { sqlitePendingReviewRepository } from '@/services/local/sqlitePendingReviewRepository';
import { createOfflineReviewService } from '@/services/reviews/offlineReviewService';

export const reviewService = createOfflineReviewService(
  sqlitePendingReviewRepository,
  sqliteCachedReviewRepository,
  firebaseReviewService
);

export const communityFeedService = createCommunityFeedService(
  firebaseFollowService,
  firebaseUserDirectoryService,
  firebaseCommunityReviewService
);
