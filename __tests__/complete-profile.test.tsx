import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import CompleteProfile from '@/app/(auth)/complete-profile';
import { profileService, settingsService } from '@/services';

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
    setDisplayName: jest.fn(),
    setHandle: jest.fn(),
    setProfileImage: jest.fn(),
    setUserId: jest.fn(),
    userId: 'user-1',
  }),
}));

jest.mock('@/services', () => ({
  authService: { signOut: jest.fn() },
  profileService: { create: jest.fn() },
  settingsService: { setDefaultReviewVisibility: jest.fn() },
}));

describe('Complete profile screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('normalizes the handle and continues after profile creation', async () => {
    (profileService.create as jest.Mock).mockResolvedValue({
      id: 'user-1',
      displayName: 'Connor Sheldon',
      handle: 'ConnorMovies',
      handleNormalized: 'connormovies',
      profileImage: null,
      accountPrivacy: 'public',
    });
    const { getByText } = render(<CompleteProfile />);

    fireEvent.press(getByText('Continue'));

    await waitFor(() => {
      expect(profileService.create).toHaveBeenCalledWith('user-1', {
        displayName: 'Connor Sheldon',
        handle: 'ConnorMovies',
        handleNormalized: 'connormovies',
        accountPrivacy: 'public',
      });
      expect(settingsService.setDefaultReviewVisibility).toHaveBeenCalledWith(
        'user-1',
        'private'
      );
      expect(router.replace).toHaveBeenCalledWith('/home');
    });
  });
});
