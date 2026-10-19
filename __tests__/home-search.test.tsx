import { act, fireEvent, render } from '@testing-library/react-native';
import { router } from 'expo-router';
import { HomeSearchPanel } from '@/components/home/HomeSearchPanel';
import { mediaCatalogService } from '@/services';
import { isCatalogServiceReachable } from '@/services/http/movieCatalogService';
import type { MediaSearchPage, MediaSummary } from '@/types/domain';

type ConnectivityListener = (state: {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
}) => void;

const mockConnectivityListeners = new Set<ConnectivityListener>();

jest.mock('@/services', () => ({
  mediaCatalogService: {
    search: jest.fn(),
  },
  homeImageCacheService: {
    resolve: jest.fn().mockResolvedValue(null),
  },
}));

jest.mock('@/services/http/movieCatalogService', () => ({
  isCatalogServiceReachable: jest.fn(),
}));

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
}));

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn((listener: ConnectivityListener) => {
    mockConnectivityListeners.add(listener);
    return () => mockConnectivityListeners.delete(listener);
  }),
}));

const movie = (catalogId: string, title: string): MediaSummary => ({
  mediaType: 'movie',
  reviewTargetType: 'movie',
  catalogId,
  title,
  releaseYear: 2024,
  genres: ['Science Fiction'],
  posterUrl: null,
});

const series = (catalogId: string, title: string): MediaSummary => ({
  mediaType: 'tv',
  reviewTargetType: 'series',
  catalogId,
  title,
  releaseYear: 2022,
  genres: ['Drama'],
  posterUrl: null,
});

const page = (items: MediaSummary[]): MediaSearchPage => ({
  items,
  nextCursor: null,
});

const searchMock = mediaCatalogService.search as jest.Mock;
const reachableMock = isCatalogServiceReachable as jest.Mock;

const typeAndSearch = async (
  screen: ReturnType<typeof render>,
  query: string
) => {
  fireEvent.changeText(
    screen.getByLabelText('Search movies and TV shows'),
    query
  );
  await act(async () => {
    jest.advanceTimersByTime(300);
  });
  await act(async () => {});
};

const goOffline = () => {
  act(() => {
    for (const listener of mockConnectivityListeners) {
      listener({ isConnected: false, isInternetReachable: false });
    }
  });
};

describe('Home search screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockConnectivityListeners.clear();
    reachableMock.mockResolvedValue(true);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('debounces one request pair and renders grouped results', async () => {
    searchMock.mockImplementation(async (_query, options) =>
      options?.mediaType === 'tv'
        ? page([series('tmdb:tv:95396', 'Severance')])
        : page([movie('tmdb:movie:693134', 'Dune: Part Two')])
    );

    const screen = render(<HomeSearchPanel />);
    expect(
      screen.getByLabelText('Search movies and TV shows')
    ).toBeTruthy();

    fireEvent.changeText(
      screen.getByLabelText('Search movies and TV shows'),
      'du'
    );
    fireEvent.changeText(
      screen.getByLabelText('Search movies and TV shows'),
      'dune'
    );
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    await act(async () => {});

    // Only the final query was searched, once per media type.
    expect(searchMock).toHaveBeenCalledTimes(2);
    expect(searchMock).toHaveBeenCalledWith('dune', {
      maximumResults: 10,
      mediaType: 'movie',
    });
    expect(searchMock).toHaveBeenCalledWith('dune', {
      maximumResults: 10,
      mediaType: 'tv',
    });
    expect(screen.getByText('Movies')).toBeTruthy();
    expect(screen.getByText('Dune: Part Two')).toBeTruthy();
    expect(screen.getByText('Movie · 2024')).toBeTruthy();
    expect(screen.getByText('TV Shows')).toBeTruthy();
    expect(screen.getByText('Severance')).toBeTruthy();
    expect(screen.getByText('TV Series · 2022')).toBeTruthy();
  });

  it('never shows a previous query’s results for a new query', async () => {
    let releaseFirst!: (value: MediaSearchPage) => void;
    searchMock.mockImplementation(async (query: string, options) => {
      if (query === 'alien') {
        return options?.mediaType === 'movie'
          ? new Promise<MediaSearchPage>((resolve) => {
              releaseFirst = resolve;
            })
          : page([]);
      }
      return options?.mediaType === 'movie'
        ? page([movie('tmdb:movie:2', 'Arrival')])
        : page([]);
    });

    const screen = render(<HomeSearchPanel />);
    await typeAndSearch(screen, 'alien');
    await typeAndSearch(screen, 'arrival');

    expect(screen.getByText('Arrival')).toBeTruthy();

    // The slow response for the superseded query arrives late and is dropped.
    await act(async () => {
      releaseFirst(page([movie('tmdb:movie:1', 'Alien: Romulus')]));
    });
    expect(screen.queryByText('Alien: Romulus')).toBeNull();
    expect(screen.getByText('Arrival')).toBeTruthy();
  });

  it('opens media details with the selected result', async () => {
    searchMock.mockImplementation(async (_query, options) =>
      options?.mediaType === 'movie'
        ? page([movie('tmdb:movie:693134', 'Dune: Part Two')])
        : page([])
    );

    const screen = render(<HomeSearchPanel />);
    await typeAndSearch(screen, 'dune');

    fireEvent.press(screen.getByLabelText('Open details for Dune: Part Two'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/home/media/[catalogId]',
      params: {
        catalogId: 'tmdb:movie:693134',
        summary: JSON.stringify(movie('tmdb:movie:693134', 'Dune: Part Two')),
      },
    });
  });

  it('clears the query, removing results and reporting no active query', async () => {
    searchMock.mockImplementation(async (_query, options) =>
      options?.mediaType === 'movie'
        ? page([movie('tmdb:movie:693134', 'Dune: Part Two')])
        : page([])
    );
    const onQueryPresenceChange = jest.fn();

    const screen = render(
      <HomeSearchPanel onQueryPresenceChange={onQueryPresenceChange} />
    );
    await typeAndSearch(screen, 'dune');
    expect(screen.getByText('Dune: Part Two')).toBeTruthy();
    expect(onQueryPresenceChange).toHaveBeenLastCalledWith(true);

    fireEvent.press(screen.getByLabelText('Clear search'));
    expect(screen.queryByText('Dune: Part Two')).toBeNull();
    expect(onQueryPresenceChange).toHaveBeenLastCalledWith(false);
  });

  it('shows "no results" only when the catalog was reachable', async () => {
    searchMock.mockResolvedValue(page([]));
    reachableMock.mockResolvedValue(true);

    const screen = render(<HomeSearchPanel />);
    await typeAndSearch(screen, 'zzzz');
    expect(screen.getByText('No results for “zzzz”.')).toBeTruthy();

    reachableMock.mockResolvedValue(false);
    await typeAndSearch(screen, 'zzzzy');
    expect(
      screen.getByText(
        'Search is unavailable right now. Check your connection and try again.'
      )
    ).toBeTruthy();
    expect(screen.queryByText(/No results/)).toBeNull();

    // Retry re-runs the same query.
    searchMock.mockClear();
    fireEvent.press(screen.getByText('Try Again'));
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    await act(async () => {});
    expect(searchMock).toHaveBeenCalledWith('zzzzy', {
      maximumResults: 10,
      mediaType: 'movie',
    });
  });

  it('marks cache-sourced results as possibly incomplete', async () => {
    searchMock.mockImplementation(async (_query, options) =>
      options?.mediaType === 'movie'
        ? page([
            {
              ...movie('tmdb:movie:693134', 'Dune: Part Two'),
              catalogDataRetention: {
                fetchedAt: '2026-10-18T12:00:00.000Z',
                refreshAfter: '2027-03-17T12:00:00.000Z',
                expiresAt: '2027-04-15T12:00:00.000Z',
              },
            },
          ])
        : page([])
    );

    const screen = render(<HomeSearchPanel />);
    await typeAndSearch(screen, 'dune');

    expect(screen.getByText('Dune: Part Two')).toBeTruthy();
    expect(
      screen.getByText(
        'Showing previously loaded titles — results may be incomplete.'
      )
    ).toBeTruthy();
  });

  it('reports offline search failures without probing the server', async () => {
    searchMock.mockResolvedValue(page([]));

    const screen = render(<HomeSearchPanel />);
    goOffline();
    await typeAndSearch(screen, 'dune');

    expect(
      screen.getByText(
        "You're offline. Connect to the internet to search the catalog."
      )
    ).toBeTruthy();
    expect(reachableMock).not.toHaveBeenCalled();
  });
});
