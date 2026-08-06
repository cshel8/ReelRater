import NetInfo from '@react-native-community/netinfo';
import { router } from 'expo-router';
import { Alert } from 'react-native';
import {
  act,
  fireEvent,
  render,
  waitFor,
} from '@testing-library/react-native';
import ReviewScreen from '@/app/(tabs)/reviews/write';
import {
  mediaCatalogService,
  reviewService,
  settingsService,
} from '@/services';
import { DuplicateReviewError } from '@/services/reviews/reviewErrors';

const mockDispatch = jest.fn();
let mockPreventRemove:
  | ((options: { data: { action: { type: string } } }) => void)
  | undefined;

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
  },
  useNavigation: () => ({ dispatch: mockDispatch }),
}));

jest.mock('expo-router/react-navigation', () => ({
  usePreventRemove: (
    preventRemove: boolean,
    callback: (options: { data: { action: { type: string } } }) => void
  ) => {
    mockPreventRemove = preventRemove ? callback : undefined;
  },
}));

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
  mediaCatalogService: {
    search: jest.fn(),
    getById: jest.fn(),
  },
  reviewService: {
    create: jest.fn(),
    findForMedia: jest.fn(),
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
    mockPreventRemove = undefined;
    (reviewService.listForUser as jest.Mock).mockResolvedValue({
      reviews: [],
      pendingCount: 0,
      remoteAvailable: true,
    });
    (reviewService.findForMedia as jest.Mock).mockResolvedValue(null);
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
    (mediaCatalogService.search as jest.Mock).mockResolvedValue({
      items: [],
      nextCursor: null,
    });
    (mediaCatalogService.getById as jest.Mock).mockResolvedValue(null);
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
          mediaType: 'movie',
          reviewTargetType: 'movie',
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

  it('returns to My Reviews after acknowledging a successful post', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const screen = render(<ReviewScreen />);

    fireEvent.changeText(screen.getByLabelText('Movie title'), 'Arrival');
    fireEvent.press(screen.getByLabelText('4 out of 5 stars'));
    fireEvent.changeText(screen.getByLabelText('Your review'), 'Excellent.');
    fireEvent.press(screen.getByText('Post Review'));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        'Review posted!',
        undefined,
        expect.any(Array)
      );
    });

    const successAlert = alertSpy.mock.calls.find(
      ([title]) => title === 'Review posted!'
    );
    const buttons = successAlert?.[2];
    buttons?.[0]?.onPress?.();

    expect(router.replace).toHaveBeenCalledWith('/reviews');
  });

  it('saves the selected catalog movie as a review snapshot', async () => {
    (mediaCatalogService.search as jest.Mock).mockResolvedValue({
      items: [
        {
          mediaType: 'movie',
          reviewTargetType: 'movie',
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
    expect(
      await screen.findByLabelText('Selected movie: Arrival')
    ).toBeTruthy();
    expect(screen.getByLabelText('Selected poster for Arrival')).toBeTruthy();
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

  it('searches and saves a selected TV series', async () => {
    (mediaCatalogService.search as jest.Mock).mockResolvedValue({
      items: [
        {
          mediaType: 'tv',
          reviewTargetType: 'series',
          catalogId: 'tmdb:tv:61709',
          title: 'Dragon Ball Z Kai',
          releaseYear: 2009,
          genres: ['Animation', 'Action & Adventure'],
          posterUrl: 'https://image.example/kai.jpg',
        },
      ],
      nextCursor: null,
    });
    const screen = render(<ReviewScreen />);

    fireEvent.press(screen.getByText('TV Show'));
    fireEvent.changeText(
      screen.getByLabelText('TV show title'),
      'Dragon Ball Z'
    );
    fireEvent.press(
      await screen.findByLabelText('Select Dragon Ball Z Kai (2009)')
    );
    expect(
      await screen.findByLabelText('Selected TV show: Dragon Ball Z Kai')
    ).toBeTruthy();
    fireEvent.press(screen.getByLabelText('5 out of 5 stars'));
    fireEvent.changeText(
      screen.getByLabelText('Your review'),
      'A streamlined version of a classic series.'
    );
    fireEvent.press(screen.getByText('Post Review'));

    await waitFor(() => {
      expect(mediaCatalogService.search).toHaveBeenCalledWith(
        'Dragon Ball Z',
        { maximumResults: 8, mediaType: 'tv' }
      );
      expect(reviewService.create).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          movieTitle: 'Dragon Ball Z Kai',
          movie: expect.objectContaining({
            mediaType: 'tv',
            reviewTargetType: 'series',
            matchStatus: 'matched',
            catalogId: 'tmdb:tv:61709',
          }),
        })
      );
    });
  });

  it('uses TV show wording when the selected series was already reviewed', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const tvSeries = {
      mediaType: 'tv',
      reviewTargetType: 'series',
      catalogId: 'tmdb:tv:61709',
      title: 'Dragon Ball Z Kai',
      releaseYear: 2009,
      genres: ['Animation'],
      posterUrl: null,
    };
    (mediaCatalogService.search as jest.Mock).mockResolvedValue({
      items: [tvSeries],
      nextCursor: null,
    });
    (reviewService.findForMedia as jest.Mock).mockResolvedValue({
      id: 'existing-tv-review',
      movieTitle: tvSeries.title,
      reviewText: 'Already reviewed.',
      rating: '4',
      visibility: 'private',
      createdAt: '2026-07-18T12:00:00.000Z',
      syncStatus: 'synced',
    });
    const screen = render(<ReviewScreen />);

    fireEvent.press(screen.getByText('TV Show'));
    fireEvent.changeText(screen.getByLabelText('TV show title'), 'Dragon Ball');
    fireEvent.press(
      await screen.findByLabelText('Select Dragon Ball Z Kai (2009)')
    );

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        'Review already exists',
        'You’ve already reviewed this TV show.',
        expect.any(Array)
      );
    });
    expect(screen.queryByLabelText('Selected TV show: Dragon Ball Z Kai')).toBeNull();

    const duplicateAlert = alertSpy.mock.calls.find(
      ([title]) => title === 'Review already exists'
    );
    const editButton = duplicateAlert?.[2]?.find(
      (button) => button.text === 'Edit Existing Review'
    );
    act(() => editButton?.onPress?.());

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith({
        pathname: '/reviews/[reviewId]',
        params: { edit: 'true', reviewId: 'existing-tv-review' },
      });
    });
  });

  it('blocks an older indexed duplicate while its full review is unavailable offline', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const movie = {
      mediaType: 'movie',
      reviewTargetType: 'movie',
      catalogId: 'tmdb:movie:329865',
      title: 'Arrival',
      releaseYear: 2016,
      genres: ['Drama'],
      posterUrl: null,
    };
    (mediaCatalogService.search as jest.Mock).mockResolvedValue({
      items: [movie],
      nextCursor: null,
    });
    (reviewService.findForMedia as jest.Mock).mockRejectedValue(
      new DuplicateReviewError(null, 'older-review')
    );
    const screen = render(<ReviewScreen />);

    fireEvent.changeText(screen.getByLabelText('Movie title'), 'Arrival');
    fireEvent.press(await screen.findByLabelText('Select Arrival (2016)'));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        'Review already exists',
        'You’ve already reviewed this movie. Connect to the internet to view or edit your existing review.',
        [{ text: 'OK' }]
      );
    });
  });

  it('saves a manually entered TV series with its target identity', async () => {
    const screen = render(<ReviewScreen />);

    fireEvent.press(screen.getByText('TV Show'));
    fireEvent.changeText(screen.getByLabelText('TV show title'), 'Test Series');
    fireEvent.press(screen.getByLabelText('4 out of 5 stars'));
    fireEvent.changeText(
      screen.getByLabelText('Your review'),
      'A manually entered series review.'
    );
    fireEvent.press(screen.getByText('Post Review'));

    await waitFor(() => {
      expect(reviewService.create).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          movieTitle: 'Test Series',
          movie: expect.objectContaining({
            mediaType: 'tv',
            reviewTargetType: 'series',
            matchStatus: 'manual',
            catalogId: null,
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

  it('offers to post a completed draft before leaving', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const screen = render(<ReviewScreen />);

    fireEvent.changeText(screen.getByLabelText('Movie title'), 'Arrival');
    fireEvent.press(screen.getByLabelText('4 out of 5 stars'));
    fireEvent.changeText(
      screen.getByLabelText('Your review'),
      'Excellent science fiction.'
    );

    const backAction = { type: 'GO_BACK' };
    act(() => {
      mockPreventRemove?.({ data: { action: backAction } });
    });

    expect(alertSpy).toHaveBeenCalledWith(
      'Post review before leaving?',
      "Your review hasn't been posted. Would you like to post it before leaving?",
      expect.any(Array)
    );

    const buttons = alertSpy.mock.calls.at(-1)?.[2];
    const postButton = buttons?.find((button) => button.text === 'Post Review');
    await act(async () => {
      postButton?.onPress?.();
    });

    await waitFor(() => {
      expect(reviewService.create).toHaveBeenCalled();
      expect(mockDispatch).toHaveBeenCalledWith(backAction);
    });
  });

  it('does not intercept leaving when the form is blank', async () => {
    render(<ReviewScreen />);

    await waitFor(() => {
      expect(settingsService.get).toHaveBeenCalledWith('user-1');
    });

    expect(mockPreventRemove).toBeUndefined();
  });
});
