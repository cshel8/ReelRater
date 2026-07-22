import type { Review } from '@/types/domain';

export interface CachedReviewRepository {
  listForUser(userId: string): Promise<Review[]>;
  replaceForUser(userId: string, reviews: Review[]): Promise<void>;
  save(userId: string, review: Review): Promise<void>;
  remove(userId: string, reviewId: string): Promise<void>;
}
