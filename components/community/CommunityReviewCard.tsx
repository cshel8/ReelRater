import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { ReviewPoster } from '@/components/reviews/ReviewPoster';
import { ReviewStars } from '@/components/reviews/ReviewStars';
import { SpoilerReviewText } from '@/components/reviews/SpoilerReviewText';
import { colors } from '@/constants/colors';
import type { CommunityReview, PublicUserProfile } from '@/types/domain';
import { formatReviewDate } from '@/utils/reviewFormatting';
import { getDisplayReviewMovieMetadata, getDisplayReviewMovieTitle } from '@/utils/reviewMovie';

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

function formatRelativeTime(value: string): string | null {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) {
    return null;
  }
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days < 7 ? `${days}d ago` : null;
}

export function CommunityReviewCard({ review, onFollow }: { review: CommunityReview; onFollow?: (review: CommunityReview) => void }) {
  const [isSpoilerRevealed, setIsSpoilerRevealed] = useState(false);
  const displayMovieTitle = getDisplayReviewMovieTitle(review);
  const movieMetadata = getDisplayReviewMovieMetadata(review);
  const relativeTime = formatRelativeTime(review.createdAt);
  const formattedDate = formatReviewDate(review.createdAt);

  return (
    <View style={styles.card}>
      <Pressable
        accessibilityHint="Opens this person's public profile"
        accessibilityLabel={`View ${review.author.displayName}'s profile`}
        accessibilityRole="button"
        onPress={() => router.push({ pathname: '/community/[userId]', params: { userId: review.author.id } })}
        style={({ pressed }) => [styles.authorRow, pressed && styles.pressed]}
      >
        <AuthorAvatar author={review.author} />
        <View style={styles.authorIdentity}>
          <Text numberOfLines={1} style={styles.authorName}>{review.author.displayName}</Text>
          <Text numberOfLines={1} style={styles.authorMeta}>
            @{review.author.handle}{relativeTime ? ` · ${relativeTime}` : ''}
          </Text>
        </View>
        {onFollow && review.relationshipStatus !== undefined && review.relationshipStatus !== 'active' && review.relationshipStatus !== 'pending' ? (
          <Pressable accessibilityLabel={`Follow ${review.author.displayName}`} onPress={() => onFollow(review)} style={styles.followButton}><Text style={styles.followText}>Follow</Text></Pressable>
        ) : null}
        {onFollow && review.relationshipStatus === 'active' ? <Text style={styles.statusText}>Following</Text> : null}
        {onFollow && review.relationshipStatus === 'pending' ? <Text style={styles.statusText}>Requested</Text> : null}
      </Pressable>

      <Pressable
        accessibilityHint="Opens the complete read-only review"
        accessibilityLabel={`Read review of ${displayMovieTitle}`}
        accessibilityRole="button"
        onPress={() => router.push({ pathname: '/community/review/[reviewId]', params: { authorId: review.authorId, reviewId: review.id } })}
        style={({ pressed }) => [styles.reviewRow, pressed && styles.pressed]}
      >
        <ReviewPoster
          movie={review.movie}
          style={[
            styles.poster,
            review.spoilerWarning && !isSpoilerRevealed && styles.collapsedSpoilerPoster,
          ]}
          title={displayMovieTitle}
        />
        <View style={styles.reviewContent}>
          <Text numberOfLines={2} style={styles.movieTitle}>{displayMovieTitle}</Text>
          {movieMetadata ? <Text numberOfLines={2} style={styles.movieMetadata}>{movieMetadata}</Text> : null}
          <View style={styles.stars}><ReviewStars rating={review.rating} /></View>
          <SpoilerReviewText
            numberOfLines={4}
            onReveal={() => setIsSpoilerRevealed(true)}
            presentation="community"
            reviewText={review.reviewText}
            spoilerWarning={review.spoilerWarning}
            textStyle={styles.reviewText}
          />
          <View style={styles.footer}>
            {review.movie?.mediaType ? (
              <View style={styles.footerItem}>
                <Ionicons color="#7D8490" name="film-outline" size={14} />
                <Text style={styles.footerText}>{review.movie.mediaType === 'tv' ? 'TV Show' : 'Movie'}</Text>
              </View>
            ) : null}
            {formattedDate ? (
              <View style={styles.footerItem}>
                <Ionicons color="#7D8490" name="calendar-outline" size={14} />
                <Text style={styles.footerText}>{formattedDate}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { alignSelf: 'center', backgroundColor: '#FFFFFF', borderColor: '#E4E6EA', borderRadius: 17, borderWidth: 1, maxWidth: 620, padding: 12, shadowColor: '#20242B', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 5, width: '100%' },
  authorRow: { alignItems: 'center', flexDirection: 'row', minHeight: 42 },
  avatar: { borderRadius: 20, height: 40, width: 40 },
  avatarPlaceholder: { alignItems: 'center', backgroundColor: colors.reviewAccentSoft, borderRadius: 20, height: 40, justifyContent: 'center', width: 40 },
  avatarText: { color: colors.reviewAccentText, fontSize: 16, fontWeight: '700' },
  authorIdentity: { flex: 1, marginLeft: 10, minWidth: 0 },
  authorName: { color: '#22242A', fontSize: 14, fontWeight: '700' },
  authorMeta: { color: '#78808D', fontSize: 12, marginTop: 2 },
  followButton: { borderColor: colors.reviewAccent, borderRadius: 14, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5 },
  followText: { color: colors.reviewAccentText, fontSize: 12, fontWeight: '700' },
  statusText: { color: '#78808D', fontSize: 12, fontWeight: '700', paddingHorizontal: 4 },
  reviewRow: { flexDirection: 'row', marginTop: 11 },
  // A modest fixed 2:3 poster size keeps normal cards visually balanced
  // without allowing unusually long review text to create oversized artwork.
  poster: { borderRadius: 9, height: 166, width: 112 },
  // Collapsed spoilers intentionally use a taller 2:3 treatment to align
  // with the concealed-content panel. Revealed spoilers immediately return
  // to the normal approved poster treatment above.
  collapsedSpoilerPoster: { height: 190, width: 128 },
  reviewContent: { flex: 1, marginLeft: 12, minWidth: 0 },
  movieTitle: { color: '#202126', fontSize: 17, fontWeight: '700', lineHeight: 21 },
  movieMetadata: { color: '#737B87', fontSize: 13, lineHeight: 18, marginTop: 3 },
  stars: { marginTop: 6 },
  reviewText: { color: '#444A54', fontSize: 14, lineHeight: 20, marginTop: 8 },
  footer: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 9 },
  footerItem: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  footerText: { color: '#7D8490', fontSize: 11 },
  pressed: { opacity: 0.58 },
});
