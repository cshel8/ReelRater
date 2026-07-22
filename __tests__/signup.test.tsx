import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import Signup from '@/app/(auth)/signup';
import { authService, profileService, settingsService } from '@/services';

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

jest.mock('expo-router', () => ({
  router: {
    replace: jest.fn(),
  },
}));

jest.mock('@/store/userStore', () => ({
  userStore: () => ({
    displayName: 'Previous User',
    handle: 'PreviousHandle',
    setDisplayName: jest.fn(),
    setHandle: jest.fn(),
    setProfileImage: jest.fn(),
    setUserId: jest.fn(),
  }),
}));

jest.mock('@/services', () => ({
  authService: {
    signOut: jest.fn(),
    signUp: jest.fn(),
  },
  profileService: {
    create: jest.fn(),
  },
  settingsService: {
    setDefaultReviewVisibility: jest.fn(),
  },
}));

describe('Signup screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (authService.signUp as jest.Mock).mockResolvedValue({ id: 'user-1' });
    (profileService.create as jest.Mock).mockResolvedValue({
      id: 'user-1',
      displayName: 'Connor',
      handle: 'ConnorMovies',
      handleNormalized: 'connormovies',
      profileImage: null,
      accountPrivacy: 'public',
    });
    (
      settingsService.setDefaultReviewVisibility as jest.Mock
    ).mockResolvedValue(undefined);
  });

  it('starts with empty account fields instead of cached profile values', () => {
    const screen = render(<Signup />);

    for (const input of screen.getAllByPlaceholderText('Type here')) {
      expect(input.props.value).toBe('');
    }
    expect(screen.queryByDisplayValue('Previous User')).toBeNull();
    expect(screen.queryByDisplayValue('PreviousHandle')).toBeNull();
  });

  it('saves the onboarding visibility as the future-review default', async () => {
    const screen = render(<Signup />);

    fireEvent.changeText(
      screen.getByLabelText('Email'),
      'connor@example.com'
    );
    fireEvent.changeText(
      screen.getByLabelText('Password'),
      'password123'
    );
    fireEvent.changeText(
      screen.getByLabelText('Confirm password'),
      'password123'
    );
    fireEvent.press(screen.getByText('Continue'));

    fireEvent.changeText(screen.getByPlaceholderText('Type here'), 'Connor');
    fireEvent.changeText(
      screen.getByPlaceholderText('e.g. moviebuff'),
      'ConnorMovies'
    );
    fireEvent.press(screen.getByText('Continue'));

    fireEvent.press(screen.getByText('Private Account'));
    fireEvent.press(screen.getByText('Continue'));

    fireEvent.press(screen.getByText('Followers Only'));
    fireEvent.press(screen.getByText('Finish'));

    await waitFor(() => {
      expect(profileService.create).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ accountPrivacy: 'private' })
      );
      expect(settingsService.setDefaultReviewVisibility).toHaveBeenCalledWith(
        'user-1',
        'followers'
      );
      expect(router.replace).toHaveBeenCalledWith('/home');
    });
  });

  it('does not continue when the password confirmation does not match', () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const screen = render(<Signup />);

    fireEvent.changeText(screen.getByLabelText('Email'), 'connor@example.com');
    fireEvent.changeText(screen.getByLabelText('Password'), 'password123');
    fireEvent.changeText(
      screen.getByLabelText('Confirm password'),
      'different-password'
    );
    fireEvent.press(screen.getByText('Continue'));

    expect(alertSpy).toHaveBeenCalledWith(
      'Passwords do not match',
      'Retype your password so both entries are the same.'
    );
    expect(screen.getByText('Create your account')).toBeTruthy();
    expect(screen.queryByText('Choose your profile')).toBeNull();
  });
});
