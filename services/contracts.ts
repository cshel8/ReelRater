import type { AuthUser, CreateReviewInput, Review, UserProfile } from '@/types/domain';

export interface AuthService {
  signUp(username: string, password: string): Promise<AuthUser>;
  signIn(username: string, password: string): Promise<AuthUser>;
  signOut(): Promise<void>;
  getAccessToken(): Promise<string | null>;
}

export interface ProfileService {
  create(userId: string, username: string): Promise<UserProfile>;
  get(userId: string): Promise<UserProfile | null>;
  uploadImage(userId: string, localUri: string): Promise<string>;
}

export interface ReviewService {
  listForUser(userId: string): Promise<Review[]>;
  create(userId: string, input: CreateReviewInput): Promise<Review>;
  remove(reviewId: string): Promise<void>;
}
