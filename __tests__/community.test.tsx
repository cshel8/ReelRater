import { fireEvent, render } from '@testing-library/react-native';
import { router } from 'expo-router';
import CommunityScreen from '@/app/(tabs)/community';
import { communityFeedService } from '@/services';

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
  },
  useFocusEffect: (callback: () => void) => {
    const React = require('react');
    React.useEffect(callback, [callback]);
  },
}));

jest.mock('@/store/userStore', () => ({
  userStore: (selector: (state: { userId: string }) => unknown) =>
    selector({ userId: 'viewer-1' }),
}));

jest.mock('@/services', () => ({
  communityFeedService: {
    list: jest.fn(),
  },
}));

describe('Community screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('encourages viewers who follow nobody to find people', async () => {
    (communityFeedService.list as jest.Mock).mockResolvedValue({
      reviews: [],
      followsAnyone: false,
    });
    const screen = render(<CommunityScreen />);

    fireEvent.press(await screen.findByText('Find People'));

    expect(router.push).toHaveBeenCalledWith('/community/find-people');
  });

  it('distinguishes an empty feed from following nobody', async () => {
    (communityFeedService.list as jest.Mock).mockResolvedValue({
      reviews: [],
      followsAnyone: true,
    });
    const screen = render(<CommunityScreen />);

    expect(await screen.findByText('No community reviews yet')).toBeTruthy();
    expect(screen.queryByText('Find People')).toBeNull();
  });

  it('renders a shared review with its author', async () => {
    (communityFeedService.list as jest.Mock).mockResolvedValue({
      followsAnyone: true,
      reviews: [
        {
          id: 'review-1',
          authorId: 'author-1',
          author: {
            id: 'author-1',
            displayName: 'Alex',
            handle: 'AlexMovies',
            handleNormalized: 'alexmovies',
            profileImage: null,
            accountPrivacy: 'public',
          },
          movieTitle: 'Arrival',
          reviewText: 'Thoughtful science fiction.',
          rating: '5',
          visibility: 'followers',
          createdAt: '2026-07-19T12:00:00.000Z',
          syncStatus: 'synced',
        },
      ],
    });
    const screen = render(<CommunityScreen />);

    expect(await screen.findByText('Arrival')).toBeTruthy();
    expect(screen.getByText('Alex')).toBeTruthy();
    expect(screen.getByText('@AlexMovies')).toBeTruthy();
    expect(screen.getByText('Followers')).toBeTruthy();
  });
});
