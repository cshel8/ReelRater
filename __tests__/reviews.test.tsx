import NetInfo from '@react-native-community/netinfo';
import {
  act,
  fireEvent,
  render,
  waitFor,
} from '@testing-library/react-native';
import ReviewScreen from '@/app/(tabs)/reviews/write';
import {
  movieCatalogService,
  reviewService,
  settingsService,
} from '@/services';

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    addEventListener: jest.fn(() => jest.fn()),
  },
}));

jest.mock('@/store/userStore', () => ({
  userStore: () => ({ userId: 'user-1' }),
}));

jest.mock('@/services', () => ({
  movieCatalogService: {
    search: jest.fn(),
    getById: jest.fn(),
  },
  reviewService: {
    create: jest.fn(),
    listForUser: jest.fn(),
    syncPending: jest.fn(),
  },
  settingsService: {
    get: jest.fn(),
  },
}));

describe('Write Review screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (reviewService.listForUser as jest.Mock).mockResolvedValue({
      reviews: [],
      pendingCount: 0,
      remoteAvailable: true,
    });
    (reviewService.syncPending as jest.Mock).mockResolvedValue({
      syncedCount: 0,
      failedCount: 0,
      pendingCount: 0,
    });
    (reviewService.create as jest.Mock).mockResolvedValue({
      id: 'review-1',
      movieTitle: 'Arrival',
      reviewText: 'Excellent science fiction.',
      rating: '4',
      visibility: 'private',
      createdAt: '2026-07-18T12:00:00.000Z',
      syncStatus: 'synced',
    });
    (settingsService.get as jest.Mock).mockResolvedValue({
      defaultReviewVisibility: 'private',
    });
    (movieCatalogService.search as jest.Mock).mockResolvedValue({
      movies: [],
      nextCursor: null,
    });
    (movieCatalogService.getById as jest.Mock).mockResolvedValue(null);
  });

  it('starts with the profile default but allows a one-review override', async () => {
    (settingsService.get as jest.Mock).mockResolvedValue({
      defaultReviewVisibility: 'followers',
    });
    const screen = render(<ReviewScreen />);

    await waitFor(() => {
      expect(settingsService.get).toHaveBeenCalledWith('user-1');
    });
    fireEvent.press(screen.getByText('Public'));
    fireEvent.changeText(screen.getByLabelText('Movie title'), 'Arrival');
    fireEvent.press(screen.getByLabelText('4 out of 5 stars'));
    fireEvent.changeText(
      screen.getByLabelText('Your review'),
      'Excellent science fiction.'
    );
    fireEvent.press(screen.getByText('Post Review'));

    await waitFor(() => {
      expect(reviewService.create).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ visibility: 'public' })
      );
    });
  });

  it('posts the selected star rating without imposing a review length cap', async () => {
    const screen = render(<ReviewScreen />);
    const reviewInput = screen.getByLabelText('Your review');

    expect(reviewInput.props.maxLength).toBeUndefined();

    fireEvent.changeText(screen.getByLabelText('Movie title'), 'Arrival');
    fireEvent.press(screen.getByLabelText('4 out of 5 stars'));
    fireEvent.changeText(reviewInput, 'Excellent science fiction.');
    fireEvent.press(screen.getByText('Post Review'));

    await waitFor(() => {
      expect(reviewService.create).toHaveBeenCalledWith('user-1', {
        movieTitle: 'Arrival',
        movie: {
          matchStatus: 'manual',
          catalogId: null,
          title: 'Arrival',
          releaseYear: null,
          genres: [],
          posterUrl: null,
        },
        reviewText: 'Excellent science fiction.',
        rating: '4',
        visibility: 'private',
      });
    });
  });

  it('saves the selected catalog movie as a review snapshot', async () => {
    (movieCatalogService.search as jest.Mock).mockResolvedValue({
      movies: [
        {
          catalogId: 'tmdb:329865',
          title: 'Arrival',
          releaseYear: 2016,
          genres: ['Drama', 'Science Fiction'],
          posterUrl: 'https://image.example/arrival.jpg',
        },
      ],
      nextCursor: null,
    });
    const screen = render(<ReviewScreen />);

    fireEvent.changeText(screen.getByLabelText('Movie title'), 'Arriv');
    fireEvent.press(await screen.findByLabelText('Select Arrival (2016)'));
    fireEvent.press(screen.getByLabelText('5 out of 5 stars'));
    fireEvent.changeText(
      screen.getByLabelText('Your review'),
      'A thoughtful science-fiction film.'
    );
    fireEvent.press(screen.getByText('Post Review'));

    await waitFor(() => {
      expect(reviewService.create).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          movieTitle: 'Arrival',
          movie: expect.objectContaining({
            matchStatus: 'matched',
            catalogId: 'tmdb:329865',
            title: 'Arrival',
            releaseYear: 2016,
            genres: ['Drama', 'Science Fiction'],
            posterUrl: 'https://image.example/arrival.jpg',
            catalogDataRetention: expect.objectContaining({
              fetchedAt: expect.any(String),
              refreshAfter: expect.any(String),
              expiresAt: expect.any(String),
            }),
          }),
        })
      );
    });
  });

  it('shows the offline notice only while the device is offline', async () => {
    const screen = render(<ReviewScreen />);
    const networkListener = (NetInfo.addEventListener as jest.Mock).mock
      .calls[0][0];

    await waitFor(() => {
      expect(reviewService.listForUser).toHaveBeenCalled();
    });
    expect(screen.queryByText(/Offline mode/)).toBeNull();

    act(() => {
      networkListener({
        isConnected: false,
        isInternetReachable: false,
      });
    });
    expect(screen.getByText(/Offline mode/)).toBeTruthy();

    await act(async () => {
      networkListener({
        isConnected: true,
        isInternetReachable: true,
      });
    });
    expect(screen.queryByText(/Offline mode/)).toBeNull();
  });
});
