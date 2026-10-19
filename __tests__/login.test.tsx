import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import Login from '@/app/(auth)/login';
import { authService, profileService } from '@/services';

jest.mock('@expo/vector-icons', () => ({
  Ionicons: ({ name }: { name: string }) => {
    const { Text } = require('react-native');
    return <Text testID={`icon-${name}`} />;
  },
}));

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
  },
}));

jest.mock('@/store/userStore', () => ({
  userStore: () => ({
    setDisplayName: jest.fn(),
    setHandle: jest.fn(),
    setProfileImage: jest.fn(),
    setUserId: jest.fn(),
  }),
}));

jest.mock('@/services', () => ({
  authService: { signIn: jest.fn() },
  profileService: { get: jest.fn() },
}));

const fillCredentials = (
  screen: ReturnType<typeof render>,
  email = 'person@example.com',
  password = 'password'
) => {
  fireEvent.changeText(screen.getByLabelText('Email'), email);
  fireEvent.changeText(screen.getByLabelText('Password'), password);
};

describe('Login screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('routes an account without a complete profile to onboarding', async () => {
    (authService.signIn as jest.Mock).mockResolvedValue({ id: 'user-1' });
    (profileService.get as jest.Mock).mockResolvedValue(null);
    const screen = render(<Login />);
    fillCredentials(screen);
    fireEvent.press(screen.getByLabelText('Log in'));

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith('/complete-profile');
    });
  });

  it('routes an account with a complete profile to home', async () => {
    (authService.signIn as jest.Mock).mockResolvedValue({ id: 'user-1' });
    (profileService.get as jest.Mock).mockResolvedValue({
      id: 'user-1',
      displayName: 'Connor',
      handle: 'ConnorMovies',
      handleNormalized: 'connormovies',
      profileImage: null,
    });
    const screen = render(<Login />);
    fillCredentials(screen);
    fireEvent.press(screen.getByLabelText('Log in'));

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith('/home');
    });
    expect(authService.signIn).toHaveBeenCalledWith(
      'person@example.com',
      'password'
    );
  });

  it('requires both fields before contacting the auth service', () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const screen = render(<Login />);

    fireEvent.press(screen.getByLabelText('Log in'));

    expect(alertSpy).toHaveBeenCalledWith(
      'Missing information',
      'Enter your email and password to log in.'
    );
    expect(authService.signIn).not.toHaveBeenCalled();
  });

  it('rejects a malformed email address before contacting the auth service', () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const screen = render(<Login />);
    fillCredentials(screen, 'not-an-email');

    fireEvent.press(screen.getByLabelText('Log in'));

    expect(alertSpy).toHaveBeenCalledWith(
      'Invalid email',
      'Enter a valid email address.'
    );
    expect(authService.signIn).not.toHaveBeenCalled();
  });

  it('shows a friendly message instead of internal Firebase errors', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const firebaseError = Object.assign(
      new Error('Firebase: Error (auth/invalid-credential).'),
      { code: 'auth/invalid-credential' }
    );
    (authService.signIn as jest.Mock).mockRejectedValue(firebaseError);
    const screen = render(<Login />);
    fillCredentials(screen);

    fireEvent.press(screen.getByLabelText('Log in'));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        'Login failed',
        'Incorrect email or password. Check your entries and try again.'
      );
    });
    expect(alertSpy).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('Firebase')
    );
  });

  it('prevents duplicate submissions while signing in', async () => {
    let releaseSignIn!: (value: { id: string }) => void;
    (authService.signIn as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        releaseSignIn = resolve;
      })
    );
    (profileService.get as jest.Mock).mockResolvedValue(null);
    const screen = render(<Login />);
    fillCredentials(screen);

    fireEvent.press(screen.getByLabelText('Log in'));
    fireEvent.press(screen.getByLabelText('Log in'));

    expect(authService.signIn).toHaveBeenCalledTimes(1);

    releaseSignIn({ id: 'user-1' });
    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith('/complete-profile');
    });
  });

  it('toggles password visibility with the eye control', () => {
    const screen = render(<Login />);

    expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(true);

    fireEvent.press(screen.getByLabelText('Show password'));
    expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(
      false
    );

    fireEvent.press(screen.getByLabelText('Hide password'));
    expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(true);
  });
});
