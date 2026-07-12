// Swap these adapters for HTTP implementations when the AWS API is ready.
export { firebaseAuthService as authService } from '@/services/firebase/authService';
export { firebaseProfileService as profileService } from '@/services/firebase/profileService';
export { firebaseReviewService as reviewService } from '@/services/firebase/reviewService';
