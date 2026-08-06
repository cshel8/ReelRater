import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import CommunityScreen from '@/app/(tabs)/community';
import {
  communityFeedService,
  communityPreferenceRepository,
  settingsService,
} from '@/services';
import {
  beginCommunitySessionForUser,
  getCommunityScrollOffset,
  setCommunityScrollOffset,
} from '@/services/community/communitySessionState';

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
  },
  Stack: {
    Screen: ({
      options,
    }: {
      options?: { headerLeft?: () => unknown; headerRight?: () => unknown };
    }) => (
      <>
        {options?.headerLeft?.() ?? null}
        {options?.headerRight?.() ?? null}
      </>
    ),
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
  communityPreferenceRepository: {
    getForUser: jest.fn(),
    setForUser: jest.fn(),
  },
  settingsService: {
    get: jest.fn(),
  },
}));

describe('Community screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (communityPreferenceRepository.getForUser as jest.Mock).mockResolvedValue(
      null
    );
    (communityPreferenceRepository.setForUser as jest.Mock).mockResolvedValue(
      undefined
    );
    (settingsService.get as jest.Mock).mockResolvedValue(null);
  });

  it('encourages viewers who follow nobody to find people', async () => {
    (communityFeedService.list as jest.Mock).mockResolvedValue({
      reviews: [],
      followsAnyone: false,
    });
    const screen = render(<CommunityScreen />);

    await screen.findByText('Find your community');
    fireEvent.press(screen.getByText('Find People'));

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

    fireEvent.press(screen.getByLabelText("View Alex's profile"));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/community/[userId]',
      params: { userId: 'author-1' },
    });

    fireEvent.press(screen.getByLabelText('Read review of Arrival'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/community/review/[reviewId]',
      params: {
        authorId: 'author-1',
        reviewId: 'review-1',
      },
    });
  });

  it('passes the selected media filter and rating sort to the feed service', async () => {
    (communityFeedService.list as jest.Mock).mockResolvedValue({
      reviews: [],
      followsAnyone: true,
    });
    const screen = render(<CommunityScreen />);

    await screen.findByText('No community reviews yet');
    fireEvent.press(
      screen.getByLabelText('Filter and sort community reviews')
    );
    fireEvent.press(screen.getByText('TV Shows'));
    fireEvent.press(screen.getByText('Highest rated'));
    fireEvent.press(screen.getByText('Done'));

    await waitFor(() => {
      expect(communityFeedService.list).toHaveBeenLastCalledWith('viewer-1', {
        mediaFilter: 'tv',
        sort: 'highest',
      });
    });
    expect(await screen.findByText('No TV show reviews yet')).toBeTruthy();
    expect(communityPreferenceRepository.setForUser).toHaveBeenCalledWith(
      'viewer-1',
      { mediaFilter: 'tv', sort: 'highest' }
    );
  });

  it('shows Reset to defaults only when active Community options differ from saved defaults', async () => {
    (communityPreferenceRepository.getForUser as jest.Mock).mockResolvedValue({
      mediaFilter: 'tv',
      sort: 'highest',
    });
    (settingsService.get as jest.Mock).mockResolvedValue({
      accountPrivacy: 'public',
      defaultReviewVisibility: 'private',
      defaultMediaFilter: 'all',
      defaultSort: 'newest',
    });
    (communityFeedService.list as jest.Mock).mockResolvedValue({
      reviews: [],
      followsAnyone: true,
    });
    const screen = render(<CommunityScreen />);

    await screen.findByText('No TV show reviews yet');
    fireEvent.press(
      screen.getByLabelText('Filter and sort community reviews')
    );

    expect(screen.getByText('Reset to defaults')).toBeTruthy();
  });

  it('hides Reset to defaults when active options already match saved defaults', async () => {
    (settingsService.get as jest.Mock).mockResolvedValue({
      accountPrivacy: 'public',
      defaultReviewVisibility: 'private',
      defaultMediaFilter: 'all',
      defaultSort: 'newest',
    });
    (communityFeedService.list as jest.Mock).mockResolvedValue({
      reviews: [],
      followsAnyone: true,
    });
    const screen = render(<CommunityScreen />);

    await screen.findByText('No community reviews yet');
    fireEvent.press(
      screen.getByLabelText('Filter and sort community reviews')
    );

    expect(screen.queryByText('Reset to defaults')).toBeNull();
  });

  it('restores saved defaults locally without changing the Firestore defaults', async () => {
    (communityPreferenceRepository.getForUser as jest.Mock).mockResolvedValue({
      mediaFilter: 'tv',
      sort: 'highest',
    });
    (settingsService.get as jest.Mock).mockResolvedValue({
      accountPrivacy: 'public',
      defaultReviewVisibility: 'private',
      defaultMediaFilter: 'movie',
      defaultSort: 'oldest',
    });
    (communityFeedService.list as jest.Mock).mockResolvedValue({
      reviews: [],
      followsAnyone: true,
    });
    const screen = render(<CommunityScreen />);

    await screen.findByText('No TV show reviews yet');
    fireEvent.press(
      screen.getByLabelText('Filter and sort community reviews')
    );
    fireEvent.press(screen.getByText('Reset to defaults'));

    await waitFor(() => {
      expect(communityPreferenceRepository.setForUser).toHaveBeenCalledWith(
        'viewer-1',
        { mediaFilter: 'movie', sort: 'oldest' }
      );
      expect(communityFeedService.list).toHaveBeenLastCalledWith('viewer-1', {
        mediaFilter: 'movie',
        sort: 'oldest',
      });
    });
    expect(settingsService.get).toHaveBeenCalledTimes(1);
  });

  it('keeps Community search text while Reset to defaults changes the view', async () => {
    (communityPreferenceRepository.getForUser as jest.Mock).mockResolvedValue({
      mediaFilter: 'tv',
      sort: 'highest',
    });
    (settingsService.get as jest.Mock).mockResolvedValue({
      accountPrivacy: 'public',
      defaultReviewVisibility: 'private',
      defaultMediaFilter: 'movie',
      defaultSort: 'newest',
    });
    (communityFeedService.list as jest.Mock).mockResolvedValue({
      reviews: [],
      followsAnyone: true,
    });
    const screen = render(<CommunityScreen />);

    await screen.findByText('No TV show reviews yet');
    fireEvent.press(screen.getByLabelText('Search community reviews'));
    fireEvent.changeText(
      screen.getAllByLabelText('Search community reviews')[1],
      'Batman'
    );
    fireEvent.press(
      screen.getByLabelText('Filter and sort community reviews')
    );
    fireEvent.press(screen.getByText('Reset to defaults'));

    expect(screen.getByDisplayValue('Batman')).toBeTruthy();
  });

  it('uses the safe All and Newest fallback when saved defaults are invalid', async () => {
    beginCommunitySessionForUser('viewer-1');
    setCommunityScrollOffset('viewer-1', 260);
    (communityPreferenceRepository.getForUser as jest.Mock).mockResolvedValue({
      mediaFilter: 'tv',
      sort: 'highest',
    });
    (settingsService.get as jest.Mock).mockResolvedValue({
      accountPrivacy: 'public',
      defaultReviewVisibility: 'private',
      defaultMediaFilter: 'invalid',
      defaultSort: 'invalid',
    });
    (communityFeedService.list as jest.Mock).mockResolvedValue({
      reviews: [],
      followsAnyone: true,
    });
    const screen = render(<CommunityScreen />);

    await screen.findByText('No TV show reviews yet');
    setCommunityScrollOffset('viewer-1', 260);
    fireEvent.press(
      screen.getByLabelText('Filter and sort community reviews')
    );
    fireEvent.press(screen.getByText('Reset to defaults'));

    await waitFor(() => {
      expect(communityPreferenceRepository.setForUser).toHaveBeenCalledWith(
        'viewer-1',
        { mediaFilter: 'all', sort: 'newest' }
      );
    });
    expect(getCommunityScrollOffset('viewer-1')).toBe(0);
  });

  it('uses the account-scoped last-active Community options before loading', async () => {
    (communityPreferenceRepository.getForUser as jest.Mock).mockResolvedValue({
      mediaFilter: 'movie',
      sort: 'lowest',
    });
    (communityFeedService.list as jest.Mock).mockResolvedValue({
      reviews: [],
      followsAnyone: true,
    });
    render(<CommunityScreen />);

    await waitFor(() => {
      expect(communityFeedService.list).toHaveBeenLastCalledWith('viewer-1', {
        mediaFilter: 'movie',
        sort: 'lowest',
      });
    });
  });

  it('uses known account defaults when no local Community value exists', async () => {
    (settingsService.get as jest.Mock).mockResolvedValue({
      accountPrivacy: 'public',
      defaultReviewVisibility: 'private',
      defaultMediaFilter: 'tv',
      defaultSort: 'highestRated',
    });
    (communityFeedService.list as jest.Mock).mockResolvedValue({
      reviews: [],
      followsAnyone: true,
    });
    render(<CommunityScreen />);

    await waitFor(() => {
      expect(communityFeedService.list).toHaveBeenLastCalledWith('viewer-1', {
        mediaFilter: 'tv',
        sort: 'highest',
      });
    });
  });

  it('passes an on-screen search query to the feed without saving it as a preference', async () => {
    (communityFeedService.list as jest.Mock).mockResolvedValue({
      reviews: [],
      followsAnyone: true,
    });
    const screen = render(<CommunityScreen />);

    await screen.findByText('No community reviews yet');
    fireEvent.press(screen.getByLabelText('Search community reviews'));
    fireEvent.changeText(
      screen.getAllByLabelText('Search community reviews')[1],
      'arrival'
    );

    await waitFor(() => {
      expect(communityFeedService.list).toHaveBeenLastCalledWith('viewer-1', {
        mediaFilter: 'all',
        searchQuery: 'arrival',
        sort: 'newest',
      });
    });
    expect(communityPreferenceRepository.setForUser).not.toHaveBeenCalled();
  });
});
