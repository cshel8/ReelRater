import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Alert, ScrollView } from 'react-native';
import CompleteProfile from '@/app/(auth)/complete-profile';
import {
  accountDeletionService,
  profileService,
  settingsService,
  socialGraphInitializationService,
} from '@/services';

const mockSetDisplayName = jest.fn();
const mockSetHandle = jest.fn();
const mockSetProfileImage = jest.fn();
const mockSetUserId = jest.fn();

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

jest.mock('expo-router', () => ({
  router: {
    replace: jest.fn(),
  },
}));

jest.mock('@/store/userStore', () => ({
  userStore: () => ({
    displayName: 'Connor Sheldon',
    handle: 'ConnorMovies',
    setDisplayName: mockSetDisplayName,
    setHandle: mockSetHandle,
    setProfileImage: mockSetProfileImage,
    setUserId: mockSetUserId,
    userId: 'user-1',
  }),
}));

jest.mock('@/services', () => ({
  accountDeletionService: { deleteCurrentAccount: jest.fn() },
  authService: { signOut: jest.fn() },
  profileService: { create: jest.fn() },
  settingsService: { initializeForNewUser: jest.fn() },
  socialGraphInitializationService: { initializeCounters: jest.fn() },
}));

describe('Complete profile screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps the expanded onboarding form scrollable and renders its existing fields', () => {
    const screen = render(<CompleteProfile />);

    expect(screen.getByText('Display Name')).toBeTruthy();
    expect(screen.getByText('Handle')).toBeTruthy();
    expect(screen.getByText('Account privacy')).toBeTruthy();
    expect(screen.getByText('Default review visibility')).toBeTruthy();
    expect(screen.getByText('Continue')).toBeTruthy();
    expect(screen.getByText('Delete Account')).toBeTruthy();

    const scrollView = screen.UNSAFE_getByType(ScrollView);
    expect(scrollView.props.contentContainerStyle).toMatchObject({ flexGrow: 1 });
    expect(scrollView.props.contentContainerStyle.flex).toBeUndefined();
  });

  it('normalizes the handle and continues after profile creation', async () => {
    (profileService.create as jest.Mock).mockResolvedValue({
      id: 'user-1',
      displayName: 'Connor Sheldon',
      handle: 'ConnorMovies',
      handleNormalized: 'connormovies',
      profileImage: null,
      accountPrivacy: 'public',
      followerCount: null,
      followingCount: null,
    });
    (socialGraphInitializationService.initializeCounters as jest.Mock)
      .mockResolvedValue(undefined);
    const { getByText } = render(<CompleteProfile />);

    fireEvent.press(getByText('Continue'));

    await waitFor(() => {
      expect(profileService.create).toHaveBeenCalledWith('user-1', {
        displayName: 'Connor Sheldon',
        handle: 'ConnorMovies',
        handleNormalized: 'connormovies',
        accountPrivacy: 'public',
      });
      expect(settingsService.initializeForNewUser).toHaveBeenCalledWith(
        'user-1',
        'private'
      );
      expect(socialGraphInitializationService.initializeCounters).toHaveBeenCalledWith(
        'user-1'
      );
      expect(router.replace).toHaveBeenCalledWith('/home');
    });
  });

  it('uses the existing password-confirmed deletion service for an incomplete profile', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    (accountDeletionService.deleteCurrentAccount as jest.Mock).mockResolvedValue({
      localCleanupComplete: true,
    });
    const screen = render(<CompleteProfile />);

    fireEvent.press(screen.getByText('Delete Account'));
    const warningButtons = alertSpy.mock.calls.at(-1)?.[2];
    act(() => warningButtons?.find((button) => button.text === 'Continue')?.onPress?.());

    fireEvent.changeText(screen.getByLabelText('Current password'), 'password123');
    fireEvent.press(screen.getByText('Delete Permanently'));

    await waitFor(() => {
      expect(accountDeletionService.deleteCurrentAccount).toHaveBeenCalledWith('password123');
      expect(mockSetUserId).toHaveBeenCalledWith(null);
      expect(router.replace).toHaveBeenCalledWith('/login');
    });
  });

  it('keeps an incomplete-profile user signed in when remote deletion is retryable', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    (accountDeletionService.deleteCurrentAccount as jest.Mock).mockRejectedValue(
      new Error('Some account data may already have been removed. Please try again to finish deleting your account.')
    );
    const screen = render(<CompleteProfile />);

    fireEvent.press(screen.getByText('Delete Account'));
    const warningButtons = alertSpy.mock.calls.at(-1)?.[2];
    act(() => warningButtons?.find((button) => button.text === 'Continue')?.onPress?.());
    fireEvent.changeText(screen.getByLabelText('Current password'), 'password123');
    fireEvent.press(screen.getByText('Delete Permanently'));

    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith(
      'Could not delete account',
      expect.stringMatching(/may already have been removed/i)
    ));
    expect(mockSetUserId).not.toHaveBeenCalledWith(null);
    expect(router.replace).not.toHaveBeenCalledWith('/login');
  });
});
