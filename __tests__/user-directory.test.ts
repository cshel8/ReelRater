import {
  endAt,
  getDoc,
  getDocs,
  limit,
  orderBy,
  startAt,
} from 'firebase/firestore';
import { firebaseUserDirectoryService } from '@/services/firebase/userDirectoryService';

jest.mock('@/config/firebase', () => ({
  db: { name: 'test-database' },
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn((_database, ...segments: string[]) => ({
    path: segments.join('/'),
  })),
  doc: jest.fn((_database, ...segments: string[]) => ({
    path: segments.join('/'),
  })),
  endAt: jest.fn((value: string) => ({ endAt: value })),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  limit: jest.fn((value: number) => ({ limit: value })),
  orderBy: jest.fn((field: string) => ({ orderBy: field })),
  query: jest.fn((...constraints: unknown[]) => ({ constraints })),
  startAt: jest.fn((value: string) => ({ startAt: value })),
}));

describe('Firebase user directory service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('normalizes a handle prefix and excludes the signed-in account', async () => {
    (getDocs as jest.Mock).mockResolvedValue({
      docs: [
        {
          id: 'current-user',
          data: () => ({
            displayName: 'Connor',
            handle: 'ConnorMovies',
            handleNormalized: 'connormovies',
            profileImage: null,
            accountPrivacy: 'public',
          }),
        },
        {
          id: 'other-user',
          data: () => ({
            displayName: 'Connie',
            handle: 'ConnieFilms',
            handleNormalized: 'conniefilms',
            profileImage: null,
            accountPrivacy: 'private',
          }),
        },
      ],
    });

    const results = await firebaseUserDirectoryService.searchByHandle(
      '  @CONN  ',
      'current-user',
      20
    );

    expect(orderBy).toHaveBeenCalledWith('handleNormalized');
    expect(startAt).toHaveBeenCalledWith('conn');
    expect(endAt).toHaveBeenCalledWith(`conn\uf8ff`);
    expect(limit).toHaveBeenCalledWith(21);
    expect(results).toEqual([
      {
        id: 'other-user',
        displayName: 'Connie',
        handle: 'ConnieFilms',
        handleNormalized: 'conniefilms',
        profileImage: null,
        accountPrivacy: 'private',
      },
    ]);
  });

  it('loads a public profile without authentication fields', async () => {
    (getDoc as jest.Mock).mockResolvedValue({
      id: 'other-user',
      exists: () => true,
      data: () => ({
        displayName: 'Alex',
        handle: 'AlexReviews',
        handleNormalized: 'alexreviews',
        profileImage: 'https://example.com/avatar.jpg',
        accountPrivacy: 'private',
        email: 'not-returned@example.com',
      }),
    });

    await expect(
      firebaseUserDirectoryService.getById('other-user')
    ).resolves.toEqual({
      id: 'other-user',
      displayName: 'Alex',
      handle: 'AlexReviews',
      handleNormalized: 'alexreviews',
      profileImage: 'https://example.com/avatar.jpg',
      accountPrivacy: 'private',
    });
  });
});
