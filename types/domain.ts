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

export type Review = {
  id: string;
  movieTitle: string;
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
