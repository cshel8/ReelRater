import {
  act,
  fireEvent,
  render,
  waitFor,
} from '@testing-library/react-native';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import ReviewDetailsScreen from '@/app/(tabs)/reviews/[reviewId]';
import { reviewService } from '@/services';

const mockDispatch = jest.fn();
let mockPreventRemove:
  | ((options: { data: { action: { type: string } } }) => void)
  | undefined;

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

jest.mock('expo-router', () => ({
  router: {
    replace: jest.fn(),
  },
  useNavigation: () => ({ dispatch: mockDispatch }),
  useFocusEffect: (callback: () => void) => {
    const React = require('react');
    React.useEffect(callback, [callback]);
  },
  useLocalSearchParams: () => ({ reviewId: 'review-1' }),
}));

jest.mock('expo-router/react-navigation', () => ({
  usePreventRemove: (
    preventRemove: boolean,
    callback: (options: {
      data: { action: { type: string } };
    }) => void
  ) => {
    mockPreventRemove = preventRemove ? callback : undefined;
  },
}));

jest.mock('@/store/userStore', () => ({
  userStore: (selector: (state: { userId: string }) => unknown) =>
    selector({ userId: 'user-1' }),
}));

jest.mock('@/services', () => ({
  reviewService: {
    listForUser: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  },
}));

describe('Review Details screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPreventRemove = undefined;
    (reviewService.listForUser as jest.Mock).mockResolvedValue({
      reviews: [
        {
          id: 'review-1',
          movieTitle: 'Arrival',
          reviewText:
            'A thoughtful story about language, time, and human connection.',
          rating: '5',
          visibility: 'private',
          createdAt: '2026-07-18T12:00:00.000Z',
          syncStatus: 'synced',
        },
      ],
      pendingCount: 0,
      remoteAvailable: true,
    });
    (reviewService.update as jest.Mock).mockImplementation(
      async (_userId, review) => ({ ...review, syncStatus: 'synced' })
    );
    (reviewService.remove as jest.Mock).mockResolvedValue(undefined);
  });

  it('loads the selected review and displays its complete text', async () => {
    const screen = render(<ReviewDetailsScreen />);

    expect(await screen.findByText('Arrival')).toBeTruthy();
    expect(
      screen.getByText(
        'A thoughtful story about language, time, and human connection.'
      )
    ).toBeTruthy();
    expect(screen.getByLabelText('5 out of 5 stars')).toBeTruthy();
    expect(
      screen.getByLabelText('Poster placeholder for Arrival')
    ).toBeTruthy();
  });

  it('edits the selected review', async () => {
    const screen = render(<ReviewDetailsScreen />);
    await screen.findByText('Arrival');

    fireEvent.press(screen.getByText('Edit Review'));
    fireEvent.changeText(
      screen.getByLabelText('Edit review text'),
      'An even better second viewing.'
    );
    fireEvent.press(screen.getByLabelText('Edit rating to 4 out of 5 stars'));
    fireEvent.press(screen.getByText('Save Changes'));

    await waitFor(() => {
      expect(reviewService.update).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          id: 'review-1',
          movieTitle: 'Arrival',
          reviewText: 'An even better second viewing.',
          rating: '4',
        })
      );
    });
  });

  it('offers to save edited review fields before navigating back', async () => {
    let promptButtons: Parameters<typeof Alert.alert>[2];
    const alertSpy = jest
      .spyOn(Alert, 'alert')
      .mockImplementation((title, _message, buttons) => {
        if (title === 'Save review changes?') {
          promptButtons = buttons;
        }
      });
    const backAction = { type: 'GO_BACK' };
    const screen = render(<ReviewDetailsScreen />);
    await screen.findByText('Arrival');

    fireEvent.press(screen.getByText('Edit Review'));
    fireEvent.changeText(
      screen.getByLabelText('Edit review text'),
      'Save this updated review before leaving.'
    );
    mockPreventRemove?.({ data: { action: backAction } });

    expect(alertSpy).toHaveBeenCalledWith(
      'Save review changes?',
      "Your review changes haven't been saved. Would you like to save them before leaving?",
      expect.any(Array)
    );

    act(() => {
      promptButtons
        ?.find((button) => button.text === 'Save Changes')
        ?.onPress?.();
    });

    await waitFor(() => {
      expect(reviewService.update).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          reviewText: 'Save this updated review before leaving.',
        })
      );
      expect(mockDispatch).toHaveBeenCalledWith(backAction);
    });
  });

  it('does not guard Back when edit mode has no changes', async () => {
    const screen = render(<ReviewDetailsScreen />);
    await screen.findByText('Arrival');

    fireEvent.press(screen.getByText('Edit Review'));

    expect(mockPreventRemove).toBeUndefined();
  });

  it('confirms before deleting and returns to My Reviews', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation(
      (title, _message, buttons) => {
        if (title === 'Delete this review?') {
          buttons?.find((button) => button.text === 'Delete')?.onPress?.();
        }
      }
    );
    const screen = render(<ReviewDetailsScreen />);
    await screen.findByText('Arrival');

    fireEvent.press(screen.getByText('Delete Review'));

    await waitFor(() => {
      expect(reviewService.remove).toHaveBeenCalledWith(
        'user-1',
        'review-1'
      );
      expect(router.replace).toHaveBeenCalledWith('/reviews');
    });
  });
});
