import assert from 'node:assert/strict';
import test from 'node:test';
import { Timestamp } from 'firebase-admin/firestore';
import {
  PublicReviewSchemaInventoryJob,
  classifyPublicReview,
} from './publicReviewSchemaInventory.js';

const modernReview = (overrides: Record<string, unknown> = {}) => ({
  reviewId: 'modern-review',
  value: {
    userId: 'author-1',
    movieTitle: 'Arrival',
    reviewText: 'Thoughtful science fiction.',
    rating: 5,
    spoilerWarning: false,
    visibility: 'public',
    createdAt: Timestamp.fromDate(new Date('2026-09-26T12:00:00.000Z')),
    movie: {
      mediaType: 'movie',
      reviewTargetType: 'movie',
    },
    ...overrides,
  },
});

test('classifies a modern public review as safe for Everyone queries', () => {
  assert.equal(classifyPublicReview(modernReview()), null);
});

test('identifies persisted legacy query fields without accepting client normalization', () => {
  const unsafe = classifyPublicReview(
    modernReview({
      createdAt: '2026-09-26T12:00:00.000Z',
      rating: '4',
      movie: { mediaType: 'television', reviewTargetType: 'movie' },
      spoilerWarning: undefined,
    })
  );

  assert.deepEqual(unsafe?.issues, [
    'createdAt: expected Firestore Timestamp',
    'rating: expected numeric integer from 1 through 5',
    'movie.mediaType: expected "movie" or "tv"',
    'movie.reviewTargetType: incompatible with mediaType',
    'spoilerWarning: expected boolean',
  ]);
});

test('flags fields that would prevent shared-review deserialization', () => {
  const unsafe = classifyPublicReview(
    modernReview({
      userId: '',
      movieTitle: null,
      reviewText: null,
      movie: null,
    })
  );

  assert.deepEqual(unsafe?.issues, [
    'movie: expected object with mediaType',
    'userId: expected nonempty string',
    'movieTitle: expected nonempty string',
    'reviewText: expected string',
  ]);
});

test('reports totals without mutating its read-only repository', async () => {
  let calls = 0;
  const job = new PublicReviewSchemaInventoryJob({
    async listPublicReviews() {
      calls += 1;
      return [
        modernReview(),
        { ...modernReview({ rating: '3' }), reviewId: 'legacy' },
      ];
    },
  });

  const result = await job.run();

  assert.equal(calls, 1);
  assert.equal(result.publicReviewsScanned, 2);
  assert.equal(result.querySafeReviews, 1);
  assert.equal(result.queryUnsafeReviews, 1);
  assert.equal(result.unsafeReviews[0]?.reviewId, 'legacy');
});
