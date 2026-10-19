import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import Home from '@/app/(tabs)/home';
import {
  homeFeedService,
  homeImageCacheService,
  homeRecommendationsService,
} from '@/services';
import type { HomeSection, HomeSectionContent } from '@/services/contracts';
import type { MediaSummary } from '@/types/domain';

type ConnectivityListener = (state: {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
}) => void;

const mockConnectivityListeners = new Set<ConnectivityListener>();

jest.mock('@/services', () => ({
  homeFeedService: {
    getSection: jest.fn(),
  },
  homeImageCacheService: {
    resolve: jest.fn(),
    purgeStale: jest.fn(),
  },
  homeRecommendationsService: {
    getForUser: jest.fn(),
  },
  mediaCatalogService: {
    search: jest.fn(),
  },
}));

let mockUserId: string | null = 'user-1';
jest.mock('@/store/userStore', () => ({
  userStore: (selector: (state: { userId: string | null }) => unknown) =>
    selector({ userId: mockUserId }),
}));

jest.mock('@/services/http/movieCatalogService', () => ({
  isCatalogServiceReachable: jest.fn(async () => true),
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: ({ name }: { name: string }) => {
    const { Text } = require('react-native');
    return <Text testID={`icon-${name}`} />;
  },
}));

const mockParentBlurListeners = new Set<() => void>();
const mockStackNavigation = {
  getParent: () => ({
    addListener: jest.fn((event: string, listener: () => void) => {
      if (event === 'blur') {
        mockParentBlurListeners.add(listener);
      }
      return () => mockParentBlurListeners.delete(listener);
    }),
  }),
};

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
  },
  useNavigation: () => mockStackNavigation,
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
    React.useEffect(() => callback(), [callback]);
  },
}));

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn((listener: ConnectivityListener) => {
    mockConnectivityListeners.add(listener);
    return () => mockConnectivityListeners.delete(listener);
  }),
}));

const media = (
  catalogId: string,
  title: string,
  overrides: Partial<MediaSummary> = {}
): MediaSummary => ({
  mediaType: 'movie',
  reviewTargetType: 'movie',
  catalogId,
  title,
  releaseYear: 2024,
  genres: ['Science Fiction'],
  posterUrl: `https://image.example/w342/${catalogId}.jpg`,
  backdropUrl: `https://image.example/w780/${catalogId}-wide.jpg`,
  ...overrides,
} as MediaSummary);

const remoteContent = (items: MediaSummary[]): HomeSectionContent => ({
  items,
  source: 'remote',
  fetchedAt: '2026-10-18T12:00:00.000Z',
  remoteError: null,
});

const cachedContent = (
  items: MediaSummary[],
  remoteError: string | null = 'Network unavailable'
): HomeSectionContent => ({
  items,
  source: 'cache',
  fetchedAt: items.length > 0 ? '2026-10-17T12:00:00.000Z' : null,
  remoteError,
});

const sectionMock = homeFeedService.getSection as jest.Mock;

const mockSections = (
  contentBySection: Record<HomeSection, HomeSectionContent>
) => {
  sectionMock.mockImplementation(async (section: HomeSection) =>
    contentBySection[section]
  );
};

describe('Home screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConnectivityListeners.clear();
    mockParentBlurListeners.clear();
    mockUserId = 'user-1';
    (homeRecommendationsService.getForUser as jest.Mock).mockResolvedValue(
      []
    );
    (homeImageCacheService.resolve as jest.Mock).mockResolvedValue(null);
    (homeImageCacheService.purgeStale as jest.Mock).mockResolvedValue(
      undefined
    );
  });

  it('renders the hero and popular sections from loaded content', async () => {
    mockSections({
      trending: remoteContent([
        media('tmdb:movie:1', 'Dune: Part Two'),
        media('tmdb:movie:2', 'Deadpool & Wolverine'),
      ]),
      popularMovies: remoteContent([media('tmdb:movie:3', 'Oppenheimer')]),
      popularTv: remoteContent([
        media('tmdb:tv:4', 'Severance', {
          mediaType: 'tv',
          reviewTargetType: 'series',
          posterUrl: null,
          backdropUrl: null,
        }),
      ]),
    });

    const screen = render(<Home />);

    await waitFor(() => {
      expect(screen.getByText('Dune: Part Two')).toBeTruthy();
    });
    expect(screen.getAllByText('TRENDING NOW').length).toBeGreaterThan(0);
    expect(screen.getByText('Popular Movies')).toBeTruthy();
    expect(screen.getByText('Popular TV')).toBeTruthy();
    expect(screen.getByText('Oppenheimer')).toBeTruthy();
    // Metadata stays visible even when the title has no image at all.
    expect(screen.getByText('Severance')).toBeTruthy();
    expect(screen.queryByText(/Good evening/)).toBeNull();
    expect(homeImageCacheService.purgeStale).toHaveBeenCalled();
  });

  it('shows the subtle stale banner when saved content cannot refresh', async () => {
    mockSections({
      trending: cachedContent([media('tmdb:movie:1', 'Dune: Part Two')]),
      popularMovies: cachedContent([media('tmdb:movie:3', 'Oppenheimer')]),
      popularTv: cachedContent([]),
    });

    const screen = render(<Home />);

    await waitFor(() => {
      expect(screen.getByText('Dune: Part Two')).toBeTruthy();
    });
    expect(
      screen.getByText("Showing saved content — couldn't refresh just now.")
    ).toBeTruthy();
    expect(screen.getByText('Popular Movies')).toBeTruthy();
    expect(screen.queryByText('Popular TV')).toBeNull();
  });

  it('shows an intentional empty state offline with no cache and retries', async () => {
    mockSections({
      trending: cachedContent([]),
      popularMovies: cachedContent([]),
      popularTv: cachedContent([]),
    });

    const screen = render(<Home />);

    await waitFor(() => {
      expect(screen.getByText('Nothing to show yet')).toBeTruthy();
    });
    expect(sectionMock).toHaveBeenCalledTimes(3);

    mockSections({
      trending: remoteContent([media('tmdb:movie:1', 'Dune: Part Two')]),
      popularMovies: remoteContent([media('tmdb:movie:3', 'Oppenheimer')]),
      popularTv: remoteContent([]),
    });
    fireEvent.press(screen.getByText('Try Again'));

    await waitFor(() => {
      expect(screen.getByText('Dune: Part Two')).toBeTruthy();
    });
    expect(sectionMock).toHaveBeenCalledWith('trending', {
      forceRefresh: true,
    });
  });

  it('reloads sections when connectivity returns', async () => {
    mockSections({
      trending: cachedContent([media('tmdb:movie:1', 'Dune: Part Two')]),
      popularMovies: cachedContent([]),
      popularTv: cachedContent([]),
    });

    const screen = render(<Home />);
    await waitFor(() => {
      expect(screen.getByText('Dune: Part Two')).toBeTruthy();
    });
    sectionMock.mockClear();
    mockSections({
      trending: remoteContent([media('tmdb:movie:1', 'Dune: Part Two')]),
      popularMovies: remoteContent([media('tmdb:movie:3', 'Oppenheimer')]),
      popularTv: remoteContent([]),
    });

    await act(async () => {
      for (const listener of mockConnectivityListeners) {
        listener({ isConnected: false, isInternetReachable: false });
      }
      for (const listener of mockConnectivityListeners) {
        listener({ isConnected: true, isInternetReachable: true });
      }
    });

    await waitFor(() => {
      expect(screen.getByText('Oppenheimer')).toBeTruthy();
    });
    expect(sectionMock).toHaveBeenCalledWith('trending', {
      forceRefresh: false,
    });
  });

  it('opens media details from the hero button and poster taps', async () => {
    mockSections({
      trending: remoteContent([media('tmdb:movie:1', 'Dune: Part Two')]),
      popularMovies: remoteContent([media('tmdb:movie:3', 'Oppenheimer')]),
      popularTv: remoteContent([]),
    });

    const screen = render(<Home />);
    await waitFor(() => {
      expect(screen.getByText('Dune: Part Two')).toBeTruthy();
    });

    fireEvent.press(
      screen.getByLabelText('Open details for Dune: Part Two')
    );
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/home/media/[catalogId]',
      params: {
        catalogId: 'tmdb:movie:1',
        summary: JSON.stringify(media('tmdb:movie:1', 'Dune: Part Two')),
      },
    });

    fireEvent.press(screen.getByLabelText('Open details for Oppenheimer'));
    expect(router.push).toHaveBeenLastCalledWith(
      expect.objectContaining({
        params: expect.objectContaining({ catalogId: 'tmdb:movie:3' }),
      })
    );
  });

  it('expands inline search, swaps the feed while querying, and restores it', async () => {
    mockSections({
      trending: remoteContent([media('tmdb:movie:1', 'Dune: Part Two')]),
      popularMovies: remoteContent([media('tmdb:movie:3', 'Oppenheimer')]),
      popularTv: remoteContent([]),
    });

    const screen = render(<Home />);
    await waitFor(() => {
      expect(screen.getByText('Popular Movies')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('Search'));
    // Field open with no query: the feed stays visible.
    expect(screen.getByLabelText('Search movies and TV shows')).toBeTruthy();
    expect(screen.getByText('Popular Movies')).toBeTruthy();

    fireEvent.changeText(
      screen.getByLabelText('Search movies and TV shows'),
      'dune'
    );
    await waitFor(() => {
      expect(screen.queryByText('Popular Movies')).toBeNull();
    });

    fireEvent.press(screen.getByLabelText('Close search'));
    expect(
      screen.queryByLabelText('Search movies and TV shows')
    ).toBeNull();
    await waitFor(() => {
      expect(screen.getByText('Popular Movies')).toBeTruthy();
    });
  });

  it('clears active search when the tab is left', async () => {
    mockSections({
      trending: remoteContent([media('tmdb:movie:1', 'Dune: Part Two')]),
      popularMovies: remoteContent([media('tmdb:movie:3', 'Oppenheimer')]),
      popularTv: remoteContent([]),
    });

    const screen = render(<Home />);
    await waitFor(() => {
      expect(screen.getByText('Popular Movies')).toBeTruthy();
    });
    fireEvent.press(screen.getByLabelText('Search'));
    expect(screen.getByLabelText('Search movies and TV shows')).toBeTruthy();

    await act(async () => {
      for (const listener of mockParentBlurListeners) {
        listener();
      }
    });

    expect(
      screen.queryByLabelText('Search movies and TV shows')
    ).toBeNull();
    expect(screen.getByText('Popular Movies')).toBeTruthy();
  });

  it('shows the Recommended for You row only when personalized results exist', async () => {
    mockSections({
      trending: remoteContent([media('tmdb:movie:1', 'Dune: Part Two')]),
      popularMovies: remoteContent([media('tmdb:movie:3', 'Oppenheimer')]),
      popularTv: remoteContent([]),
    });
    (homeRecommendationsService.getForUser as jest.Mock).mockResolvedValue([
      media('tmdb:movie:50', 'Blade Runner 2049'),
    ]);

    const screen = render(<Home />);

    await waitFor(() => {
      expect(screen.getByText('Recommended for You')).toBeTruthy();
    });
    expect(screen.getByText('Blade Runner 2049')).toBeTruthy();
    expect(screen.getByText('Popular Movies')).toBeTruthy();
    expect(homeRecommendationsService.getForUser).toHaveBeenCalledWith(
      'user-1'
    );
  });

  it('hides the recommendations row for empty or failed results', async () => {
    mockSections({
      trending: remoteContent([media('tmdb:movie:1', 'Dune: Part Two')]),
      popularMovies: remoteContent([media('tmdb:movie:3', 'Oppenheimer')]),
      popularTv: remoteContent([]),
    });
    (homeRecommendationsService.getForUser as jest.Mock).mockRejectedValue(
      new Error('Network unavailable')
    );

    const screen = render(<Home />);

    await waitFor(() => {
      expect(screen.getByText('Popular Movies')).toBeTruthy();
    });
    expect(screen.queryByText('Recommended for You')).toBeNull();
  });

  it('never shows a previous account’s stale recommendations', async () => {
    mockSections({
      trending: remoteContent([media('tmdb:movie:1', 'Dune: Part Two')]),
      popularMovies: remoteContent([media('tmdb:movie:3', 'Oppenheimer')]),
      popularTv: remoteContent([]),
    });
    let releaseFirstUser!: (items: MediaSummary[]) => void;
    (homeRecommendationsService.getForUser as jest.Mock).mockImplementation(
      async (requestUserId: string) =>
        requestUserId === 'user-1'
          ? new Promise<MediaSummary[]>((resolve) => {
              releaseFirstUser = resolve;
            })
          : []
    );

    const screen = render(<Home />);
    await waitFor(() => {
      expect(screen.getByText('Popular Movies')).toBeTruthy();
    });

    // The account switches while user-1's request is still in flight.
    mockUserId = 'user-2';
    screen.rerender(<Home />);
    await act(async () => {
      releaseFirstUser([media('tmdb:movie:50', 'Blade Runner 2049')]);
    });

    expect(screen.queryByText('Recommended for You')).toBeNull();
    expect(screen.queryByText('Blade Runner 2049')).toBeNull();
  });

  it('keeps the screen usable when a section load rejects outright', async () => {
    sectionMock.mockImplementation(async (section: HomeSection) => {
      if (section === 'popularTv') {
        throw new Error('Server exploded');
      }
      return remoteContent([media(`tmdb:movie:${section}`, `Title ${section}`)]);
    });

    const screen = render(<Home />);

    await waitFor(() => {
      expect(screen.getByText('Title trending')).toBeTruthy();
    });
    expect(
      screen.getByText("Showing saved content — couldn't refresh just now.")
    ).toBeTruthy();
  });
});
