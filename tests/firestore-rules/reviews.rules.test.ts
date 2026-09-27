import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  documentId,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import {
  clientDb,
  createRulesTestEnvironment,
  profile,
  relationship,
  review,
  seed,
} from './helpers';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

describe('Firestore review visibility rules', () => {
  let testEnvironment: RulesTestEnvironment;

  beforeAll(async () => {
    testEnvironment = await createRulesTestEnvironment();
  });

  beforeEach(async () => {
    await testEnvironment.clearFirestore();
    await seed(testEnvironment, 'users/author', profile({ handle: 'author', handleNormalized: 'author', accountPrivacy: 'private' }));
    await seed(testEnvironment, 'users/active', profile({ handle: 'active', handleNormalized: 'active' }));
    await seed(testEnvironment, 'users/pending', profile({ handle: 'pending', handleNormalized: 'pending' }));
    await seed(testEnvironment, 'users/other', profile({ handle: 'other', handleNormalized: 'other' }));
    await seed(testEnvironment, 'followRelationships/author/followers/active', relationship('active', 'author', 'active'));
    await seed(testEnvironment, 'followRelationships/author/followers/pending', relationship('pending', 'author', 'pending'));
    await seed(testEnvironment, 'reviews/public', review('author', 'public'));
    await seed(testEnvironment, 'reviews/followers', review('author', 'followers'));
    await seed(testEnvironment, 'reviews/private', review('author', 'private'));
  });

  afterAll(async () => {
    await testEnvironment.cleanup();
  });

  it('allows public reviews from a private account to every signed-in user', async () => {
    await assertSucceeds(getDoc(doc(clientDb(testEnvironment, 'other'), 'reviews', 'public')));
  });

  it('allows followers-only reviews only to the owner and active followers', async () => {
    await assertSucceeds(getDoc(doc(clientDb(testEnvironment, 'author'), 'reviews', 'followers')));
    await assertSucceeds(getDoc(doc(clientDb(testEnvironment, 'active'), 'reviews', 'followers')));
    await assertFails(getDoc(doc(clientDb(testEnvironment, 'pending'), 'reviews', 'followers')));
    await assertFails(getDoc(doc(clientDb(testEnvironment, 'other'), 'reviews', 'followers')));
  });

  it('allows only the owner to read only-me reviews', async () => {
    await assertSucceeds(getDoc(doc(clientDb(testEnvironment, 'author'), 'reviews', 'private')));
    await assertFails(getDoc(doc(clientDb(testEnvironment, 'active'), 'reviews', 'private')));
  });

  it('enforces review ownership for creates and updates', async () => {
    await assertSucceeds(setDoc(doc(clientDb(testEnvironment, 'author'), 'reviews', 'new'), review('author', 'public')));
    await assertFails(setDoc(doc(clientDb(testEnvironment, 'other'), 'reviews', 'forged'), review('author', 'public')));
    await assertFails(setDoc(doc(clientDb(testEnvironment, 'other'), 'reviews', 'public'), review('other', 'public')));
  });

  const createReview = (id: string, data: Record<string, unknown>, userId = 'author') =>
    setDoc(doc(clientDb(testEnvironment, userId), 'reviews', id), data);

  const matchedMovie = (overrides: Record<string, unknown> = {}) => ({
    mediaType: 'movie',
    reviewTargetType: 'movie',
    matchStatus: 'matched',
    catalogId: 'tmdb:movie:329865',
    title: 'Arrival',
    releaseYear: 2016,
    genres: ['Science Fiction'],
    posterUrl: 'https://image.example/arrival.jpg',
    catalogDataRetention: {
      fetchedAt: new Date('2026-01-01T00:00:00.000Z'),
      refreshAfter: new Date('2026-06-01T00:00:00.000Z'),
      expiresAt: new Date('2026-06-29T00:00:00.000Z'),
    },
    ...overrides,
  });

  it('allows complete manual movie and TV-series review documents', async () => {
    await assertSucceeds(createReview('manual-movie', review('author', 'private')));
    await assertSucceeds(
      createReview(
        'manual-tv',
        review('author', 'public', {
          movieTitle: 'Dragon Ball Z Kai',
          movie: {
            mediaType: 'tv',
            reviewTargetType: 'series',
            matchStatus: 'manual',
            catalogId: null,
            title: 'Dragon Ball Z Kai',
            releaseYear: null,
            genres: [],
            posterUrl: null,
          },
          spoilerWarning: true,
        })
      )
    );
  });

  it('allows complete matched movie and TV-series review documents', async () => {
    await assertSucceeds(
      createReview('matched-movie', review('author', 'public', { movie: matchedMovie() }))
    );
    await assertSucceeds(
      createReview(
        'matched-tv',
        review('author', 'followers', {
          movieTitle: 'Dragon Ball Z Kai',
          movie: matchedMovie({
            mediaType: 'tv',
            reviewTargetType: 'series',
            catalogId: 'tmdb:tv:61709',
            title: 'Dragon Ball Z Kai',
          }),
        })
      )
    );
  });

  it.each([0, 6, 4.5, '4', null])('denies invalid rating %p', async (rating) => {
    await assertFails(createReview(`invalid-rating-${String(rating)}`, review('author', 'private', { rating })));
  });

  it('denies a missing rating', async () => {
    const { rating: _rating, ...missingRating } = review('author', 'private');
    await assertFails(createReview('missing-rating', missingRating));
  });

  it('allows numeric rating boundaries and both spoiler-warning values', async () => {
    await assertSucceeds(createReview('rating-one', review('author', 'private', { rating: 1, spoilerWarning: false })));
    await assertSucceeds(createReview('rating-five', review('author', 'private', { rating: 5, spoilerWarning: true })));
  });

  it.each(['', 42, null])('denies invalid spoilerWarning %p', async (spoilerWarning) => {
    await assertFails(createReview(`invalid-spoiler-${String(spoilerWarning)}`, review('author', 'private', { spoilerWarning })));
  });

  it('denies a missing spoilerWarning', async () => {
    const { spoilerWarning: _spoilerWarning, ...missingSpoiler } = review('author', 'private');
    await assertFails(createReview('missing-spoiler', missingSpoiler));
  });

  it('validates review text and titles at their schema boundaries', async () => {
    await assertSucceeds(createReview('maximum-text', review('author', 'private', { reviewText: 'a'.repeat(3000) })));
    await assertFails(createReview('empty-text', review('author', 'private', { reviewText: '' })));
    await assertFails(createReview('long-text', review('author', 'private', { reviewText: 'a'.repeat(3001) })));
    await assertFails(createReview('non-string-text', review('author', 'private', { reviewText: 3 })));
    const { reviewText: _reviewText, ...missingReviewText } = review('author', 'private');
    await assertFails(createReview('missing-text', missingReviewText));
    await assertFails(createReview('empty-title', review('author', 'private', { movieTitle: '' })));
    await assertFails(createReview('long-title', review('author', 'private', { movieTitle: 'a'.repeat(201) })));
    await assertFails(createReview('long-movie-title', review('author', 'private', {
      movie: { ...review('author', 'private').movie as Record<string, unknown>, title: 'a'.repeat(201) },
    })));
  });

  it('denies unknown persisted fields at every review schema level', async () => {
    await assertFails(createReview('unknown-top-level', review('author', 'private', { isFeatured: true })));
    await assertFails(createReview('sync-status', review('author', 'private', { syncStatus: 'pending' })));
    await assertFails(createReview('unknown-movie', review('author', 'private', {
      movie: { ...review('author', 'private').movie as Record<string, unknown>, localPosterUri: 'file:///poster.jpg' },
    })));
    await assertFails(createReview('unknown-retention', review('author', 'private', {
      movie: matchedMovie({
        catalogDataRetention: { ...matchedMovie().catalogDataRetention, unexpected: true },
      }),
    })));
  });

  it('denies invalid manual and matched catalog snapshots', async () => {
    await assertFails(createReview('manual-catalog-id', review('author', 'private', {
      movie: { ...review('author', 'private').movie as Record<string, unknown>, catalogId: 'tmdb:movie:329865' },
    })));
    await assertFails(createReview('manual-retention', review('author', 'private', {
      movie: { ...review('author', 'private').movie as Record<string, unknown>, catalogDataRetention: matchedMovie().catalogDataRetention },
    })));
    await assertFails(createReview('matched-null-id', review('author', 'private', { movie: matchedMovie({ catalogId: null }) })));
    await assertFails(createReview('matched-empty-id', review('author', 'private', { movie: matchedMovie({ catalogId: '' }) })));
    await assertFails(createReview('matched-long-id', review('author', 'private', { movie: matchedMovie({ catalogId: 'a'.repeat(201) }) })));
    await assertFails(createReview('invalid-release-year', review('author', 'private', { movie: matchedMovie({ releaseYear: 1800 }) })));
    await assertFails(createReview('too-many-genres', review('author', 'private', { movie: matchedMovie({ genres: Array.from({ length: 21 }, () => 'Drama') }) })));
    await assertFails(createReview('long-genre', review('author', 'private', { movie: matchedMovie({ genres: ['a'.repeat(51)] }) })));
    await assertFails(createReview('long-poster', review('author', 'private', { movie: matchedMovie({ posterUrl: 'a'.repeat(1001) }) })));
    await assertFails(createReview('string-retention', review('author', 'private', {
      movie: matchedMovie({ catalogDataRetention: { fetchedAt: '2026-01-01T00:00:00.000Z', refreshAfter: '2026-06-01T00:00:00.000Z', expiresAt: '2026-06-29T00:00:00.000Z' } }),
    })));
    await assertFails(createReview('unordered-retention', review('author', 'private', {
      movie: matchedMovie({ catalogDataRetention: { fetchedAt: new Date('2026-06-01T00:00:00.000Z'), refreshAfter: new Date('2026-01-01T00:00:00.000Z'), expiresAt: new Date('2026-06-29T00:00:00.000Z') } }),
    })));
  });

  it('denies unsupported media-target combinations', async () => {
    await assertFails(createReview('movie-series', review('author', 'private', {
      movie: { ...review('author', 'private').movie as Record<string, unknown>, reviewTargetType: 'series' },
    })));
    await assertFails(createReview('tv-movie', review('author', 'private', {
      movie: { ...review('author', 'private').movie as Record<string, unknown>, mediaType: 'tv' },
    })));
  });

  it('validates creation and update timestamps', async () => {
    await assertSucceeds(createReview('without-updated-at', review('author', 'private')));
    await assertSucceeds(createReview('with-updated-at', review('author', 'private', {
      updatedAt: new Date('2026-08-12T00:00:00.000Z'),
    })));
    await assertFails(createReview('missing-created-at', (() => {
      const { createdAt: _createdAt, ...withoutCreatedAt } = review('author', 'private');
      return withoutCreatedAt;
    })()));
    await assertFails(createReview('string-created-at', review('author', 'private', { createdAt: '2026-08-11T00:00:00.000Z' })));
    await assertFails(createReview('early-updated-at', review('author', 'private', { updatedAt: new Date('2026-08-10T00:00:00.000Z') })));
    await assertFails(createReview('string-updated-at', review('author', 'private', { updatedAt: '2026-08-12T00:00:00.000Z' })));
  });

  it('allows manual-to-matched and metadata-only matched updates', async () => {
    await seed(testEnvironment, 'reviews/manual-transition', review('author', 'private'));
    await assertSucceeds(setDoc(
      doc(clientDb(testEnvironment, 'author'), 'reviews', 'manual-transition'),
      review('author', 'private', { movie: matchedMovie() })
    ));

    await seed(testEnvironment, 'reviews/matched-refresh', review('author', 'private', { movie: matchedMovie() }));
    await assertSucceeds(setDoc(
      doc(clientDb(testEnvironment, 'author'), 'reviews', 'matched-refresh'),
      review('author', 'private', {
        movie: matchedMovie({
          title: 'Arrival (Refreshed)',
          genres: ['Drama', 'Science Fiction'],
          catalogDataRetention: {
            fetchedAt: new Date('2026-02-01T00:00:00.000Z'),
            refreshAfter: new Date('2026-07-01T00:00:00.000Z'),
            expiresAt: new Date('2026-07-29T00:00:00.000Z'),
          },
        }),
      })
    ));
  });

  it('locks matched identity and owner/creation fields after creation', async () => {
    const original = review('author', 'private', { movie: matchedMovie() });
    await seed(testEnvironment, 'reviews/matched-identity', original);
    const path = doc(clientDb(testEnvironment, 'author'), 'reviews', 'matched-identity');
    await assertFails(setDoc(path, review('author', 'private', { movie: { ...matchedMovie(), catalogId: 'tmdb:movie:999' } })));
    await assertFails(setDoc(path, review('author', 'private', { movie: { ...matchedMovie(), mediaType: 'tv', reviewTargetType: 'series' } })));
    await assertFails(setDoc(path, review('author', 'private', { movie: { ...review('author', 'private').movie as Record<string, unknown> } })));
    await assertFails(setDoc(path, review('other', 'private', { movie: matchedMovie() })));
    await assertFails(setDoc(path, review('author', 'private', { movie: matchedMovie(), createdAt: new Date('2026-08-12T00:00:00.000Z') })));
    await assertFails(setDoc(doc(clientDb(testEnvironment, 'other'), 'reviews', 'matched-identity'), original));
    await assertFails(deleteDoc(doc(clientDb(testEnvironment, 'other'), 'reviews', 'matched-identity')));
  });

  it('authorizes the public-profile public-review query shape', async () => {
    await assertSucceeds(
      getDocs(query(collection(clientDb(testEnvironment, 'other'), 'reviews'), where('userId', '==', 'author'), where('visibility', '==', 'public')))
    );
  });

  it('authorizes public-profile followers-only and paginated query shapes for an active follower', async () => {
    const reviews = collection(clientDb(testEnvironment, 'active'), 'reviews');
    await assertSucceeds(
      getDocs(
        query(
          reviews,
          where('userId', '==', 'author'),
          where('visibility', '==', 'followers')
        )
      )
    );
    await assertSucceeds(
      getDocs(
        query(
          reviews,
          where('userId', '==', 'author'),
          where('visibility', 'in', ['public', 'followers']),
          orderBy('createdAt', 'desc'),
          orderBy(documentId(), 'desc'),
          limit(11)
        )
      )
    );
  });
});
