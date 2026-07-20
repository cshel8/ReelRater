import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import PrivacyVisibilityScreen from '@/app/(tabs)/profile/privacy-visibility';
import { followService, settingsService } from '@/services';

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useFocusEffect: (callback: () => void) => {
    const React = require('react');
    React.useEffect(callback, [callback]);
  },
}));

jest.mock('@/store/userStore', () => ({
  userStore: (selector: (state: { userId: string }) => unknown) =>
    selector({ userId: 'owner-1' }),
}));

jest.mock('@/services', () => ({
  followService: {
    listPendingRequests: jest.fn(),
  },
  settingsService: {
    get: jest.fn(),
    setPrivacyPreferences: jest.fn(),
  },
}));

describe('Privacy and visibility screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (settingsService.get as jest.Mock).mockResolvedValue({
      accountPrivacy: 'private',
      defaultReviewVisibility: 'followers',
    });
    (settingsService.setPrivacyPreferences as jest.Mock).mockResolvedValue(
      undefined
    );
    (followService.listPendingRequests as jest.Mock).mockResolvedValue([
      {
        followerId: 'requester-1',
        followedUserId: 'owner-1',
        status: 'pending',
        createdAt: '2026-07-19T12:00:00.000Z',
        acceptedAt: null,
      },
      {
        followerId: 'requester-2',
        followedUserId: 'owner-1',
        status: 'pending',
        createdAt: '2026-07-19T12:01:00.000Z',
        acceptedAt: null,
      },
    ]);
  });

  it('offers to review pending requests before making an account public', async () => {
    let promptButtons: Parameters<typeof Alert.alert>[2];
    const alertSpy = jest
      .spyOn(Alert, 'alert')
      .mockImplementation((title, _message, buttons) => {
        if (title === 'Make account public?') {
          promptButtons = buttons;
        }
      });

    const screen = render(<PrivacyVisibilityScreen />);

    await screen.findByText('Save Settings');
    fireEvent.press(screen.getByText('Public Account'));
    fireEvent.press(screen.getByText('Save Settings'));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        'Make account public?',
        expect.stringContaining('2 pending follower requests'),
        expect.any(Array)
      );
    });
    expect(settingsService.setPrivacyPreferences).not.toHaveBeenCalled();

    promptButtons?.find((button) => button.text === 'Review Requests')
      ?.onPress?.();

    expect(router.push).toHaveBeenCalledWith('/profile/follow-requests');
  });

  it('leaves requests pending while saving public account privacy', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((title, _message, buttons) => {
      if (title === 'Make account public?') {
        buttons?.find((button) => button.text === 'Make Public')?.onPress?.();
      }
    });

    const screen = render(<PrivacyVisibilityScreen />);

    await screen.findByText('Save Settings');
    fireEvent.press(screen.getByText('Public Account'));
    fireEvent.press(screen.getByText('Save Settings'));

    await waitFor(() => {
      expect(settingsService.setPrivacyPreferences).toHaveBeenCalledWith(
        'owner-1',
        {
          accountPrivacy: 'public',
          defaultReviewVisibility: 'followers',
        }
      );
    });
    expect(followService.listPendingRequests).toHaveBeenCalledWith('owner-1');
  });
});
