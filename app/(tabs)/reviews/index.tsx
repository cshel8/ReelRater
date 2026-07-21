import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ReviewPoster } from '@/components/reviews/ReviewPoster';
import { ReviewStars } from '@/components/reviews/ReviewStars';
import { colors } from '@/constants/colors';
import { reviewService } from '@/services';
import { userStore } from '@/store/userStore';
import type { Review } from '@/types/domain';
import { formatReviewDate } from '@/utils/reviewFormatting';
import { getDisplayReviewMovieTitle } from '@/utils/reviewMovie';

type ReviewSort = 'newest' | 'oldest' | 'highest' | 'lowest';

const SORT_OPTIONS: { label: string; value: ReviewSort }[] = [
  { label: 'Newest first', value: 'newest' },
  { label: 'Oldest first', value: 'oldest' },
  { label: 'Highest rated', value: 'highest' },
  { label: 'Lowest rated', value: 'lowest' },
];

function getReviewTime(review: Review): number {
  const time = new Date(review.createdAt).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function sortReviews(reviews: Review[], sort: ReviewSort): Review[] {
  return [...reviews].sort((left, right) => {
    if (sort === 'oldest') {
      return getReviewTime(left) - getReviewTime(right);
    }
    if (sort === 'highest') {
      return Number(right.rating) - Number(left.rating);
    }
    if (sort === 'lowest') {
      return Number(left.rating) - Number(right.rating);
    }
    return getReviewTime(right) - getReviewTime(left);
  });
}

function ReviewRow({
  review,
  onPress,
}: {
  review: Review;
  onPress: () => void;
}) {
  const formattedDate = formatReviewDate(review.createdAt);
  const displayMovieTitle = getDisplayReviewMovieTitle(review);

  return (
    <Pressable
      accessibilityHint="Opens the full review"
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.reviewRow,
        pressed && styles.reviewRowPressed,
      ]}
    >
      <ReviewPoster
        movie={review.movie}
        style={styles.poster}
        title={displayMovieTitle}
      />

      <View style={styles.reviewContent}>
        <View style={styles.reviewTitleRow}>
          <Text numberOfLines={1} style={styles.reviewTitle} testID="review-title">
            {displayMovieTitle}
          </Text>
          {review.syncStatus !== 'synced' && (
            <Text
              style={[
                styles.syncStatus,
                review.syncStatus === 'failed' && styles.failedSyncStatus,
              ]}
            >
              {review.syncStatus === 'failed' ? 'Sync failed' : 'Pending'}
            </Text>
          )}
        </View>

        <View style={styles.listStars}>
          <ReviewStars rating={review.rating} />
        </View>

        <Text numberOfLines={2} style={styles.reviewPreview}>
          {review.reviewText}
        </Text>

        {formattedDate && (
          <Text style={styles.reviewDate}>{formattedDate}</Text>
        )}
      </View>

      <Ionicons
        color="#858B96"
        name="chevron-forward"
        size={22}
        style={styles.chevron}
      />
    </Pressable>
  );
}

function SortReviewsModal({
  onClose,
  onSelect,
  selectedSort,
  visible,
}: {
  onClose: () => void;
  onSelect: (sort: ReviewSort) => void;
  selectedSort: ReviewSort;
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
          accessibilityLabel="Close sort options"
          onPress={onClose}
          style={styles.modalBackdrop}
        />
        <View style={styles.sortSheet}>
          <View style={styles.sortHandle} />
          <Text style={styles.sortTitle}>Sort Reviews</Text>
          {SORT_OPTIONS.map((option) => {
            const selected = option.value === selectedSort;

            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected }}
                key={option.value}
                onPress={() => onSelect(option.value)}
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
                {selected && (
                  <Ionicons
                    color={colors.reviewAccent}
                    name="checkmark"
                    size={22}
                  />
                )}
              </Pressable>
            );
          })}
        </View>
      </View>
    </Modal>
  );
}

export default function MyReviewsScreen() {
  const userId = userStore((state) => state.userId);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [remoteAvailable, setRemoteAvailable] = useState(true);
  const [remoteError, setRemoteError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSort, setSelectedSort] = useState<ReviewSort>('newest');
  const [sortModalVisible, setSortModalVisible] = useState(false);

  const sortedReviews = useMemo(
    () => sortReviews(reviews, selectedSort),
    [reviews, selectedSort]
  );

  const loadReviews = useCallback(
    async (refreshing = false) => {
      if (!userId) {
        setIsLoading(false);
        return;
      }

      if (refreshing) {
        setIsRefreshing(true);
      }
      setError(null);

      try {
        const result = await reviewService.listForUser(userId);
        setReviews(result.reviews);
        setPendingCount(result.pendingCount);
        setRemoteAvailable(result.remoteAvailable);
        setRemoteError(result.remoteError ?? null);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Your reviews could not be loaded'
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [userId]
  );

  useFocusEffect(
    useCallback(() => {
      void loadReviews();
    }, [loadReviews])
  );

  const handleRetrySync = async () => {
    if (!userId) {
      return;
    }

    setIsRefreshing(true);
    try {
      await reviewService.syncPending(userId);
      await loadReviews();
    } finally {
      setIsRefreshing(false);
    }
  };

  const listHeader = (
    <View>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/reviews/write')}
        style={({ pressed }) => [
          styles.writeButton,
          pressed && styles.writeButtonPressed,
        ]}
      >
        <Ionicons color={colors.reviewAccent} name="add" size={25} />
        <Text style={styles.writeButtonText}>Write a Review</Text>
      </Pressable>

      {!remoteAvailable && (
        <View style={styles.connectionNotice}>
          <Ionicons color="#7B5A00" name="cloud-offline-outline" size={20} />
          <Text style={styles.connectionNoticeText}>
            {remoteError?.includes('permission-denied')
              ? 'Firestore denied access to your reviews. Check that your security rules are still active.'
              : 'The review service couldn’t be reached. Showing cached reviews and changes waiting on this device.'}
          </Text>
        </View>
      )}

      {pendingCount > 0 && (
        <View style={styles.pendingNotice}>
          <Text style={styles.pendingNoticeText}>
            {pendingCount} {pendingCount === 1 ? 'change is' : 'changes are'}{' '}
            waiting to sync.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => void handleRetrySync()}
            style={({ pressed }) => [
              styles.retryButton,
              pressed && styles.retryButtonPressed,
            ]}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      )}

      {reviews.length > 0 && <View style={styles.listSpacing} />}
    </View>
  );

  const sortHeaderButton = () => (
    <Pressable
      accessibilityLabel="Sort reviews"
      accessibilityRole="button"
      hitSlop={10}
      onPress={() => setSortModalVisible(true)}
      style={({ pressed }) => [
        styles.headerButton,
        pressed && styles.headerButtonPressed,
      ]}
    >
      <Ionicons color="#33363D" name="filter" size={23} />
    </Pressable>
  );

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ headerRight: sortHeaderButton }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.reviewAccent} size="large" />
          <Text style={styles.loadingText}>Loading your reviews…</Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerRight: sortHeaderButton }} />
      <FlatList
        style={styles.list}
        contentContainerStyle={[
          styles.listContent,
          reviews.length === 0 && styles.emptyListContent,
        ]}
        data={sortedReviews}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        keyExtractor={(review) => review.id}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons
              color="#C4C7CE"
              name="chatbox-ellipses-outline"
              size={44}
            />
            <Text style={styles.emptyTitle}>
              {error ? 'Reviews unavailable' : 'No reviews yet'}
            </Text>
            <Text style={styles.emptyText}>
              {error
                ? error
                : 'When you post a review, it will appear here.'}
            </Text>
            {error && (
              <Pressable
                accessibilityRole="button"
                onPress={() => void loadReviews(true)}
                style={styles.emptyRetryButton}
              >
                <Text style={styles.emptyRetryButtonText}>Try Again</Text>
              </Pressable>
            )}
          </View>
        }
        ListHeaderComponent={listHeader}
        refreshControl={
          <RefreshControl
            colors={[colors.reviewAccent]}
            onRefresh={() => void loadReviews(true)}
            refreshing={isRefreshing}
            tintColor={colors.reviewAccent}
          />
        }
        renderItem={({ item }) => (
          <ReviewRow
            onPress={() =>
              router.push({
                pathname: '/reviews/[reviewId]',
                params: { reviewId: item.id },
              })
            }
            review={item}
          />
        )}
        showsVerticalScrollIndicator={false}
      />
      <SortReviewsModal
        onClose={() => setSortModalVisible(false)}
        onSelect={(sort) => {
          setSelectedSort(sort);
          setSortModalVisible(false);
        }}
        selectedSort={selectedSort}
        visible={sortModalVisible}
      />
    </>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#858B96',
    marginTop: 12,
  },
  headerButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerButtonPressed: {
    backgroundColor: colors.reviewAccentSoft,
  },
  listContent: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 36,
  },
  list: {
    backgroundColor: '#F7F7F8',
  },
  emptyListContent: {
    flexGrow: 1,
  },
  writeButton: {
    width: '100%',
    minHeight: 58,
    borderRadius: 11,
    backgroundColor: colors.reviewAccentSoft,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  writeButtonPressed: {
    backgroundColor: colors.reviewAccentSoftPressed,
    transform: [{ scale: 0.99 }],
  },
  writeButtonText: {
    color: colors.reviewAccentText,
    fontSize: 16,
    fontWeight: '700',
  },
  connectionNotice: {
    borderRadius: 10,
    backgroundColor: '#FFF4D6',
    marginTop: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  connectionNoticeText: {
    color: '#6B4F00',
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  pendingNotice: {
    borderRadius: 10,
    backgroundColor: colors.reviewAccentSoft,
    marginTop: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  pendingNoticeText: {
    color: colors.reviewAccentText,
    flex: 1,
    fontSize: 13,
  },
  retryButton: {
    borderWidth: 1,
    borderColor: colors.reviewAccent,
    borderRadius: 7,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  retryButtonPressed: {
    backgroundColor: colors.reviewAccentSoftPressed,
  },
  retryButtonText: {
    color: colors.reviewAccentText,
    fontWeight: '600',
  },
  listSpacing: {
    marginTop: 28,
  },
  reviewRow: {
    minHeight: 166,
    borderWidth: 1,
    borderColor: '#E7E4E6',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    padding: 14,
    flexDirection: 'row',
    gap: 15,
    shadowColor: '#201A1C',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 9,
    elevation: 2,
  },
  reviewRowPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.99 }],
  },
  poster: {
    width: 88,
    height: 132,
    borderRadius: 9,
    backgroundColor: colors.reviewAccentSoft,
    borderWidth: 1,
    borderColor: '#F1CAD5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewContent: {
    flex: 1,
    paddingVertical: 2,
  },
  reviewTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  reviewTitle: {
    color: '#17171C',
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
  },
  syncStatus: {
    color: '#8A6500',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 3,
  },
  failedSyncStatus: {
    color: '#B42318',
  },
  listStars: {
    marginTop: 10,
  },
  reviewPreview: {
    color: '#353941',
    fontSize: 15,
    lineHeight: 20,
    marginTop: 10,
  },
  reviewDate: {
    color: '#858B96',
    fontSize: 13,
    marginTop: 9,
  },
  chevron: {
    alignSelf: 'center',
    marginLeft: -8,
  },
  separator: {
    height: 13,
  },
  emptyState: {
    flex: 1,
    minHeight: 300,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
    paddingBottom: 50,
  },
  emptyTitle: {
    color: '#3E4148',
    fontSize: 17,
    fontWeight: '600',
    marginTop: 14,
    textAlign: 'center',
  },
  emptyText: {
    color: '#858B96',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
    textAlign: 'center',
  },
  emptyRetryButton: {
    borderWidth: 1,
    borderColor: colors.reviewAccent,
    borderRadius: 8,
    marginTop: 18,
    paddingHorizontal: 18,
    paddingVertical: 9,
  },
  emptyRetryButtonText: {
    color: colors.reviewAccentText,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
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
});
