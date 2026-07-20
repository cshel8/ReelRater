import { render, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import Index from '@/app/index';
import { authService, profileService, reviewService } from '@/services';

jest.mock('expo-router', () => ({
  router: {
    replace: jest.fn(),
  },
}));

jest.mock('@/services', () => ({
  authService: { observeAuthState: jest.fn() },
  profileService: { get: jest.fn() },
  reviewService: { syncPending: jest.fn().mockResolvedValue({
    syncedCount: 0,
    failedCount: 0,
    pendingCount: 0,
  }) },
}));

jest.mock('@/store/userStore', () => {
  const state = {
    userId: null,
    displayName: '',
    handle: '',
    profileImage: null,
    setUserId: jest.fn(),
    setDisplayName: jest.fn(),
    setHandle: jest.fn(),
    setProfileImage: jest.fn(),
  };
  const userStore = () => state;
  userStore.getState = () => state;
  userStore.persist = {
    rehydrate: jest.fn().mockResolvedValue(undefined),
  };
  return { userStore };
});

describe('Startup session routing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('routes signed-out users to login', async () => {
    (authService.observeAuthState as jest.Mock).mockImplementation((callback) => {
      callback(null);
      return jest.fn();
    });

    render(<Index />);

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith('/login');
    });
  });

  it('routes a persisted account with a complete profile to home', async () => {
    (profileService.get as jest.Mock).mockResolvedValue({
      id: 'user-1',
      displayName: 'Connor',
      handle: 'ConnorMovies',
      handleNormalized: 'connormovies',
      profileImage: null,
    });
    (authService.observeAuthState as jest.Mock).mockImplementation((callback) => {
      callback({ id: 'user-1' });
      return jest.fn();
    });

    render(<Index />);

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith('/home');
    });
    expect(reviewService.syncPending).toHaveBeenCalledWith('user-1');
  });

  it('routes a persisted account without a profile to onboarding', async () => {
    (profileService.get as jest.Mock).mockResolvedValue(null);
    (authService.observeAuthState as jest.Mock).mockImplementation((callback) => {
      callback({ id: 'user-1' });
      return jest.fn();
    });

    render(<Index />);

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith('/complete-profile');
    });
  });
});
