import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import Login from '@/app/(auth)/login';
import { authService, profileService } from '@/services';

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

describe('Login screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('routes an account without a complete profile to onboarding', async () => {
    (authService.signIn as jest.Mock).mockResolvedValue({ id: 'user-1' });
    (profileService.get as jest.Mock).mockResolvedValue(null);
    const { getAllByPlaceholderText, getAllByText } = render(<Login />);
    const [emailInput, passwordInput] = getAllByPlaceholderText('Type here');
    fireEvent.changeText(emailInput, 'person@example.com');
    fireEvent.changeText(passwordInput, 'password');
    fireEvent.press(getAllByText('Login')[1]);

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
    const { getAllByPlaceholderText, getAllByText } = render(<Login />);
    const [emailInput, passwordInput] = getAllByPlaceholderText('Type here');
    fireEvent.changeText(emailInput, 'person@example.com');
    fireEvent.changeText(passwordInput, 'password');
    fireEvent.press(getAllByText('Login')[1]);

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith('/home');
    });
  });
});
