import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  reviewVisibilityLabel,
} from '@/components/reviews/ReviewVisibilitySelector';
import { colors } from '@/constants/colors';
import { publicProfileReviewService } from '@/services';
import { userStore } from '@/store/userStore';
import type { SharedReview } from '@/types/domain';
import { formatReviewDate } from '@/utils/reviewFormatting';
import {
  getDisplayReviewMovieMetadata,
  getDisplayReviewMovieTitle,
} from '@/utils/reviewMovie';
import { ReviewPoster } from './ReviewPoster';
import { ReviewStars } from './ReviewStars';

export default function PublicReviewDetailsScreen() {
  const viewerId = userStore((state) => state.userId);
  const parameters = useLocalSearchParams<{
    authorId: string | string[];
    reviewId: string | string[];
  }>();
  const authorId = Array.isArray(parameters.authorId)
    ? parameters.authorId[0]
    : parameters.authorId;
  const reviewId = Array.isArray(parameters.reviewId)
    ? parameters.reviewId[0]
    : parameters.reviewId;
  const [review, setReview] = useState<SharedReview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let active = true;

    const loadReview = async () => {
      if (!viewerId || !authorId || !reviewId) {
        setError('This review could not be found.');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);
      try {
        const result = await publicProfileReviewService.getById(
          viewerId,
          authorId,
          reviewId
        );
        if (active) {
          setReview(result);
          if (!result) {
            setError('This review is unavailable or is no longer shared with you.');
          }
        }
      } catch (loadError) {
        if (active) {
          setReview(null);
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'This review could not be loaded.'
          );
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void loadReview();
    return () => {
      active = false;
    };
  }, [authorId, retryCount, reviewId, viewerId]);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.reviewAccent} size="large" />
        <Text style={styles.loadingText}>Loading review…</Text>
      </View>
    );
  }

  if (!review) {
    return (
      <View style={styles.centered}>
        <Ionicons color="#C4C7CE" name="document-text-outline" size={46} />
        <Text style={styles.errorTitle}>Review unavailable</Text>
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

  const title = getDisplayReviewMovieTitle(review);
  const metadata = getDisplayReviewMovieMetadata(review);
  const date = formatReviewDate(review.createdAt);

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <ReviewPoster
        iconSize={48}
        movie={review.movie}
        style={styles.poster}
        title={title}
      />
      <Text style={styles.movieTitle}>{title}</Text>
      {metadata ? <Text style={styles.movieMetadata}>{metadata}</Text> : null}

      <View style={styles.stars}>
        <ReviewStars rating={review.rating} size={25} />
      </View>
      {date ? <Text style={styles.reviewDate}>Reviewed {date}</Text> : null}

      <View style={styles.visibilityBadge}>
        <Ionicons
          color={colors.reviewAccentText}
          name={
            review.visibility === 'followers'
              ? 'people-outline'
              : 'earth-outline'
          }
          size={15}
        />
        <Text style={styles.visibilityBadgeText}>
          {reviewVisibilityLabel(review.visibility)}
        </Text>
      </View>

      <View style={styles.reviewSection}>
        <Text style={styles.sectionTitle}>Review</Text>
        <View style={styles.reviewBodyCard}>
          <Text style={styles.reviewText}>{review.reviewText}</Text>
        </View>
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
    paddingTop: 30,
    paddingBottom: 44,
  },
  poster: {
    width: 142,
    height: 213,
    borderRadius: 10,
  },
  movieTitle: {
    color: '#17171C',
    fontSize: 25,
    fontWeight: '700',
    marginTop: 23,
    textAlign: 'center',
  },
  movieMetadata: {
    color: '#858B96',
    fontSize: 14,
    marginTop: 7,
    textAlign: 'center',
  },
  stars: {
    marginTop: 13,
  },
  reviewDate: {
    color: '#858B96',
    fontSize: 14,
    marginTop: 10,
  },
  visibilityBadge: {
    borderRadius: 14,
    backgroundColor: colors.reviewAccentSoft,
    marginTop: 11,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  visibilityBadgeText: {
    color: colors.reviewAccentText,
    fontSize: 12,
    fontWeight: '600',
  },
  reviewSection: {
    width: '100%',
    maxWidth: 620,
    marginTop: 30,
  },
  sectionTitle: {
    width: '100%',
    color: '#17171C',
    fontSize: 18,
    fontWeight: '700',
  },
  reviewBodyCard: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#E3DDE0',
    borderRadius: 12,
    backgroundColor: '#FFFAFC',
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  reviewText: {
    width: '100%',
    color: '#353941',
    fontSize: 16,
    lineHeight: 25,
  },
});
