import {
  deleteDoc,
  getDoc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { firebaseFollowService } from '@/services/firebase/followService';

const mockTransactionGet = jest.fn();
const mockTransactionSet = jest.fn();

jest.mock('@/config/firebase', () => ({
  db: { name: 'test-database' },
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn((_database, ...segments: string[]) => ({
    path: segments.join('/'),
  })),
  collectionGroup: jest.fn((_database, name: string) => ({
    collectionGroup: name,
  })),
  deleteDoc: jest.fn(),
  doc: jest.fn((_database, ...segments: string[]) => ({
    path: segments.join('/'),
  })),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  query: jest.fn((...constraints: unknown[]) => ({ constraints })),
  runTransaction: jest.fn(async (_database, callback) =>
    callback({
      get: mockTransactionGet,
      set: mockTransactionSet,
    })
  ),
  serverTimestamp: jest.fn(() => 'server-timestamp'),
  updateDoc: jest.fn(),
  where: jest.fn((field: string, operator: string, value: string) => ({
    field,
    operator,
    value,
  })),
}));

describe('Firebase follow service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTransactionGet.mockImplementation(async (reference) => {
      if (reference.path === 'users/alex-id') {
        return {
          exists: () => true,
          data: () => ({ accountPrivacy: 'public' }),
        };
      }
      return {
        exists: () => false,
      };
    });
  });

  it('creates one active, one-way relationship at a deterministic path', async () => {
    await firebaseFollowService.follow('connor-id', 'alex-id');

    expect(runTransaction).toHaveBeenCalledTimes(1);
    expect(mockTransactionSet).toHaveBeenCalledWith(
      {
        path: 'followRelationships/alex-id/followers/connor-id',
      },
      {
        followerId: 'connor-id',
        followedUserId: 'alex-id',
        status: 'active',
        createdAt: 'server-timestamp',
        acceptedAt: 'server-timestamp',
      }
    );
    expect(serverTimestamp).toHaveBeenCalledTimes(2);
  });

  it('does not create a duplicate relationship', async () => {
    mockTransactionGet.mockResolvedValueOnce({
      exists: () => true,
    });

    await firebaseFollowService.follow('connor-id', 'alex-id');

    expect(mockTransactionSet).not.toHaveBeenCalled();
  });

  it('creates a pending request for a private account', async () => {
    mockTransactionGet.mockImplementation(async (reference) => {
      if (reference.path === 'users/alex-id') {
        return {
          exists: () => true,
          data: () => ({ accountPrivacy: 'private' }),
        };
      }
      return {
        exists: () => false,
      };
    });

    await firebaseFollowService.follow('connor-id', 'alex-id');

    expect(mockTransactionSet).toHaveBeenCalledWith(
      { path: 'followRelationships/alex-id/followers/connor-id' },
      expect.objectContaining({
        status: 'pending',
        acceptedAt: null,
      })
    );
  });

  it('prevents an account from following itself', async () => {
    await expect(
      firebaseFollowService.follow('connor-id', 'connor-id')
    ).rejects.toThrow('You cannot follow your own account.');

    expect(runTransaction).not.toHaveBeenCalled();
  });

  it('recognizes only active relationships as following', async () => {
    (getDoc as jest.Mock)
      .mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ status: 'pending' }),
      })
      .mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ status: 'active' }),
      });

    await expect(
      firebaseFollowService.isFollowing('connor-id', 'alex-id')
    ).resolves.toBe(false);
    await expect(
      firebaseFollowService.isFollowing('connor-id', 'alex-id')
    ).resolves.toBe(true);
  });

  it('deletes the same one-way relationship when unfollowing', async () => {
    await firebaseFollowService.unfollow('connor-id', 'alex-id');

    expect(deleteDoc).toHaveBeenCalledWith({
      path: 'followRelationships/alex-id/followers/connor-id',
    });
  });

  it('lets the followed account remove a follower', async () => {
    await firebaseFollowService.removeFollower('alex-id', 'connor-id');

    expect(deleteDoc).toHaveBeenCalledWith({
      path: 'followRelationships/alex-id/followers/connor-id',
    });
  });
});
