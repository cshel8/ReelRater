import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ReviewPoster } from '@/components/reviews/ReviewPoster';
import { ReviewStars } from '@/components/reviews/ReviewStars';
import { colors } from '@/constants/colors';
import {
  communityFeedService,
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
import type {
  CommunityActivePreferences,
  CommunityReview,
  PublicUserProfile,
} from '@/types/domain';
import { formatReviewDate } from '@/utils/reviewFormatting';
import {
  getDisplayReviewMovieMetadata,
  getDisplayReviewMovieTitle,
} from '@/utils/reviewMovie';

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

function AuthorAvatar({ author }: { author: PublicUserProfile }) {
  if (author.profileImage) {
    return <Image source={{ uri: author.profileImage }} style={styles.avatar} />;
  }

  return (
    <View style={styles.avatarPlaceholder}>
      <Text style={styles.avatarText}>
        {author.displayName.trim().charAt(0).toUpperCase() || '?'}
      </Text>
    </View>
  );
}

function CommunityReviewCard({ review }: { review: CommunityReview }) {
  const formattedDate = formatReviewDate(review.createdAt);
  const displayMovieTitle = getDisplayReviewMovieTitle(review);
  const movieMetadata = getDisplayReviewMovieMetadata(review);

  return (
    <View style={styles.reviewCard}>
      <Pressable
        accessibilityLabel={`View ${review.author.displayName}'s profile`}
        accessibilityHint="Opens this person's public profile"
        accessibilityRole="button"
        onPress={() =>
          router.push({
            pathname: '/community/[userId]',
            params: { userId: review.author.id },
          })
        }
        style={({ pressed }) => [
          styles.authorRow,
          pressed && styles.pressed,
        ]}
      >
        <AuthorAvatar author={review.author} />
        <View style={styles.authorIdentity}>
          <Text numberOfLines={1} style={styles.authorName}>
            {review.author.displayName}
          </Text>
          <Text numberOfLines={1} style={styles.authorHandle}>
            @{review.author.handle}
          </Text>
        </View>
        <Text style={styles.visibilityLabel}>
          {review.visibility === 'followers' ? 'Followers' : 'Public'}
        </Text>
      </Pressable>

      <Pressable
        accessibilityHint="Opens the complete read-only review"
        accessibilityLabel={`Read review of ${displayMovieTitle}`}
        accessibilityRole="button"
        onPress={() =>
          router.push({
            pathname: '/community/review/[reviewId]',
            params: {
              authorId: review.authorId,
              reviewId: review.id,
            },
          })
        }
        style={({ pressed }) => [
          styles.reviewRow,
          pressed && styles.pressed,
        ]}
      >
        <ReviewPoster
          movie={review.movie}
          style={styles.poster}
          title={displayMovieTitle}
        />
        <View style={styles.reviewContent}>
          <Text numberOfLines={2} style={styles.movieTitle}>
            {displayMovieTitle}
          </Text>
          {movieMetadata ? (
            <Text numberOfLines={1} style={styles.movieMetadata}>
              {movieMetadata}
            </Text>
          ) : null}
          <View style={styles.stars}>
            <ReviewStars rating={review.rating} />
          </View>
          <Text numberOfLines={3} style={styles.reviewText}>
            {review.reviewText}
          </Text>
          {formattedDate ? (
            <Text style={styles.reviewDate}>{formattedDate}</Text>
          ) : null}
        </View>
      </Pressable>
    </View>
  );
}

export default function CommunityScreen() {
  const listRef = useRef<FlatList<CommunityReview>>(null);
  const userId = userStore((state) => state.userId);
  const [reviews, setReviews] = useState<CommunityReview[]>([]);
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
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [appliedSearchQuery, setAppliedSearchQuery] = useState('');
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [savedDefaultPreferences, setSavedDefaultPreferences] =
    useState<CommunityActivePreferences>({ mediaFilter: 'all', sort: 'newest' });
  const hasLoadedFeedRef = useRef(false);
  const feedRequestIdRef = useRef(0);
  const shouldRestoreScrollRef = useRef(false);

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
      void loadFeed();

      return () => {
        setOptionsVisible(false);
      };
    }, [loadFeed, preferencesReady, userId])
  );

  useFocusEffect(
    useCallback(
      () => () => {
        setOptionsVisible(false);
        setSearchQuery('');
        setSearchVisible(false);
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

  const searchHeaderButton = () => (
    <Pressable
      accessibilityLabel="Search community reviews"
      accessibilityRole="button"
      hitSlop={10}
      onPress={() => setSearchVisible(true)}
      style={({ pressed }) => [
        styles.headerButton,
        pressed && styles.pressed,
      ]}
    >
      <Ionicons color="#33363D" name="search-outline" size={23} />
    </Pressable>
  );

  const filterHeaderButton = () => {
    const hasActiveOptions =
      selectedMediaFilter !== 'all' || selectedSort !== 'newest';
    return (
      <Pressable
        accessibilityLabel="Filter and sort community reviews"
        accessibilityRole="button"
        hitSlop={10}
        onPress={openOptions}
        style={({ pressed }) => [
          styles.headerButton,
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

  if (isLoading) {
    return (
      <>
        <Stack.Screen
          options={{
            headerLeft: searchHeaderButton,
            headerRight: filterHeaderButton,
          }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.reviewAccent} size="large" />
          <Text style={styles.loadingText}>Loading your community…</Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerLeft: searchHeaderButton,
          headerRight: filterHeaderButton,
        }}
      />
      <FlatList
      ref={listRef}
      style={styles.list}
      contentContainerStyle={[
        styles.listContent,
        reviews.length === 0 && styles.emptyListContent,
      ]}
      data={reviews}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      keyExtractor={(review) => review.id}
      ListHeaderComponent={
        searchVisible ? (
          <View style={styles.searchRow}>
            <View style={styles.searchField}>
              <Ionicons color="#7B8190" name="search-outline" size={21} />
              <TextInput
                accessibilityLabel="Search community reviews"
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
                onChangeText={updateSearchQuery}
                placeholder="Search titles or review text"
                placeholderTextColor="#9DA3AE"
                returnKeyType="search"
                style={styles.searchInput}
                value={searchQuery}
              />
              {searchQuery.length > 0 ? (
                <Pressable
                  accessibilityLabel="Clear community review search"
                  hitSlop={8}
                  onPress={() => updateSearchQuery('')}
                >
                  <Ionicons color="#7B8190" name="close-circle" size={21} />
                </Pressable>
              ) : null}
            </View>
            <Pressable
              accessibilityLabel="Close community review search"
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => {
                updateSearchQuery('');
                setSearchVisible(false);
              }}
              style={({ pressed }) => [
                styles.searchCancelButton,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons color="#4F5662" name="close" size={24} />
            </Pressable>
          </View>
        ) : null
      }
      onContentSizeChange={restoreScrollPosition}
      onScroll={(event) => {
        if (userId) {
          setCommunityScrollOffset(userId, event.nativeEvent.contentOffset.y);
        }
      }}
      scrollEventThrottle={16}
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <Ionicons
            color="#C4C7CE"
            name={error ? 'cloud-offline-outline' : 'people-outline'}
            size={49}
          />
          <Text style={styles.emptyTitle}>
            {error
              ? 'Community unavailable'
              : searchQuery.trim()
                ? 'No matching community reviews'
              : followsAnyone && selectedMediaFilter !== 'all'
                ? `No ${selectedMediaFilter === 'tv' ? 'TV show' : 'movie'} reviews yet`
              : followsAnyone
                ? 'No community reviews yet'
                : 'Find your community'}
          </Text>
          <Text style={styles.emptyText}>
            {error?.includes('permission-denied')
              ? 'Firestore denied this feed query. Publish the updated review rules, then try again.'
              : error?.includes('failed-precondition')
                ? 'Firestore needs an index for this feed query. Check the development console for its index link.'
              : error
                  ? 'This feed is online-only for now. Check your connection and try again.'
              : searchQuery.trim()
                ? 'Try another title or phrase from a review.'
              : followsAnyone && selectedMediaFilter !== 'all'
                ? `No ${selectedMediaFilter === 'tv' ? 'TV show' : 'movie'} reviews from people you follow are available yet.`
              : followsAnyone
                ? 'Reviews shared by people you follow will appear here.'
                : 'Follow other movie fans to see the reviews they share.'}
          </Text>
          {!error && !followsAnyone ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/community/find-people')}
              style={({ pressed }) => [
                styles.findPeopleButton,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons
                color="#FFFFFF"
                name="search-outline"
                size={19}
              />
              <Text style={styles.findPeopleButtonText}>Find People</Text>
            </Pressable>
          ) : null}
          {error ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => void loadFeed()}
              style={({ pressed }) => [
                styles.retryButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.retryButtonText}>Try Again</Text>
            </Pressable>
          ) : null}
        </View>
      }
      refreshControl={
        <RefreshControl
          colors={[colors.reviewAccent]}
          onRefresh={() => void loadFeed(true)}
          refreshing={isRefreshing}
          tintColor={colors.reviewAccent}
        />
      }
      renderItem={({ item }) => <CommunityReviewCard review={item} />}
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#858B96',
    marginTop: 12,
  },
  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
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
  searchCancelButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
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
  emptyListContent: {
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  emptyTitle: {
    color: '#3E4148',
    fontSize: 20,
    fontWeight: '700',
    marginTop: 15,
    textAlign: 'center',
  },
  emptyText: {
    color: '#858B96',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
    textAlign: 'center',
  },
  findPeopleButton: {
    minHeight: 46,
    borderRadius: 9,
    backgroundColor: colors.reviewAccent,
    marginTop: 22,
    paddingHorizontal: 21,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  findPeopleButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  retryButton: {
    minHeight: 42,
    borderWidth: 1,
    borderColor: colors.reviewAccent,
    borderRadius: 8,
    marginTop: 20,
    paddingHorizontal: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryButtonText: {
    color: colors.reviewAccentText,
    fontWeight: '700',
  },
  reviewCard: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: '#E6E6E9',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    padding: 15,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 39,
    height: 39,
    borderRadius: 20,
  },
  avatarPlaceholder: {
    width: 39,
    height: 39,
    borderRadius: 20,
    backgroundColor: colors.reviewAccentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.reviewAccentText,
    fontSize: 16,
    fontWeight: '700',
  },
  authorIdentity: {
    flex: 1,
    minWidth: 0,
    marginLeft: 10,
  },
  authorName: {
    color: '#24252A',
    fontSize: 15,
    fontWeight: '700',
  },
  authorHandle: {
    color: '#858B96',
    fontSize: 12,
    marginTop: 2,
  },
  visibilityLabel: {
    color: colors.reviewAccentText,
    fontSize: 11,
    fontWeight: '600',
    backgroundColor: colors.reviewAccentSoft,
    borderRadius: 10,
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  reviewRow: {
    flexDirection: 'row',
    marginTop: 14,
  },
  poster: {
    width: 82,
    height: 116,
    borderRadius: 8,
  },
  reviewContent: {
    flex: 1,
    minWidth: 0,
    marginLeft: 14,
  },
  movieTitle: {
    color: '#202126',
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 21,
  },
  movieMetadata: {
    color: '#9095A0',
    fontSize: 12,
    marginTop: 3,
  },
  stars: {
    marginTop: 7,
  },
  reviewText: {
    color: '#4F535C',
    fontSize: 14,
    lineHeight: 19,
    marginTop: 8,
  },
  reviewDate: {
    color: '#9095A0',
    fontSize: 12,
    marginTop: 8,
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
