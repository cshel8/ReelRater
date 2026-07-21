import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ReviewPoster } from '@/components/reviews/ReviewPoster';
import { ReviewStars } from '@/components/reviews/ReviewStars';
import { colors } from '@/constants/colors';
import { communityFeedService } from '@/services';
import { userStore } from '@/store/userStore';
import type { CommunityReview, PublicUserProfile } from '@/types/domain';
import { formatReviewDate } from '@/utils/reviewFormatting';
import { getDisplayReviewMovieTitle } from '@/utils/reviewMovie';

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

  return (
    <View style={styles.reviewCard}>
      <Pressable
        accessibilityHint="Opens this person's public profile"
        accessibilityRole="button"
        onPress={() =>
          router.push({
            pathname: '/profile/[userId]',
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

      <View style={styles.reviewRow}>
        <ReviewPoster
          movie={review.movie}
          style={styles.poster}
          title={displayMovieTitle}
        />
        <View style={styles.reviewContent}>
          <Text numberOfLines={2} style={styles.movieTitle}>
            {displayMovieTitle}
          </Text>
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
      </View>
    </View>
  );
}

export default function CommunityScreen() {
  const userId = userStore((state) => state.userId);
  const [reviews, setReviews] = useState<CommunityReview[]>([]);
  const [followsAnyone, setFollowsAnyone] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFeed = useCallback(
    async (refreshing = false) => {
      if (!userId) {
        setIsLoading(false);
        return;
      }

      if (refreshing) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      try {
        const result = await communityFeedService.list(userId);
        setReviews(result.reviews);
        setFollowsAnyone(result.followsAnyone);
      } catch (loadError) {
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
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [userId]
  );

  useFocusEffect(
    useCallback(() => {
      void loadFeed();
    }, [loadFeed])
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={colors.reviewAccent} size="large" />
        <Text style={styles.loadingText}>Loading your community…</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={[
        styles.listContent,
        reviews.length === 0 && styles.emptyListContent,
      ]}
      data={reviews}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      keyExtractor={(review) => review.id}
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
});
