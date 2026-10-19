import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { MediaDetailsScreen } from '@/components/media/MediaDetailsScreen';
import { mediaCatalogService } from '@/services';
import type { MediaDetails, MediaSummary } from '@/types/domain';

jest.mock('@/services', () => ({
  mediaCatalogService: {
    getById: jest.fn(),
  },
  homeImageCacheService: {
    resolve: jest.fn().mockResolvedValue(null),
  },
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: ({ name }: { name: string }) => {
    const { Text } = require('react-native');
    return <Text testID={`icon-${name}`} />;
  },
}));

const summary: MediaSummary = {
  mediaType: 'movie',
  reviewTargetType: 'movie',
  catalogId: 'tmdb:movie:693134',
  title: 'Dune: Part Two',
  releaseYear: 2024,
  genres: ['Science Fiction', 'Adventure'],
  posterUrl: 'https://image.example/w342/dune2.jpg',
  backdropUrl: 'https://image.example/w780/dune2-wide.jpg',
};

const details: MediaDetails = {
  ...summary,
  overview: 'Paul Atreides unites with the Fremen.',
  rating: 7.543,
};

const getByIdMock = mediaCatalogService.getById as jest.Mock;

describe('Media details screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the passed summary instantly and enriches with details', async () => {
    let releaseDetails!: (value: MediaDetails) => void;
    getByIdMock.mockReturnValue(
      new Promise((resolve) => {
        releaseDetails = resolve;
      })
    );

    const screen = render(
      <MediaDetailsScreen
        catalogId={summary.catalogId}
        initialSummary={summary}
      />
    );

    // Summary data renders before the catalog responds.
    expect(screen.getByText('Dune: Part Two')).toBeTruthy();
    expect(screen.getByText('Movie')).toBeTruthy();
    expect(
      screen.getByText('Science Fiction • Adventure • 2024')
    ).toBeTruthy();
    expect(screen.queryByText(/TMDB/)).toBeNull();

    releaseDetails(details);
    await waitFor(() => {
      expect(
        screen.getByText('Paul Atreides unites with the Fremen.')
      ).toBeTruthy();
    });
    expect(screen.getByText('Synopsis')).toBeTruthy();
    expect(screen.getByText('7.5 / 10 · TMDB')).toBeTruthy();
    expect(getByIdMock).toHaveBeenCalledWith(summary.catalogId);
  });

  it('asks the user to connect when the synopsis could not be retrieved', async () => {
    getByIdMock.mockRejectedValue(new Error('Network unavailable'));

    const screen = render(
      <MediaDetailsScreen
        catalogId={summary.catalogId}
        initialSummary={summary}
      />
    );

    await waitFor(() => {
      expect(
        screen.getByText('Connect to the internet to load this synopsis.')
      ).toBeTruthy();
    });
    expect(screen.getByText('Dune: Part Two')).toBeTruthy();
    // A failed request is never presented as a genuinely missing synopsis.
    expect(screen.queryByText('No synopsis available.')).toBeNull();
    expect(screen.queryByText(/TMDB/)).toBeNull();
  });

  it('shows an error state with a working retry when nothing is available', async () => {
    getByIdMock.mockRejectedValueOnce(new Error('Network unavailable'));

    const screen = render(
      <MediaDetailsScreen catalogId={summary.catalogId} />
    );

    await waitFor(() => {
      expect(screen.getByText("Couldn't load details")).toBeTruthy();
    });

    getByIdMock.mockResolvedValue(details);
    fireEvent.press(screen.getByText('Try Again'));

    await waitFor(() => {
      expect(screen.getByText('Dune: Part Two')).toBeTruthy();
    });
    expect(
      screen.getByText('Paul Atreides unites with the Fremen.')
    ).toBeTruthy();
  });

  it('treats cached browse metadata without a synopsis as unretrieved, not missing', async () => {
    // Offline fallback: Home browse seeding cached this title's metadata,
    // but a synopsis was never fetched. The service reports success with a
    // cache-sourced record (catalogDataRetention present, overview null).
    getByIdMock.mockResolvedValue({
      ...summary,
      overview: null,
      catalogDataRetention: {
        fetchedAt: '2026-10-18T12:00:00.000Z',
        refreshAfter: '2027-03-17T12:00:00.000Z',
        expiresAt: '2027-04-15T12:00:00.000Z',
      },
    });

    const screen = render(
      <MediaDetailsScreen
        catalogId={summary.catalogId}
        initialSummary={summary}
      />
    );

    await waitFor(() => {
      expect(
        screen.getByText('Connect to the internet to load this synopsis.')
      ).toBeTruthy();
    });
    expect(screen.queryByText('No synopsis available.')).toBeNull();
  });

  it('shows a cached synopsis in the card even when served from the cache', async () => {
    getByIdMock.mockResolvedValue({
      ...details,
      catalogDataRetention: {
        fetchedAt: '2026-10-18T12:00:00.000Z',
        refreshAfter: '2027-03-17T12:00:00.000Z',
        expiresAt: '2027-04-15T12:00:00.000Z',
      },
    });

    const screen = render(
      <MediaDetailsScreen catalogId={summary.catalogId} />
    );

    await waitFor(() => {
      expect(
        screen.getByText('Paul Atreides unites with the Fremen.')
      ).toBeTruthy();
    });
    expect(
      screen.queryByText('Connect to the internet to load this synopsis.')
    ).toBeNull();
  });

  it('hides the rating and shows a synopsis fallback for sparse titles', async () => {
    getByIdMock.mockResolvedValue({
      ...details,
      overview: null,
      rating: null,
    });

    const screen = render(
      <MediaDetailsScreen catalogId={summary.catalogId} />
    );

    await waitFor(() => {
      expect(screen.getByText('No synopsis available.')).toBeTruthy();
    });
    expect(screen.queryByText(/\/ 10/)).toBeNull();
    expect(
      screen.queryByText('Connect to the internet to load this synopsis.')
    ).toBeNull();
  });

  it('labels TV series correctly', async () => {
    getByIdMock.mockResolvedValue({
      ...details,
      mediaType: 'tv',
      reviewTargetType: 'series',
      catalogId: 'tmdb:tv:95396',
      title: 'Severance',
    });

    const screen = render(<MediaDetailsScreen catalogId="tmdb:tv:95396" />);

    await waitFor(() => {
      expect(screen.getByText('Severance')).toBeTruthy();
    });
    expect(screen.getByText('TV Series')).toBeTruthy();
  });
});
