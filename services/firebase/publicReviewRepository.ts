import {
  collection,
  documentId,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  type QueryConstraint,
  where,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import type {
  PublicReviewPage,
  PublicReviewRepository,
} from '@/services/contracts';
import { deserializeReviewMovie, readFirestoreRating } from '@/services/firebase/reviewSerialization';
import type { SharedReview } from '@/types/domain';

const PAGE_SIZE = 20;

const readCreatedAt = (value: unknown) =>
  value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function'
    ? value.toDate().toISOString()
    : new Date(0).toISOString();

const readReview = (id: string, value: Record<string, unknown>): SharedReview | null => {
  const rating = readFirestoreRating(value.rating);
  if (typeof value.userId !== 'string' || typeof value.movieTitle !== 'string' || typeof value.reviewText !== 'string' || rating === null || value.visibility !== 'public') return null;
  return {
    id, authorId: value.userId, movieTitle: value.movieTitle,
    movie: deserializeReviewMovie(value.movie, value.movieTitle), reviewText: value.reviewText,
    rating, spoilerWarning: value.spoilerWarning === true, visibility: 'public',
    createdAt: readCreatedAt(value.createdAt), syncStatus: 'synced',
  };
};

const orderConstraints = (sort: 'newest' | 'oldest' | 'highest' | 'lowest') => {
  if (sort === 'oldest') return [orderBy('createdAt', 'asc'), orderBy(documentId(), 'asc')];
  if (sort === 'highest') return [orderBy('rating', 'desc'), orderBy('movieTitle', 'asc'), orderBy('createdAt', 'desc'), orderBy(documentId(), 'desc')];
  if (sort === 'lowest') return [orderBy('rating', 'asc'), orderBy('movieTitle', 'asc'), orderBy('createdAt', 'desc'), orderBy(documentId(), 'desc')];
  return [orderBy('createdAt', 'desc'), orderBy(documentId(), 'desc')];
};

export const firebasePublicReviewRepository: PublicReviewRepository = {
  async listPublicPage({ mediaFilter, sort, cursor, maximumResults = PAGE_SIZE }): Promise<PublicReviewPage> {
    const requestedSize = Math.min(PAGE_SIZE, Math.max(1, maximumResults));
    const constraints: QueryConstraint[] = [where('visibility', '==', 'public')];
    if (mediaFilter !== 'all') constraints.push(where('movie.mediaType', '==', mediaFilter));
    constraints.push(...orderConstraints(sort));
    if (cursor) constraints.push(startAfter(...cursor.values));
    constraints.push(limit(requestedSize + 1));
    const snapshot = await getDocs(query(collection(db, 'reviews'), ...constraints));
    const pageDocuments = snapshot.docs.slice(0, requestedSize);
    const reviews = pageDocuments.flatMap((document) => {
      const review = readReview(document.id, document.data());
      return review ? [review] : [];
    });
    const finalDocument = pageDocuments.at(-1);
    const nextCursor = snapshot.docs.length > requestedSize && finalDocument
      ? { values: sort === 'highest' || sort === 'lowest'
        ? [finalDocument.data().rating, finalDocument.data().movieTitle, finalDocument.data().createdAt, finalDocument.id]
        : [finalDocument.data().createdAt, finalDocument.id] }
      : null;
    return { reviews, nextCursor };
  },
};
