import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import type { RemoteReviewService } from '@/services/contracts';
import type { Review } from '@/types/domain';
import { readReviewMovieSnapshot } from '@/utils/reviewMovie';

function readVisibility(value: unknown): Review['visibility'] {
  return value === 'public' || value === 'followers' || value === 'private'
    ? value
    : 'private';
}

function readCreatedAt(value: unknown): string {
  if (
    value &&
    typeof value === 'object' &&
    'toDate' in value &&
    typeof value.toDate === 'function'
  ) {
    return value.toDate().toISOString();
  }

  if (typeof value === 'string') {
    return value;
  }

  return new Date(0).toISOString();
}

export const firebaseReviewService: RemoteReviewService = {
  async listForUser(userId) {
    const reviewsQuery = query(
      collection(db, 'reviews'),
      where('userId', '==', userId)
    );
    const snapshot = await getDocs(reviewsQuery);

    return snapshot.docs
      .map((reviewDocument) => {
        const data = reviewDocument.data();
        const movieTitle =
          typeof data.movieTitle === 'string' ? data.movieTitle : '';
        return {
          id: reviewDocument.id,
          movieTitle,
          movie: readReviewMovieSnapshot(data.movie, movieTitle),
          reviewText: data.reviewText,
          rating: data.rating,
          visibility: readVisibility(data.visibility),
          createdAt: readCreatedAt(data.createdAt),
          syncStatus: 'synced',
        } satisfies Review;
      })
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  },

  async save(userId, review) {
    await setDoc(doc(db, 'reviews', review.id), {
      userId,
      movieTitle: review.movieTitle,
      movie: readReviewMovieSnapshot(review.movie, review.movieTitle),
      reviewText: review.reviewText,
      rating: review.rating,
      visibility: review.visibility,
      createdAt: new Date(review.createdAt),
    });
  },

  async remove(_userId, reviewId) {
    await deleteDoc(doc(db, 'reviews', reviewId));
  },
};
