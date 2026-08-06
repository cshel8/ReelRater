import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ReviewPoster } from '@/components/reviews/ReviewPoster';
import { ReviewStars } from '@/components/reviews/ReviewStars';
import { colors } from '@/constants/colors';
import {
  followService,
  publicProfileReviewService,
  userDirectoryService,
} from '@/services';
import { userStore } from '@/store/userStore';
import type {
  FollowStatus,
  PublicUserProfile,
  SharedReview,
} from '@/types/domain';
import { formatReviewDate } from '@/utils/reviewFormatting';
import {
  getDisplayReviewMovieMetadata,
  getDisplayReviewMovieTitle,
} from '@/utils/reviewMovie';

const PROFILE_REVIEW_PAGE_SIZE = 10;

function ProfileReviewCard({
  onPress,
  review,
}: {
  onPress: () => void;
  review: SharedReview;
}) {
  const title = getDisplayReviewMovieTitle(review);
  const metadata = getDisplayReviewMovieMetadata(review);
  const date = formatReviewDate(review.createdAt);

  return (
    <Pressable
      accessibilityHint="Opens the complete read-only review"
      accessibilityLabel={`Read review of ${title}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.reviewCard,
        pressed && styles.reviewCardPressed,
      ]}
    >
      <ReviewPoster movie={review.movie} style={styles.poster} title={title} />
      <View style={styles.reviewContent}>
        <Text numberOfLines={2} style={styles.reviewTitle}>
          {title}
        </Text>
        {metadata ? (
          <Text numberOfLines={1} style={styles.movieMetadata}>
            {metadata}
          </Text>
        ) : null}
        <View style={styles.reviewStars}>
          <ReviewStars rating={review.rating} />
        </View>
        <Text numberOfLines={3} style={styles.reviewText}>
          {review.reviewText}
        </Text>
        {date ? <Text style={styles.reviewDate}>{date}</Text> : null}
      </View>
    </Pressable>
  );
}

export default function PublicProfileScreen({
  routeBase = 'profile',
}: {
  routeBase?: 'community' | 'profile';
}) {
  const currentUserId = userStore((state) => state.userId);
  const { userId: userIdParameter } = useLocalSearchParams<{
    userId: string | string[];
  }>();
  const userId = Array.isArray(userIdParameter)
    ? userIdParameter[0]
    : userIdParameter;
  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [followStatus, setFollowStatus] = useState<FollowStatus | null>(null);
  const [isChangingFollow, setIsChangingFollow] = useState(false);
  const [reviews, setReviews] = useState<SharedReview[]>([]);
  const [canSeeFollowersOnly, setCanSeeFollowersOnly] = useState(false);
  const [isLoadingReviews, setIsLoadingReviews] = useState(true);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [nextReviewCursor, setNextReviewCursor] = useState<string | null>(null);
  const [isLoadingMoreReviews, setIsLoadingMoreReviews] = useState(false);
  const [reviewRetryCount, setReviewRetryCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let active = true;

    const loadProfile = async () => {
      if (!userId) {
        setError('This profile could not be found.');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);
      try {
        const [result, relationshipStatus] = await Promise.all([
          userDirectoryService.getById(userId),
          currentUserId && currentUserId !== userId
            ? followService.getStatus(currentUserId, userId)
            : Promise.resolve(null),
        ]);
        if (active) {
          setProfile(result);
          setFollowStatus(relationshipStatus);
          if (!result) {
            setError('This profile could not be found.');
          }
        }
      } catch (profileError) {
        if (active) {
          setProfile(null);
          setError(
            profileError instanceof Error
              ? profileError.message
              : 'This profile could not be loaded.'
          );
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void loadProfile();
    return () => {
      active = false;
    };
  }, [currentUserId, retryCount, userId]);

  useEffect(() => {
    let active = true;

    const loadReviews = async () => {
      if (!currentUserId || !userId) {
        setReviews([]);
        setIsLoadingReviews(false);
        return;
      }

      setIsLoadingReviews(true);
      setReviewError(null);
      try {
        const result = await publicProfileReviewService.listPage(
          currentUserId,
          userId,
          { maximumResults: PROFILE_REVIEW_PAGE_SIZE }
        );
        if (active) {
          setReviews(result.reviews);
          setCanSeeFollowersOnly(result.canSeeFollowersOnly);
          setNextReviewCursor(result.nextCursor);
        }
      } catch (reviewsError) {
        const details =
          reviewsError instanceof Error
            ? reviewsError.message
            : 'Reviews could not be loaded.';
        console.log('Unable to load profile reviews:', details);
        if (active) {
          setReviews([]);
          setNextReviewCursor(null);
          setReviewError(details);
        }
      } finally {
        if (active) {
          setIsLoadingReviews(false);
        }
      }
    };

    void loadReviews();
    return () => {
      active = false;
    };
  }, [currentUserId, reviewRetryCount, userId]);

  const loadMoreReviews = async () => {
    if (
      !currentUserId ||
      !userId ||
      !nextReviewCursor ||
      isLoadingMoreReviews
    ) {
      return;
    }

    setIsLoadingMoreReviews(true);
    try {
      const result = await publicProfileReviewService.listPage(
        currentUserId,
        userId,
        {
          cursor: nextReviewCursor,
          maximumResults: PROFILE_REVIEW_PAGE_SIZE,
        }
      );
      setReviews((currentReviews) => {
        const existingIds = new Set(currentReviews.map((review) => review.id));
        return [
          ...currentReviews,
          ...result.reviews.filter((review) => !existingIds.has(review.id)),
        ];
      });
      setCanSeeFollowersOnly(result.canSeeFollowersOnly);
      setNextReviewCursor(result.nextCursor);
    } catch (loadMoreError) {
      Alert.alert(
        'Could not load more reviews',
        loadMoreError instanceof Error
          ? loadMoreError.message
          : 'Please try again.'
      );
    } finally {
      setIsLoadingMoreReviews(false);
    }
  };

  const follow = async () => {
    if (!currentUserId || !userId || isChangingFollow) {
      return;
    }

    setIsChangingFollow(true);
    try {
      await followService.follow(currentUserId, userId);
      setFollowStatus(
        (await followService.getStatus(currentUserId, userId)) ?? 'active'
      );
      setReviewRetryCount((count) => count + 1);
    } catch (followError) {
      Alert.alert(
        'Could not follow this person',
        followError instanceof Error
          ? followError.message
          : 'Please try again.'
      );
    } finally {
      setIsChangingFollow(false);
    }
  };

  const unfollow = async () => {
    if (!currentUserId || !userId || isChangingFollow) {
      return;
    }

    setIsChangingFollow(true);
    try {
      await followService.unfollow(currentUserId, userId);
      setFollowStatus(null);
      setReviewRetryCount((count) => count + 1);
    } catch (unfollowError) {
      Alert.alert(
        'Could not unfollow this person',
        unfollowError instanceof Error
          ? unfollowError.message
          : 'Please try again.'
      );
    } finally {
      setIsChangingFollow(false);
    }
  };

  const confirmRemoveRelationship = () => {
    const pending = followStatus === 'pending';
    Alert.alert(
      pending
        ? `Cancel request to @${profile?.handle ?? ''}?`
        : `Unfollow @${profile?.handle ?? ''}?`,
      pending
        ? 'They will no longer see this follow request.'
        : 'Their reviews will no longer appear in your community feed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: pending ? 'Cancel Request' : 'Unfollow',
          style: 'destructive',
          onPress: () => void unfollow(),
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.reviewAccent} size="large" />
        <Text style={styles.loadingText}>Loading profile…</Text>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.centered}>
        <Ionicons color="#C4C7CE" name="person-outline" size={48} />
        <Text style={styles.errorTitle}>Profile unavailable</Text>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => setRetryCount((count) => count + 1)}
          style={({ pressed }) => [
            styles.retryButton,
            pressed && styles.buttonPressed,
          ]}
        >
          <Text style={styles.retryButtonText}>Try Again</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      {profile.profileImage ? (
        <Image source={{ uri: profile.profileImage }} style={styles.avatar} />
      ) : (
        <View style={styles.avatarPlaceholder}>
          <Text style={styles.avatarText}>
            {profile.displayName.trim().charAt(0).toUpperCase() || '?'}
          </Text>
        </View>
      )}

      <Text style={styles.displayName}>{profile.displayName}</Text>
      <Text style={styles.handle}>@{profile.handle}</Text>
      {profile.accountPrivacy === 'private' ? (
        <View style={styles.privateBadge}>
          <Ionicons color="#737A86" name="lock-closed" size={12} />
          <Text style={styles.privateBadgeText}>Private account</Text>
        </View>
      ) : null}

      {currentUserId && currentUserId !== profile.id ? (
        <Pressable
          accessibilityRole="button"
          disabled={isChangingFollow}
          onPress={
            followStatus ? confirmRemoveRelationship : () => void follow()
          }
          style={({ pressed }) => [
            styles.followButton,
            followStatus && styles.followingButton,
            (pressed || isChangingFollow) && styles.buttonPressed,
          ]}
        >
          {isChangingFollow ? (
            <ActivityIndicator
              color={followStatus ? colors.reviewAccentText : '#FFFFFF'}
              size="small"
            />
          ) : (
            <>
              <Ionicons
                color={followStatus ? colors.reviewAccentText : '#FFFFFF'}
                name={
                  followStatus === 'active'
                    ? 'checkmark'
                    : followStatus === 'pending'
                      ? 'time-outline'
                      : 'person-add-outline'
                }
                size={18}
              />
              <Text
                style={[
                  styles.followButtonText,
                  followStatus && styles.followingButtonText,
                ]}
              >
                {followStatus === 'active'
                  ? 'Following'
                  : followStatus === 'pending'
                    ? 'Requested'
                    : 'Follow'}
              </Text>
            </>
          )}
        </Pressable>
      ) : null}

      <View style={styles.reviewsSection}>
        <Text style={styles.reviewsHeading}>Reviews</Text>

        {isLoadingReviews ? (
          <View style={styles.reviewsMessage}>
            <ActivityIndicator color={colors.reviewAccent} size="small" />
            <Text style={styles.reviewsMessageText}>Loading reviews…</Text>
          </View>
        ) : reviewError ? (
          <View style={styles.reviewsMessage}>
            <Ionicons color="#C4C7CE" name="cloud-offline-outline" size={32} />
            <Text style={styles.reviewsMessageTitle}>Reviews unavailable</Text>
            <Text style={styles.reviewsMessageText}>
              {reviewError.includes('failed-precondition') ||
              reviewError.toLowerCase().includes('requires an index')
                ? 'Firestore needs an index for paginated reviews. Check the development console for its creation link.'
                : reviewError.includes('permission-denied')
                  ? 'Firestore denied this review query. Check the published review rules.'
                  : 'Check your connection and try again.'}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setReviewRetryCount((count) => count + 1)}
              style={({ pressed }) => [
                styles.reviewRetryButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={styles.reviewRetryButtonText}>Try Again</Text>
            </Pressable>
          </View>
        ) : reviews.length === 0 ? (
          <View style={styles.reviewsMessage}>
            <Ionicons color="#C4C7CE" name="chatbox-outline" size={34} />
            <Text style={styles.reviewsMessageTitle}>
              {canSeeFollowersOnly
                ? 'No reviews yet'
                : 'No public reviews yet'}
            </Text>
            <Text style={styles.reviewsMessageText}>
              {canSeeFollowersOnly
                ? `${profile.displayName} hasn't shared any reviews yet.`
                : followStatus === 'pending'
                  ? `Your request to follow @${profile.handle} is still pending.`
                  : `Follow @${profile.handle} to see reviews they share with followers.`}
            </Text>
          </View>
        ) : (
          <View style={styles.reviewList}>
            {reviews.map((review) => (
              <ProfileReviewCard
                key={review.id}
                onPress={() => {
                  const params = {
                    authorId: review.authorId,
                    reviewId: review.id,
                  };
                  if (routeBase === 'community') {
                    router.push({
                      pathname: '/community/review/[reviewId]',
                      params,
                    });
                  } else {
                    router.push({
                      pathname: '/profile/review/[reviewId]',
                      params,
                    });
                  }
                }}
                review={review}
              />
            ))}
            {nextReviewCursor ? (
              <Pressable
                accessibilityRole="button"
                disabled={isLoadingMoreReviews}
                onPress={() => void loadMoreReviews()}
                style={({ pressed }) => [
                  styles.loadMoreButton,
                  (pressed || isLoadingMoreReviews) && styles.buttonPressed,
                ]}
              >
                {isLoadingMoreReviews ? (
                  <ActivityIndicator color={colors.reviewAccent} size="small" />
                ) : null}
                <Text style={styles.loadMoreButtonText}>
                  {isLoadingMoreReviews ? 'Loading…' : 'Load More'}
                </Text>
              </Pressable>
            ) : null}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  loadingText: {
    color: '#858B96',
    marginTop: 12,
  },
  errorTitle: {
    color: '#3E4148',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 14,
  },
  errorText: {
    color: '#858B96',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 7,
    textAlign: 'center',
  },
  retryButton: {
    borderWidth: 1,
    borderColor: colors.reviewAccent,
    borderRadius: 8,
    marginTop: 20,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  retryButtonText: {
    color: colors.reviewAccentText,
    fontWeight: '600',
  },
  buttonPressed: {
    opacity: 0.55,
  },
  container: {
    flexGrow: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 36,
  },
  avatar: {
    width: 112,
    height: 112,
    borderRadius: 56,
  },
  avatarPlaceholder: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: colors.reviewAccentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.reviewAccentText,
    fontSize: 42,
    fontWeight: '700',
  },
  displayName: {
    color: '#1F2937',
    fontSize: 25,
    fontWeight: '700',
    marginTop: 20,
  },
  handle: {
    color: '#7B8190',
    fontSize: 16,
    marginTop: 5,
  },
  privateBadge: {
    borderRadius: 12,
    backgroundColor: '#F0F1F3',
    marginTop: 9,
    paddingHorizontal: 9,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  privateBadgeText: {
    color: '#737A86',
    fontSize: 12,
    fontWeight: '600',
  },
  followButton: {
    minWidth: 150,
    minHeight: 46,
    borderRadius: 9,
    backgroundColor: colors.reviewAccent,
    marginTop: 24,
    paddingHorizontal: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  followingButton: {
    backgroundColor: colors.reviewAccentSoft,
    borderWidth: 1,
    borderColor: colors.reviewAccent,
  },
  followButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  followingButtonText: {
    color: colors.reviewAccentText,
  },
  reviewsSection: {
    width: '100%',
    maxWidth: 620,
    marginTop: 42,
  },
  reviewsHeading: {
    color: '#1F2937',
    fontSize: 21,
    fontWeight: '700',
  },
  reviewList: {
    marginTop: 15,
    gap: 13,
  },
  reviewCard: {
    width: '100%',
    minHeight: 144,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    padding: 12,
    flexDirection: 'row',
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 7,
    elevation: 1,
  },
  reviewCardPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.99 }],
  },
  poster: {
    width: 82,
    height: 120,
    borderRadius: 8,
  },
  reviewContent: {
    flex: 1,
    minWidth: 0,
    marginLeft: 14,
  },
  reviewTitle: {
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
  reviewStars: {
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
  reviewsMessage: {
    minHeight: 170,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  reviewsMessageTitle: {
    color: '#3E4148',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 10,
  },
  reviewsMessageText: {
    color: '#858B96',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 7,
    textAlign: 'center',
  },
  reviewRetryButton: {
    borderWidth: 1,
    borderColor: colors.reviewAccent,
    borderRadius: 8,
    marginTop: 14,
    paddingHorizontal: 15,
    paddingVertical: 8,
  },
  reviewRetryButtonText: {
    color: colors.reviewAccentText,
    fontWeight: '600',
  },
  loadMoreButton: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: colors.reviewAccent,
    borderRadius: 10,
    marginTop: 3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadMoreButtonText: {
    color: colors.reviewAccentText,
    fontSize: 14,
    fontWeight: '700',
  },
});
