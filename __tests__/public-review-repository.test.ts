const mockGetDocs = jest.fn();
const mockGetDocsFromServer = jest.fn();
const mockWhere = jest.fn((field: string, operator: string, value: unknown) => ({ field, operator, value }));
const mockOrderBy = jest.fn((field: unknown, direction: string) => ({ field, direction }));
const mockStartAfter = jest.fn((...values: unknown[]) => ({ startAfter: values }));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  documentId: jest.fn(() => '__name__'),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  getDocsFromServer: (...args: unknown[]) => mockGetDocsFromServer(...args),
  limit: jest.fn((value: number) => ({ limit: value })),
  orderBy: (...args: [unknown, string]) => mockOrderBy(...args),
  query: jest.fn((_collection: unknown, ...constraints: unknown[]) => ({ constraints })),
  startAfter: (...values: unknown[]) => mockStartAfter(...values),
  where: (...args: [string, string, unknown]) => mockWhere(...args),
}));

jest.mock('@/config/firebase', () => ({ db: {} }));

import { firebasePublicReviewRepository } from '@/services/firebase/publicReviewRepository';

const selectedTv = {
  catalogId: 'tmdb:tv:42', mediaType: 'tv' as const, reviewTargetType: 'series' as const,
};

describe('Firebase public exact-media review repository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDocs.mockResolvedValue({ docs: [] });
    mockGetDocsFromServer.mockResolvedValue({ docs: [] });
  });

  it.each([
    ['newest', [['createdAt', 'desc'], ['__name__', 'desc']]],
    ['oldest', [['createdAt', 'asc'], ['__name__', 'asc']]],
    ['highest', [['rating', 'desc'], ['movieTitle', 'asc'], ['createdAt', 'desc'], ['__name__', 'desc']]],
    ['lowest', [['rating', 'asc'], ['movieTitle', 'asc'], ['createdAt', 'desc'], ['__name__', 'desc']]],
  ] as const)('scopes %s ordering to the exact public TV identity', async (sort, expectedOrder) => {
    await firebasePublicReviewRepository.listPublicPage({
      mediaFilter: 'all', sort, exactMedia: selectedTv,
    });

    expect(mockWhere).toHaveBeenCalledWith('visibility', '==', 'public');
    expect(mockWhere).toHaveBeenCalledWith('movie.matchStatus', '==', 'matched');
    expect(mockWhere).toHaveBeenCalledWith('movie.catalogId', '==', 'tmdb:tv:42');
    expect(mockWhere).toHaveBeenCalledWith('movie.mediaType', '==', 'tv');
    expect(mockWhere).toHaveBeenCalledWith('movie.reviewTargetType', '==', 'series');
    expect(mockOrderBy.mock.calls).toEqual(expectedOrder);
    expect(mockGetDocsFromServer).toHaveBeenCalledTimes(1);
    expect(mockGetDocs).not.toHaveBeenCalled();
  });

  it('keeps ordinary Everyone page reads cache-aware when no exact identity is selected', async () => {
    await firebasePublicReviewRepository.listPublicPage({
      mediaFilter: 'all', sort: 'newest',
    });
    expect(mockGetDocs).toHaveBeenCalledTimes(1);
    expect(mockGetDocsFromServer).not.toHaveBeenCalled();
  });

  it('uses all ordering fields in the cursor, preserving equal-rating and equal-title pagination', async () => {
    await firebasePublicReviewRepository.listPublicPage({
      mediaFilter: 'tv', sort: 'highest', exactMedia: selectedTv,
      cursor: { values: [5, 'Wednesday', 'timestamp', 'review-b'] },
    });
    expect(mockStartAfter).toHaveBeenCalledWith(5, 'Wednesday', 'timestamp', 'review-b');
  });

  it('does not issue a generic query for malformed exact identities', async () => {
    await expect(firebasePublicReviewRepository.listPublicPage({
      mediaFilter: 'all', sort: 'newest',
      exactMedia: { catalogId: '42', mediaType: 'movie', reviewTargetType: 'movie' },
    })).rejects.toThrow('Invalid exact Community media identity');
    expect(mockGetDocs).not.toHaveBeenCalled();
    expect(mockGetDocsFromServer).not.toHaveBeenCalled();
  });

  it('propagates an exact-query failure rather than substituting unrelated public reviews', async () => {
    mockGetDocsFromServer.mockRejectedValue(new Error('Index is not ready'));
    await expect(firebasePublicReviewRepository.listPublicPage({
      mediaFilter: 'all', sort: 'newest', exactMedia: selectedTv,
    })).rejects.toThrow('Index is not ready');
  });
});
