import { fireEvent, render, waitFor } from '@testing-library/react-native';
import PublicProfileScreen from '@/app/(tabs)/profile/[userId]';
import { followService, userDirectoryService } from '@/services';

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ userId: 'other-user' }),
}));

jest.mock('@/store/userStore', () => ({
  userStore: (selector: (state: { userId: string }) => unknown) =>
    selector({ userId: 'current-user' }),
}));

jest.mock('@/services', () => ({
  followService: {
    follow: jest.fn(),
    getStatus: jest.fn(),
    isFollowing: jest.fn(),
    unfollow: jest.fn(),
  },
  userDirectoryService: {
    getById: jest.fn(),
  },
}));

describe('Public profile screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (userDirectoryService.getById as jest.Mock).mockResolvedValue({
      id: 'other-user',
      displayName: 'Alex',
      handle: 'AlexMovies',
      handleNormalized: 'alexmovies',
      profileImage: null,
      accountPrivacy: 'public',
    });
    (followService.getStatus as jest.Mock).mockResolvedValue(null);
    (followService.follow as jest.Mock).mockResolvedValue(undefined);
    (followService.getStatus as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce('active');
  });

  it('follows the viewed account and updates the button state', async () => {
    const screen = render(<PublicProfileScreen />);

    fireEvent.press(await screen.findByText('Follow'));

    await waitFor(() => {
      expect(followService.follow).toHaveBeenCalledWith(
        'current-user',
        'other-user'
      );
      expect(screen.getByText('Following')).toBeTruthy();
    });
  });
});
