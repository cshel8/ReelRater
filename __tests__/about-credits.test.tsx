import { fireEvent, render } from '@testing-library/react-native';
import { Linking } from 'react-native';
import AboutCreditsScreen from '@/app/(tabs)/profile/about-credits';

jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

describe('About and credits', () => {
  it('shows the required TMDB attribution and opens its website', async () => {
    const openUrl = jest
      .spyOn(Linking, 'openURL')
      .mockResolvedValueOnce(undefined);
    const screen = render(<AboutCreditsScreen />);

    expect(
      screen.getByText(
        'This product uses the TMDB API but is not endorsed or certified by TMDB.',
      ),
    ).toBeTruthy();

    fireEvent.press(screen.getByText('Visit TMDB'));

    expect(openUrl).toHaveBeenCalledWith('https://www.themoviedb.org');
  });
});
