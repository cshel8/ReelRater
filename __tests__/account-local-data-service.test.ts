const mockRunAsync = jest.fn();
const mockTransaction = { runAsync: mockRunAsync };

jest.mock('@/database/sqliteDatabase', () => ({
  runSQLiteTransaction: jest.fn(async (operation) => operation(mockTransaction)),
}));
jest.mock('@/services/community/communitySessionState', () => ({
  beginCommunitySessionForUser: jest.fn(),
}));
jest.mock('@/services/local/asyncStorageCommunityPreferenceRepository', () => ({
  asyncStorageCommunityPreferenceRepository: { removeForUser: jest.fn() },
}));

import { accountLocalDataService } from '@/services/local/accountLocalDataService';

describe('account local data cleanup', () => {
  beforeEach(() => jest.clearAllMocks());

  it('clears Community snapshots and feed membership for the deleted viewer', async () => {
    await accountLocalDataService.removeForUser('viewer-a');

    expect(mockRunAsync).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM community_cached_feed_entries'),
      'viewer-a'
    );
    expect(mockRunAsync).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM community_cached_reviews'),
      'viewer-a'
    );
  });
});
