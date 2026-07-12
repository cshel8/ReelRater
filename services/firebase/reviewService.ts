import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import type { ReviewService } from '@/services/contracts';
import type { Review } from '@/types/domain';

export const firebaseReviewService: ReviewService = {
  async listForUser(userId) {
    const reviewsQuery = query(
      collection(db, 'reviews'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(reviewsQuery);

    return snapshot.docs.map((reviewDocument) => {
      const data = reviewDocument.data();
      return {
        id: reviewDocument.id,
        movieTitle: data.movieTitle,
        reviewText: data.reviewText,
        rating: data.rating,
      } satisfies Review;
    });
  },

  async create(userId, input) {
    const reviewDocument = await addDoc(collection(db, 'reviews'), {
      userId,
      ...input,
      createdAt: serverTimestamp(),
    });

    return { id: reviewDocument.id, ...input };
  },

  async remove(reviewId) {
    await deleteDoc(doc(db, 'reviews', reviewId));
  },
};
