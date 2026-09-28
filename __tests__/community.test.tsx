import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { StyleSheet } from 'react-native';
import CommunityScreen from '@/app/(tabs)/community';
import {
  cachedFollowingCommunityFeedService,
  communityPreferenceRepository,
  cachedEveryoneCommunityFeedService,
  settingsService,
} from '@/services';
import {
  beginCommunitySessionForUser,
  getCommunityScrollOffset,
  setCommunityScrollOffset,
} from '@/services/community/communitySessionState';

jest.mock('@expo/vector-icons', () => ({
  Ionicons: ({ name }: { name: string }) => {
    const { Text } = require('react-native');
    return <Text testID={`icon-${name}`} />;
  },
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
  cachedFollowingCommunityFeedService: {
    list: jest.fn(),
  },
  cachedEveryoneCommunityFeedService: { listPage: jest.fn() },
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
    (cachedFollowingCommunityFeedService.list as jest.Mock).mockResolvedValue({
      reviews: [],
      followsAnyone: false,
    });
    const screen = render(<CommunityScreen />);

    await screen.findByText('Your Following feed is quiet');
    fireEvent.press(screen.getByText('Find People'));

    expect(router.push).toHaveBeenCalledWith('/community/find-people');
  });

  it('distinguishes an empty feed from following nobody', async () => {
    (cachedFollowingCommunityFeedService.list as jest.Mock).mockResolvedValue({
      reviews: [],
      followsAnyone: true,
    });
    const screen = render(<CommunityScreen />);

    expect(await screen.findByText('Your Following feed is quiet')).toBeTruthy();
    expect(screen.getByText('Explore Everyone')).toBeTruthy();
  });

  it('renders a shared review with its author', async () => {
    (cachedFollowingCommunityFeedService.list as jest.Mock).mockResolvedValue({
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
          movie: {
            catalogId: 'tmdb:movie:329865',
            catalogDataRetention: {
              fetchedAt: '2026-09-01T00:00:00.000Z',
              refreshAfter: '2027-01-01T00:00:00.000Z',
              expiresAt: '2027-03-01T00:00:00.000Z',
            },
            genres: ['Drama', 'Science Fiction'],
            matchStatus: 'matched',
            mediaType: 'movie',
            posterUrl: null,
            releaseYear: 2016,
            reviewTargetType: 'movie',
            title: 'Arrival',
          },
          reviewText: 'Thoughtful science fiction.',
          rating: 5,
          visibility: 'followers',
          createdAt: '2026-07-19T12:00:00.000Z',
          syncStatus: 'synced',
        },
        {
          id: 'review-tv-1',
          authorId: 'author-1',
          author: {
            id: 'author-1',
            displayName: 'Alex',
            handle: 'AlexMovies',
            handleNormalized: 'alexmovies',
            profileImage: null,
            accountPrivacy: 'public',
          },
          movieTitle: 'The Bear',
          movie: {
            catalogId: 'tmdb:tv:136311',
            catalogDataRetention: {
              fetchedAt: '2026-09-01T00:00:00.000Z',
              refreshAfter: '2027-01-01T00:00:00.000Z',
              expiresAt: '2027-03-01T00:00:00.000Z',
            },
            genres: ['Drama'],
            matchStatus: 'matched',
            mediaType: 'tv',
            posterUrl: null,
            releaseYear: 2022,
            reviewTargetType: 'series',
            title: 'The Bear',
          },
          reviewText: 'A tense kitchen drama.',
          rating: 4,
          spoilerWarning: false,
          visibility: 'public',
          createdAt: '2026-07-18T12:00:00.000Z',
          syncStatus: 'synced',
        },
      ],
    });
    const screen = render(<CommunityScreen />);

    expect(await screen.findByText('Arrival')).toBeTruthy();
    expect(screen.getAllByText('Alex')).toHaveLength(2);
    expect(screen.getAllByText('@AlexMovies')).toHaveLength(2);
    expect(screen.getByText('2016 · Drama, Science Fiction')).toBeTruthy();
    expect(screen.getByText('Movie')).toBeTruthy();
    expect(screen.getByText('2022 · Drama')).toBeTruthy();
    expect(screen.getByText('TV Show')).toBeTruthy();
    expect(screen.getByLabelText('Poster placeholder for Arrival')).toBeTruthy();
    expect(
      StyleSheet.flatten(
        screen.getByLabelText('Poster placeholder for Arrival').props.style
      ).height
    ).toBe(166);
    expect(screen.getByText('Thoughtful science fiction.')).toBeTruthy();
    expect(screen.queryByTestId('icon-ellipsis-horizontal')).toBeNull();

    fireEvent.press(screen.getAllByLabelText("View Alex's profile")[0]);
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
    (cachedFollowingCommunityFeedService.list as jest.Mock).mockResolvedValue({
      reviews: [],
      followsAnyone: true,
    });
    const screen = render(<CommunityScreen />);

    await screen.findByText('Your Following feed is quiet');
    fireEvent.press(
      screen.getByLabelText('Filter and sort community reviews')
    );
    fireEvent.press(screen.getByText('TV Shows'));
    fireEvent.press(screen.getByText('Highest rated'));
    fireEvent.press(screen.getByText('Done'));

    await waitFor(() => {
      expect(cachedFollowingCommunityFeedService.list).toHaveBeenLastCalledWith('viewer-1', {
        mediaFilter: 'tv',
        sort: 'highest',
      });
    });
    expect(await screen.findByText('No reviews for this filter')).toBeTruthy();
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
    (cachedFollowingCommunityFeedService.list as jest.Mock).mockResolvedValue({
      reviews: [],
      followsAnyone: true,
    });
    const screen = render(<CommunityScreen />);

    await screen.findByText('No reviews for this filter');
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
    (cachedFollowingCommunityFeedService.list as jest.Mock).mockResolvedValue({
      reviews: [],
      followsAnyone: true,
    });
    const screen = render(<CommunityScreen />);

    await screen.findByText('Your Following feed is quiet');
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
    (cachedFollowingCommunityFeedService.list as jest.Mock).mockResolvedValue({
      reviews: [],
      followsAnyone: true,
    });
    const screen = render(<CommunityScreen />);

    await screen.findByText('No reviews for this filter');
    fireEvent.press(
      screen.getByLabelText('Filter and sort community reviews')
    );
    fireEvent.press(screen.getByText('Reset to defaults'));

    await waitFor(() => {
      expect(communityPreferenceRepository.setForUser).toHaveBeenCalledWith(
        'viewer-1',
        { mediaFilter: 'movie', sort: 'oldest' }
      );
      expect(cachedFollowingCommunityFeedService.list).toHaveBeenLastCalledWith('viewer-1', {
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
    (cachedFollowingCommunityFeedService.list as jest.Mock).mockResolvedValue({
      reviews: [],
      followsAnyone: true,
    });
    const screen = render(<CommunityScreen />);

    await screen.findByText('No reviews for this filter');
    fireEvent.changeText(
      screen.getByLabelText('Search community reviews'),
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
    (cachedFollowingCommunityFeedService.list as jest.Mock).mockResolvedValue({
      reviews: [],
      followsAnyone: true,
    });
    const screen = render(<CommunityScreen />);

    await screen.findByText('No reviews for this filter');
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
    (cachedFollowingCommunityFeedService.list as jest.Mock).mockResolvedValue({
      reviews: [],
      followsAnyone: true,
    });
    render(<CommunityScreen />);

    await waitFor(() => {
      expect(cachedFollowingCommunityFeedService.list).toHaveBeenLastCalledWith('viewer-1', {
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
    (cachedFollowingCommunityFeedService.list as jest.Mock).mockResolvedValue({
      reviews: [],
      followsAnyone: true,
    });
    render(<CommunityScreen />);

    await waitFor(() => {
      expect(cachedFollowingCommunityFeedService.list).toHaveBeenLastCalledWith('viewer-1', {
        mediaFilter: 'tv',
        sort: 'highest',
      });
    });
  });

  it('passes an on-screen search query to the feed without saving it as a preference', async () => {
    (cachedFollowingCommunityFeedService.list as jest.Mock).mockResolvedValue({
      reviews: [],
      followsAnyone: true,
    });
    const screen = render(<CommunityScreen />);

    await screen.findByText('Your Following feed is quiet');
    fireEvent.changeText(
      screen.getByLabelText('Search community reviews'),
      'arrival'
    );

    await waitFor(() => {
      expect(cachedFollowingCommunityFeedService.list).toHaveBeenLastCalledWith('viewer-1', {
        mediaFilter: 'all',
        searchQuery: 'arrival',
        sort: 'newest',
      });
    });
    expect(communityPreferenceRepository.setForUser).not.toHaveBeenCalled();
  });

  it('starts in Following and does not populate Everyone with Following data', async () => {
    (cachedFollowingCommunityFeedService.list as jest.Mock).mockResolvedValue({
      followsAnyone: true,
      reviews: [
        {
          id: 'review-1', authorId: 'author-1', author: { id: 'author-1', displayName: 'Alex', handle: 'AlexMovies', handleNormalized: 'alexmovies', profileImage: null, accountPrivacy: 'public' },
          movieTitle: 'Arrival', reviewText: 'Thoughtful science fiction.', rating: 5, spoilerWarning: false, visibility: 'public', createdAt: '2026-07-19T12:00:00.000Z', syncStatus: 'synced',
        },
      ],
    });
    const screen = render(<CommunityScreen />);

    expect(screen.getByText('Following')).toBeTruthy();
    expect(await screen.findByText('Arrival')).toBeTruthy();
    (cachedEveryoneCommunityFeedService.listPage as jest.Mock).mockResolvedValue({ reviews: [], nextCursor: null, source: 'remote', remoteError: null });
    fireEvent.press(screen.getByText('Everyone'));

    expect(await screen.findByText('No public reviews yet')).toBeTruthy();
    expect(screen.queryByText('Arrival')).toBeNull();
    expect(cachedFollowingCommunityFeedService.list).toHaveBeenCalledTimes(1);
  });

  it('conceals a spoiler review until Reveal Review is pressed', async () => {
    (cachedFollowingCommunityFeedService.list as jest.Mock).mockResolvedValue({
      followsAnyone: true,
      reviews: [
        {
          id: 'spoiler-1', authorId: 'author-1', author: { id: 'author-1', displayName: 'Alex', handle: 'AlexMovies', handleNormalized: 'alexmovies', profileImage: null, accountPrivacy: 'public' },
          movieTitle: 'The Last Of Us', reviewText: 'The ending changes everything.', rating: 4, spoilerWarning: true, visibility: 'public', createdAt: '2026-07-19T12:00:00.000Z', syncStatus: 'synced',
        },
      ],
    });
    const screen = render(<CommunityScreen />);

    expect(await screen.findByText('Contains spoilers')).toBeTruthy();
    expect(screen.queryByText('The ending changes everything.')).toBeNull();
    expect(
      StyleSheet.flatten(
        screen.getByLabelText('Poster placeholder for The Last Of Us').props.style
      ).height
    ).toBe(190);
    fireEvent.press(screen.getByText('Reveal Review'));
    expect(screen.getByText('The ending changes everything.')).toBeTruthy();
    expect(
      StyleSheet.flatten(
        screen.getByLabelText('Poster placeholder for The Last Of Us').props.style
      ).height
    ).toBe(166);
  });

  it('shows an offline saved indicator and disables remote-only controls for cached Everyone results', async () => {
    (cachedFollowingCommunityFeedService.list as jest.Mock).mockResolvedValue({
      followsAnyone: true,
      reviews: [],
    });
    (cachedEveryoneCommunityFeedService.listPage as jest.Mock).mockResolvedValue({
      reviews: [{
        id: 'saved-review', authorId: 'author-1',
        author: { id: 'author-1', displayName: 'Alex', handle: 'AlexMovies', handleNormalized: 'alexmovies', profileImage: null, accountPrivacy: 'public' },
        movieTitle: 'Saved Arrival', reviewText: 'Saved locally.', rating: 4,
        spoilerWarning: false, visibility: 'public', createdAt: '2026-09-27T12:00:00.000Z', syncStatus: 'synced',
      }],
      // The service never returns a cache cursor; this confirms the screen
      // still suppresses Load More if an invalid adapter ever did.
      nextCursor: { values: ['not-a-cache-cursor'] }, source: 'cache', remoteError: 'Network unavailable',
    });
    const screen = render(<CommunityScreen />);
    await screen.findByText('Your Following feed is quiet');
    fireEvent.press(screen.getByText('Everyone'));

    expect(await screen.findByText('Offline · Showing saved reviews')).toBeTruthy();
    expect(screen.getByText('Saved Arrival')).toBeTruthy();
    expect(screen.queryByLabelText('Load more public reviews')).toBeNull();
    expect(screen.queryByLabelText('Follow Alex')).toBeNull();
  });

  it('uses the Everyone-specific saved-content empty state after remote failure with no eligible cache', async () => {
    (cachedFollowingCommunityFeedService.list as jest.Mock).mockResolvedValue({ followsAnyone: true, reviews: [] });
    (cachedEveryoneCommunityFeedService.listPage as jest.Mock).mockResolvedValue({
      reviews: [], nextCursor: null, source: 'cache', remoteError: 'Network unavailable',
    });
    const screen = render(<CommunityScreen />);
    await screen.findByText('Your Following feed is quiet');
    fireEvent.press(screen.getByText('Everyone'));

    expect(await screen.findByText('No saved public reviews')).toBeTruthy();
    expect(screen.queryByText('Offline · Showing saved reviews')).toBeNull();
  });

  it('shows saved Following reviews with the offline indicator after authoritative failure', async () => {
    (cachedFollowingCommunityFeedService.list as jest.Mock).mockResolvedValue({
      followsAnyone: true,
      reviews: [{
        id: 'saved-following-review', authorId: 'author-1',
        author: { id: 'author-1', displayName: 'Alex', handle: 'AlexMovies', handleNormalized: 'alexmovies', profileImage: null, accountPrivacy: 'public' },
        movieTitle: 'Saved Following Review', reviewText: 'Saved locally.', rating: 4,
        spoilerWarning: false, visibility: 'followers', createdAt: '2026-09-27T12:00:00.000Z', syncStatus: 'synced',
      }],
      source: 'cache', remoteError: 'Network unavailable',
    });
    const screen = render(<CommunityScreen />);

    expect(await screen.findByText('Saved Following Review')).toBeTruthy();
    expect(screen.getByText('Offline · Showing saved reviews')).toBeTruthy();
  });

  it('uses the Following-specific saved-content empty state after failure with no eligible cache', async () => {
    (cachedFollowingCommunityFeedService.list as jest.Mock).mockResolvedValue({
      followsAnyone: false, reviews: [], source: 'cache', remoteError: 'Network unavailable',
    });
    const screen = render(<CommunityScreen />);

    expect(await screen.findByText('No saved Following reviews')).toBeTruthy();
    expect(screen.queryByText('Offline · Showing saved reviews')).toBeNull();
  });
});
