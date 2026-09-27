const mockGetDocs = jest.fn();

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  doc: jest.fn(),
  documentId: jest.fn(),
  getDoc: jest.fn(),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  limit: jest.fn(),
  orderBy: jest.fn(),
  query: jest.fn(),
  startAfter: jest.fn(),
  where: jest.fn(),
}));

jest.mock('@/config/firebase', () => ({ db: {} }));

import { firebaseCommunityReviewService } from '@/services/firebase/communityReviewService';

describe('Firebase Community review deserialization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('normalizes a legacy string rating for Community and public-profile reads', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        {
          id: 'legacy-review',
          data: () => ({
            userId: 'author-1',
            movieTitle: 'Arrival',
            reviewText: 'A legacy public review.',
            rating: '4',
            visibility: 'public',
            createdAt: '2026-07-18T12:00:00.000Z',
          }),
        },
      ],
    });

    await expect(
      firebaseCommunityReviewService.listVisibleFromAuthor(
        'viewer-1',
        'author-1',
        false
      )
    ).resolves.toEqual([
      expect.objectContaining({
        id: 'legacy-review',
        rating: 4,
        spoilerWarning: false,
      }),
    ]);
  });
});
