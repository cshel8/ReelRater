import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ReviewPoster } from '@/components/reviews/ReviewPoster';
import { ReviewStars } from '@/components/reviews/ReviewStars';
import {
  ReviewVisibilitySelector,
  reviewVisibilityLabel,
} from '@/components/reviews/ReviewVisibilitySelector';
import { colors } from '@/constants/colors';
import { reviewService } from '@/services';
import { userStore } from '@/store/userStore';
import type { Review, ReviewVisibility } from '@/types/domain';
import { formatReviewDate } from '@/utils/reviewFormatting';
import {
  createManualMovieSnapshot,
  getDisplayReviewMovieTitle,
  readReviewMovieSnapshot,
} from '@/utils/reviewMovie';

const STAR_VALUES = [1, 2, 3, 4, 5] as const;

export default function ReviewDetailsScreen() {
  const { reviewId: reviewIdParameter } = useLocalSearchParams<{
    reviewId: string | string[];
  }>();
  const reviewId = Array.isArray(reviewIdParameter)
    ? reviewIdParameter[0]
    : reviewIdParameter;
  const userId = userStore((state) => state.userId);
  const [review, setReview] = useState<Review | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedMovieTitle, setEditedMovieTitle] = useState('');
  const [editedReviewText, setEditedReviewText] = useState('');
  const [editedRating, setEditedRating] = useState(0);
  const [editedVisibility, setEditedVisibility] =
    useState<ReviewVisibility>('private');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadReview = useCallback(async () => {
    if (!userId || !reviewId) {
      setMessage('This review could not be found.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      const result = await reviewService.listForUser(userId);
      const matchingReview =
        result.reviews.find((candidate) => candidate.id === reviewId) ?? null;

      setReview(matchingReview);
      if (!matchingReview) {
        setMessage(
          result.remoteAvailable
            ? 'This review could not be found.'
            : 'This synchronized review is unavailable without a connection.'
        );
      }
    } catch (loadError) {
      setMessage(
        loadError instanceof Error
          ? loadError.message
          : 'This review could not be loaded.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [reviewId, userId]);

  useFocusEffect(
    useCallback(() => {
      void loadReview();
    }, [loadReview])
  );

  const beginEditing = () => {
    if (!review) {
      return;
    }

    setEditedMovieTitle(review.movieTitle);
    setEditedReviewText(review.reviewText);
    setEditedRating(Number(review.rating) || 0);
    setEditedVisibility(review.visibility);
    setIsEditing(true);
  };

  const saveChanges = async () => {
    if (
      !userId ||
      !review ||
      !editedMovieTitle.trim() ||
      !editedReviewText.trim() ||
      editedRating === 0
    ) {
      Alert.alert('Please complete every field and choose a rating');
      return;
    }

    setIsSaving(true);
    try {
      const updatedReview = await reviewService.update(userId, {
        ...review,
        movieTitle: editedMovieTitle.trim(),
        movie:
          editedMovieTitle.trim() === review.movieTitle
            ? readReviewMovieSnapshot(review.movie, review.movieTitle)
            : createManualMovieSnapshot(editedMovieTitle),
        reviewText: editedReviewText.trim(),
        rating: String(editedRating),
        visibility: editedVisibility,
      });
      setReview(updatedReview);
      setIsEditing(false);

      if (updatedReview.syncStatus === 'synced') {
        Alert.alert('Review updated');
      } else {
        Alert.alert(
          'Changes saved on this device',
          'They will synchronize automatically when a connection is available.'
        );
      }
    } catch (updateError) {
      Alert.alert(
        'Unable to update review',
        updateError instanceof Error
          ? updateError.message
          : 'Unknown database error'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const deleteReview = async () => {
    if (!userId || !review) {
      return;
    }

    setIsDeleting(true);
    try {
      await reviewService.remove(userId, review.id);
      router.replace('/reviews');
    } catch (deleteError) {
      Alert.alert(
        'Unable to delete review',
        deleteError instanceof Error
          ? deleteError.message
          : 'Unknown database error'
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const confirmDelete = () => {
    Alert.alert(
      'Delete this review?',
      'This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => void deleteReview(),
        },
      ]
    );
  };

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
        <Ionicons
          color="#C4C7CE"
          name="document-text-outline"
          size={46}
        />
        <Text style={styles.unavailableTitle}>Review unavailable</Text>
        <Text style={styles.unavailableText}>{message}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => void loadReview()}
          style={({ pressed }) => [
            styles.retryButton,
            pressed && styles.retryButtonPressed,
          ]}
        >
          <Text style={styles.retryButtonText}>Try Again</Text>
        </Pressable>
      </View>
    );
  }

  const formattedDate = formatReviewDate(review.createdAt);
  const displayMovieTitle = getDisplayReviewMovieTitle(review);

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <ReviewPoster
        iconSize={48}
        movie={review.movie}
        style={styles.poster}
        title={displayMovieTitle}
      />

      <Text style={styles.movieTitle}>{displayMovieTitle}</Text>

      <View style={styles.stars}>
        <ReviewStars rating={review.rating} size={25} />
      </View>

      {formattedDate && (
        <Text style={styles.reviewDate}>Reviewed {formattedDate}</Text>
      )}

      <View style={styles.visibilityBadge}>
        <Ionicons
          color={colors.reviewAccentText}
          name={
            review.visibility === 'public'
              ? 'earth-outline'
              : review.visibility === 'followers'
                ? 'people-outline'
                : 'lock-closed-outline'
          }
          size={15}
        />
        <Text style={styles.visibilityBadgeText}>
          {reviewVisibilityLabel(review.visibility)}
        </Text>
      </View>

      {review.syncStatus !== 'synced' && (
        <View
          style={[
            styles.syncBadge,
            review.syncStatus === 'failed' && styles.failedSyncBadge,
          ]}
        >
          <Ionicons
            color={
              review.syncStatus === 'failed'
                ? '#B42318'
                : colors.reviewAccentText
            }
            name={
              review.syncStatus === 'failed'
                ? 'alert-circle-outline'
                : 'cloud-upload-outline'
            }
            size={16}
          />
          <Text
            style={[
              styles.syncBadgeText,
              review.syncStatus === 'failed' && styles.failedSyncBadgeText,
            ]}
          >
            {review.syncStatus === 'failed'
              ? 'Waiting to retry synchronization'
              : 'Waiting to synchronize'}
          </Text>
        </View>
      )}

      <View style={styles.divider} />

      {isEditing ? (
        <View style={styles.editor}>
          <Text style={styles.sectionTitle}>Edit Review</Text>

          <Text style={styles.label}>Movie Title</Text>
          <TextInput
            accessibilityLabel="Edit movie title"
            onChangeText={setEditedMovieTitle}
            style={styles.input}
            value={editedMovieTitle}
          />

          <Text style={styles.label}>Your Rating</Text>
          <View style={styles.editStars}>
            {STAR_VALUES.map((value) => (
              <Pressable
                accessibilityLabel={`Edit rating to ${value} out of 5 stars`}
                accessibilityRole="button"
                accessibilityState={{ selected: editedRating === value }}
                hitSlop={7}
                key={value}
                onPress={() => setEditedRating(value)}
              >
                <Ionicons
                  color={colors.reviewAccent}
                  name={value <= editedRating ? 'star' : 'star-outline'}
                  size={35}
                />
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Your Review</Text>
          <TextInput
            accessibilityLabel="Edit review text"
            multiline
            onChangeText={setEditedReviewText}
            style={[styles.input, styles.reviewInput]}
            textAlignVertical="top"
            value={editedReviewText}
          />

          <Text style={styles.label}>Who can see this review?</Text>
          <ReviewVisibilitySelector
            disabled={isSaving}
            onChange={setEditedVisibility}
            value={editedVisibility}
          />
          <Text style={styles.visibilityHint}>
            Changing this review does not change your profile default.
          </Text>

          <View style={styles.editorActions}>
            <Pressable
              accessibilityRole="button"
              disabled={isSaving}
              onPress={() => setIsEditing(false)}
              style={({ pressed }) => [
                styles.cancelButton,
                pressed && styles.actionButtonPressed,
              ]}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={isSaving}
              onPress={() => void saveChanges()}
              style={({ pressed }) => [
                styles.saveButton,
                pressed && styles.actionButtonPressed,
                isSaving && styles.disabled,
              ]}
            >
              <Text style={styles.saveButtonText}>
                {isSaving ? 'Saving…' : 'Save Changes'}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <>
          <Text style={styles.sectionTitle}>Your Review</Text>
          <Text style={styles.reviewText}>{review.reviewText}</Text>

          <View style={styles.detailActions}>
            <Pressable
              accessibilityRole="button"
              disabled={isDeleting}
              onPress={beginEditing}
              style={({ pressed }) => [
                styles.editButton,
                pressed && styles.actionButtonPressed,
              ]}
            >
              <Ionicons
                color={colors.reviewAccentText}
                name="create-outline"
                size={19}
              />
              <Text style={styles.editButtonText}>Edit Review</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={isDeleting}
              onPress={confirmDelete}
              style={({ pressed }) => [
                styles.deleteButton,
                pressed && styles.deleteButtonPressed,
                isDeleting && styles.disabled,
              ]}
            >
              <Ionicons color="#B42318" name="trash-outline" size={19} />
              <Text style={styles.deleteButtonText}>
                {isDeleting ? 'Deleting…' : 'Delete Review'}
              </Text>
            </Pressable>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  loadingText: {
    color: '#858B96',
    marginTop: 12,
  },
  unavailableTitle: {
    color: '#3E4148',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 15,
  },
  unavailableText: {
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
  retryButtonPressed: {
    backgroundColor: colors.reviewAccentSoft,
  },
  retryButtonText: {
    color: colors.reviewAccentText,
    fontWeight: '600',
  },
  container: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 620,
    alignSelf: 'center',
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
  visibilityHint: {
    color: '#7B8190',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 8,
  },
  syncBadge: {
    borderRadius: 14,
    backgroundColor: colors.reviewAccentSoft,
    marginTop: 14,
    paddingHorizontal: 11,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  failedSyncBadge: {
    backgroundColor: '#FEECEB',
  },
  syncBadgeText: {
    color: colors.reviewAccentText,
    fontSize: 12,
    fontWeight: '600',
  },
  failedSyncBadgeText: {
    color: '#B42318',
  },
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: '#ECEDEF',
    marginTop: 31,
  },
  sectionTitle: {
    width: '100%',
    color: '#17171C',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 25,
  },
  reviewText: {
    width: '100%',
    color: '#353941',
    fontSize: 16,
    lineHeight: 25,
    marginTop: 12,
  },
  detailActions: {
    width: '100%',
    marginTop: 34,
    gap: 12,
  },
  editButton: {
    minHeight: 52,
    borderRadius: 10,
    backgroundColor: colors.reviewAccentSoft,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  editButtonText: {
    color: colors.reviewAccentText,
    fontSize: 16,
    fontWeight: '700',
  },
  deleteButton: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: '#E8A7A2',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  deleteButtonPressed: {
    backgroundColor: '#FEECEB',
  },
  deleteButtonText: {
    color: '#B42318',
    fontSize: 16,
    fontWeight: '700',
  },
  editor: {
    width: '100%',
  },
  label: {
    color: '#19191F',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 22,
    marginBottom: 8,
  },
  input: {
    width: '100%',
    minHeight: 50,
    borderWidth: 1,
    borderColor: '#D9DCE3',
    borderRadius: 10,
    color: '#1D1D23',
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  reviewInput: {
    minHeight: 170,
    lineHeight: 23,
  },
  editStars: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 300,
  },
  editorActions: {
    width: '100%',
    marginTop: 28,
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: '#D9DCE3',
    borderRadius: 10,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    color: '#525761',
    fontWeight: '700',
  },
  saveButton: {
    minHeight: 50,
    borderRadius: 10,
    backgroundColor: colors.reviewAccent,
    flex: 1.4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  actionButtonPressed: {
    opacity: 0.65,
  },
  disabled: {
    opacity: 0.5,
  },
});
