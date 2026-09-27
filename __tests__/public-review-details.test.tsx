import { fireEvent, render } from '@testing-library/react-native';
import PublicReviewDetailsScreen from '@/components/reviews/PublicReviewDetailsScreen';
import { publicProfileReviewService } from '@/services';

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({
    authorId: 'author-1',
    reviewId: 'review-1',
  }),
}));

jest.mock('@/store/userStore', () => ({
  userStore: (selector: (state: { userId: string }) => unknown) =>
    selector({ userId: 'viewer-1' }),
}));

jest.mock('@/services', () => ({
  publicProfileReviewService: {
    getById: jest.fn(),
  },
}));

describe('Public review details screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (publicProfileReviewService.getById as jest.Mock).mockResolvedValue({
      id: 'review-1',
      authorId: 'author-1',
      movieTitle: 'Arrival',
      movie: {
        matchStatus: 'manual',
        catalogId: null,
        title: 'Arrival',
        releaseYear: null,
        genres: [],
        posterUrl: null,
      },
      reviewText:
        'A thoughtful story about language, time, and human connection.',
      rating: 5,
      spoilerWarning: false,
      visibility: 'followers',
      createdAt: '2026-07-18T12:00:00.000Z',
      syncStatus: 'synced',
    });
  });

  it('conceals a spoiler review until the viewer explicitly reveals it', async () => {
    (publicProfileReviewService.getById as jest.Mock).mockResolvedValueOnce({
      id: 'review-1',
      authorId: 'author-1',
      movieTitle: 'Arrival',
      reviewText: 'The ending is revealed here.',
      rating: 5,
      spoilerWarning: true,
      visibility: 'public',
      createdAt: '2026-07-18T12:00:00.000Z',
      syncStatus: 'synced',
    });
    const screen = render(<PublicReviewDetailsScreen />);

    expect(await screen.findByText('Contains spoilers')).toBeTruthy();
    expect(screen.queryByText('The ending is revealed here.')).toBeNull();
    fireEvent.press(screen.getByText('Reveal Review'));
    expect(screen.getByText('The ending is revealed here.')).toBeTruthy();
  });

  it('shows the complete review without owner controls', async () => {
    const screen = render(<PublicReviewDetailsScreen />);

    expect(await screen.findByText('Arrival')).toBeTruthy();
    expect(
      screen.getByText(
        'A thoughtful story about language, time, and human connection.'
      )
    ).toBeTruthy();
    expect(screen.getByText('Followers Only')).toBeTruthy();
    expect(screen.queryByText('Edit Review')).toBeNull();
    expect(screen.queryByText('Delete Review')).toBeNull();
    expect(publicProfileReviewService.getById).toHaveBeenCalledWith(
      'viewer-1',
      'author-1',
      'review-1'
    );
  });
});
