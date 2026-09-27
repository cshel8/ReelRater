const mockSetDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockTimestampFromDate = jest.fn((date: Date) => ({
  toDate: () => date,
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  deleteDoc: jest.fn(),
  doc: jest.fn(() => ({ path: 'reviews/review-1' })),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  query: jest.fn(),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  Timestamp: {
    fromDate: (date: Date) => mockTimestampFromDate(date),
  },
  where: jest.fn(),
}));

jest.mock('@/config/firebase', () => ({ db: {} }));

import { firebaseReviewService } from '@/services/firebase/reviewService';
import {
  readFirestoreRating,
  ReviewDeserializationError,
} from '@/services/firebase/reviewSerialization';

describe('Firebase review serialization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    [1, 1],
    [2, 2],
    [3, 3],
    [4, 4],
    [5, 5],
    ['1', 1],
    ['2', 2],
    ['3', 3],
    ['4', 4],
    ['5', 5],
  ])('normalizes persisted rating %p to numeric %p', (persisted, expected) => {
    expect(readFirestoreRating(persisted)).toBe(expected);
    expect(typeof readFirestoreRating(persisted)).toBe('number');
  });

  it.each([
    0,
    6,
    4.5,
    '0',
    '6',
    '4.5',
    'abc',
    '',
    ' 4 ',
    null,
    undefined,
    {},
    [],
    true,
  ])('rejects unsupported persisted rating %p', (persisted) => {
    expect(readFirestoreRating(persisted)).toBeNull();
  });

  it('reads a legacy string rating as a numeric domain rating', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        {
          id: 'legacy-review',
          data: () => ({
            userId: 'user-1',
            movieTitle: 'Arrival',
            reviewText: 'A legacy review.',
            rating: '4',
            visibility: 'private',
            createdAt: '2026-07-18T12:00:00.000Z',
          }),
        },
      ],
    });

    await expect(firebaseReviewService.listForUser('user-1')).resolves.toEqual([
      expect.objectContaining({
        id: 'legacy-review',
        rating: 4,
        spoilerWarning: false,
      }),
    ]);
  });

  it('does not turn rejected Firestore documents into an empty result', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        {
          id: 'invalid-review',
          data: () => ({
            userId: 'user-1',
            movieTitle: 'Arrival',
            reviewText: 'An invalid persisted rating.',
            rating: 'not-a-rating',
            visibility: 'private',
            createdAt: '2026-07-18T12:00:00.000Z',
          }),
        },
      ],
    });

    await expect(firebaseReviewService.listForUser('user-1')).rejects.toBeInstanceOf(
      ReviewDeserializationError
    );
  });

  it('persists and reads spoilerWarning as review-owned data', async () => {
    await firebaseReviewService.save('user-1', {
      id: 'review-1',
      movieTitle: 'Arrival',
      reviewText: 'The ending is a spoiler.',
      rating: 5,
      spoilerWarning: true,
      visibility: 'public',
      createdAt: '2026-08-17T12:00:00.000Z',
      syncStatus: 'pending',
    });

    expect(mockSetDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ spoilerWarning: true })
    );

    mockGetDocs.mockResolvedValue({
      docs: [
        {
          id: 'review-1',
          data: () => ({
            userId: 'user-1',
            movieTitle: 'Arrival',
            reviewText: 'The ending is a spoiler.',
            rating: 5,
            spoilerWarning: true,
            visibility: 'public',
            createdAt: '2026-08-17T12:00:00.000Z',
          }),
        },
      ],
    });

    await expect(firebaseReviewService.listForUser('user-1')).resolves.toEqual([
      expect.objectContaining({ spoilerWarning: true }),
    ]);
  });

  it('does not write an invalid rating to Firestore', async () => {
    await expect(
      firebaseReviewService.save('user-1', {
        id: 'review-1',
        movieTitle: 'Arrival',
        reviewText: 'A review.',
        rating: 4.5,
        spoilerWarning: false,
        visibility: 'private',
        createdAt: '2026-08-17T12:00:00.000Z',
        syncStatus: 'pending',
      })
    ).rejects.toThrow('Choose a whole-star rating from 1 to 5.');

    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('writes numeric ratings for both new and existing review saves', async () => {
    const review = {
      id: 'review-1',
      movieTitle: 'Arrival',
      reviewText: 'A numeric rating remains numeric.',
      rating: 4,
      spoilerWarning: false,
      visibility: 'private' as const,
      createdAt: '2026-08-17T12:00:00.000Z',
      syncStatus: 'pending' as const,
    };

    await firebaseReviewService.save('user-1', review);
    await firebaseReviewService.save('user-1', {
      ...review,
      reviewText: 'An edited review still uses a numeric rating.',
    });

    expect(mockSetDoc).toHaveBeenCalledTimes(2);
    for (const [, data] of mockSetDoc.mock.calls) {
      expect(data.rating).toBe(4);
      expect(typeof data.rating).toBe('number');
    }
  });

  it('writes matched catalog retention timestamps and reads them back as ISO strings', async () => {
    await firebaseReviewService.save('user-1', {
      id: 'review-1',
      movieTitle: 'Arrival',
      movie: {
        mediaType: 'movie',
        reviewTargetType: 'movie',
        matchStatus: 'matched',
        catalogId: 'tmdb:movie:329865',
        title: 'Arrival',
        releaseYear: 2016,
        genres: ['Science Fiction'],
        posterUrl: 'https://image.example/arrival.jpg',
        catalogDataRetention: {
          fetchedAt: '2026-09-05T12:00:00.000Z',
          refreshAfter: '2027-02-02T12:00:00.000Z',
          expiresAt: '2027-03-03T12:00:00.000Z',
        },
      },
      reviewText: 'A thoughtful science-fiction story.',
      rating: 5,
      spoilerWarning: false,
      visibility: 'private',
      createdAt: '2026-09-05T12:00:00.000Z',
      syncStatus: 'pending',
    });

    expect(mockTimestampFromDate).toHaveBeenCalledTimes(3);
    expect(mockSetDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        rating: 5,
        movie: expect.objectContaining({
          catalogDataRetention: expect.objectContaining({
            fetchedAt: expect.objectContaining({ toDate: expect.any(Function) }),
          }),
        }),
      })
    );

    mockGetDocs.mockResolvedValue({
      docs: [
        {
          id: 'review-1',
          data: () => ({
            userId: 'user-1',
            movieTitle: 'Arrival',
            reviewText: 'A thoughtful science-fiction story.',
            rating: 5,
            spoilerWarning: false,
            visibility: 'private',
            createdAt: '2026-09-05T12:00:00.000Z',
            movie: {
              mediaType: 'movie',
              reviewTargetType: 'movie',
              matchStatus: 'matched',
              catalogId: 'tmdb:movie:329865',
              title: 'Arrival',
              releaseYear: 2016,
              genres: ['Science Fiction'],
              posterUrl: 'https://image.example/arrival.jpg',
              catalogDataRetention: {
                fetchedAt: { toDate: () => new Date('2026-09-05T12:00:00.000Z') },
                refreshAfter: { toDate: () => new Date('2027-02-02T12:00:00.000Z') },
                expiresAt: { toDate: () => new Date('2027-03-03T12:00:00.000Z') },
              },
            },
          }),
        },
      ],
    });

    await expect(firebaseReviewService.listForUser('user-1')).resolves.toEqual([
      expect.objectContaining({
        rating: 5,
        movie: expect.objectContaining({
          catalogDataRetention: {
            fetchedAt: '2026-09-05T12:00:00.000Z',
            refreshAfter: '2027-02-02T12:00:00.000Z',
            expiresAt: '2027-03-03T12:00:00.000Z',
          },
        }),
      }),
    ]);
  });

  it('reads legacy ISO catalog retention data and falls back for an incomplete movie snapshot', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        {
          id: 'legacy-catalog-review',
          data: () => ({
            userId: 'user-1',
            movieTitle: 'Arrival',
            reviewText: 'A legacy catalog review.',
            rating: '4',
            createdAt: '2026-07-18T12:00:00.000Z',
            movie: {
              mediaType: 'movie',
              reviewTargetType: 'movie',
              matchStatus: 'matched',
              catalogId: 'tmdb:movie:329865',
              title: 'Arrival',
              releaseYear: 2016,
              genres: ['Science Fiction'],
              posterUrl: null,
              catalogDataRetention: {
                fetchedAt: '2026-09-05T12:00:00.000Z',
                refreshAfter: '2027-02-02T12:00:00.000Z',
                expiresAt: '2027-03-03T12:00:00.000Z',
              },
            },
          }),
        },
        {
          id: 'legacy-incomplete-review',
          data: () => ({
            userId: 'user-1',
            movieTitle: 'Unmatched Title',
            reviewText: 'An older review with no complete movie snapshot.',
            rating: 3,
            createdAt: '2026-07-17T12:00:00.000Z',
          }),
        },
      ],
    });

    await expect(firebaseReviewService.listForUser('user-1')).resolves.toEqual([
      expect.objectContaining({
        id: 'legacy-catalog-review',
        rating: 4,
        spoilerWarning: false,
        visibility: 'private',
        movie: expect.objectContaining({
          catalogDataRetention: {
            fetchedAt: '2026-09-05T12:00:00.000Z',
            refreshAfter: '2027-02-02T12:00:00.000Z',
            expiresAt: '2027-03-03T12:00:00.000Z',
          },
        }),
      }),
      expect.objectContaining({
        id: 'legacy-incomplete-review',
        spoilerWarning: false,
        visibility: 'private',
        movie: expect.objectContaining({
          matchStatus: 'manual',
          title: 'Unmatched Title',
        }),
      }),
    ]);
  });
});
