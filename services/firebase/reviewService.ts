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
import {
  deserializeReviewMovie,
  readFirestoreRating,
  ReviewDeserializationError,
  serializeReviewMovie,
} from '@/services/firebase/reviewSerialization';
import { assertValidReview } from '@/services/reviews/reviewValidation';
import { readReviewMovieSnapshot } from '@/utils/reviewMovie';

function readVisibility(value: unknown): Review['visibility'] {
  return value === 'public' || value === 'followers' || value === 'private'
    ? value
    : 'private';
}

function readSpoilerWarning(value: unknown): boolean {
  return value === true;
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

    const reviews: Review[] = [];
    let rejectedDocumentCount = 0;

    for (const reviewDocument of snapshot.docs) {
      const data = reviewDocument.data();
      const movieTitle =
        typeof data.movieTitle === 'string' ? data.movieTitle : '';
      const rating = readFirestoreRating(data.rating);
      if (rating === null || typeof data.reviewText !== 'string') {
        rejectedDocumentCount += 1;
        continue;
      }
      reviews.push({
        id: reviewDocument.id,
        movieTitle,
        movie: deserializeReviewMovie(data.movie, movieTitle),
        reviewText: data.reviewText,
        rating,
        spoilerWarning: readSpoilerWarning(data.spoilerWarning),
        visibility: readVisibility(data.visibility),
        createdAt: readCreatedAt(data.createdAt),
        syncStatus: 'synced',
      });
    }

    if (rejectedDocumentCount > 0) {
      throw new ReviewDeserializationError(rejectedDocumentCount);
    }

    return reviews.sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt)
    );
  },

  async save(userId, review) {
    assertValidReview(review);
    await setDoc(doc(db, 'reviews', review.id), {
      userId,
      movieTitle: review.movieTitle,
      movie: serializeReviewMovie(review.movie ?? readReviewMovieSnapshot(undefined, review.movieTitle)),
      reviewText: review.reviewText,
      rating: review.rating,
      spoilerWarning: review.spoilerWarning,
      visibility: review.visibility,
      createdAt: new Date(review.createdAt),
    });
  },

  async remove(_userId, reviewId) {
    await deleteDoc(doc(db, 'reviews', reviewId));
  },
};
