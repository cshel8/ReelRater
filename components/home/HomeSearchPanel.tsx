import NetInfo from '@react-native-community/netinfo';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { CachedMediaImage } from '@/components/home/CachedMediaImage';
import { colors } from '@/constants/colors';
import { mediaCatalogService } from '@/services';
import { isCatalogServiceReachable } from '@/services/http/movieCatalogService';
import type { MediaSummary } from '@/types/domain';

const MAXIMUM_RESULTS_PER_TYPE = 10;
const SEARCH_DEBOUNCE_MS = 300;

type SearchState = 'idle' | 'loading' | 'ready' | 'empty' | 'unavailable';

function SearchResultRow({
  item,
  onSelect,
}: {
  item: MediaSummary;
  onSelect: (item: MediaSummary) => void;
}) {
  const meta = [
    item.mediaType === 'tv' ? 'TV Series' : 'Movie',
    ...(item.releaseYear !== null ? [String(item.releaseYear)] : []),
  ].join(' · ');

  return (
    <Pressable
      accessibilityLabel={`Open details for ${item.title}`}
      onPress={() => onSelect(item)}
      style={({ pressed }) => [
        styles.resultRow,
        pressed ? styles.resultRowPressed : null,
      ]}
    >
      <CachedMediaImage
        accessibilityLabel={`Poster for ${item.title}`}
        allowDownload={false}
        catalogId={item.catalogId}
        iconSize={20}
        sourceUrl={item.posterUrl}
        style={styles.resultPoster}
      />
      <View style={styles.resultText}>
        <Text numberOfLines={2} style={styles.resultTitle}>
          {item.title}
        </Text>
        <Text style={styles.resultMeta}>{meta}</Text>
      </View>
      <Ionicons color="#A2A7B1" name="chevron-forward" size={18} />
    </Pressable>
  );
}

/**
 * The inline Home search: a field beneath the header plus full-height
 * movie/TV results that the Home screen swaps in for its feed whenever a
 * query is present.
 */
export function HomeSearchPanel({
  onQueryPresenceChange,
}: {
  onQueryPresenceChange?: (hasQuery: boolean) => void;
}) {
  const inputRef = useRef<TextInput | null>(null);
  const requestIdRef = useRef(0);
  const offlineRef = useRef(false);
  const [query, setQuery] = useState('');
  const [movies, setMovies] = useState<MediaSummary[]>([]);
  const [tvShows, setTvShows] = useState<MediaSummary[]>([]);
  const [searchState, setSearchState] = useState<SearchState>('idle');
  const [isOffline, setIsOffline] = useState(false);
  const [retryToken, setRetryToken] = useState(0);

  const hasQuery = query.trim().length > 0;

  useEffect(() => {
    onQueryPresenceChange?.(hasQuery);
  }, [hasQuery, onQueryPresenceChange]);

  useEffect(
    () =>
      NetInfo.addEventListener((state) => {
        const offline = !(
          Boolean(state.isConnected) && state.isInternetReachable !== false
        );
        offlineRef.current = offline;
        setIsOffline(offline);
      }),
    []
  );

  useEffect(() => {
    const trimmedQuery = query.trim();
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    // Never leave a previous query's results on screen for a new query.
    setMovies([]);
    setTvShows([]);

    if (!trimmedQuery) {
      setSearchState('idle');
      return;
    }
    setSearchState('loading');

    const timer = setTimeout(() => {
      Promise.all([
        mediaCatalogService.search(trimmedQuery, {
          maximumResults: MAXIMUM_RESULTS_PER_TYPE,
          mediaType: 'movie',
        }),
        mediaCatalogService.search(trimmedQuery, {
          maximumResults: MAXIMUM_RESULTS_PER_TYPE,
          mediaType: 'tv',
        }),
      ])
        .then(async ([moviePage, tvPage]) => {
          if (requestId !== requestIdRef.current) {
            return;
          }
          if (moviePage.items.length > 0 || tvPage.items.length > 0) {
            setMovies(moviePage.items);
            setTvShows(tvPage.items);
            setSearchState('ready');
            return;
          }

          // Empty results are only a genuine "no matches" when the catalog
          // service itself was reachable; otherwise the cache fallback has
          // silently produced an incomplete answer.
          const reachable =
            !offlineRef.current && (await isCatalogServiceReachable());
          if (requestId !== requestIdRef.current) {
            return;
          }
          setSearchState(reachable ? 'empty' : 'unavailable');
        })
        .catch(() => {
          if (requestId !== requestIdRef.current) {
            return;
          }
          setSearchState('unavailable');
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [query, retryToken]);

  const openDetails = (item: MediaSummary) => {
    inputRef.current?.blur();
    router.push({
      pathname: '/home/media/[catalogId]',
      params: {
        catalogId: item.catalogId,
        summary: JSON.stringify(item),
      },
    });
  };

  // Cache-sourced results carry retention metadata; a reachable catalog
  // never returns them, so their presence means fallback results.
  const showIncompleteNotice =
    searchState === 'ready' &&
    (isOffline ||
      [...movies, ...tvShows].some(
        (item) => item.catalogDataRetention !== undefined
      ));

  return (
    <View style={hasQuery ? styles.panelExpanded : null}>
      <View style={styles.searchFieldWrap}>
        <Ionicons color="#737A86" name="search" size={18} />
        <TextInput
          accessibilityLabel="Search movies and TV shows"
          autoCorrect={false}
          autoFocus
          onChangeText={setQuery}
          placeholder="Search movies and TV shows"
          placeholderTextColor="#9AA0AB"
          ref={inputRef}
          returnKeyType="search"
          style={styles.searchInput}
          value={query}
        />
        {query.length > 0 ? (
          <Pressable
            accessibilityLabel="Clear search"
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => {
              setQuery('');
            }}
          >
            <Ionicons color="#737A86" name="close-circle" size={18} />
          </Pressable>
        ) : null}
      </View>
      {hasQuery ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={() => {
            inputRef.current?.blur();
          }}
          showsVerticalScrollIndicator={false}
          style={styles.results}
        >
          {searchState === 'loading' ? (
            <ActivityIndicator
              color={colors.reviewAccent}
              style={styles.loading}
            />
          ) : null}
          {searchState === 'empty' ? (
            <Text style={styles.hint}>
              No results for &ldquo;{query.trim()}&rdquo;.
            </Text>
          ) : null}
          {searchState === 'unavailable' ? (
            <View style={styles.unavailable}>
              <View style={styles.noticeBanner}>
                <Ionicons
                  color={colors.reviewAccentText}
                  name="cloud-offline-outline"
                  size={16}
                />
                <Text style={styles.noticeText}>
                  {isOffline
                    ? "You're offline. Connect to the internet to search the catalog."
                    : "Search is unavailable right now. Check your connection and try again."}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setRetryToken((token) => token + 1);
                }}
                style={({ pressed }) => [
                  styles.retryButton,
                  pressed ? styles.retryButtonPressed : null,
                ]}
              >
                <Text style={styles.retryButtonText}>Try Again</Text>
              </Pressable>
            </View>
          ) : null}
          {showIncompleteNotice ? (
            <View style={styles.noticeBanner}>
              <Ionicons
                color={colors.reviewAccentText}
                name="cloud-offline-outline"
                size={16}
              />
              <Text style={styles.noticeText}>
                Showing previously loaded titles — results may be incomplete.
              </Text>
            </View>
          ) : null}
          {movies.length > 0 ? (
            <>
              <Text style={styles.sectionHeading}>Movies</Text>
              {movies.map((item) => (
                <SearchResultRow
                  item={item}
                  key={item.catalogId}
                  onSelect={openDetails}
                />
              ))}
            </>
          ) : null}
          {tvShows.length > 0 ? (
            <>
              <Text style={styles.sectionHeading}>TV Shows</Text>
              {tvShows.map((item) => (
                <SearchResultRow
                  item={item}
                  key={item.catalogId}
                  onSelect={openDetails}
                />
              ))}
            </>
          ) : null}
          <View style={styles.bottomSpacer} />
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panelExpanded: {
    flex: 1,
  },
  searchFieldWrap: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E4E6EA',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
  },
  searchInput: {
    color: '#17171C',
    flex: 1,
    fontSize: 15,
    paddingVertical: 11,
  },
  results: {
    flex: 1,
  },
  hint: {
    color: '#5B616C',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 24,
    paddingHorizontal: 16,
    textAlign: 'center',
  },
  loading: {
    marginTop: 28,
  },
  unavailable: {
    alignItems: 'center',
  },
  noticeBanner: {
    alignItems: 'center',
    backgroundColor: '#FCEAF0',
    borderRadius: 10,
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 16,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  noticeText: {
    color: colors.reviewAccentText,
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
  retryButton: {
    backgroundColor: colors.reviewAccent,
    borderRadius: 12,
    marginTop: 16,
    paddingHorizontal: 28,
    paddingVertical: 11,
  },
  retryButtonPressed: {
    backgroundColor: colors.reviewAccentPressed,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  sectionHeading: {
    color: '#17171C',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
    marginTop: 20,
    paddingHorizontal: 16,
  },
  resultRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  resultRowPressed: {
    backgroundColor: '#F1F2F5',
  },
  resultPoster: {
    borderRadius: 8,
    height: 84,
    overflow: 'hidden',
    width: 56,
  },
  resultText: {
    flex: 1,
  },
  resultTitle: {
    color: '#17171C',
    fontSize: 15,
    fontWeight: '600',
  },
  resultMeta: {
    color: '#5B616C',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 3,
  },
  bottomSpacer: {
    height: 28,
  },
});
