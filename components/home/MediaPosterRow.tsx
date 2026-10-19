import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import type { MediaSummary } from '@/types/domain';
import { CachedMediaImage } from '@/components/home/CachedMediaImage';

/**
 * EXPERIMENTAL (pending Simulator review): heading-side arrows that page a
 * discovery row roughly one viewport at a time. Removing this component and
 * its call site reverts the rows to pure swipe scrolling.
 */
function RowArrowControls({
  canScrollBack,
  canScrollForward,
  onScrollBack,
  onScrollForward,
  title,
}: {
  canScrollBack: boolean;
  canScrollForward: boolean;
  onScrollBack: () => void;
  onScrollForward: () => void;
  title: string;
}) {
  return (
    <View style={styles.arrowGroup}>
      <Pressable
        accessibilityLabel={`Scroll ${title} back`}
        accessibilityRole="button"
        accessibilityState={{ disabled: !canScrollBack }}
        disabled={!canScrollBack}
        hitSlop={6}
        onPress={onScrollBack}
        style={[styles.rowArrow, !canScrollBack ? styles.rowArrowDisabled : null]}
      >
        <Ionicons color="#17171C" name="chevron-back" size={16} />
      </Pressable>
      <Pressable
        accessibilityLabel={`Scroll ${title} forward`}
        accessibilityRole="button"
        accessibilityState={{ disabled: !canScrollForward }}
        disabled={!canScrollForward}
        hitSlop={6}
        onPress={onScrollForward}
        style={[
          styles.rowArrow,
          !canScrollForward ? styles.rowArrowDisabled : null,
        ]}
      >
        <Ionicons color="#17171C" name="chevron-forward" size={16} />
      </Pressable>
    </View>
  );
}

/** A Concept B horizontal poster row with a section heading. */
export function MediaPosterRow({
  items,
  onSelectItem,
  title,
}: {
  items: MediaSummary[];
  onSelectItem?: (item: MediaSummary) => void;
  title: string;
}) {
  const listRef = useRef<FlatList<MediaSummary>>(null);
  const scrollOffset = useRef(0);
  const [scrollX, setScrollX] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);

  if (items.length === 0) {
    return null;
  }

  const hasOverflow = contentWidth > viewportWidth + 2;
  const canScrollBack = hasOverflow && scrollX > 2;
  const canScrollForward =
    hasOverflow && scrollX + viewportWidth < contentWidth - 2;

  const scrollBy = (direction: 1 | -1) => {
    const step = Math.max(viewportWidth * 0.9, 1);
    const maximumOffset = Math.max(contentWidth - viewportWidth, 0);
    const target = Math.min(
      Math.max(scrollOffset.current + direction * step, 0),
      maximumOffset
    );
    listRef.current?.scrollToOffset({ animated: true, offset: target });
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollOffset.current = event.nativeEvent.contentOffset.x;
    setScrollX(event.nativeEvent.contentOffset.x);
  };

  return (
    <View style={styles.section}>
      <View style={styles.headingRow}>
        <Text style={styles.heading}>{title}</Text>
        {hasOverflow ? (
          <RowArrowControls
            canScrollBack={canScrollBack}
            canScrollForward={canScrollForward}
            onScrollBack={() => {
              scrollBy(-1);
            }}
            onScrollForward={() => {
              scrollBy(1);
            }}
            title={title}
          />
        ) : null}
      </View>
      <FlatList
        contentContainerStyle={styles.listContent}
        data={items}
        horizontal
        keyExtractor={(item) => item.catalogId}
        onContentSizeChange={(width) => {
          setContentWidth(width);
        }}
        onLayout={(event) => {
          setViewportWidth(event.nativeEvent.layout.width);
        }}
        onScroll={handleScroll}
        ref={listRef}
        renderItem={({ item }) => (
          <Pressable
            accessibilityLabel={`Open details for ${item.title}`}
            disabled={!onSelectItem}
            onPress={() => onSelectItem?.(item)}
            style={styles.card}
          >
            <CachedMediaImage
              accessibilityLabel={`Poster for ${item.title}`}
              catalogId={item.catalogId}
              sourceUrl={item.posterUrl}
              style={styles.poster}
            />
            <Text numberOfLines={2} style={styles.posterTitle}>
              {item.title}
            </Text>
          </Pressable>
        )}
        scrollEventThrottle={16}
        showsHorizontalScrollIndicator={false}
        testID={`poster-row-${title}`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 24,
  },
  headingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  heading: {
    color: '#17171C',
    fontSize: 20,
    fontWeight: '700',
  },
  arrowGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  rowArrow: {
    alignItems: 'center',
    backgroundColor: '#EDEEF1',
    borderRadius: 14,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  rowArrowDisabled: {
    opacity: 0.35,
  },
  listContent: {
    paddingHorizontal: 16,
  },
  card: {
    marginRight: 12,
    width: 110,
  },
  poster: {
    borderRadius: 12,
    height: 165,
    overflow: 'hidden',
    width: 110,
  },
  posterTitle: {
    color: '#17171C',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 6,
    textAlign: 'center',
  },
});
