import { fireEvent, render, waitFor } from '@testing-library/react-native';
import PreferencesScreen from '@/app/(tabs)/profile/preferences';
import { communityPreferenceRepository, settingsService } from '@/services';
import {
  beginCommunitySessionForUser,
  getCommunityScrollOffset,
  getCurrentCommunityPreferences,
  setCommunityScrollOffset,
} from '@/services/community/communitySessionState';

const mockDispatch = jest.fn();

jest.mock('expo-router', () => ({
  useNavigation: () => ({ dispatch: mockDispatch }),
}));

jest.mock('expo-router/react-navigation', () => ({
  usePreventRemove: jest.fn(),
}));

jest.mock('@/store/userStore', () => ({
  userStore: (selector: (state: { userId: string }) => unknown) =>
    selector({ userId: 'owner-1' }),
}));

jest.mock('@/services', () => ({
  communityPreferenceRepository: {
    setForUser: jest.fn(),
  },
  settingsService: {
    get: jest.fn(),
    setCommunityDefaults: jest.fn(),
  },
}));

describe('Preferences screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (settingsService.get as jest.Mock).mockResolvedValue({
      defaultMediaFilter: 'all',
      defaultSort: 'newest',
    });
    (settingsService.setCommunityDefaults as jest.Mock).mockResolvedValue(
      undefined
    );
    (communityPreferenceRepository.setForUser as jest.Mock).mockResolvedValue(
      undefined
    );
  });

  it('saves Community defaults separately from device-only active options', async () => {
    beginCommunitySessionForUser('owner-1');
    setCommunityScrollOffset('owner-1', 280);
    const screen = render(<PreferencesScreen />);

    await screen.findByText('Community defaults');
    fireEvent.press(screen.getByText('TV Shows'));
    fireEvent.press(screen.getByText('Highest rated'));
    fireEvent.press(screen.getByText('Save Preferences'));

    await waitFor(() => {
      expect(settingsService.setCommunityDefaults).toHaveBeenCalledWith(
        'owner-1',
        {
          defaultMediaFilter: 'tv',
          defaultSort: 'highestRated',
        }
      );
    });
    expect(communityPreferenceRepository.setForUser).toHaveBeenCalledWith(
      'owner-1',
      { mediaFilter: 'tv', sort: 'highest' }
    );
    expect(getCurrentCommunityPreferences('owner-1')).toEqual({
      mediaFilter: 'tv',
      sort: 'highest',
    });
    expect(getCommunityScrollOffset('owner-1')).toBe(0);
    expect(await screen.findByText('Preferences saved')).toBeTruthy();
  });

  it('does not show the old device-reset action', async () => {
    const screen = render(<PreferencesScreen />);

    await screen.findByText('Community defaults');
    expect(
      screen.queryByText("Reset this device's Community view")
    ).toBeNull();
  });
});
