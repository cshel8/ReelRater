import { act, fireEvent, render } from '@testing-library/react-native';
import { FlatList } from 'react-native';
import { HomeHero } from '@/components/home/HomeHero';
import { MediaPosterRow } from '@/components/home/MediaPosterRow';
import type { MediaSummary } from '@/types/domain';

jest.mock('@/services', () => ({
  homeImageCacheService: {
    resolve: jest.fn().mockResolvedValue(null),
  },
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: ({ name }: { name: string }) => {
    const { Text } = require('react-native');
    return <Text testID={`icon-${name}`} />;
  },
}));

jest.mock('expo-router', () => ({
  useFocusEffect: (callback: () => void | (() => void)) => {
    const React = require('react');
    React.useEffect(() => callback(), [callback]);
  },
}));

const media = (catalogId: string, title: string): MediaSummary => ({
  mediaType: 'movie',
  reviewTargetType: 'movie',
  catalogId,
  title,
  releaseYear: 2024,
  genres: ['Science Fiction'],
  posterUrl: `https://image.example/w342/${catalogId}.jpg`,
  backdropUrl: `https://image.example/w780/${catalogId}-wide.jpg`,
});

const heroItems = [
  media('tmdb:movie:1', 'Dune: Part Two'),
  media('tmdb:movie:2', 'Deadpool & Wolverine'),
  media('tmdb:movie:3', 'Inside Out 2'),
];

describe('Home hero carousel', () => {
  let scrollToIndex: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    scrollToIndex = jest
      .spyOn(FlatList.prototype, 'scrollToIndex')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    scrollToIndex.mockRestore();
    jest.useRealTimers();
  });

  it('advances automatically every 15 seconds and loops', () => {
    render(<HomeHero items={heroItems} />);

    act(() => {
      jest.advanceTimersByTime(15000);
    });
    expect(scrollToIndex).toHaveBeenLastCalledWith({
      animated: true,
      index: 1,
    });

    act(() => {
      jest.advanceTimersByTime(15000);
    });
    expect(scrollToIndex).toHaveBeenLastCalledWith({
      animated: true,
      index: 2,
    });

    act(() => {
      jest.advanceTimersByTime(15000);
    });
    expect(scrollToIndex).toHaveBeenLastCalledWith({
      animated: true,
      index: 0,
    });
  });

  it('navigates with the arrows, looping at both ends, and resets the timer', () => {
    const screen = render(<HomeHero items={heroItems} />);

    fireEvent.press(screen.getByLabelText('Previous featured title'));
    expect(scrollToIndex).toHaveBeenLastCalledWith({
      animated: true,
      index: 2,
    });

    fireEvent.press(screen.getByLabelText('Next featured title'));
    expect(scrollToIndex).toHaveBeenLastCalledWith({
      animated: true,
      index: 0,
    });

    // The automatic timer restarts from the manual navigation.
    scrollToIndex.mockClear();
    act(() => {
      jest.advanceTimersByTime(14999);
    });
    expect(scrollToIndex).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(scrollToIndex).toHaveBeenLastCalledWith({
      animated: true,
      index: 1,
    });
  });

  it('pauses while the user is dragging and resumes afterwards', () => {
    const screen = render(<HomeHero items={heroItems} />);
    const list = screen.getByTestId('home-hero-list');

    fireEvent(list, 'scrollBeginDrag');
    act(() => {
      jest.advanceTimersByTime(40000);
    });
    expect(scrollToIndex).not.toHaveBeenCalled();

    fireEvent(list, 'momentumScrollEnd', {
      nativeEvent: { contentOffset: { x: 0 } },
    });
    act(() => {
      jest.advanceTimersByTime(15000);
    });
    expect(scrollToIndex).toHaveBeenLastCalledWith({
      animated: true,
      index: 1,
    });
  });

  it('clears the automatic timer on unmount', () => {
    const screen = render(<HomeHero items={heroItems} />);
    expect(jest.getTimerCount()).toBeGreaterThan(0);

    screen.unmount();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('renders no arrows or timer for a single item', () => {
    const screen = render(<HomeHero items={[heroItems[0]]} />);

    expect(screen.queryByLabelText('Next featured title')).toBeNull();
    expect(jest.getTimerCount()).toBe(0);
  });
});

describe('Media poster row arrows', () => {
  const rowItems = [
    media('tmdb:movie:10', 'Oppenheimer'),
    media('tmdb:movie:11', 'Barbie'),
    media('tmdb:movie:12', 'Top Gun: Maverick'),
  ];

  let scrollToOffset: jest.SpyInstance;

  beforeEach(() => {
    scrollToOffset = jest
      .spyOn(FlatList.prototype, 'scrollToOffset')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    scrollToOffset.mockRestore();
  });

  const layoutRow = (
    screen: ReturnType<typeof render>,
    viewportWidth: number,
    contentWidth: number
  ) => {
    const list = screen.getByTestId('poster-row-Popular Movies');
    fireEvent(list, 'layout', {
      nativeEvent: { layout: { width: viewportWidth, height: 200 } },
    });
    fireEvent(list, 'contentSizeChange', contentWidth, 200);
    return list;
  };

  const scrollEvent = (x: number) => ({
    nativeEvent: {
      contentOffset: { x, y: 0 },
      contentSize: { width: 800, height: 200 },
      layoutMeasurement: { width: 390, height: 200 },
    },
  });

  it('hides arrows entirely when the content fits the viewport', () => {
    const screen = render(
      <MediaPosterRow items={rowItems} title="Popular Movies" />
    );
    layoutRow(screen, 800, 500);

    expect(screen.queryByLabelText('Scroll Popular Movies forward')).toBeNull();
  });

  it('pages forward about one viewport and disables arrows at the edges', () => {
    const screen = render(
      <MediaPosterRow items={rowItems} title="Popular Movies" />
    );
    const list = layoutRow(screen, 390, 800);

    const back = screen.getByLabelText('Scroll Popular Movies back');
    const forward = screen.getByLabelText('Scroll Popular Movies forward');
    expect(back.props.accessibilityState?.disabled).toBe(true);
    expect(forward.props.accessibilityState?.disabled).toBe(false);

    fireEvent.press(forward);
    expect(scrollToOffset).toHaveBeenLastCalledWith({
      animated: true,
      offset: 351,
    });

    fireEvent(list, 'scroll', scrollEvent(410));
    expect(
      screen.getByLabelText('Scroll Popular Movies back').props
        .accessibilityState?.disabled
    ).toBe(false);
    expect(
      screen.getByLabelText('Scroll Popular Movies forward').props
        .accessibilityState?.disabled
    ).toBe(true);

    fireEvent.press(screen.getByLabelText('Scroll Popular Movies back'));
    expect(scrollToOffset).toHaveBeenLastCalledWith({
      animated: true,
      offset: 59,
    });
  });

  it('clamps forward paging to the end of the content', () => {
    const screen = render(
      <MediaPosterRow items={rowItems} title="Popular Movies" />
    );
    const list = layoutRow(screen, 390, 800);

    fireEvent(list, 'scroll', scrollEvent(300));
    fireEvent.press(screen.getByLabelText('Scroll Popular Movies forward'));
    expect(scrollToOffset).toHaveBeenLastCalledWith({
      animated: true,
      offset: 410,
    });
  });
});
