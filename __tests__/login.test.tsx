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

jest.mock('@/services/http/healthService', () => ({
  healthService: {
    get: jest.fn().mockResolvedValue({
      ok: true,
      app: 'reelrater',
      served_by: 'test-instance',
      time: '2026-07-13T12:00:00.000Z',
    }),
  },
}));

describe('Login screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows the AWS API status', async () => {
    const { getByText } = render(<Login />);

    expect(getByText('AWS API Status')).toBeTruthy();
    await waitFor(() => expect(getByText('Connected')).toBeTruthy());
    expect(getByText('Served by: test-instance')).toBeTruthy();
  });

  it('routes an account without a complete profile to onboarding', async () => {
    (authService.signIn as jest.Mock).mockResolvedValue({ id: 'user-1' });
    (profileService.get as jest.Mock).mockResolvedValue(null);
    const { getAllByPlaceholderText, getAllByText, getByText } = render(<Login />);

    await waitFor(() => expect(getByText('Connected')).toBeTruthy());
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
    const { getAllByPlaceholderText, getAllByText, getByText } = render(<Login />);

    await waitFor(() => expect(getByText('Connected')).toBeTruthy());
    const [emailInput, passwordInput] = getAllByPlaceholderText('Type here');
    fireEvent.changeText(emailInput, 'person@example.com');
    fireEvent.changeText(passwordInput, 'password');
    fireEvent.press(getAllByText('Login')[1]);

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith('/home');
    });
  });
});
