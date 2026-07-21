import { fireEvent, render, waitFor } from '@testing-library/react-native';
import FollowRequestsScreen from '@/app/(tabs)/profile/follow-requests';
import { followService, userDirectoryService } from '@/services';

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
    approveFollower: jest.fn(),
    listPendingRequests: jest.fn(),
    rejectFollower: jest.fn(),
  },
  userDirectoryService: {
    getById: jest.fn(),
  },
}));

describe('Follow requests screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (followService.listPendingRequests as jest.Mock).mockResolvedValue([
      {
        followerId: 'requester-1',
        followedUserId: 'owner-1',
        status: 'pending',
        createdAt: '2026-07-19T12:00:00.000Z',
        acceptedAt: null,
      },
    ]);
    (userDirectoryService.getById as jest.Mock).mockResolvedValue({
      id: 'requester-1',
      displayName: 'Alex',
      handle: 'AlexMovies',
      handleNormalized: 'alexmovies',
      profileImage: null,
      accountPrivacy: 'public',
    });
    (followService.approveFollower as jest.Mock).mockResolvedValue(undefined);
  });

  it('allows the private account owner to approve a request', async () => {
    const screen = render(<FollowRequestsScreen />);

    fireEvent.press(
      await screen.findByLabelText(
        'Approve @AlexMovies',
        {},
        { timeout: 3000 }
      )
    );

    await waitFor(() => {
      expect(followService.approveFollower).toHaveBeenCalledWith(
        'owner-1',
        'requester-1'
      );
      expect(screen.queryByText('@AlexMovies')).toBeNull();
    });
  });
});
