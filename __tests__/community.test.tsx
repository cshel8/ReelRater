import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { FlatList, InteractionManager, Keyboard, StyleSheet } from 'react-native';
import CommunityScreen from '@/app/(tabs)/community';
import {
  cachedFollowingCommunityFeedService,
  communityPreferenceRepository,
  cachedEveryoneCommunityFeedService,
  exactMediaCommunitySearchService,
  settingsService,
  mediaCatalogService,
} from '@/services';
import {
  beginCommunitySessionForUser,
  getCommunityScrollOffset,
  invalidateFollowingAuthorForSession,
  setCommunityScrollOffset,
} from '@/services/community/communitySessionState';

const mockParentTabListeners = new Map<string, Set<() => void>>();
const mockCommunityFocusEffects = new Set<{
  callback: () => void | (() => void);
  cleanup?: () => void;
}>();
const mockParentTabNavigation = {
  addListener: jest.fn((event: string, listener: () => void) => {
    const listeners = mockParentTabListeners.get(event) ?? new Set<() => void>();
    listeners.add(listener);
    mockParentTabListeners.set(event, listeners);
    return () => listeners.delete(listener);
  }),
};
const mockCommunityNavigation = {
  getParent: () => mockParentTabNavigation,
};

function emitParentTabEvent(event: string) {
  for (const listener of mockParentTabListeners.get(event) ?? []) {
    listener();
  }
}

function blurCommunityScreen() {
  for (const effect of mockCommunityFocusEffects) {
    effect.cleanup?.();
  }
}

function focusCommunityScreen() {
  for (const effect of mockCommunityFocusEffects) {
    const cleanup = effect.callback();
    effect.cleanup = typeof cleanup === 'function' ? cleanup : undefined;
  }
}

function communityReview(
  id: string,
  movieTitle: string,
  authorId = `author-${id}`,
  visibility: 'public' | 'followers' = 'public'
) {
  return {
    id,
    authorId,
    author: {
      id: authorId,
      displayName: authorId,
      handle: authorId,
      handleNormalized: authorId,
      profileImage: null,
      accountPrivacy: 'public' as const,
    },
    movieTitle,
    reviewText: `${movieTitle} review text.`,
    rating: 4,
    spoilerWarning: false,
    visibility,
    createdAt: '2026-10-10T12:00:00.000Z',
    syncStatus: 'synced' as const,
  };
}

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
  useFocusEffect: (callback: () => void | (() => void)) => {
    const React = require('react');
    React.useEffect(() => {
      const effect = {
        callback,
        cleanup: undefined as (() => void) | undefined,
      };
      const cleanup = callback();
      effect.cleanup = typeof cleanup === 'function' ? cleanup : undefined;
      mockCommunityFocusEffects.add(effect);
      return () => {
        effect.cleanup?.();
        mockCommunityFocusEffects.delete(effect);
      };
    }, [callback]);
  },
  useNavigation: () => mockCommunityNavigation,
}));

let mockUserId: string | null = 'viewer-1';
jest.mock('@/store/userStore', () => ({
  userStore: (selector: (state: { userId: string | null }) => unknown) =>
    selector({ userId: mockUserId }),
}));

jest.mock('@/services', () => ({
  cachedFollowingCommunityFeedService: {
    list: jest.fn(),
  },
  cachedEveryoneCommunityFeedService: { listPage: jest.fn() },
  exactMediaCommunitySearchService: { search: jest.fn() },
  communityPreferenceRepository: {
    getForUser: jest.fn(),
    setForUser: jest.fn(),
  },
  settingsService: {
    get: jest.fn(),
  },
  mediaCatalogService: {
    search: jest.fn(),
  },
}));

describe('Community screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUserId = 'viewer-1';
    mockParentTabListeners.clear();
    mockCommunityFocusEffects.clear();
    beginCommunitySessionForUser(null);
    beginCommunitySessionForUser('viewer-1');
    (communityPreferenceRepository.getForUser as jest.Mock).mockResolvedValue(
      null
    );
    (communityPreferenceRepository.setForUser as jest.Mock).mockResolvedValue(
      undefined
    );
    (settingsService.get as jest.Mock).mockResolvedValue(null);
    (mediaCatalogService.search as jest.Mock).mockResolvedValue({
      items: [],
      nextCursor: null,
    });
    (exactMediaCommunitySearchService.search as jest.Mock).mockResolvedValue({
      reviews: [],
      pagination: { retrieval: 'bounded', nextCursor: null },
    });
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
      source: 'remote',
      remoteError: null,
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

  it('merges debounced movie and TV catalog suggestions without changing the feed query', async () => {
    (cachedFollowingCommunityFeedService.list as jest.Mock).mockResolvedValue({
      reviews: [],
      followsAnyone: true,
    });
    (mediaCatalogService.search as jest.Mock).mockImplementation(
      (_query, options) =>
        Promise.resolve({
          items:
            options?.mediaType === 'movie'
              ? [{
                  catalogId: 'tmdb:movie:123', mediaType: 'movie',
                  reviewTargetType: 'movie', title: 'Wednesday', releaseYear: 2008,
                  genres: [], posterUrl: null,
                }]
              : [{
                  catalogId: 'tmdb:tv:119051', mediaType: 'tv',
                  reviewTargetType: 'series', title: 'Wednesday', releaseYear: 2022,
                  genres: [], posterUrl: null,
                }],
          nextCursor: null,
        })
    );
    const screen = render(<CommunityScreen />);

    await screen.findByText('Your Following feed is quiet');
    fireEvent.changeText(
      screen.getByLabelText('Search community reviews'),
      'wednesday'
    );
    expect(mediaCatalogService.search).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(mediaCatalogService.search).toHaveBeenCalledWith('wednesday', {
        maximumResults: 8,
        mediaType: 'movie',
      });
      expect(mediaCatalogService.search).toHaveBeenCalledWith('wednesday', {
        maximumResults: 8,
        mediaType: 'tv',
      });
    });
    expect(screen.getByText('Following')).toBeTruthy();
    expect(screen.getByText('Everyone')).toBeTruthy();
    expect(screen.getByText('Movies & TV')).toBeTruthy();
    expect(screen.getAllByText('Wednesday')).toHaveLength(2);
    expect(screen.getByText('Movie · 2008')).toBeTruthy();
    expect(screen.getByText('TV series · 2022')).toBeTruthy();
    expect(screen.getByText('Review Text Matches')).toBeTruthy();
    expect(cachedFollowingCommunityFeedService.list).toHaveBeenLastCalledWith(
      'viewer-1',
      { mediaFilter: 'all', searchQuery: 'wednesday', sort: 'newest' }
    );
  });

  it('groups catalog suggestions and expands Movies and TV Shows independently', async () => {
    (cachedFollowingCommunityFeedService.list as jest.Mock).mockResolvedValue({
      reviews: [],
      followsAnyone: true,
    });
    (mediaCatalogService.search as jest.Mock).mockImplementation(
      (_query, options) =>
        Promise.resolve({
          items: Array.from({ length: 4 }, (_, index) => ({
            catalogId: `tmdb:${options?.mediaType}:${index + 1}`,
            mediaType: options?.mediaType,
            reviewTargetType:
              options?.mediaType === 'tv' ? 'series' : 'movie',
            title: `${options?.mediaType === 'tv' ? 'Series' : 'Movie'} ${index + 1}`,
            releaseYear: null,
            genres: [],
            posterUrl: null,
          })),
          nextCursor: null,
        })
    );
    const screen = render(<CommunityScreen />);

    await screen.findByText('Your Following feed is quiet');
    fireEvent.changeText(
      screen.getByLabelText('Search community reviews'),
      'title'
    );

    expect(await screen.findByText('Movies')).toBeTruthy();
    expect(screen.getByText('TV Shows')).toBeTruthy();
    expect(screen.getByText('Movie 3')).toBeTruthy();
    expect(screen.queryByText('Movie 4')).toBeNull();
    expect(screen.getByText('Series 3')).toBeTruthy();
    expect(screen.queryByText('Series 4')).toBeNull();

    fireEvent.press(screen.getByLabelText('See more Movies'));
    expect(await screen.findByText('Movie 4')).toBeTruthy();
    expect(screen.queryByText('Series 4')).toBeNull();
    expect(screen.getByLabelText('Show less Movies')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('See more TV Shows'));
    expect(await screen.findByText('Series 4')).toBeTruthy();
  });

  it('omits a Review Text Matches section in Everyone without fabricating global results', async () => {
    (cachedFollowingCommunityFeedService.list as jest.Mock).mockResolvedValue({
      reviews: [],
      followsAnyone: true,
    });
    (cachedEveryoneCommunityFeedService.listPage as jest.Mock).mockResolvedValue({
      reviews: [],
      nextCursor: null,
      source: 'remote',
      remoteError: null,
    });
    (mediaCatalogService.search as jest.Mock).mockResolvedValue({
      items: [],
      nextCursor: null,
    });
    const screen = render(<CommunityScreen />);

    await screen.findByText('Your Following feed is quiet');
    fireEvent.press(screen.getByText('Everyone'));
    await screen.findByText('No public reviews yet');
    fireEvent.changeText(
      screen.getByLabelText('Search community reviews'),
      'arrival'
    );

    await screen.findByText('No movies or TV series found.');
    expect(screen.queryByText('Review Text Matches')).toBeNull();
    expect(
      screen.queryByText('Review-text matches are not available in Everyone yet.')
    ).toBeNull();
  });

  it('ignores stale catalog responses and does not search blank input', async () => {
    (cachedFollowingCommunityFeedService.list as jest.Mock).mockResolvedValue({
      reviews: [],
      followsAnyone: true,
    });
    const oldResolvers: Array<(value: unknown) => void> = [];
    const newResolvers: Array<(value: unknown) => void> = [];
    (mediaCatalogService.search as jest.Mock).mockImplementation(
      (query) =>
        new Promise((resolve) => {
          (query === 'old' ? oldResolvers : newResolvers).push(resolve);
        })
    );
    const screen = render(<CommunityScreen />);

    await screen.findByText('Your Following feed is quiet');
    fireEvent.changeText(screen.getByLabelText('Search community reviews'), 'old');
    await waitFor(() => expect(mediaCatalogService.search).toHaveBeenCalledTimes(2));
    expect(screen.getByLabelText('Loading movie and TV suggestions')).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText('Search community reviews'), 'new');
    await waitFor(() => expect(mediaCatalogService.search).toHaveBeenCalledTimes(4));
    newResolvers.forEach((resolve, index) => resolve({
      items: index === 1 ? [{
        catalogId: 'tmdb:tv:2', mediaType: 'tv', reviewTargetType: 'series',
        title: 'New Result', releaseYear: null, genres: [], posterUrl: null,
      }] : [], nextCursor: null,
    }));
    expect(await screen.findByText('New Result')).toBeTruthy();
    oldResolvers.forEach((resolve, index) => resolve({
      items: index === 0 ? [{
        catalogId: 'tmdb:movie:1', mediaType: 'movie', reviewTargetType: 'movie',
        title: 'Old Result', releaseYear: null, genres: [], posterUrl: null,
      }] : [], nextCursor: null,
    }));
    await waitFor(() => expect(screen.queryByText('Old Result')).toBeNull());

    fireEvent.changeText(screen.getByLabelText('Search community reviews'), '   ');
    await waitFor(() => expect(screen.queryByText('Movies & TV')).toBeNull());
    expect(mediaCatalogService.search).toHaveBeenCalledTimes(4);
  });

  it('retrieves selected catalog media and preserves its identity across Community scopes', async () => {
    (cachedFollowingCommunityFeedService.list as jest.Mock).mockResolvedValue({
      reviews: [],
      followsAnyone: true,
    });
    (cachedEveryoneCommunityFeedService.listPage as jest.Mock).mockResolvedValue({
      reviews: [], nextCursor: null, source: 'remote', remoteError: null,
    });
    (mediaCatalogService.search as jest.Mock).mockImplementation(
      (_query, options) => Promise.resolve({
        items: options?.mediaType === 'tv' ? [{
          catalogId: 'tmdb:tv:61709', mediaType: 'tv', reviewTargetType: 'series',
          title: 'Dragon Ball Z Kai', releaseYear: 2009, genres: [], posterUrl: null,
        }] : [], nextCursor: null,
      })
    );
    const screen = render(<CommunityScreen />);

    await screen.findByText('Your Following feed is quiet');
    fireEvent.changeText(screen.getByLabelText('Search community reviews'), 'dragon');
    expect(await screen.findByLabelText('Select Dragon Ball Z Kai')).toBeTruthy();
    const feedCallsBeforeSelection = (cachedFollowingCommunityFeedService.list as jest.Mock).mock.calls.length;
    fireEvent.press(screen.getByLabelText('Select Dragon Ball Z Kai'));

    expect(await screen.findByText('Reviews for Dragon Ball Z Kai')).toBeTruthy();
    await waitFor(() => {
      expect(exactMediaCommunitySearchService.search).toHaveBeenCalledWith(
        'viewer-1',
        expect.objectContaining({
          scope: 'following',
          selectedMedia: {
            catalogId: 'tmdb:tv:61709',
            mediaType: 'tv',
            reviewTargetType: 'series',
          },
          sort: 'newest',
        })
      );
    });
    expect(cachedFollowingCommunityFeedService.list).toHaveBeenCalledTimes(feedCallsBeforeSelection);
    fireEvent.press(screen.getByText('Everyone'));
    expect(screen.getByDisplayValue('dragon')).toBeTruthy();
    expect(screen.getByText('Reviews for Dragon Ball Z Kai')).toBeTruthy();
    await waitFor(() => {
      expect(exactMediaCommunitySearchService.search).toHaveBeenLastCalledWith(
        'viewer-1',
        expect.objectContaining({ scope: 'everyone' })
      );
    });
    fireEvent.press(screen.getByLabelText('Clear selected media'));
    expect(screen.queryByText('Reviews for Dragon Ball Z Kai')).toBeNull();
    expect(screen.getByDisplayValue('')).toBeTruthy();
    expect(await screen.findByText('No public reviews yet')).toBeTruthy();
  });

  it('clears only transient Community state when its parent tab loses focus', async () => {
    (cachedFollowingCommunityFeedService.list as jest.Mock).mockResolvedValue({
      reviews: [],
      followsAnyone: true,
      source: 'remote',
      remoteError: null,
    });
    (mediaCatalogService.search as jest.Mock).mockImplementation(
      (_query, options) =>
        Promise.resolve({
          items:
            options?.mediaType === 'movie'
              ? [{
                  catalogId: 'tmdb:movie:1', mediaType: 'movie',
                  reviewTargetType: 'movie', title: 'Arrival', releaseYear: 2016,
                  genres: [], posterUrl: null,
                }]
              : [],
          nextCursor: null,
        })
    );
    const screen = render(<CommunityScreen />);

    await screen.findByText('Your Following feed is quiet');
    fireEvent.changeText(
      screen.getByLabelText('Search community reviews'),
      'arrival'
    );
    fireEvent.press(await screen.findByLabelText('Select Arrival'));
    expect(await screen.findByText('Reviews for Arrival')).toBeTruthy();

    const list = screen.UNSAFE_getByType(FlatList);
    act(() => {
      list.props.onContentSizeChange(390, 1600);
      list.props.onScroll({ nativeEvent: { contentOffset: { y: 340 } } });
    });

    act(() => emitParentTabEvent('blur'));

    await waitFor(() => {
      expect(screen.getByDisplayValue('')).toBeTruthy();
      expect(screen.queryByText('Reviews for Arrival')).toBeNull();
    });
    expect(screen.getByText('Following')).toBeTruthy();
    expect(getCommunityScrollOffset('viewer-1')).toBe(0);

    act(() => {
      focusCommunityScreen();
      screen.UNSAFE_getByType(FlatList).props.onContentSizeChange(390, 1600);
    });
    expect(getCommunityScrollOffset('viewer-1')).toBe(0);
  });

  it('restores the complete normal Following snapshot before its tab-return refresh resolves', async () => {
    const initial = [
      communityReview('wednesday', 'Wednesday', 'maya'),
      communityReview('arrival', 'Arrival', 'alex'),
    ];
    const searched = [initial[0]];
    const refreshed = [
      communityReview('wednesday', 'Wednesday', 'maya'),
      communityReview('dune', 'Dune', 'jamie'),
    ];
    let normalCalls = 0;
    let resolveRefresh: ((value: unknown) => void) | undefined;
    (cachedFollowingCommunityFeedService.list as jest.Mock).mockImplementation(
      (_viewerId, options) => {
        if (options?.searchQuery) {
          return Promise.resolve({ reviews: searched, followsAnyone: true, source: 'remote', remoteError: null });
        }
        normalCalls += 1;
        if (normalCalls === 1) {
          return Promise.resolve({ reviews: initial, followsAnyone: true, source: 'remote', remoteError: null });
        }
        return new Promise((resolve) => {
          resolveRefresh = resolve;
        });
      }
    );
    const screen = render(<CommunityScreen />);

    await screen.findByText('Arrival');
    fireEvent.changeText(screen.getByLabelText('Search community reviews'), 'Wednesday');
    await waitFor(() => expect(cachedFollowingCommunityFeedService.list).toHaveBeenCalledWith(
      'viewer-1',
      expect.objectContaining({ searchQuery: 'Wednesday' })
    ));
    await waitFor(() => expect(screen.queryByText('Arrival')).toBeNull());

    act(() => emitParentTabEvent('blur'));
    expect(screen.getByDisplayValue('')).toBeTruthy();
    expect(screen.getByText('Arrival')).toBeTruthy();
    expect(screen.getByText('Wednesday')).toBeTruthy();

    act(() => focusCommunityScreen());
    expect(screen.getByText('Arrival')).toBeTruthy();
    await waitFor(() => expect(resolveRefresh).toBeDefined());
    await act(async () => {
      resolveRefresh?.({ reviews: refreshed, followsAnyone: true, source: 'remote', remoteError: null });
    });
    expect(await screen.findByText('Dune')).toBeTruthy();
    expect(screen.queryByText('Arrival')).toBeNull();
  });

  it('shows loading instead of stale searched reviews when no safe normal snapshot exists', async () => {
    const saved = communityReview('saved', 'Arrival', 'alex');
    const searched = communityReview('searched', 'Wednesday', 'maya');
    (cachedFollowingCommunityFeedService.list as jest.Mock).mockImplementation(
      (_viewerId, options) => Promise.resolve(
        options?.searchQuery
          ? { reviews: [searched], followsAnyone: true, source: 'remote', remoteError: null }
          : { reviews: [saved], followsAnyone: true, source: 'cache', remoteError: 'offline' }
      )
    );
    const screen = render(<CommunityScreen />);

    await screen.findByText('Arrival');
    fireEvent.changeText(screen.getByLabelText('Search community reviews'), 'Wednesday');
    await screen.findByText('Wednesday');
    act(() => emitParentTabEvent('blur'));

    expect(screen.queryByText('Wednesday')).toBeNull();
    expect(screen.getByText('Loading your community…')).toBeTruthy();
  });

  it('never carries a normal Following snapshot into a different account session', async () => {
    const firstAccountReview = communityReview('first-account', 'Arrival', 'alex');
    (cachedFollowingCommunityFeedService.list as jest.Mock).mockImplementation(
      (viewerId) => viewerId === 'viewer-1'
        ? Promise.resolve({ reviews: [firstAccountReview], followsAnyone: true, source: 'remote', remoteError: null })
        : new Promise(() => undefined)
    );
    const screen = render(<CommunityScreen />);

    await screen.findByText('Arrival');
    mockUserId = 'viewer-2';
    screen.rerender(<CommunityScreen />);

    await waitFor(() => {
      expect(screen.queryByText('Arrival')).toBeNull();
      expect(screen.getByText('Loading your community…')).toBeTruthy();
    });
  });

  it('filters locally invalidated authors from the restored normal Following snapshot', async () => {
    const protectedReview = communityReview('protected', 'Wednesday', 'maya', 'followers');
    const publicReview = communityReview('public', 'Arrival', 'alex');
    (cachedFollowingCommunityFeedService.list as jest.Mock).mockImplementation(
      (_viewerId, options) => Promise.resolve({
        reviews: options?.searchQuery ? [protectedReview] : [protectedReview, publicReview],
        followsAnyone: true,
        source: 'remote',
        remoteError: null,
      })
    );
    const screen = render(<CommunityScreen />);

    await screen.findByText('Arrival');
    fireEvent.changeText(screen.getByLabelText('Search community reviews'), 'Wednesday');
    await waitFor(() => expect(cachedFollowingCommunityFeedService.list).toHaveBeenCalledWith(
      'viewer-1',
      expect.objectContaining({ searchQuery: 'Wednesday' })
    ));
    await waitFor(() => expect(screen.queryByText('Arrival')).toBeNull());
    invalidateFollowingAuthorForSession('viewer-1', 'maya');
    act(() => emitParentTabEvent('blur'));

    expect(screen.getByText('Arrival')).toBeTruthy();
    expect(screen.queryByText('Wednesday')).toBeNull();
  });

  it('does not substitute a Following snapshot while Everyone is active', async () => {
    (cachedFollowingCommunityFeedService.list as jest.Mock).mockResolvedValue({
      reviews: [communityReview('following', 'Arrival', 'alex')],
      followsAnyone: true,
      source: 'remote',
      remoteError: null,
    });
    (cachedEveryoneCommunityFeedService.listPage as jest.Mock).mockResolvedValue({
      reviews: [communityReview('everyone', 'Dune', 'maya')],
      nextCursor: null,
      source: 'remote',
      remoteError: null,
    });
    const screen = render(<CommunityScreen />);

    await screen.findByText('Arrival');
    fireEvent.press(screen.getByText('Everyone'));
    await screen.findByText('Dune');
    fireEvent.changeText(screen.getByLabelText('Search community reviews'), 'Dune');
    act(() => emitParentTabEvent('blur'));

    expect(screen.getByText('Dune')).toBeTruthy();
    expect(screen.queryByText('Arrival')).toBeNull();
  });

  it('ignores a delayed searched-feed response after restoring the normal snapshot', async () => {
    const initial = [
      communityReview('wednesday', 'Wednesday', 'maya'),
      communityReview('arrival', 'Arrival', 'alex'),
    ];
    let resolveSearch: ((value: unknown) => void) | undefined;
    (cachedFollowingCommunityFeedService.list as jest.Mock).mockImplementation(
      (_viewerId, options) => options?.searchQuery
        ? new Promise((resolve) => { resolveSearch = resolve; })
        : Promise.resolve({ reviews: initial, followsAnyone: true, source: 'remote', remoteError: null })
    );
    const screen = render(<CommunityScreen />);

    await screen.findByText('Arrival');
    fireEvent.changeText(screen.getByLabelText('Search community reviews'), 'Wednesday');
    await waitFor(() => expect(resolveSearch).toBeDefined());
    act(() => emitParentTabEvent('blur'));
    await act(async () => {
      resolveSearch?.({ reviews: [initial[0]], followsAnyone: true, source: 'remote', remoteError: null });
    });

    expect(screen.getByText('Arrival')).toBeTruthy();
    expect(screen.getByDisplayValue('')).toBeTruthy();
  });

  it('restores an unselected Following search position after Review Details without accepting blurred-list scroll events', async () => {
    (cachedFollowingCommunityFeedService.list as jest.Mock).mockResolvedValue({
      followsAnyone: true,
      reviews: [
        {
          id: 'wednesday-review', authorId: 'maya-1',
          author: { id: 'maya-1', displayName: 'Maya', handle: 'maya', handleNormalized: 'maya', profileImage: null, accountPrivacy: 'public' },
          movieTitle: 'Wednesday', reviewText: 'A sharp mystery with great performances.', rating: 4,
          spoilerWarning: false, visibility: 'public', createdAt: '2026-10-10T12:00:00.000Z', syncStatus: 'synced',
        },
      ],
    });
    (mediaCatalogService.search as jest.Mock).mockResolvedValue({
      items: [], nextCursor: null,
    });
    const interactionSpy = jest.spyOn(
      InteractionManager,
      'runAfterInteractions'
    );
    const scrollToOffset = jest.spyOn(FlatList.prototype, 'scrollToOffset');
    const screen = render(<CommunityScreen />);

    await screen.findByText('Wednesday');
    const searchInput = screen.getByLabelText('Search community reviews');
    const dismissKeyboard = jest.spyOn(Keyboard, 'dismiss');
    fireEvent.changeText(searchInput, 'Wednesday');
    expect(await screen.findByText('Review Text Matches')).toBeTruthy();
    const list = screen.UNSAFE_getByType(FlatList);
    act(() => {
      list.props.onContentSizeChange(390, 1800);
      list.props.onScroll({ nativeEvent: { contentOffset: { y: 468 } } });
      list.props.onScrollBeginDrag();
    });
    expect(dismissKeyboard).toHaveBeenCalledTimes(1);
    expect(screen.getByDisplayValue('Wednesday')).toBeTruthy();

    act(() => {
      fireEvent.press(screen.getByLabelText('Read review of Wednesday'));
      blurCommunityScreen();
      // FlatList may emit a transition scroll while the detail route is above it.
      list.props.onScroll({ nativeEvent: { contentOffset: { y: 0 } } });
      focusCommunityScreen();
    });

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/community/review/[reviewId]',
      params: { authorId: 'maya-1', reviewId: 'wednesday-review' },
    });
    expect(screen.getByDisplayValue('Wednesday')).toBeTruthy();
    expect(screen.getByText('Review Text Matches')).toBeTruthy();
    expect(dismissKeyboard).toHaveBeenCalledTimes(2);
    expect(scrollToOffset).toHaveBeenLastCalledWith({ animated: false, offset: 468 });
    expect(interactionSpy).not.toHaveBeenCalled();
    expect(getCommunityScrollOffset('viewer-1')).toBe(468);
    fireEvent.changeText(searchInput, 'Wednesday Addams');
    expect(screen.getByDisplayValue('Wednesday Addams')).toBeTruthy();
    scrollToOffset.mockRestore();
    interactionSpy.mockRestore();
    dismissKeyboard.mockRestore();
  });

  it('uses drag keyboard dismissal without treating programmatic restoration as a user drag', async () => {
    (cachedFollowingCommunityFeedService.list as jest.Mock).mockResolvedValue({
      followsAnyone: true,
      reviews: [],
    });
    const screen = render(<CommunityScreen />);

    await screen.findByText('Your Following feed is quiet');
    const dismissKeyboard = jest.spyOn(Keyboard, 'dismiss');
    const list = screen.UNSAFE_getByType(FlatList);

    expect(list.props.keyboardDismissMode).toBe('on-drag');
    act(() => list.props.onContentSizeChange(390, 1600));
    expect(dismissKeyboard).not.toHaveBeenCalled();

    act(() => list.props.onScrollBeginDrag());
    expect(dismissKeyboard).toHaveBeenCalledTimes(1);
    dismissKeyboard.mockRestore();
  });

  it('restores ordinary and selected-media Community positions after Review Details', async () => {
    (cachedFollowingCommunityFeedService.list as jest.Mock).mockResolvedValue({
      followsAnyone: true,
      reviews: [
        {
          id: 'arrival-review', authorId: 'alex-1',
          author: { id: 'alex-1', displayName: 'Alex', handle: 'alex', handleNormalized: 'alex', profileImage: null, accountPrivacy: 'public' },
          movieTitle: 'Arrival', reviewText: 'Thoughtful science fiction.', rating: 5,
          spoilerWarning: false, visibility: 'public', createdAt: '2026-10-10T12:00:00.000Z', syncStatus: 'synced',
        },
      ],
    });
    (mediaCatalogService.search as jest.Mock).mockImplementation((_query, options) =>
      Promise.resolve({
        items: options?.mediaType === 'movie'
          ? [{ catalogId: 'tmdb:movie:329865', mediaType: 'movie', reviewTargetType: 'movie', title: 'Arrival', releaseYear: 2016, genres: [], posterUrl: null }]
          : [],
        nextCursor: null,
      })
    );
    (exactMediaCommunitySearchService.search as jest.Mock).mockResolvedValue({
      reviews: [
        {
          id: 'selected-arrival-review', authorId: 'alex-1',
          author: { id: 'alex-1', displayName: 'Alex', handle: 'alex', handleNormalized: 'alex', profileImage: null, accountPrivacy: 'public' },
          movieTitle: 'Arrival', reviewText: 'Still thoughtful.', rating: 5,
          spoilerWarning: false, visibility: 'public', createdAt: '2026-10-10T12:00:00.000Z', syncStatus: 'synced',
        },
      ],
      pagination: { retrieval: 'bounded', nextCursor: null },
    });
    const scrollToOffset = jest.spyOn(FlatList.prototype, 'scrollToOffset');
    const screen = render(<CommunityScreen />);

    await screen.findByText('Arrival');
    let list = screen.UNSAFE_getByType(FlatList);
    act(() => {
      list.props.onContentSizeChange(390, 1600);
      list.props.onScroll({ nativeEvent: { contentOffset: { y: 275 } } });
      blurCommunityScreen();
      list.props.onScroll({ nativeEvent: { contentOffset: { y: 0 } } });
      // The native list may report its existing content before the screen's
      // focus effect has armed restoration.
      list.props.onContentSizeChange(390, 1600);
      focusCommunityScreen();
    });
    await waitFor(() => {
      expect(scrollToOffset).toHaveBeenLastCalledWith({ animated: false, offset: 275 });
    });

    fireEvent.changeText(screen.getByLabelText('Search community reviews'), 'arrival');
    fireEvent.press(await screen.findByLabelText('Select Arrival'));
    expect(await screen.findByText('Reviews for Arrival')).toBeTruthy();
    list = screen.UNSAFE_getByType(FlatList);
    act(() => {
      list.props.onContentSizeChange(390, 1600);
      list.props.onScroll({ nativeEvent: { contentOffset: { y: 390 } } });
      blurCommunityScreen();
      list.props.onScroll({ nativeEvent: { contentOffset: { y: 0 } } });
      focusCommunityScreen();
    });

    expect(screen.getByText('Reviews for Arrival')).toBeTruthy();
    expect(getCommunityScrollOffset('viewer-1')).toBe(390);
    await waitFor(() => {
      expect(scrollToOffset).toHaveBeenLastCalledWith({ animated: false, offset: 390 });
    });
    scrollToOffset.mockRestore();
  });

  it('restores an ordinary Everyone position without reloading search state', async () => {
    (cachedFollowingCommunityFeedService.list as jest.Mock).mockResolvedValue({
      followsAnyone: true,
      reviews: [],
    });
    (cachedEveryoneCommunityFeedService.listPage as jest.Mock).mockResolvedValue({
      reviews: [
        {
          id: 'everyone-review', authorId: 'maya-1',
          author: { id: 'maya-1', displayName: 'Maya', handle: 'maya', handleNormalized: 'maya', profileImage: null, accountPrivacy: 'public' },
          movieTitle: 'Wednesday', reviewText: 'A clever mystery.', rating: 4,
          spoilerWarning: false, visibility: 'public', createdAt: '2026-10-10T12:00:00.000Z', syncStatus: 'synced',
        },
      ],
      nextCursor: null,
      source: 'remote',
      remoteError: null,
    });
    const scrollToOffset = jest.spyOn(FlatList.prototype, 'scrollToOffset');
    const screen = render(<CommunityScreen />);

    await screen.findByText('Your Following feed is quiet');
    fireEvent.press(screen.getByText('Everyone'));
    await screen.findByText('Wednesday');
    const list = screen.UNSAFE_getByType(FlatList);
    act(() => {
      list.props.onContentSizeChange(390, 1600);
      list.props.onScroll({ nativeEvent: { contentOffset: { y: 285 } } });
      blurCommunityScreen();
      list.props.onScroll({ nativeEvent: { contentOffset: { y: 0 } } });
      focusCommunityScreen();
    });

    await waitFor(() => {
      expect(scrollToOffset).toHaveBeenLastCalledWith({ animated: false, offset: 285 });
    });
    expect(screen.getByText('Everyone')).toBeTruthy();
    expect(screen.getByText('Wednesday')).toBeTruthy();
    scrollToOffset.mockRestore();
  });

  it('does not let a delayed catalog response reset a restored search position', async () => {
    let resolveMovieSearch: ((value: { items: unknown[]; nextCursor: null }) => void) | undefined;
    let resolveTvSearch: ((value: { items: unknown[]; nextCursor: null }) => void) | undefined;
    (cachedFollowingCommunityFeedService.list as jest.Mock).mockResolvedValue({
      followsAnyone: true,
      reviews: [
        {
          id: 'delayed-wednesday-review', authorId: 'maya-1',
          author: { id: 'maya-1', displayName: 'Maya', handle: 'maya', handleNormalized: 'maya', profileImage: null, accountPrivacy: 'public' },
          movieTitle: 'Wednesday', reviewText: 'A clever mystery.', rating: 4,
          spoilerWarning: false, visibility: 'public', createdAt: '2026-10-10T12:00:00.000Z', syncStatus: 'synced',
        },
      ],
    });
    (mediaCatalogService.search as jest.Mock).mockImplementation((_query, options) =>
      new Promise((resolve) => {
        if (options?.mediaType === 'movie') {
          resolveMovieSearch = resolve;
        } else {
          resolveTvSearch = resolve;
        }
      })
    );
    const scrollToOffset = jest.spyOn(FlatList.prototype, 'scrollToOffset');
    const screen = render(<CommunityScreen />);

    await screen.findByText('Wednesday');
    fireEvent.changeText(screen.getByLabelText('Search community reviews'), 'Wednesday');
    expect(await screen.findByText('Review Text Matches')).toBeTruthy();
    const list = screen.UNSAFE_getByType(FlatList);
    act(() => {
      list.props.onContentSizeChange(390, 1600);
      list.props.onScroll({ nativeEvent: { contentOffset: { y: 512 } } });
      blurCommunityScreen();
      focusCommunityScreen();
    });

    await waitFor(() => {
      expect(resolveMovieSearch).toBeDefined();
      expect(resolveTvSearch).toBeDefined();
    });
    await act(async () => {
      resolveMovieSearch?.({ items: [], nextCursor: null });
      resolveTvSearch?.({ items: [], nextCursor: null });
    });
    act(() => list.props.onContentSizeChange(390, 1800));

    expect(screen.getByDisplayValue('Wednesday')).toBeTruthy();
    expect(getCommunityScrollOffset('viewer-1')).toBe(512);
    expect(scrollToOffset).toHaveBeenLastCalledWith({ animated: false, offset: 512 });
    scrollToOffset.mockRestore();
  });

  it('ignores a delayed focus restoration after a main-tab exit', async () => {
    const interactionTasks: Array<() => void> = [];
    const interactionSpy = jest
      .spyOn(InteractionManager, 'runAfterInteractions')
      .mockImplementation((task) => {
        if (typeof task === 'function') interactionTasks.push(task);
        return {
          cancel: jest.fn(),
          done: jest.fn(),
          then: (onfulfilled, onrejected) =>
            Promise.resolve().then(onfulfilled, onrejected),
        };
      });
    const scrollToOffset = jest.spyOn(FlatList.prototype, 'scrollToOffset');
    (cachedFollowingCommunityFeedService.list as jest.Mock).mockResolvedValue({
      followsAnyone: true,
      reviews: [
        {
          id: 'review-1', authorId: 'alex-1',
          author: { id: 'alex-1', displayName: 'Alex', handle: 'alex', handleNormalized: 'alex', profileImage: null, accountPrivacy: 'public' },
          movieTitle: 'Arrival', reviewText: 'Thoughtful.', rating: 5,
          spoilerWarning: false, visibility: 'public', createdAt: '2026-10-10T12:00:00.000Z', syncStatus: 'synced',
        },
      ],
    });
    const screen = render(<CommunityScreen />);

    await screen.findByText('Arrival');
    const list = screen.UNSAFE_getByType(FlatList);
    act(() => {
      list.props.onScroll({ nativeEvent: { contentOffset: { y: 330 } } });
      blurCommunityScreen();
      focusCommunityScreen();
    });
    const delayedRestore = interactionTasks.at(-1);
    expect(delayedRestore).toBeDefined();

    act(() => emitParentTabEvent('blur'));
    act(() => delayedRestore?.());

    expect(getCommunityScrollOffset('viewer-1')).toBe(0);
    expect(scrollToOffset).not.toHaveBeenCalledWith({ animated: false, offset: 330 });
    scrollToOffset.mockRestore();
    interactionSpy.mockRestore();
  });

  it('uses a later content-size event when the post-focus list is not ready', async () => {
    const interactionTasks: Array<() => void> = [];
    const interactionSpy = jest
      .spyOn(InteractionManager, 'runAfterInteractions')
      .mockImplementation((task) => {
        if (typeof task === 'function') interactionTasks.push(task);
        return {
          cancel: jest.fn(),
          done: jest.fn(),
          then: (onfulfilled, onrejected) =>
            Promise.resolve().then(onfulfilled, onrejected),
        };
      });
    const scrollToOffset = jest.spyOn(FlatList.prototype, 'scrollToOffset');
    (cachedFollowingCommunityFeedService.list as jest.Mock).mockResolvedValue({
      followsAnyone: true,
      reviews: [],
    });
    const screen = render(<CommunityScreen />);

    await screen.findByText('Your Following feed is quiet');
    setCommunityScrollOffset('viewer-1', 410);
    act(() => {
      blurCommunityScreen();
      focusCommunityScreen();
    });
    const delayedRestore = interactionTasks.at(-1);
    act(() => delayedRestore?.());
    expect(scrollToOffset).not.toHaveBeenCalledWith({ animated: false, offset: 410 });

    const list = screen.UNSAFE_getByType(FlatList);
    act(() => list.props.onContentSizeChange(390, 1700));
    expect(scrollToOffset).toHaveBeenLastCalledWith({ animated: false, offset: 410 });
    scrollToOffset.mockRestore();
    interactionSpy.mockRestore();
  });

  it('cancels a pending focus restoration when a new search selects different media', async () => {
    const interactionTasks: Array<() => void> = [];
    const interactionSpy = jest
      .spyOn(InteractionManager, 'runAfterInteractions')
      .mockImplementation((task) => {
        if (typeof task === 'function') interactionTasks.push(task);
        return {
          cancel: jest.fn(),
          done: jest.fn(),
          then: (onfulfilled, onrejected) =>
            Promise.resolve().then(onfulfilled, onrejected),
        };
      });
    const scrollToOffset = jest.spyOn(FlatList.prototype, 'scrollToOffset');
    (cachedFollowingCommunityFeedService.list as jest.Mock).mockResolvedValue({
      followsAnyone: true,
      reviews: [
        {
          id: 'review-1', authorId: 'alex-1',
          author: { id: 'alex-1', displayName: 'Alex', handle: 'alex', handleNormalized: 'alex', profileImage: null, accountPrivacy: 'public' },
          movieTitle: 'Arrival', reviewText: 'Thoughtful.', rating: 5,
          spoilerWarning: false, visibility: 'public', createdAt: '2026-10-10T12:00:00.000Z', syncStatus: 'synced',
        },
      ],
    });
    (mediaCatalogService.search as jest.Mock).mockImplementation((_query, options) =>
      Promise.resolve({
        items: options?.mediaType === 'movie'
          ? [{ catalogId: 'tmdb:movie:329865', mediaType: 'movie', reviewTargetType: 'movie', title: 'Arrival', releaseYear: 2016, genres: [], posterUrl: null }]
          : [],
        nextCursor: null,
      })
    );
    const screen = render(<CommunityScreen />);

    await screen.findByText('Arrival');
    const list = screen.UNSAFE_getByType(FlatList);
    act(() => {
      list.props.onScroll({ nativeEvent: { contentOffset: { y: 360 } } });
      blurCommunityScreen();
      focusCommunityScreen();
    });
    const delayedRestore = interactionTasks.at(-1);

    fireEvent.changeText(screen.getByLabelText('Search community reviews'), 'arrival');
    fireEvent.press(await screen.findByLabelText('Select Arrival'));
    act(() => delayedRestore?.());

    expect(await screen.findByText('Reviews for Arrival')).toBeTruthy();
    expect(getCommunityScrollOffset('viewer-1')).toBe(0);
    expect(scrollToOffset).not.toHaveBeenCalledWith({ animated: false, offset: 360 });
    scrollToOffset.mockRestore();
    interactionSpy.mockRestore();
  });

  it('shows catalog empty and error states without making an exact-media review request', async () => {
    (cachedFollowingCommunityFeedService.list as jest.Mock).mockResolvedValue({
      reviews: [], followsAnyone: true,
    });
    (mediaCatalogService.search as jest.Mock).mockImplementation((query) =>
      query === 'nothing'
        ? Promise.resolve({ items: [], nextCursor: null })
        : Promise.reject(new Error('offline'))
    );
    const screen = render(<CommunityScreen />);

    await screen.findByText('Your Following feed is quiet');
    fireEvent.changeText(screen.getByLabelText('Search community reviews'), 'nothing');
    expect(await screen.findByText('No movies or TV series found.')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Clear community review search'));
    fireEvent.changeText(screen.getByLabelText('Search community reviews'), 'retry');
    expect(await screen.findByText('Suggestions are unavailable.')).toBeTruthy();
    expect(screen.getByText('Try again')).toBeTruthy();
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

    expect(mockParentTabNavigation.addListener).toHaveBeenCalledWith(
      'blur',
      expect.any(Function)
    );
    act(() => emitParentTabEvent('blur'));
    await waitFor(() => {
      expect(screen.queryByText('The ending changes everything.')).toBeNull();
      expect(screen.getByText('Contains spoilers')).toBeTruthy();
    });
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
