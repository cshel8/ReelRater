import { render, waitFor } from '@testing-library/react-native';
import Login from '@/app/(auth)/login';

jest.mock('@/store/userStore', () => ({
  userStore: () => ({
    setUsername: jest.fn(),
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
  it('shows the AWS API status', async () => {
    const { getByText } = render(<Login />);

    expect(getByText('AWS API Status')).toBeTruthy();
    await waitFor(() => expect(getByText('Connected')).toBeTruthy());
    expect(getByText('Served by: test-instance')).toBeTruthy();
  });
});
