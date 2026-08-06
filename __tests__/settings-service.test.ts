import {
  getDoc,
  runTransaction,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { firebaseSettingsService } from '@/services/firebase/settingsService';

jest.mock('@/config/firebase', () => ({
  db: { name: 'test-database' },
}));

jest.mock('firebase/firestore', () => ({
  doc: jest.fn((_database, ...segments: string[]) => ({
    path: segments.join('/'),
  })),
  getDoc: jest.fn(),
  runTransaction: jest.fn(),
  serverTimestamp: jest.fn(() => 'server-timestamp'),
  setDoc: jest.fn(),
  writeBatch: jest.fn(),
}));

describe('Firebase settings service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns null when an account has no saved settings yet', async () => {
    (getDoc as jest.Mock).mockResolvedValue({
      exists: () => false,
    });

    await expect(firebaseSettingsService.get('user-1')).resolves.toBeNull();
  });

  it('stores the future-review default in an owner settings document', async () => {
    await firebaseSettingsService.setDefaultReviewVisibility(
      'user-1',
      'followers'
    );

    expect(setDoc).toHaveBeenCalledWith(
      { path: 'userSettings/user-1' },
      {
        defaultReviewVisibility: 'followers',
        updatedAt: 'server-timestamp',
      },
      { merge: true }
    );
    expect(serverTimestamp).toHaveBeenCalled();
  });

  it('uses Community defaults when older settings documents have no fields', async () => {
    (getDoc as jest.Mock)
      .mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ defaultReviewVisibility: 'followers' }),
      })
      .mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ accountPrivacy: 'private' }),
      });

    await expect(firebaseSettingsService.get('user-1')).resolves.toEqual({
      accountPrivacy: 'private',
      defaultReviewVisibility: 'followers',
      defaultMediaFilter: 'all',
      defaultSort: 'newest',
    });
  });

  it('initializes new accounts without overwriting valid saved values', async () => {
    const get = jest.fn().mockResolvedValue({
      exists: () => true,
      data: () => ({
        defaultReviewVisibility: 'public',
        defaultMediaFilter: 'tv',
        defaultSort: 'highestRated',
      }),
    });
    const set = jest.fn();
    (runTransaction as jest.Mock).mockImplementation(
      async (_database, operation) => operation({ get, set })
    );

    await firebaseSettingsService.initializeForNewUser('user-1', 'private');

    expect(set).toHaveBeenCalledWith(
      { path: 'userSettings/user-1' },
      {
        defaultReviewVisibility: 'public',
        defaultMediaFilter: 'tv',
        defaultSort: 'highestRated',
        updatedAt: 'server-timestamp',
      },
      { merge: true }
    );
  });

  it('assigns Community defaults for a new settings document', async () => {
    const get = jest.fn().mockResolvedValue({
      exists: () => false,
      data: () => ({}),
    });
    const set = jest.fn();
    (runTransaction as jest.Mock).mockImplementation(
      async (_database, operation) => operation({ get, set })
    );

    await firebaseSettingsService.initializeForNewUser('user-1', 'followers');

    expect(set).toHaveBeenCalledWith(
      { path: 'userSettings/user-1' },
      {
        defaultReviewVisibility: 'followers',
        defaultMediaFilter: 'all',
        defaultSort: 'newest',
        updatedAt: 'server-timestamp',
      },
      { merge: true }
    );
  });

  it('updates account privacy and the review default atomically', async () => {
    const update = jest.fn();
    const set = jest.fn();
    const commit = jest.fn();
    (writeBatch as jest.Mock).mockReturnValue({ update, set, commit });

    await firebaseSettingsService.setPrivacyPreferences('user-1', {
      accountPrivacy: 'private',
      defaultReviewVisibility: 'followers',
    });

    expect(update).toHaveBeenCalledWith(
      { path: 'users/user-1' },
      { accountPrivacy: 'private' }
    );
    expect(set).toHaveBeenCalledWith(
      { path: 'userSettings/user-1' },
      {
        defaultReviewVisibility: 'followers',
        updatedAt: 'server-timestamp',
      },
      { merge: true }
    );
    expect(commit).toHaveBeenCalled();
  });
});
