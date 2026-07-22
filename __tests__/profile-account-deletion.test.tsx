import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { router } from 'expo-router';
import Profile from '@/app/(tabs)/profile';
import { accountDeletionService } from '@/services';

const mockSetUserId = jest.fn();
const mockSetDisplayName = jest.fn();
const mockSetHandle = jest.fn();
const mockSetProfileImage = jest.fn();

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    addEventListener: jest.fn(() => jest.fn()),
  },
}));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn() },
  useFocusEffect: (callback: () => void) => {
    const React = require('react');
    React.useEffect(callback, [callback]);
  },
}));
jest.mock('@/store/userStore', () => ({
  userStore: () => ({
    userId: 'user-1',
    displayName: 'Connor',
    handle: 'ConnorMovies',
    profileImage: null,
    setUserId: mockSetUserId,
    setDisplayName: mockSetDisplayName,
    setHandle: mockSetHandle,
    setProfileImage: mockSetProfileImage,
  }),
}));
jest.mock('@/services', () => ({
  accountDeletionService: { deleteCurrentAccount: jest.fn() },
  authService: { signOut: jest.fn() },
  followService: {
    listFollowers: jest.fn().mockResolvedValue([]),
    listFollowing: jest.fn().mockResolvedValue([]),
    listPendingRequests: jest.fn().mockResolvedValue([]),
  },
  profileService: {
    get: jest.fn().mockResolvedValue(null),
    uploadImage: jest.fn(),
  },
}));

test('requires warning confirmation and the current password before deletion', async () => {
  const alertSpy = jest.spyOn(Alert, 'alert');
  (accountDeletionService.deleteCurrentAccount as jest.Mock).mockResolvedValue(
    undefined
  );
  const screen = render(<Profile />);

  await waitFor(() => expect(screen.getByText('Delete Account')).toBeTruthy());

  fireEvent.press(screen.getByText('Delete Account'));
  const warningButtons = alertSpy.mock.calls.at(-1)?.[2];
  act(() => {
    warningButtons?.find((button) => button.text === 'Continue')?.onPress?.();
  });

  fireEvent.changeText(screen.getByLabelText('Current password'), 'password123');
  fireEvent.press(screen.getByText('Delete Permanently'));

  await waitFor(() => {
    expect(accountDeletionService.deleteCurrentAccount).toHaveBeenCalledWith(
      'password123'
    );
    expect(mockSetUserId).toHaveBeenCalledWith(null);
    expect(router.replace).toHaveBeenCalledWith('/login');
  });
});

test('hides follower and following counts while offline', async () => {
  const screen = render(<Profile />);
  await screen.findByText('Followers');
  const networkListener = (NetInfo.addEventListener as jest.Mock).mock
    .calls.at(-1)?.[0];

  act(() => {
    networkListener({ isConnected: false, isInternetReachable: false });
  });

  expect(screen.queryByText('Followers')).toBeNull();
  expect(screen.queryByText('Following')).toBeNull();
});
