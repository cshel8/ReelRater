import type { Review } from '@/types/domain';

export interface ReviewTargetIdentityRepository {
  findReviewId(userId: string, targetKey: string): Promise<string | null>;
  replaceForUser(userId: string, reviews: Review[]): Promise<void>;
  save(userId: string, review: Review): Promise<void>;
  remove(userId: string, reviewId: string): Promise<void>;
}

export const noopReviewTargetIdentityRepository: ReviewTargetIdentityRepository = {
  async findReviewId() {
    return null;
  },
  async replaceForUser() {},
  async save() {},
  async remove() {},
};
