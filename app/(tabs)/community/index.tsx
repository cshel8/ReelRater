import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
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
  communityFeedService,
  everyoneCommunityFeedService,
  followService,
  communityPreferenceRepository,
  settingsService,
} from '@/services';
import {
  beginCommunitySessionForUser,
  consumeCommunityPreferenceUpdate,
  getCommunityScrollOffset,
  resetCommunityScrollOffset,
  setCurrentCommunityPreferences,
  setCommunityScrollOffset,
} from '@/services/community/communitySessionState';
import {
  resolveCommunityDefaultPreferences,
  resolveInitialCommunityPreferences,
} from '@/services/community/communityPreferenceResolver';
import type {
  CommunityReviewMediaFilter,
  CommunityReviewSort,
} from '@/services/contracts';
import { userStore } from '@/store/userStore';
import type { CommunityActivePreferences, CommunityReview } from '@/types/domain';
import type { PublicReviewPageCursor } from '@/services/contracts';

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
  const userId = userStore((state) => state.userId);
  const [reviews, setReviews] = useState<CommunityReview[]>([]);
  const [everyoneReviews, setEveryoneReviews] = useState<CommunityReview[]>([]);
  const [everyoneCursor, setEveryoneCursor] = useState<PublicReviewPageCursor | null>(null);
  const [everyoneLoading, setEveryoneLoading] = useState(false);
  const [everyoneLoadingMore, setEveryoneLoadingMore] = useState(false);
  const [everyoneError, setEveryoneError] = useState<string | null>(null);
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
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [savedDefaultPreferences, setSavedDefaultPreferences] =
    useState<CommunityActivePreferences>({ mediaFilter: 'all', sort: 'newest' });
  const hasLoadedFeedRef = useRef(false);
  const feedRequestIdRef = useRef(0);
  const shouldRestoreScrollRef = useRef(false);
  const everyoneQueryKeyRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    beginCommunitySessionForUser(userId);
    hasLoadedFeedRef.current = false;
    feedRequestIdRef.current += 1;
    setPreferencesReady(false);
    setSelectedMediaFilter('all');
    setSelectedSort('newest');
    setDraftMediaFilter('all');
    setDraftSort('newest');
    setSavedDefaultPreferences({ mediaFilter: 'all', sort: 'newest' });
    setSearchQuery('');
    setAppliedSearchQuery('');

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
        const result = await communityFeedService.list(userId, {
          mediaFilter: selectedMediaFilter,
          ...(appliedSearchQuery
            ? { searchQuery: appliedSearchQuery }
            : {}),
          sort: selectedSort,
        });
        if (requestId !== feedRequestIdRef.current) {
          return;
        }
        setReviews(result.reviews);
        setFollowsAnyone(result.followsAnyone);
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
    append ? setEveryoneLoadingMore(true) : setEveryoneLoading(true);
    if (!append) setEveryoneError(null);
    try {
      const page = await everyoneCommunityFeedService.listPage(userId, {
        mediaFilter: selectedMediaFilter, sort: selectedSort,
        ...(append ? { cursor: everyoneCursor } : {}),
      });
      setEveryoneReviews((current) => append ? [...current, ...page.reviews.filter((review) => !current.some((existing) => existing.id === review.id))] : page.reviews);
      setEveryoneCursor(page.nextCursor);
    } catch (loadError) {
      setEveryoneError(loadError instanceof Error ? loadError.message : 'Public reviews could not be loaded.');
    } finally { setEveryoneLoading(false); setEveryoneLoadingMore(false); }
  }, [everyoneCursor, preferencesReady, selectedMediaFilter, selectedSort, userId]);

  useEffect(() => {
    const key = `${communityMode}:${selectedMediaFilter}:${selectedSort}:${userId ?? ''}`;
    if (communityMode === 'everyone' && preferencesReady && everyoneQueryKeyRef.current !== key) {
      everyoneQueryKeyRef.current = key;
      void loadEveryone();
    }
  }, [communityMode, loadEveryone, preferencesReady, selectedMediaFilter, selectedSort, userId]);

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
        shouldRestoreScrollRef.current = false;
        listRef.current?.scrollToOffset({ animated: false, offset: 0 });
        return;
      }

      shouldRestoreScrollRef.current = true;
      if (communityMode === 'following') {
        void loadFeed();
      }

      return () => {
        setOptionsVisible(false);
      };
    }, [communityMode, loadFeed, preferencesReady, userId])
  );

  useFocusEffect(
    useCallback(
      () => () => {
        setOptionsVisible(false);
        setSearchQuery('');
      },
      []
    )
  );

  const restoreScrollPosition = useCallback(() => {
    if (!shouldRestoreScrollRef.current || !userId) {
      return;
    }
    shouldRestoreScrollRef.current = false;
    listRef.current?.scrollToOffset({
      animated: false,
      offset: getCommunityScrollOffset(userId),
    });
  }, [userId]);

  const openOptions = () => {
    setDraftMediaFilter(selectedMediaFilter);
    setDraftSort(selectedSort);
    setOptionsVisible(true);
  };

  const applyOptions = () => {
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
    setSearchQuery(query);
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
    setCommunityMode(nextMode);
    setSearchQuery('');
    setAppliedSearchQuery('');
    setOptionsVisible(false);
    if (nextMode === 'everyone') everyoneQueryKeyRef.current = null;
  };

  const getFollowingEmptyState = (): CommunityEmptyStateKind => {
    if (error) return 'error';
    if (searchQuery.trim()) return 'search';
    if (selectedMediaFilter !== 'all') return 'filtered';
    return followsAnyone ? 'following-quiet' : 'following-empty';
  };

  const communityHeader = (
    <View style={styles.communityHeader}>
      <CommunityModeToggle mode={communityMode} onChange={changeCommunityMode} />
      <View style={styles.searchRow}>
        <View style={styles.searchField}>
          <Ionicons color="#7B8190" name="search-outline" size={21} />
          <TextInput
            accessibilityLabel="Search community reviews"
            autoCapitalize="none"
            autoCorrect={false}
            editable={communityMode === 'following'}
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
      {communityMode === 'everyone' ? <Text style={styles.searchComingSoon}>Global Community search coming soon</Text> : null}
    </View>
  );

  if ((isLoading && communityMode === 'following') || (everyoneLoading && communityMode === 'everyone')) {
    return (
      <View style={styles.loadingContainer}>
        {communityHeader}
        <View style={styles.loadingBody}>
          <ActivityIndicator color={colors.reviewAccent} size="large" />
          <Text style={styles.loadingText}>Loading your community…</Text>
        </View>
      </View>
    );
  }

  return (
    <>
      <FlatList
      ref={listRef}
      style={styles.list}
      contentContainerStyle={[
        styles.listContent,
        (communityMode === 'everyone' || reviews.length === 0) && styles.emptyListContent,
      ]}
      data={communityMode === 'following' ? reviews : everyoneReviews}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      keyExtractor={(review) => review.id}
      ListHeaderComponent={communityHeader}
      onContentSizeChange={restoreScrollPosition}
      onScroll={(event) => {
        if (userId) {
          setCommunityScrollOffset(userId, event.nativeEvent.contentOffset.y);
        }
      }}
      scrollEventThrottle={16}
      ListEmptyComponent={
        <CommunityEmptyState
          kind={communityMode === 'everyone' ? (everyoneError ? 'error' : selectedMediaFilter !== 'all' ? 'filtered' : 'everyone-empty') : getFollowingEmptyState()}
          onExploreEveryone={() => changeCommunityMode('everyone')}
          onFindPeople={() => router.push('/community/find-people')}
          onRetry={() => void (communityMode === 'everyone' ? loadEveryone() : loadFeed())}
        />
      }
      refreshControl={
        <RefreshControl
          colors={[colors.reviewAccent]}
          onRefresh={() => {
            if (communityMode === 'following') void loadFeed(true);
            else void loadEveryone();
          }}
          refreshing={isRefreshing}
          tintColor={colors.reviewAccent}
        />
      }
      renderItem={({ item }) => <CommunityReviewCard review={item} onFollow={communityMode === 'everyone' && item.authorId !== userId ? async (review) => { await followService.follow(userId ?? '', review.authorId); setEveryoneReviews((current) => current.map((candidate) => candidate.authorId === review.authorId ? { ...candidate, relationshipStatus: review.author.accountPrivacy === 'private' ? 'pending' : 'active' } : candidate)); } : undefined} />}
      ListFooterComponent={communityMode === 'everyone' && everyoneReviews.length > 0 && everyoneCursor ? <Pressable accessibilityRole="button" accessibilityLabel="Load more public reviews" disabled={everyoneLoadingMore} onPress={() => void loadEveryone(true)} style={styles.loadMoreButton}><Text style={styles.loadMoreText}>{everyoneLoadingMore ? 'Loading…' : 'Load more'}</Text></Pressable> : null}
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
    </>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
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
  searchComingSoon: { color: '#7D8490', fontSize: 12, marginTop: -9, marginBottom: 7 },
  loadMoreButton: { alignItems: 'center', paddingVertical: 16 },
  loadMoreText: { color: colors.reviewAccentText, fontWeight: '700' },
  list: {
    flex: 1,
    backgroundColor: '#F7F7F8',
  },
  listContent: {
    paddingHorizontal: 15,
    paddingTop: 18,
    paddingBottom: 30,
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
