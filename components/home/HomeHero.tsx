import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { CachedMediaImage } from '@/components/home/CachedMediaImage';
import { heroGradientUri } from '@/components/home/heroGradient';
import { colors } from '@/constants/colors';
import type { MediaSummary } from '@/types/domain';

const HERO_HEIGHT = 320;
const MAXIMUM_HERO_ITEMS = 5;
const AUTO_ADVANCE_INTERVAL_MS = 15000;

const heroMeta = (item: MediaSummary) => {
  const parts = [
    ...item.genres.slice(0, 2),
    ...(item.releaseYear !== null ? [String(item.releaseYear)] : []),
  ];
  return parts.join(' • ');
};

/** The Concept B cinematic Trending Now hero: a paged backdrop carousel. */
export function HomeHero({
  items,
  onSelectItem,
}: {
  items: MediaSummary[];
  onSelectItem?: (item: MediaSummary) => void;
}) {
  const { width } = useWindowDimensions();
  const listRef = useRef<FlatList<MediaSummary>>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isFocused, setIsFocused] = useState(true);
  const [isAppActive, setIsAppActive] = useState(true);
  const [isInteracting, setIsInteracting] = useState(false);
  const heroItems = items.slice(0, MAXIMUM_HERO_ITEMS);
  const heroCount = heroItems.length;

  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      return () => {
        setIsFocused(false);
      };
    }, [])
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      setIsAppActive(state === 'active');
    });
    return () => {
      subscription.remove();
    };
  }, []);

  const goTo = useCallback(
    (index: number) => {
      if (heroCount === 0) {
        return;
      }
      const next = (index + heroCount) % heroCount;
      listRef.current?.scrollToIndex({ animated: true, index: next });
      setActiveIndex(next);
    },
    [heroCount]
  );

  // Auto-advance. Keying the timeout on activeIndex restarts the 15-second
  // window after every manual or automatic navigation.
  useEffect(() => {
    if (heroCount < 2 || !isFocused || !isAppActive || isInteracting) {
      return;
    }
    const timer = setTimeout(() => {
      goTo(activeIndex + 1);
    }, AUTO_ADVANCE_INTERVAL_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [activeIndex, goTo, heroCount, isAppActive, isFocused, isInteracting]);

  if (heroCount === 0) {
    return null;
  }

  const handleMomentumEnd = (
    event: NativeSyntheticEvent<NativeScrollEvent>
  ) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / width);
    setActiveIndex(Math.min(Math.max(index, 0), heroCount - 1));
    setIsInteracting(false);
  };

  return (
    <View style={styles.hero}>
      <FlatList
        data={heroItems}
        getItemLayout={(_, index) => ({
          index,
          length: width,
          offset: width * index,
        })}
        horizontal
        keyExtractor={(item) => item.catalogId}
        onMomentumScrollEnd={handleMomentumEnd}
        onScrollBeginDrag={() => {
          setIsInteracting(true);
        }}
        pagingEnabled
        ref={listRef}
        renderItem={({ item }) => {
          const meta = heroMeta(item);
          return (
            <Pressable
              accessibilityLabel={`Open details for ${item.title}`}
              disabled={!onSelectItem}
              onPress={() => onSelectItem?.(item)}
              style={[styles.slide, { width }]}
            >
              <CachedMediaImage
                accessibilityLabel={`Backdrop for ${item.title}`}
                catalogId={item.catalogId}
                iconSize={48}
                sourceUrl={item.backdropUrl ?? item.posterUrl}
                style={styles.backdrop}
              />
              <View style={styles.dim} />
              <Image
                resizeMode="stretch"
                source={{ uri: heroGradientUri }}
                style={styles.gradientTop}
              />
              <Image
                resizeMode="stretch"
                source={{ uri: heroGradientUri }}
                style={styles.gradientBottom}
              />
              <View style={styles.slideContent}>
                <Text style={styles.label}>TRENDING NOW</Text>
                <Text numberOfLines={2} style={styles.title}>
                  {item.title}
                </Text>
                {meta ? <Text style={styles.meta}>{meta}</Text> : null}
              </View>
            </Pressable>
          );
        }}
        showsHorizontalScrollIndicator={false}
        testID="home-hero-list"
      />
      {heroCount > 1 ? (
        <>
          <Pressable
            accessibilityLabel="Previous featured title"
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => {
              goTo(activeIndex - 1);
            }}
            style={({ pressed }) => [
              styles.arrow,
              styles.arrowLeft,
              pressed ? styles.arrowPressed : null,
            ]}
          >
            <Ionicons color="#FFFFFF" name="chevron-back" size={20} />
          </Pressable>
          <Pressable
            accessibilityLabel="Next featured title"
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => {
              goTo(activeIndex + 1);
            }}
            style={({ pressed }) => [
              styles.arrow,
              styles.arrowRight,
              pressed ? styles.arrowPressed : null,
            ]}
          >
            <Ionicons color="#FFFFFF" name="chevron-forward" size={20} />
          </Pressable>
          <View style={styles.dots}>
            {heroItems.map((item, index) => (
              <View
                key={item.catalogId}
                style={[
                  styles.dot,
                  index === activeIndex ? styles.dotActive : null,
                ]}
              />
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: '#17171C',
    height: HERO_HEIGHT,
  },
  slide: {
    height: HERO_HEIGHT,
  },
  backdrop: {
    height: HERO_HEIGHT,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    width: '100%',
  },
  dim: {
    backgroundColor: 'rgba(10, 10, 14, 0.24)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  gradientTop: {
    height: 90,
    left: 0,
    opacity: 0.35,
    position: 'absolute',
    right: 0,
    top: 0,
    transform: [{ scaleY: -1 }],
    width: '100%',
  },
  gradientBottom: {
    bottom: 0,
    height: 180,
    left: 0,
    opacity: 0.94,
    position: 'absolute',
    right: 0,
    width: '100%',
  },
  slideContent: {
    bottom: 30,
    left: 0,
    paddingHorizontal: 16,
    position: 'absolute',
    right: 0,
  },
  label: {
    color: colors.reviewAccent,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.6,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 27,
    fontWeight: '800',
    marginTop: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.35)',
    textShadowOffset: { height: 1, width: 0 },
    textShadowRadius: 6,
  },
  meta: {
    color: 'rgba(255, 255, 255, 0.82)',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 5,
  },
  arrow: {
    alignItems: 'center',
    backgroundColor: 'rgba(12, 12, 16, 0.42)',
    borderRadius: 17,
    height: 34,
    justifyContent: 'center',
    marginTop: -17,
    position: 'absolute',
    top: '50%',
    width: 34,
  },
  arrowLeft: {
    left: 10,
  },
  arrowRight: {
    right: 10,
  },
  arrowPressed: {
    backgroundColor: 'rgba(12, 12, 16, 0.65)',
  },
  dots: {
    alignItems: 'center',
    bottom: 11,
    flexDirection: 'row',
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
  },
  dot: {
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    borderRadius: 3,
    height: 6,
    marginHorizontal: 3,
    width: 6,
  },
  dotActive: {
    backgroundColor: '#FFFFFF',
    width: 16,
  },
});
