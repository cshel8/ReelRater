import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useNavigation } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  InteractionManager,
  Keyboard,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { CommunityEmptyState, type CommunityEmptyStateKind } from '@/components/community/CommunityEmptyState';
import { CommunityModeToggle, type CommunityMode } from '@/components/community/CommunityModeToggle';
import { CommunityReviewCard } from '@/components/community/CommunityReviewCard';
import { colors } from '@/constants/colors';
import {
  cachedFollowingCommunityFeedService,
  cachedEveryoneCommunityFeedService,
  followService,
  mediaCatalogService,
  communityPreferenceRepository,
  exactMediaCommunitySearchService,
  settingsService,
} from '@/services';
import {
  beginCommunitySessionForUser,
  consumeCommunityPreferenceUpdate,
  getCommunityScrollOffset,
  isFollowingAuthorInvalidatedForSession,
  resetCommunityScrollOffset,
  setCurrentCommunityPreferences,
  setCommunityScrollOffset,
} from '@/services/community/communitySessionState';
import {
  resolveCommunityDefaultPreferences,
  resolveInitialCommunityPreferences,
} from '@/services/community/communityPreferenceResolver';
import type {
  CommunitySelectedMedia,
  CommunityReviewMediaFilter,
  CommunityReviewSort,
} from '@/services/contracts';
import { userStore } from '@/store/userStore';
import type {
  CommunityActivePreferences,
  CommunityReview,
  MediaSummary,
} from '@/types/domain';
import type { PublicReviewPageCursor } from '@/services/contracts';
import { toCommunitySelectedMedia } from '@/services/community/communitySearch';

const MEDIA_FILTER_OPTIONS: {
  label: string;
  value: CommunityReviewMediaFilter;
}[] = [
  { label: 'All', value: 'all' },
  { label: 'Movies', value: 'movie' },
  { label: 'TV Shows', value: 'tv' },
];

const SORT_OPTIONS: { label: string; value: CommunityReviewSort }[] = [
  { label: 'Newest first', value: 'newest' },
  { label: 'Oldest first', value: 'oldest' },
  { label: 'Highest rated', value: 'highest' },
  { label: 'Lowest rated', value: 'lowest' },
];

type CatalogSuggestion = {
  media: MediaSummary;
  identity: CommunitySelectedMedia;
};

type CatalogSuggestionState = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

type NormalFollowingSnapshot = {
  userId: string;
  mediaFilter: CommunityReviewMediaFilter;
  sort: CommunityReviewSort;
  reviews: CommunityReview[];
  followsAnyone: boolean;
  source: 'remote' | 'cache';
  error: string | null;
};

function CatalogSuggestionSection({
  expanded,
  label,
  onSelect,
  onToggleExpanded,
  suggestions,
}: {
  expanded: boolean;
  label: 'Movies' | 'TV Shows';
  onSelect: (suggestion: CatalogSuggestion) => void;
  onToggleExpanded: () => void;
  suggestions: CatalogSuggestion[];
}) {
  if (suggestions.length === 0) {
    return null;
  }

  const visibleSuggestions = expanded ? suggestions : suggestions.slice(0, 3);
  const hasAdditionalSuggestions = suggestions.length > 3;

  return (
    <View style={styles.catalogSuggestionSection}>
      <Text style={styles.catalogSectionTitle}>{label}</Text>
      <View style={styles.catalogSuggestionList}>
        {visibleSuggestions.map((suggestion) => (
          <Pressable
            accessibilityLabel={`Select ${suggestion.media.title}`}
            accessibilityRole="button"
            key={suggestion.identity.catalogId}
            onPress={() => onSelect(suggestion)}
            style={({ pressed }) => [
              styles.catalogSuggestion,
              pressed && styles.pressed,
            ]}
          >
            {suggestion.media.posterUrl ? (
              <Image
                accessibilityLabel={`Poster for ${suggestion.media.title}`}
                source={{ uri: suggestion.media.posterUrl }}
                style={styles.catalogPoster}
              />
            ) : (
              <View
                accessibilityLabel={`Poster placeholder for ${suggestion.media.title}`}
                style={styles.catalogPosterFallback}
              >
                <Ionicons
                  color={colors.reviewAccent}
                  name="film-outline"
                  size={20}
                />
              </View>
            )}
            <View style={styles.catalogSuggestionCopy}>
              <Text numberOfLines={1} style={styles.catalogSuggestionTitle}>
                {suggestion.media.title}
              </Text>
              <Text style={styles.catalogSuggestionMeta}>
                {suggestion.media.mediaType === 'tv' ? 'TV series' : 'Movie'}
                {suggestion.media.releaseYear !== null
                  ? ` · ${suggestion.media.releaseYear}`
                  : ''}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>
      {hasAdditionalSuggestions ? (
        <Pressable
          accessibilityLabel={`${expanded ? 'Show less' : 'See more'} ${label}`}
          accessibilityRole="button"
          onPress={onToggleExpanded}
          style={styles.catalogExpansionButton}
        >
          <Text style={styles.catalogExpansionText}>
            {expanded ? 'Show less' : 'See more'}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function CommunityOptionsModal({
  mediaFilter,
  onApply,
  onClose,
  onResetToDefaults,
  setMediaFilter,
  setSort,
  showResetToDefaults,
  sort,
  visible,
}: {
  mediaFilter: CommunityReviewMediaFilter;
  onApply: () => void;
  onClose: () => void;
  onResetToDefaults: () => void;
  setMediaFilter: (filter: CommunityReviewMediaFilter) => void;
  setSort: (sort: CommunityReviewSort) => void;
  showResetToDefaults: boolean;
  sort: CommunityReviewSort;
  visible: boolean;
}) {
  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <View style={styles.modalContainer}>
        <Pressable
          accessibilityLabel="Close community filter and sort options"
          onPress={onClose}
          style={styles.modalBackdrop}
        />
        <View style={styles.sortSheet}>
          <View style={styles.sortHandle} />
          <Text style={styles.sortTitle}>Filter &amp; Sort</Text>
          <Text style={styles.optionsSectionTitle}>Show</Text>
          {MEDIA_FILTER_OPTIONS.map((option) => {
            const selected = option.value === mediaFilter;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected }}
                key={option.value}
                onPress={() => setMediaFilter(option.value)}
                style={({ pressed }) => [
                  styles.sortOption,
                  pressed && styles.sortOptionPressed,
                ]}
              >
                <Text
                  style={[
                    styles.sortOptionText,
                    selected && styles.selectedSortOptionText,
                  ]}
                >
                  {option.label}
                </Text>
                {selected ? (
                  <Ionicons
                    color={colors.reviewAccent}
                    name="checkmark"
                    size={22}
                  />
                ) : null}
              </Pressable>
            );
          })}
          <View style={styles.optionsDivider} />
          <Text style={styles.optionsSectionTitle}>Sort By</Text>
          {SORT_OPTIONS.map((option) => {
            const selected = option.value === sort;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected }}
                key={option.value}
                onPress={() => setSort(option.value)}
                style={({ pressed }) => [
                  styles.sortOption,
                  pressed && styles.sortOptionPressed,
                ]}
              >
                <Text
                  style={[
                    styles.sortOptionText,
                    selected && styles.selectedSortOptionText,
                  ]}
                >
                  {option.label}
                </Text>
                {selected ? (
                  <Ionicons
                    color={colors.reviewAccent}
                    name="checkmark"
                    size={22}
                  />
                ) : null}
              </Pressable>
            );
          })}
          {showResetToDefaults ? (
            <Pressable
              accessibilityRole="button"
              onPress={onResetToDefaults}
              style={({ pressed }) => [
                styles.resetToDefaultsButton,
                pressed && styles.sortOptionPressed,
              ]}
            >
              <Text style={styles.resetToDefaultsText}>Reset to defaults</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            onPress={onApply}
            style={({ pressed }) => [
              styles.optionsDoneButton,
              pressed && styles.optionsDoneButtonPressed,
            ]}
          >
            <Text style={styles.optionsDoneButtonText}>Done</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export default function CommunityScreen() {
  const listRef = useRef<FlatList<CommunityReview>>(null);
  const searchInputRef = useRef<TextInput>(null);
  const navigation = useNavigation();
  const userId = userStore((state) => state.userId);
  const [reviews, setReviews] = useState<CommunityReview[]>([]);
  const [everyoneReviews, setEveryoneReviews] = useState<CommunityReview[]>([]);
  const [everyoneCursor, setEveryoneCursor] = useState<PublicReviewPageCursor | null>(null);
  const [everyoneLoading, setEveryoneLoading] = useState(false);
  const [everyoneLoadingMore, setEveryoneLoadingMore] = useState(false);
  const [everyoneError, setEveryoneError] = useState<string | null>(null);
  const [everyoneSource, setEveryoneSource] = useState<'remote' | 'cache'>('remote');
  const [followingSource, setFollowingSource] = useState<'remote' | 'cache'>('remote');
  const [followsAnyone, setFollowsAnyone] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMediaFilter, setSelectedMediaFilter] =
    useState<CommunityReviewMediaFilter>('all');
  const [selectedSort, setSelectedSort] =
    useState<CommunityReviewSort>('newest');
  const [draftMediaFilter, setDraftMediaFilter] =
    useState<CommunityReviewMediaFilter>('all');
  const [draftSort, setDraftSort] =
    useState<CommunityReviewSort>('newest');
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [communityMode, setCommunityMode] = useState<CommunityMode>('following');
  const [searchQuery, setSearchQuery] = useState('');
  const [appliedSearchQuery, setAppliedSearchQuery] = useState('');
  const [catalogSuggestions, setCatalogSuggestions] = useState<CatalogSuggestion[]>([]);
  const [catalogSuggestionState, setCatalogSuggestionState] =
    useState<CatalogSuggestionState>('idle');
  const [catalogSearchRetry, setCatalogSearchRetry] = useState(0);
  const [movieSuggestionsExpanded, setMovieSuggestionsExpanded] =
    useState(false);
  const [tvSuggestionsExpanded, setTvSuggestionsExpanded] = useState(false);
  const [selectedCommunityMedia, setSelectedCommunityMedia] =
    useState<CommunitySelectedMedia | null>(null);
  const [selectedMediaDisplay, setSelectedMediaDisplay] =
    useState<MediaSummary | null>(null);
  const [selectedMediaReviews, setSelectedMediaReviews] = useState<
    CommunityReview[]
  >([]);
  const [selectedMediaCursor, setSelectedMediaCursor] =
    useState<PublicReviewPageCursor | null>(null);
  const [selectedMediaLoading, setSelectedMediaLoading] = useState(false);
  const [selectedMediaLoadingMore, setSelectedMediaLoadingMore] =
    useState(false);
  const [selectedMediaError, setSelectedMediaError] = useState<string | null>(
    null
  );
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [savedDefaultPreferences, setSavedDefaultPreferences] =
    useState<CommunityActivePreferences>({ mediaFilter: 'all', sort: 'newest' });
  const hasLoadedFeedRef = useRef(false);
  const feedRequestIdRef = useRef(0);
  const catalogRequestIdRef = useRef(0);
  const shouldRestoreScrollRef = useRef(false);
  const isCommunityScreenFocusedRef = useRef(false);
  const hasPendingScrollRestoreRef = useRef(false);
  const pendingScrollRestoreOffsetRef = useRef(0);
  const contentHeightRef = useRef(0);
  const scrollRestoreGenerationRef = useRef(0);
  const scheduledScrollRestoreRef = useRef<{
    cancel: () => void;
  } | null>(null);
  const shouldRefreshCommunityOnFocusRef = useRef(true);
  const lastFollowingFocusKeyRef = useRef<string | null>(null);
  const normalFollowingSnapshotRef = useRef<NormalFollowingSnapshot | null>(null);
  const everyoneQueryKeyRef = useRef<string | null>(null);
  const everyoneRequestIdRef = useRef(0);
  const selectedMediaRequestIdRef = useRef(0);
  const [spoilerResetToken, setSpoilerResetToken] = useState(0);

  const cancelPendingScrollRestoration = useCallback(() => {
    scrollRestoreGenerationRef.current += 1;
    scheduledScrollRestoreRef.current?.cancel();
    scheduledScrollRestoreRef.current = null;
    shouldRestoreScrollRef.current = false;
    hasPendingScrollRestoreRef.current = false;
  }, []);

  const attemptScrollRestoration = useCallback(
    (
      generation: number,
      _source: 'focus' | 'after-interactions' | 'content-size'
    ) => {
      if (
        generation !== scrollRestoreGenerationRef.current ||
        !shouldRestoreScrollRef.current ||
        !userId ||
        !isCommunityScreenFocusedRef.current
      ) {
        return false;
      }

      const offset = hasPendingScrollRestoreRef.current
        ? pendingScrollRestoreOffsetRef.current
        : getCommunityScrollOffset(userId);
      if (offset === 0) {
        shouldRestoreScrollRef.current = false;
        hasPendingScrollRestoreRef.current = false;
        scheduledScrollRestoreRef.current = null;
        return true;
      }
      if (!listRef.current || contentHeightRef.current <= offset) {
        return false;
      }

      shouldRestoreScrollRef.current = false;
      hasPendingScrollRestoreRef.current = false;
      scheduledScrollRestoreRef.current = null;
      listRef.current.scrollToOffset({ animated: false, offset });
      return true;
    },
    [userId]
  );

  const scheduleScrollRestoration = useCallback(() => {
    scheduledScrollRestoreRef.current?.cancel();
    const generation = scrollRestoreGenerationRef.current + 1;
    scrollRestoreGenerationRef.current = generation;
    if (attemptScrollRestoration(generation, 'focus')) {
      return;
    }
    scheduledScrollRestoreRef.current = InteractionManager.runAfterInteractions(
      () => {
        scheduledScrollRestoreRef.current = null;
        attemptScrollRestoration(generation, 'after-interactions');
      }
    );
  }, [attemptScrollRestoration]);

  useEffect(() => {
    let active = true;
    beginCommunitySessionForUser(userId);
    normalFollowingSnapshotRef.current = null;
    hasLoadedFeedRef.current = false;
    feedRequestIdRef.current += 1;
    everyoneRequestIdRef.current += 1;
    shouldRefreshCommunityOnFocusRef.current = true;
    setPreferencesReady(false);
    setSelectedMediaFilter('all');
    setSelectedSort('newest');
    setDraftMediaFilter('all');
    setDraftSort('newest');
    setSavedDefaultPreferences({ mediaFilter: 'all', sort: 'newest' });
    setSearchQuery('');
    setAppliedSearchQuery('');
    setCatalogSuggestions([]);
    setCatalogSuggestionState('idle');
    setCatalogSearchRetry(0);
    setMovieSuggestionsExpanded(false);
    setTvSuggestionsExpanded(false);
    setSelectedCommunityMedia(null);
    setSelectedMediaDisplay(null);
    setSelectedMediaReviews([]);
    setSelectedMediaCursor(null);
    setSelectedMediaError(null);
    setReviews([]);
    setEveryoneReviews([]);
    setEveryoneCursor(null);
    setError(null);
    setEveryoneError(null);
    setFollowingSource('remote');
    setEveryoneSource('remote');

    if (!userId) {
      setPreferencesReady(true);
      return () => {
        active = false;
      };
    }

    void Promise.all([
      settingsService.get(userId).catch(() => null),
      communityPreferenceRepository.getForUser(userId).catch(() => null),
    ])
      .then(([settings, localPreferences]) => {
        if (!active) {
          return;
        }
        const defaults = resolveCommunityDefaultPreferences(settings);
        setSavedDefaultPreferences(defaults);
        const resolved = resolveInitialCommunityPreferences(
          localPreferences,
          settings
        );
        setSelectedMediaFilter(resolved.mediaFilter);
        setSelectedSort(resolved.sort);
        setDraftMediaFilter(resolved.mediaFilter);
        setDraftSort(resolved.sort);
        setCurrentCommunityPreferences(userId, resolved);
      })
      .finally(() => {
        if (active) {
          setPreferencesReady(true);
        }
      });

    return () => {
      active = false;
    };
  }, [userId]);

  useEffect(() => {
    const normalizedQuery = searchQuery.trim();
    if (!normalizedQuery) {
      setAppliedSearchQuery('');
      return;
    }

    const timeout = setTimeout(() => {
      setAppliedSearchQuery(normalizedQuery);
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  useEffect(() => {
    const query = searchQuery.trim();
    const requestId = catalogRequestIdRef.current + 1;
    catalogRequestIdRef.current = requestId;

    if (!query) {
      setCatalogSuggestions([]);
      setCatalogSuggestionState('idle');
      return;
    }

    if (selectedCommunityMedia) {
      setCatalogSuggestions([]);
      setCatalogSuggestionState('idle');
      return;
    }

    const timer = setTimeout(() => {
      setCatalogSuggestionState('loading');
      Promise.all([
        mediaCatalogService.search(query, {
          maximumResults: 8,
          mediaType: 'movie',
        }),
        mediaCatalogService.search(query, {
          maximumResults: 8,
          mediaType: 'tv',
        }),
      ])
        .then((pages) => {
          if (requestId !== catalogRequestIdRef.current) {
            return;
          }
          const suggestions = pages.flatMap((page) => page.items).flatMap((media) => {
            const identity = toCommunitySelectedMedia(media);
            return identity ? [{ media, identity }] : [];
          });
          setCatalogSuggestions(suggestions);
          setCatalogSuggestionState(suggestions.length > 0 ? 'ready' : 'empty');
        })
        .catch(() => {
          if (requestId !== catalogRequestIdRef.current) {
            return;
          }
          setCatalogSuggestions([]);
          setCatalogSuggestionState('error');
        });
    }, 300);

    return () => clearTimeout(timer);
  }, [catalogSearchRetry, searchQuery, selectedCommunityMedia]);

  const loadFeed = useCallback(
    async (refreshing = false) => {
      if (!userId || !preferencesReady) {
        setIsLoading(false);
        return;
      }

      const requestId = feedRequestIdRef.current + 1;
      feedRequestIdRef.current = requestId;
      const isInitialLoad = !hasLoadedFeedRef.current;

      if (refreshing) {
        setIsRefreshing(true);
      } else if (isInitialLoad) {
        setIsLoading(true);
      }
      setError(null);

      try {
        const result = await cachedFollowingCommunityFeedService.list(userId, {
          mediaFilter: selectedMediaFilter,
          ...(appliedSearchQuery
            ? { searchQuery: appliedSearchQuery }
            : {}),
          sort: selectedSort,
        });
        if (requestId !== feedRequestIdRef.current) {
          return;
        }
        const resultError =
          result.source === 'cache' && result.reviews.length === 0
            ? result.remoteError
            : null;
        setReviews(result.reviews);
        setFollowsAnyone(result.followsAnyone);
        setFollowingSource(result.source);
        setError(resultError);
        if (!appliedSearchQuery) {
          normalFollowingSnapshotRef.current = {
            userId,
            mediaFilter: selectedMediaFilter,
            sort: selectedSort,
            reviews: result.reviews,
            followsAnyone: result.followsAnyone,
            source: result.source,
            error: resultError,
          };
        }
        hasLoadedFeedRef.current = true;
      } catch (loadError) {
        if (requestId !== feedRequestIdRef.current) {
          return;
        }
        setReviews([]);
        const code =
          loadError &&
          typeof loadError === 'object' &&
          'code' in loadError
            ? String(loadError.code)
            : null;
        const message =
          loadError instanceof Error
            ? loadError.message
            : 'Your community feed could not be loaded.';
        const detailedError = code ? `${code}: ${message}` : message;
        console.log('Unable to load the community feed:', detailedError);
        setError(detailedError);
      } finally {
        if (requestId === feedRequestIdRef.current) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [
      appliedSearchQuery,
      preferencesReady,
      selectedMediaFilter,
      selectedSort,
      userId,
    ]
  );

  const loadEveryone = useCallback(async (append = false) => {
    if (!userId || !preferencesReady || (append && !everyoneCursor)) return;
    const requestId = everyoneRequestIdRef.current + 1;
    everyoneRequestIdRef.current = requestId;
    append ? setEveryoneLoadingMore(true) : setEveryoneLoading(true);
    if (!append) setEveryoneError(null);
    try {
      const page = await cachedEveryoneCommunityFeedService.listPage(userId, {
        mediaFilter: selectedMediaFilter, sort: selectedSort,
        ...(append ? { cursor: everyoneCursor } : {}),
      });
      if (requestId !== everyoneRequestIdRef.current) {
        return;
      }
      setEveryoneReviews((current) => append ? [...current, ...page.reviews.filter((review) => !current.some((existing) => existing.id === review.id))] : page.reviews);
      setEveryoneCursor(page.nextCursor);
      setEveryoneSource(page.source);
      if (!append) {
        setEveryoneError(
          page.source === 'cache' && page.reviews.length === 0
            ? page.remoteError
            : null
        );
      }
    } catch (loadError) {
      if (requestId !== everyoneRequestIdRef.current) {
        return;
      }
      setEveryoneError(loadError instanceof Error ? loadError.message : 'Public reviews could not be loaded.');
    } finally {
      if (requestId === everyoneRequestIdRef.current) {
        setEveryoneLoading(false);
        setEveryoneLoadingMore(false);
      }
    }
  }, [everyoneCursor, preferencesReady, selectedMediaFilter, selectedSort, userId]);

  const loadSelectedMedia = useCallback(
    async (
      selectedMedia: CommunitySelectedMedia,
      mode: CommunityMode,
      sort: CommunityReviewSort,
      append = false,
      cursor: PublicReviewPageCursor | null = null
    ) => {
      if (!userId || !preferencesReady || (append && !cursor)) {
        return;
      }

      const requestId = selectedMediaRequestIdRef.current + 1;
      selectedMediaRequestIdRef.current = requestId;
      if (append) {
        setSelectedMediaLoadingMore(true);
      } else {
        setSelectedMediaLoading(true);
        setSelectedMediaError(null);
        setSelectedMediaReviews([]);
        setSelectedMediaCursor(null);
      }

      try {
        const result = await exactMediaCommunitySearchService.search(userId, {
          scope: mode,
          selectedMedia,
          sort,
          maximumResults: 20,
          ...(append && cursor ? { cursor } : {}),
        });
        if (requestId !== selectedMediaRequestIdRef.current) {
          return;
        }
        setSelectedMediaReviews((current) =>
          append
            ? [
                ...current,
                ...result.reviews.filter(
                  (review) =>
                    !current.some((existing) => existing.id === review.id)
                ),
              ]
            : result.reviews
        );
        setSelectedMediaCursor(result.pagination.nextCursor);
      } catch (loadError) {
        if (requestId !== selectedMediaRequestIdRef.current) {
          return;
        }
        const message =
          loadError instanceof Error
            ? loadError.message
            : 'Reviews for this title could not be loaded.';
        setSelectedMediaError(
          mode === 'everyone'
            ? `This exact-media search needs a connection. ${message}`
            : message
        );
        if (!append) {
          setSelectedMediaReviews([]);
          setSelectedMediaCursor(null);
        }
      } finally {
        if (requestId === selectedMediaRequestIdRef.current) {
          setSelectedMediaLoading(false);
          setSelectedMediaLoadingMore(false);
        }
      }
    },
    [preferencesReady, userId]
  );

  useEffect(() => {
    if (!selectedCommunityMedia || !userId || !preferencesReady) {
      return;
    }
    void loadSelectedMedia(
      selectedCommunityMedia,
      communityMode,
      selectedSort
    );
  }, [
    communityMode,
    loadSelectedMedia,
    preferencesReady,
    selectedCommunityMedia,
    selectedSort,
    userId,
  ]);

  useEffect(() => {
    const key = `${communityMode}:${selectedMediaFilter}:${selectedSort}:${userId ?? ''}`;
    if (!selectedCommunityMedia && communityMode === 'everyone' && preferencesReady && everyoneQueryKeyRef.current !== key) {
      everyoneQueryKeyRef.current = key;
      void loadEveryone();
    }
  }, [communityMode, loadEveryone, preferencesReady, selectedCommunityMedia, selectedMediaFilter, selectedSort, userId]);

  const resetForFreshCommunityVisit = useCallback(() => {
    // This listener belongs to the parent tab navigator, so it runs only when
    // Community loses its active tab—not when a child Community route such as
    // Review Details is pushed.
    feedRequestIdRef.current += 1;
    catalogRequestIdRef.current += 1;
    selectedMediaRequestIdRef.current += 1;
    everyoneRequestIdRef.current += 1;
    everyoneQueryKeyRef.current = null;
    cancelPendingScrollRestoration();
    shouldRefreshCommunityOnFocusRef.current = true;
    setOptionsVisible(false);
    setSearchQuery('');
    setAppliedSearchQuery('');
    setCatalogSuggestions([]);
    setCatalogSuggestionState('idle');
    setCatalogSearchRetry(0);
    setMovieSuggestionsExpanded(false);
    setTvSuggestionsExpanded(false);
    setSelectedCommunityMedia(null);
    setSelectedMediaDisplay(null);
    setSelectedMediaReviews([]);
    setSelectedMediaCursor(null);
    setSelectedMediaLoading(false);
    setSelectedMediaLoadingMore(false);
    setSelectedMediaError(null);
    setError(null);
    setEveryoneError(null);
    setEveryoneCursor(null);
    setEveryoneLoading(false);
    setEveryoneLoadingMore(false);
    setSpoilerResetToken((token) => token + 1);

    const wasTransientFollowingView = Boolean(
      searchQuery.trim() || appliedSearchQuery || selectedCommunityMedia
    );
    if (communityMode === 'following' && wasTransientFollowingView) {
      const snapshot = normalFollowingSnapshotRef.current;
      const canRestoreSnapshot = Boolean(
        userId &&
        snapshot &&
        snapshot.userId === userId &&
        snapshot.mediaFilter === selectedMediaFilter &&
        snapshot.sort === selectedSort &&
        // Cache fallback eligibility depends on per-review timestamps that are
        // intentionally not exposed to this screen. Do not extend it merely
        // because an older cache result remains in memory.
        snapshot.source === 'remote'
      );
      if (canRestoreSnapshot && snapshot) {
        const authorizedReviews = snapshot.reviews.filter(
          (review) =>
            !isFollowingAuthorInvalidatedForSession(userId!, review.authorId)
        );
        setReviews(authorizedReviews);
        setFollowsAnyone(snapshot.followsAnyone);
        setFollowingSource(snapshot.source);
        setError(snapshot.error);
        hasLoadedFeedRef.current = true;
      } else {
        setReviews([]);
        setFollowingSource('remote');
        setError(null);
        hasLoadedFeedRef.current = false;
        setIsLoading(true);
      }
    }

    if (userId) {
      resetCommunityScrollOffset(userId);
    }
    listRef.current?.scrollToOffset({ animated: false, offset: 0 });
  }, [appliedSearchQuery, cancelPendingScrollRestoration, communityMode, searchQuery, selectedCommunityMedia, selectedMediaFilter, selectedSort, userId]);

  useEffect(() => {
    const parentTabNavigation = navigation.getParent();
    if (!parentTabNavigation) {
      return;
    }
    return parentTabNavigation.addListener('blur', resetForFreshCommunityVisit);
  }, [navigation, resetForFreshCommunityVisit]);

  // The Community screen remains mounted beneath nested Community routes.
  // Capture its account-scoped position when it regains focus, then restore
  // explicitly after the native navigation transition. Content-size changes
  // remain a fallback if the list was not ready at that point.
  useFocusEffect(
    useCallback(() => {
      isCommunityScreenFocusedRef.current = true;
      shouldRestoreScrollRef.current = Boolean(userId);
      hasPendingScrollRestoreRef.current = Boolean(userId);
      pendingScrollRestoreOffsetRef.current = userId
        ? getCommunityScrollOffset(userId)
        : 0;
      scheduleScrollRestoration();
      return () => {
        isCommunityScreenFocusedRef.current = false;
        cancelPendingScrollRestoration();
      };
    }, [cancelPendingScrollRestoration, scheduleScrollRestoration, userId])
  );

  useFocusEffect(
    useCallback(() => {
      if (!preferencesReady) {
        return;
      }

      const preferenceUpdate = userId
        ? consumeCommunityPreferenceUpdate(userId)
        : null;
      if (preferenceUpdate && userId) {
        setSelectedMediaFilter(preferenceUpdate.mediaFilter);
        setSelectedSort(preferenceUpdate.sort);
        setDraftMediaFilter(preferenceUpdate.mediaFilter);
        setDraftSort(preferenceUpdate.sort);
        setSavedDefaultPreferences(preferenceUpdate);
        setSearchQuery('');
        setAppliedSearchQuery('');
        cancelPendingScrollRestoration();
        listRef.current?.scrollToOffset({ animated: false, offset: 0 });
        return;
      }

      const followingFocusKey = `${selectedMediaFilter}:${selectedSort}:${appliedSearchQuery}:${userId ?? ''}`;
      const shouldRefresh = shouldRefreshCommunityOnFocusRef.current;
      shouldRefreshCommunityOnFocusRef.current = false;
      if (communityMode === 'following' && !selectedCommunityMedia) {
        if (shouldRefresh || lastFollowingFocusKeyRef.current !== followingFocusKey) {
          lastFollowingFocusKeyRef.current = followingFocusKey;
          void loadFeed();
        }
      } else if (shouldRefresh && communityMode === 'everyone' && !selectedCommunityMedia) {
        void loadEveryone();
      }
    }, [appliedSearchQuery, cancelPendingScrollRestoration, communityMode, loadEveryone, loadFeed, preferencesReady, selectedCommunityMedia, selectedMediaFilter, selectedSort, userId])
  );

  const openOptions = () => {
    setDraftMediaFilter(selectedMediaFilter);
    setDraftSort(selectedSort);
    setOptionsVisible(true);
  };

  const applyOptions = () => {
    cancelPendingScrollRestoration();
    setSelectedMediaFilter(draftMediaFilter);
    setSelectedSort(draftSort);
    if (userId) {
      setCurrentCommunityPreferences(userId, {
        mediaFilter: draftMediaFilter,
        sort: draftSort,
      });
    }
    setOptionsVisible(false);
    if (userId) {
      resetCommunityScrollOffset(userId);
      listRef.current?.scrollToOffset({ animated: false, offset: 0 });
      void communityPreferenceRepository
        .setForUser(userId, {
          mediaFilter: draftMediaFilter,
          sort: draftSort,
        })
        .catch((storageError) => {
          const message =
            storageError instanceof Error
              ? storageError.message
              : 'Unknown local preference error';
          console.log('Unable to save Community preferences:', message);
        });
    }
  };

  const resetToDefaults = () => {
    cancelPendingScrollRestoration();
    const defaults = savedDefaultPreferences;
    setSelectedMediaFilter(defaults.mediaFilter);
    setSelectedSort(defaults.sort);
    setDraftMediaFilter(defaults.mediaFilter);
    setDraftSort(defaults.sort);
    setOptionsVisible(false);
    if (!userId) {
      return;
    }
    setCurrentCommunityPreferences(userId, defaults);
    resetCommunityScrollOffset(userId);
    listRef.current?.scrollToOffset({ animated: false, offset: 0 });
    void communityPreferenceRepository.setForUser(userId, defaults).catch(
      (storageError) => {
        const message =
          storageError instanceof Error
            ? storageError.message
            : 'Unknown local preference error';
        console.log('Unable to reset Community preferences:', message);
      }
    );
  };

  const updateSearchQuery = (query: string) => {
    cancelPendingScrollRestoration();
    if (selectedCommunityMedia) {
      selectedMediaRequestIdRef.current += 1;
      setSelectedCommunityMedia(null);
      setSelectedMediaDisplay(null);
      setSelectedMediaReviews([]);
      setSelectedMediaCursor(null);
      setSelectedMediaError(null);
    }
    setMovieSuggestionsExpanded(false);
    setTvSuggestionsExpanded(false);
    setSearchQuery(query);
    if (!query.trim()) {
      catalogRequestIdRef.current += 1;
      setCatalogSuggestions([]);
      setCatalogSuggestionState('idle');
    }
    if (userId) {
      resetCommunityScrollOffset(userId);
      listRef.current?.scrollToOffset({ animated: false, offset: 0 });
    }
  };

  const filterHeaderButton = () => {
    const hasActiveOptions =
      selectedMediaFilter !== 'all' || selectedSort !== 'newest';
    return (
      <Pressable
        accessibilityLabel="Filter and sort community reviews"
        accessibilityState={{ disabled: false }}
        accessibilityRole="button"
        hitSlop={10}
        onPress={openOptions}
        style={({ pressed }) => [
          styles.filterButton,
          pressed && styles.pressed,
        ]}
      >
        <Ionicons
          color={hasActiveOptions ? colors.reviewAccent : '#33363D'}
          name="filter"
          size={23}
        />
      </Pressable>
    );
  };

  const changeCommunityMode = (nextMode: CommunityMode) => {
    cancelPendingScrollRestoration();
    setCommunityMode(nextMode);
    setOptionsVisible(false);
    if (nextMode === 'everyone') everyoneQueryKeyRef.current = null;
    if (selectedCommunityMedia) {
      listRef.current?.scrollToOffset({ animated: false, offset: 0 });
    }
  };

  const selectCatalogSuggestion = (suggestion: CatalogSuggestion) => {
    cancelPendingScrollRestoration();
    catalogRequestIdRef.current += 1;
    selectedMediaRequestIdRef.current += 1;
    setSelectedCommunityMedia(suggestion.identity);
    setSelectedMediaDisplay(suggestion.media);
    setSelectedMediaReviews([]);
    setSelectedMediaCursor(null);
    setSelectedMediaError(null);
    setCatalogSuggestions([]);
    setCatalogSuggestionState('idle');
    Keyboard.dismiss();
    if (userId) {
      resetCommunityScrollOffset(userId);
    }
    listRef.current?.scrollToOffset({ animated: false, offset: 0 });
  };

  const clearSelectedCommunityMedia = () => {
    cancelPendingScrollRestoration();
    selectedMediaRequestIdRef.current += 1;
    catalogRequestIdRef.current += 1;
    setSelectedCommunityMedia(null);
    setSelectedMediaDisplay(null);
    setSelectedMediaReviews([]);
    setSelectedMediaCursor(null);
    setSelectedMediaError(null);
    setSearchQuery('');
    setAppliedSearchQuery('');
    setCatalogSuggestions([]);
    setCatalogSuggestionState('idle');
    setMovieSuggestionsExpanded(false);
    setTvSuggestionsExpanded(false);
    listRef.current?.scrollToOffset({ animated: false, offset: 0 });
  };

  const getFollowingEmptyState = (): CommunityEmptyStateKind => {
    if (error) return followingSource === 'cache' ? 'following-saved-empty' : 'error';
    if (searchQuery.trim()) return 'search';
    if (selectedMediaFilter !== 'all') return 'filtered';
    return followsAnyone ? 'following-quiet' : 'following-empty';
  };

  const isCommunitySearchActive = Boolean(
    searchQuery.trim() || selectedCommunityMedia
  );

  const blurCommunitySearch = useCallback(() => {
    searchInputRef.current?.blur();
    Keyboard.dismiss();
  }, []);

  const openCommunityReview = useCallback(
    (review: CommunityReview) => {
      blurCommunitySearch();
      router.push({
        pathname: '/community/review/[reviewId]',
        params: { authorId: review.authorId, reviewId: review.id },
      });
    },
    [blurCommunitySearch]
  );

  const communityModeToggle = (
    <CommunityModeToggle mode={communityMode} onChange={changeCommunityMode} />
  );
  const movieCatalogSuggestions = catalogSuggestions.filter(
    (suggestion) => suggestion.identity.mediaType === 'movie'
  );
  const tvCatalogSuggestions = catalogSuggestions.filter(
    (suggestion) => suggestion.identity.mediaType === 'tv'
  );

  const communityHeader = (
    <View style={styles.communityHeader}>
      {!isCommunitySearchActive ? communityModeToggle : null}
      <View style={styles.searchRow}>
        <View style={styles.searchField}>
          <Ionicons color="#7B8190" name="search-outline" size={21} />
          <TextInput
            ref={searchInputRef}
            accessibilityLabel="Search community reviews"
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={updateSearchQuery}
            placeholder="Search titles or reviews..."
            placeholderTextColor="#9DA3AE"
            returnKeyType="search"
            style={styles.searchInput}
            value={searchQuery}
          />
          {searchQuery.length > 0 ? (
            <Pressable accessibilityLabel="Clear community review search" hitSlop={8} onPress={() => updateSearchQuery('')}>
              <Ionicons color="#7B8190" name="close-circle" size={21} />
            </Pressable>
          ) : null}
        </View>
        {filterHeaderButton()}
      </View>
      {searchQuery.trim() || selectedCommunityMedia ? (
        <View style={styles.catalogSection}>
          <View style={styles.catalogSectionHeading}>
            <Text style={styles.catalogSectionTitle}>Movies &amp; TV</Text>
            {catalogSuggestionState === 'loading' ? (
              <ActivityIndicator
                accessibilityLabel="Loading movie and TV suggestions"
                color={colors.reviewAccent}
                size="small"
              />
            ) : null}
          </View>
          {selectedCommunityMedia && selectedMediaDisplay ? (
            <View style={styles.selectedMediaCard}>
              {selectedMediaDisplay.posterUrl ? (
                <Image
                  accessibilityLabel={`Poster for ${selectedMediaDisplay.title}`}
                  source={{ uri: selectedMediaDisplay.posterUrl }}
                  style={styles.selectedMediaPoster}
                />
              ) : (
                <View
                  accessibilityLabel={`Poster placeholder for ${selectedMediaDisplay.title}`}
                  style={styles.selectedMediaPosterFallback}
                >
                  <Ionicons
                    color={colors.reviewAccent}
                    name="film-outline"
                    size={20}
                  />
                </View>
              )}
              <View style={styles.selectedMediaCopy}>
                <Text numberOfLines={1} style={styles.selectedMediaTitle}>
                  {selectedMediaDisplay.title}
                </Text>
                <Text style={styles.selectedMediaMeta}>
                  {selectedCommunityMedia.mediaType === 'tv' ? 'TV series' : 'Movie'}
                  {selectedMediaDisplay.releaseYear !== null
                    ? ` · ${selectedMediaDisplay.releaseYear}`
                    : ''}
                </Text>
              </View>
              <Pressable
                accessibilityLabel="Clear selected media"
                hitSlop={8}
                onPress={clearSelectedCommunityMedia}
                style={styles.clearSelectedMediaButton}
              >
                <Ionicons color={colors.reviewAccentText} name="close" size={19} />
              </Pressable>
            </View>
          ) : null}
          {!selectedCommunityMedia && catalogSuggestionState === 'ready' ? (
            <>
              <CatalogSuggestionSection
                expanded={movieSuggestionsExpanded}
                label="Movies"
                onSelect={selectCatalogSuggestion}
                onToggleExpanded={() =>
                  setMovieSuggestionsExpanded((expanded) => !expanded)
                }
                suggestions={movieCatalogSuggestions}
              />
              <CatalogSuggestionSection
                expanded={tvSuggestionsExpanded}
                label="TV Shows"
                onSelect={selectCatalogSuggestion}
                onToggleExpanded={() =>
                  setTvSuggestionsExpanded((expanded) => !expanded)
                }
                suggestions={tvCatalogSuggestions}
              />
            </>
          ) : null}
          {!selectedCommunityMedia && catalogSuggestionState === 'empty' ? (
            <Text style={styles.catalogStatus}>No movies or TV series found.</Text>
          ) : null}
          {!selectedCommunityMedia && catalogSuggestionState === 'error' ? (
            <View style={styles.catalogErrorRow}>
              <Text style={styles.catalogStatus}>Suggestions are unavailable.</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setCatalogSearchRetry((attempt) => attempt + 1)}
              >
                <Text style={styles.catalogRetry}>Try again</Text>
              </Pressable>
            </View>
          ) : null}
          {selectedCommunityMedia ? (
            <Text style={styles.selectedMediaResultsHeading}>
              Reviews for {selectedMediaDisplay?.title ?? 'this title'}
            </Text>
          ) : null}
          {selectedCommunityMedia &&
          selectedMediaFilter !== 'all' &&
          selectedMediaFilter !== selectedCommunityMedia.mediaType ? (
            <Text style={styles.selectedMediaFilterNotice}>
              This exact {selectedCommunityMedia.mediaType === 'tv' ? 'TV series' : 'movie'} search ignores your current media filter. Your preference is unchanged.
            </Text>
          ) : null}
        </View>
      ) : null}
      {searchQuery.trim() && !selectedCommunityMedia && communityMode === 'following' ? (
        <View style={styles.reviewTextMatchesHeading}>
          <Text style={styles.catalogSectionTitle}>Review Text Matches</Text>
          <Text style={styles.reviewTextMatchesHint}>
            Matches from the currently available Following feed
          </Text>
        </View>
      ) : null}
      {!selectedCommunityMedia && communityMode === 'everyone' && everyoneSource === 'cache' && everyoneReviews.length > 0 ? (
        <Text accessibilityLiveRegion="polite" style={styles.offlineIndicator}>
          Offline · Showing saved reviews
        </Text>
      ) : null}
      {!selectedCommunityMedia && communityMode === 'following' && followingSource === 'cache' && reviews.length > 0 ? (
        <Text accessibilityLiveRegion="polite" style={styles.offlineIndicator}>
          Offline · Showing saved reviews
        </Text>
      ) : null}
    </View>
  );

  const isSelectedMediaMode = selectedCommunityMedia !== null;
  const displayedReviews = isSelectedMediaMode
    ? selectedMediaReviews
    : communityMode === 'following'
      ? reviews
      : everyoneReviews;
  const displayedInitialLoading = isSelectedMediaMode
    ? selectedMediaLoading
    : (isLoading && communityMode === 'following') ||
      (everyoneLoading && communityMode === 'everyone');

  const followFromCommunityCard = async (review: CommunityReview) => {
    if (!userId) {
      return;
    }
    await followService.follow(userId, review.authorId);
    const relationshipStatus: 'pending' | 'active' =
      review.author.accountPrivacy === 'private' ? 'pending' : 'active';
    const updateStatus = (current: CommunityReview[]) =>
      current.map((candidate) =>
        candidate.authorId === review.authorId
          ? { ...candidate, relationshipStatus }
          : candidate
      );
    if (isSelectedMediaMode) {
      setSelectedMediaReviews(updateStatus);
    } else {
      setEveryoneReviews(updateStatus);
    }
  };

  if (displayedInitialLoading) {
    return (
      <View style={styles.loadingContainer}>
        {isCommunitySearchActive ? (
          <View style={styles.activeSearchModeToggle}>
            {communityModeToggle}
          </View>
        ) : null}
        {communityHeader}
        <View style={styles.loadingBody}>
          <ActivityIndicator color={colors.reviewAccent} size="large" />
          <Text style={styles.loadingText}>Loading your community…</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {isCommunitySearchActive ? (
        <View style={styles.activeSearchModeToggle}>
          {communityModeToggle}
        </View>
      ) : null}
      <FlatList
      ref={listRef}
      style={styles.list}
      contentContainerStyle={[
        styles.listContent,
        isCommunitySearchActive && styles.activeSearchListContent,
        (communityMode === 'everyone' || displayedReviews.length === 0) && styles.emptyListContent,
      ]}
      data={displayedReviews}
      extraData={spoilerResetToken}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      keyExtractor={(review) => review.id}
      ListHeaderComponent={communityHeader}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      onContentSizeChange={(_width, height) => {
        contentHeightRef.current = height;
        attemptScrollRestoration(
          scrollRestoreGenerationRef.current,
          'content-size'
        );
      }}
      onScroll={(event) => {
        const offset = event.nativeEvent.contentOffset.y;
        const acceptsOffset = Boolean(
          userId &&
          isCommunityScreenFocusedRef.current &&
          !hasPendingScrollRestoreRef.current
        );
        if (
          acceptsOffset &&
          userId
        ) {
          setCommunityScrollOffset(userId, offset);
        }
      }}
      onScrollBeginDrag={blurCommunitySearch}
      scrollEventThrottle={16}
      ListEmptyComponent={
        isSelectedMediaMode ? (
          <View style={styles.selectedMediaEmptyState}>
            <Ionicons
              color={colors.reviewAccent}
              name={selectedMediaError ? 'cloud-offline-outline' : 'film-outline'}
              size={30}
            />
            <Text style={styles.selectedMediaEmptyTitle}>
              {selectedMediaError
                ? 'Reviews unavailable'
                : communityMode === 'following'
                  ? 'No reviews from people you follow'
                  : 'No public reviews yet'}
            </Text>
            <Text style={styles.selectedMediaEmptyCopy}>
              {selectedMediaError
                ? selectedMediaError
                : communityMode === 'following'
                  ? 'Matching reviews from active followed accounts will appear here.'
                  : 'Public reviews for this title will appear here.'}
            </Text>
            {selectedMediaError && selectedCommunityMedia ? (
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  void loadSelectedMedia(
                    selectedCommunityMedia,
                    communityMode,
                    selectedSort
                  )
                }
                style={styles.selectedMediaRetryButton}
              >
                <Text style={styles.selectedMediaRetryText}>Try again</Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <CommunityEmptyState
            kind={communityMode === 'everyone' ? (everyoneError ? 'everyone-saved-empty' : selectedMediaFilter !== 'all' ? 'filtered' : 'everyone-empty') : getFollowingEmptyState()}
            onExploreEveryone={() => changeCommunityMode('everyone')}
            onFindPeople={() => router.push('/community/find-people')}
            onRetry={() => void (communityMode === 'everyone' ? loadEveryone() : loadFeed())}
          />
        )
      }
      refreshControl={
        <RefreshControl
          colors={[colors.reviewAccent]}
          onRefresh={() => {
            if (isSelectedMediaMode && selectedCommunityMedia) {
              void loadSelectedMedia(
                selectedCommunityMedia,
                communityMode,
                selectedSort
              );
            } else if (communityMode === 'following') {
              void loadFeed(true);
            } else {
              void loadEveryone();
            }
          }}
          refreshing={isSelectedMediaMode ? selectedMediaLoading : isRefreshing}
          tintColor={colors.reviewAccent}
        />
      }
      renderItem={({ item }) => (
        <CommunityReviewCard
          onFollow={communityMode === 'everyone' && (isSelectedMediaMode || everyoneSource === 'remote') && item.authorId !== userId ? followFromCommunityCard : undefined}
          onOpenReview={openCommunityReview}
          review={item}
          spoilerResetToken={spoilerResetToken}
        />
      )}
      ListFooterComponent={
        isSelectedMediaMode &&
        communityMode === 'everyone' &&
        selectedMediaReviews.length > 0 &&
        selectedMediaCursor &&
        selectedCommunityMedia ? (
          <Pressable
            accessibilityLabel="Load more reviews for selected media"
            accessibilityRole="button"
            disabled={selectedMediaLoadingMore}
            onPress={() =>
              void loadSelectedMedia(
                selectedCommunityMedia,
                communityMode,
                selectedSort,
                true,
                selectedMediaCursor
              )
            }
            style={styles.loadMoreButton}
          >
            <Text style={styles.loadMoreText}>
              {selectedMediaLoadingMore ? 'Loading…' : 'Load more'}
            </Text>
          </Pressable>
        ) : !isSelectedMediaMode &&
          communityMode === 'everyone' &&
          everyoneSource === 'remote' &&
          everyoneReviews.length > 0 &&
          everyoneCursor ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Load more public reviews" disabled={everyoneLoadingMore} onPress={() => void loadEveryone(true)} style={styles.loadMoreButton}><Text style={styles.loadMoreText}>{everyoneLoadingMore ? 'Loading…' : 'Load more'}</Text></Pressable>
        ) : null
      }
      showsVerticalScrollIndicator={false}
      />
      <CommunityOptionsModal
        mediaFilter={draftMediaFilter}
        onApply={applyOptions}
        onClose={() => setOptionsVisible(false)}
        onResetToDefaults={resetToDefaults}
        setMediaFilter={setDraftMediaFilter}
        setSort={setDraftSort}
        showResetToDefaults={
          selectedMediaFilter !== savedDefaultPreferences.mediaFilter ||
          selectedSort !== savedDefaultPreferences.sort
        }
        sort={draftSort}
        visible={optionsVisible}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#F7F7F8',
  },
  screen: {
    flex: 1,
    backgroundColor: '#F7F7F8',
  },
  loadingBody: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  loadingText: {
    color: '#858B96',
    marginTop: 12,
  },
  filterButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    borderColor: '#E6E8EC',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledControl: { opacity: 0.45 },
  communityHeader: { paddingBottom: 16 },
  activeSearchModeToggle: {
    backgroundColor: '#F7F7F8',
    paddingHorizontal: 15,
    paddingTop: 18,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  searchField: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#DADCE1',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  searchInput: {
    flex: 1,
    color: '#24252A',
    fontSize: 15,
    paddingVertical: 0,
  },
  catalogSection: {
    marginTop: -4,
    marginBottom: 8,
  },
  catalogSectionHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  catalogSectionTitle: {
    color: '#525866',
    fontSize: 13,
    fontWeight: '700',
  },
  catalogSuggestionSection: {
    gap: 7,
    marginBottom: 12,
  },
  catalogSuggestionList: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  catalogExpansionButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  catalogExpansionText: {
    color: colors.reviewAccentText,
    fontSize: 13,
    fontWeight: '700',
  },
  catalogSuggestion: {
    alignItems: 'center',
    borderBottomColor: '#EEF0F3',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 64,
    padding: 8,
  },
  catalogPoster: {
    backgroundColor: '#F1F2F5',
    borderRadius: 5,
    height: 48,
    width: 34,
  },
  catalogPosterFallback: {
    alignItems: 'center',
    backgroundColor: '#FCEAF0',
    borderRadius: 5,
    height: 48,
    justifyContent: 'center',
    width: 34,
  },
  catalogSuggestionCopy: {
    flex: 1,
    gap: 3,
  },
  catalogSuggestionTitle: {
    color: '#25262B',
    fontSize: 15,
    fontWeight: '700',
  },
  catalogSuggestionMeta: {
    color: '#7D8490',
    fontSize: 13,
  },
  catalogStatus: {
    color: '#7D8490',
    fontSize: 13,
    paddingVertical: 6,
  },
  catalogErrorRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  catalogRetry: {
    color: colors.reviewAccentText,
    fontSize: 13,
    fontWeight: '700',
  },
  selectedMediaCard: {
    alignItems: 'center',
    backgroundColor: '#FCEAF0',
    borderColor: '#F4C5D3',
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  selectedMediaPoster: {
    backgroundColor: '#F1F2F5',
    borderRadius: 5,
    height: 58,
    width: 41,
  },
  selectedMediaPosterFallback: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 5,
    height: 58,
    justifyContent: 'center',
    width: 41,
  },
  selectedMediaCopy: {
    flex: 1,
    gap: 2,
  },
  selectedMediaTitle: {
    color: '#72263D',
    fontSize: 14,
    fontWeight: '700',
  },
  selectedMediaMeta: {
    color: '#9D5067',
    fontSize: 12,
  },
  clearSelectedMediaButton: {
    alignItems: 'center',
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  selectedMediaResultsHeading: {
    color: '#33363D',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 8,
  },
  selectedMediaFilterNotice: {
    color: '#9D5067',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
  reviewTextMatchesHeading: {
    borderTopColor: '#E5E7EB',
    borderTopWidth: 1,
    gap: 2,
    marginTop: 5,
    paddingTop: 13,
  },
  reviewTextMatchesHint: {
    color: '#7D8490',
    fontSize: 12,
  },
  offlineIndicator: { color: '#7D8490', fontSize: 12, fontWeight: '600', marginTop: -6 },
  loadMoreButton: { alignItems: 'center', paddingVertical: 16 },
  loadMoreText: { color: colors.reviewAccentText, fontWeight: '700' },
  selectedMediaEmptyState: {
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 24,
    paddingTop: 42,
  },
  selectedMediaEmptyTitle: {
    color: '#33363D',
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  selectedMediaEmptyCopy: {
    color: '#7D8490',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  selectedMediaRetryButton: {
    borderColor: colors.reviewAccent,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 4,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  selectedMediaRetryText: {
    color: colors.reviewAccentText,
    fontWeight: '700',
  },
  list: {
    flex: 1,
    backgroundColor: '#F7F7F8',
  },
  listContent: {
    paddingHorizontal: 15,
    paddingTop: 18,
    paddingBottom: 30,
  },
  activeSearchListContent: {
    paddingTop: 0,
  },
  emptyListContent: {
    flexGrow: 1,
  },
  separator: {
    height: 13,
  },
  pressed: {
    opacity: 0.55,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(20, 20, 24, 0.35)',
  },
  sortSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 34,
  },
  sortHandle: {
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#D6D8DD',
    alignSelf: 'center',
    marginBottom: 16,
  },
  sortTitle: {
    color: '#17171C',
    fontSize: 19,
    fontWeight: '700',
    marginBottom: 8,
  },
  optionsSectionTitle: {
    color: '#858B96',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.7,
    marginTop: 8,
    textTransform: 'uppercase',
  },
  optionsDivider: {
    height: 1,
    backgroundColor: '#E3E4E8',
    marginVertical: 10,
  },
  sortOption: {
    minHeight: 52,
    borderBottomWidth: 1,
    borderBottomColor: '#ECEDEF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sortOptionPressed: {
    opacity: 0.55,
  },
  sortOptionText: {
    color: '#3E4148',
    fontSize: 16,
  },
  selectedSortOptionText: {
    color: colors.reviewAccentText,
    fontWeight: '700',
  },
  optionsDoneButton: {
    minHeight: 48,
    borderRadius: 10,
    backgroundColor: colors.reviewAccent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  resetToDefaultsButton: {
    alignSelf: 'center',
    minHeight: 38,
    justifyContent: 'center',
    marginTop: 6,
    marginBottom: 4,
    paddingHorizontal: 12,
  },
  resetToDefaultsText: {
    color: colors.reviewAccentText,
    fontSize: 14,
    fontWeight: '700',
  },
  optionsDoneButtonPressed: {
    opacity: 0.75,
  },
  optionsDoneButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
