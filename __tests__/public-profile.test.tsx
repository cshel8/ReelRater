import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import PublicProfileScreen from '@/app/(tabs)/profile/[userId]';
import {
  followService,
  publicProfileReviewService,
  userDirectoryService,
} from '@/services';

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
  },
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
  publicProfileReviewService: {
    listPage: jest.fn(),
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
    (publicProfileReviewService.listPage as jest.Mock).mockResolvedValue({
      reviews: [],
      canSeeFollowersOnly: false,
      nextCursor: null,
    });
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

  it('distinguishes public-only access from an active follower with no reviews', async () => {
    const publicOnlyScreen = render(<PublicProfileScreen />);

    expect(await publicOnlyScreen.findByText('No public reviews yet')).toBeTruthy();
    expect(
      publicOnlyScreen.getByText(
        'Follow @AlexMovies to see reviews they share with followers.'
      )
    ).toBeTruthy();
    publicOnlyScreen.unmount();

    (followService.getStatus as jest.Mock).mockReset().mockResolvedValue('active');
    (publicProfileReviewService.listPage as jest.Mock).mockResolvedValue({
      reviews: [],
      canSeeFollowersOnly: true,
      nextCursor: null,
    });
    const followerScreen = render(<PublicProfileScreen />);

    expect(await followerScreen.findByText('No reviews yet')).toBeTruthy();
    expect(
      followerScreen.getByText("Alex hasn't shared any reviews yet.")
    ).toBeTruthy();
  });

  it('shows reviews visible to the current viewer', async () => {
    (publicProfileReviewService.listPage as jest.Mock).mockResolvedValue({
      canSeeFollowersOnly: true,
      nextCursor: null,
      reviews: [
        {
          id: 'review-1',
          authorId: 'other-user',
          movieTitle: 'Arrival',
          movie: {
            matchStatus: 'manual',
            catalogId: null,
            title: 'Arrival',
            releaseYear: null,
            genres: [],
            posterUrl: null,
          },
          reviewText: 'Thoughtful science fiction.',
          rating: '5',
          visibility: 'followers',
          createdAt: '2026-07-19T12:00:00.000Z',
          syncStatus: 'synced',
        },
      ],
    });
    const screen = render(<PublicProfileScreen />);

    expect(await screen.findByText('Thoughtful science fiction.')).toBeTruthy();
    expect(publicProfileReviewService.listPage).toHaveBeenCalledWith(
      'current-user',
      'other-user',
      { maximumResults: 10 }
    );
    expect(screen.getByLabelText('5 out of 5 stars')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Read review of Arrival'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/profile/review/[reviewId]',
      params: {
        authorId: 'other-user',
        reviewId: 'review-1',
      },
    });
  });

  it('opens review details inside the Community stack when requested', async () => {
    (publicProfileReviewService.listPage as jest.Mock).mockResolvedValue({
      canSeeFollowersOnly: false,
      nextCursor: null,
      reviews: [
        {
          id: 'review-1',
          authorId: 'other-user',
          movieTitle: 'Arrival',
          reviewText: 'Thoughtful science fiction.',
          rating: '5',
          visibility: 'public',
          createdAt: '2026-07-19T12:00:00.000Z',
          syncStatus: 'synced',
        },
      ],
    });
    const screen = render(<PublicProfileScreen routeBase="community" />);

    fireEvent.press(
      await screen.findByLabelText('Read review of Arrival')
    );

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/community/review/[reviewId]',
      params: {
        authorId: 'other-user',
        reviewId: 'review-1',
      },
    });
  });

  it('loads another bounded page of reviews on request', async () => {
    (publicProfileReviewService.listPage as jest.Mock)
      .mockResolvedValueOnce({
        canSeeFollowersOnly: false,
        nextCursor: 'page-2',
        reviews: [
          {
            id: 'review-1',
            authorId: 'other-user',
            movieTitle: 'Arrival',
            reviewText: 'Thoughtful science fiction.',
            rating: '5',
            visibility: 'public',
            createdAt: '2026-07-19T12:00:00.000Z',
            syncStatus: 'synced',
          },
        ],
      })
      .mockResolvedValueOnce({
        canSeeFollowersOnly: false,
        nextCursor: null,
        reviews: [
          {
            id: 'review-2',
            authorId: 'other-user',
            movieTitle: 'Parasite',
            reviewText: 'Brilliant social commentary.',
            rating: '5',
            visibility: 'public',
            createdAt: '2026-07-18T12:00:00.000Z',
            syncStatus: 'synced',
          },
        ],
      });
    const screen = render(<PublicProfileScreen />);

    await screen.findByText('Arrival');
    fireEvent.press(screen.getByText('Load More'));

    expect(await screen.findByText('Parasite')).toBeTruthy();
    expect(publicProfileReviewService.listPage).toHaveBeenLastCalledWith(
      'current-user',
      'other-user',
      {
        cursor: 'page-2',
        maximumResults: 10,
      }
    );
    expect(screen.queryByText('Load More')).toBeNull();
  });
});
