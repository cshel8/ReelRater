import AsyncStorage from '@react-native-async-storage/async-storage';
import { resolveInitialCommunityPreferences } from '@/services/community/communityPreferenceResolver';
import { asyncStorageCommunityPreferenceRepository } from '@/services/local/asyncStorageCommunityPreferenceRepository';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

describe('Community local preferences', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('stores last-active values under an account-specific key', async () => {
    await asyncStorageCommunityPreferenceRepository.setForUser('user-1', {
      mediaFilter: 'tv',
      sort: 'highest',
    });

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      'reelrater:community:last-active:user-1',
      '{"mediaFilter":"tv","sort":"highest"}'
    );
  });

  it('ignores malformed stored data', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('{not json');

    await expect(
      asyncStorageCommunityPreferenceRepository.getForUser('user-1')
    ).resolves.toBeNull();
  });

  it('uses local values before account defaults, then falls back safely', () => {
    const accountSettings = {
      accountPrivacy: 'public' as const,
      defaultReviewVisibility: 'private' as const,
      defaultMediaFilter: 'movie' as const,
      defaultSort: 'lowestRated' as const,
    };

    expect(
      resolveInitialCommunityPreferences(
        { mediaFilter: 'tv', sort: 'highest' },
        accountSettings
      )
    ).toEqual({ mediaFilter: 'tv', sort: 'highest' });
    expect(resolveInitialCommunityPreferences(null, accountSettings)).toEqual({
      mediaFilter: 'movie',
      sort: 'lowest',
    });
    expect(resolveInitialCommunityPreferences(null, null)).toEqual({
      mediaFilter: 'all',
      sort: 'newest',
    });
    expect(
      resolveInitialCommunityPreferences(null, {
        ...accountSettings,
        defaultMediaFilter: 'not-valid',
      } as unknown as typeof accountSettings)
    ).toEqual({ mediaFilter: 'all', sort: 'newest' });
  });
});
