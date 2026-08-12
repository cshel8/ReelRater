export type SocialRelationshipStatus = 'active' | 'pending';

export type SocialMutationResult = {
  status: SocialRelationshipStatus | null;
};

export interface SocialGraphService {
  initializeCounters(userId: string): Promise<void>;
  follow(
    followerId: string,
    followedUserId: string
  ): Promise<SocialMutationResult>;
  unfollow(
    followerId: string,
    followedUserId: string
  ): Promise<SocialMutationResult>;
  removeFollower(
    followedUserId: string,
    followerId: string
  ): Promise<SocialMutationResult>;
  approveFollower(
    followedUserId: string,
    followerId: string
  ): Promise<SocialMutationResult>;
  rejectFollower(
    followedUserId: string,
    followerId: string
  ): Promise<SocialMutationResult>;
}

export class SocialGraphError extends Error {
  constructor(
    message: string,
    readonly statusCode: number
  ) {
    super(message);
  }
}
