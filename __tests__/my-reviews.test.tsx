import { fireEvent, render } from '@testing-library/react-native';
import { router } from 'expo-router';
import MyReviewsScreen from '@/app/(tabs)/reviews';
import { reviewService } from '@/services';

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
      options?: { headerRight?: () => React.ReactNode };
    }) => options?.headerRight?.() ?? null,
  },
  useFocusEffect: (callback: () => void) => {
    const React = require('react');
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
});
