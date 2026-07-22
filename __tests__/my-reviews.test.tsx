import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert, FlatList } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { router } from 'expo-router';
import MyReviewsScreen from '@/app/(tabs)/reviews';
import { reviewService } from '@/services';

let mockFocusCallback: (() => void) | undefined;

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
  },
}));

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    addEventListener: jest.fn(() => jest.fn()),
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
      options?: {
        headerLeft?: () => React.ReactNode;
        headerRight?: () => React.ReactNode;
      };
    }) => (
      <>
        {options?.headerLeft?.()}
        {options?.headerRight?.()}
      </>
    ),
  },
  useFocusEffect: (callback: () => void) => {
    const React = require('react');
    mockFocusCallback = callback;
    React.useEffect(callback, [callback]);
  },
}));

jest.mock('@/store/userStore', () => ({
  userStore: (selector: (state: { userId: string }) => unknown) =>
    selector({ userId: 'user-1' }),
}));

jest.mock('@/services', () => ({
  reviewService: {
    listForUser: jest.fn(),
    syncPending: jest.fn(),
  },
}));

describe('My Reviews screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFocusCallback = undefined;
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('true');
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
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
  });

  it('opens the dedicated Write Review screen', async () => {
    const screen = render(<MyReviewsScreen />);

    fireEvent.press(await screen.findByText('Write a Review'));

    expect(router.push).toHaveBeenCalledWith('/reviews/write');
  });

  it('renders reviews using the current data and a poster placeholder', async () => {
    (reviewService.listForUser as jest.Mock).mockResolvedValue({
      reviews: [
        {
          id: 'review-1',
          movieTitle: 'Arrival',
          reviewText: 'Thoughtful, emotional science fiction.',
          rating: '5',
          createdAt: '2026-07-18T12:00:00.000Z',
          syncStatus: 'synced',
        },
      ],
      pendingCount: 0,
      remoteAvailable: true,
    });

    const screen = render(<MyReviewsScreen />);

    expect(await screen.findByText('Arrival')).toBeTruthy();
    expect(
      screen.getByText('Thoughtful, emotional science fiction.')
    ).toBeTruthy();
    expect(screen.getByLabelText('5 out of 5 stars')).toBeTruthy();
    expect(
      screen.getByLabelText('Poster placeholder for Arrival')
    ).toBeTruthy();

    fireEvent.press(screen.getByText('Arrival'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/reviews/[reviewId]',
      params: { reviewId: 'review-1' },
    });
  });

  it('sorts reviews using the header filter', async () => {
    (reviewService.listForUser as jest.Mock).mockResolvedValue({
      reviews: [
        {
          id: 'review-1',
          movieTitle: 'Arrival',
          reviewText: 'Excellent.',
          rating: '4',
          createdAt: '2026-07-18T12:00:00.000Z',
          syncStatus: 'synced',
        },
        {
          id: 'review-2',
          movieTitle: 'Parasite',
          reviewText: 'Brilliant.',
          rating: '5',
          createdAt: '2026-07-17T12:00:00.000Z',
          syncStatus: 'synced',
        },
      ],
      pendingCount: 0,
      remoteAvailable: true,
    });

    const screen = render(<MyReviewsScreen />);
    await screen.findByText('Arrival');

    fireEvent.press(screen.getByLabelText('Sort reviews'));
    fireEvent.press(screen.getByText('Highest rated'));

    const titles = screen
      .getAllByTestId('review-title')
      .map((title) => title.props.children);
    expect(titles).toEqual(['Parasite', 'Arrival']);
  });

  it('searches movie titles and review text when search is opened', async () => {
    (reviewService.listForUser as jest.Mock).mockResolvedValue({
      reviews: [
        {
          id: 'review-1',
          movieTitle: 'Arrival',
          reviewText: 'Thoughtful science fiction.',
          rating: '4',
          createdAt: '2026-07-18T12:00:00.000Z',
          syncStatus: 'synced',
        },
        {
          id: 'review-2',
          movieTitle: 'Parasite',
          reviewText: 'Brilliant social commentary.',
          rating: '5',
          createdAt: '2026-07-17T12:00:00.000Z',
          syncStatus: 'synced',
        },
      ],
      pendingCount: 0,
      remoteAvailable: true,
    });
    const screen = render(<MyReviewsScreen />);
    await screen.findByText('Arrival');

    fireEvent.press(screen.getByLabelText('Search reviews'));
    fireEvent.changeText(
      screen.getByLabelText('Search your reviews'),
      'brilliant'
    );

    expect(screen.getByText('Parasite')).toBeTruthy();
    expect(screen.queryByText('Arrival')).toBeNull();
  });

  it('returns to the top when the screen regains focus', async () => {
    const scrollToOffset = jest.spyOn(FlatList.prototype, 'scrollToOffset');
    const screen = render(<MyReviewsScreen />);

    await screen.findByText('Write a Review');
    act(() => {
      mockFocusCallback?.();
    });

    expect(scrollToOffset).toHaveBeenCalledWith({
      animated: false,
      offset: 0,
    });
    scrollToOffset.mockRestore();
  });

  it('explains the five-review offline limit only until acknowledged', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    const alertSpy = jest.spyOn(Alert, 'alert');
    render(<MyReviewsScreen />);

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        'Offline review access',
        'Your five most recent reviews are available offline. All reviews appear when you’re connected.',
        expect.any(Array)
      );
    });
    const buttons = alertSpy.mock.calls.at(-1)?.[2];
    buttons?.find((button) => button.text === 'Got it')?.onPress?.();

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      'reelrater:offline-reviews-tip:user-1',
      'true'
    );
    alertSpy.mockRestore();
  });

  it('shows the offline limit banner as soon as the device is offline', async () => {
    const screen = render(<MyReviewsScreen />);
    await screen.findByText('Write a Review');
    const networkListener = (NetInfo.addEventListener as jest.Mock).mock
      .calls.at(-1)?.[0];

    act(() => {
      networkListener({ isConnected: false, isInternetReachable: false });
    });

    expect(screen.getByText(/Offline mode: showing your five most recent/)).toBeTruthy();
  });
});
