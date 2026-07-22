import { Ionicons } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import { useNavigation } from 'expo-router';
import {
  usePreventRemove,
  type NavigationAction,
} from 'expo-router/react-navigation';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ReviewVisibilitySelector } from '@/components/reviews/ReviewVisibilitySelector';
import { colors } from '@/constants/colors';
import {
  movieCatalogService,
  reviewService,
  settingsService,
} from '@/services';
import { userStore } from '@/store/userStore';
import type { MovieSummary, ReviewVisibility } from '@/types/domain';
import {
  createManualMovieSnapshot,
  createMatchedMovieSnapshot,
} from '@/utils/reviewMovie';

const LARGE_QUEUE_WARNING_THRESHOLD = 25;
const STAR_VALUES = [1, 2, 3, 4, 5] as const;

export default function ReviewScreen() {
  const navigation = useNavigation();
  const { userId } = userStore();
  const [movieTitle, setMovieTitle] = useState('');
  const [selectedMovie, setSelectedMovie] = useState<MovieSummary | null>(null);
  const [movieResults, setMovieResults] = useState<MovieSummary[]>([]);
  const [isSearchingMovies, setIsSearchingMovies] = useState(false);
  const [reviewText, setReviewText] = useState('');
  const [rating, setRating] = useState(0);
  const [defaultVisibility, setDefaultVisibility] =
    useState<ReviewVisibility>('private');
  const [visibility, setVisibility] =
    useState<ReviewVisibility>('private');
  const [pendingCount, setPendingCount] = useState(0);
  const [isOffline, setIsOffline] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingNavigationAction, setPendingNavigationAction] =
    useState<NavigationAction | null>(null);

  const hasUnsavedChanges =
    movieTitle.trim().length > 0 ||
    selectedMovie !== null ||
    reviewText.trim().length > 0 ||
    rating !== 0 ||
    visibility !== defaultVisibility;

  const fetchReviewStatus = useCallback(async () => {
    if (!userId) {
      return;
    }

    try {
      const result = await reviewService.listForUser(userId);
      setPendingCount(result.pendingCount);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown database error';
      console.log('Error checking review synchronization:', message);
    }
  }, [userId]);

  const synchronize = useCallback(
    async (showResult = false) => {
      if (!userId) {
        return;
      }

      setIsSyncing(true);
      try {
        const result = await reviewService.syncPending(userId);
        await fetchReviewStatus();

        if (showResult) {
          if (result.failedCount > 0) {
            Alert.alert(
              'Some reviews are still waiting',
              'They remain safely stored on this device. The app will try again when a connection is available.'
            );
          } else {
            Alert.alert('Reviews synchronized');
          }
        }
      } finally {
        setIsSyncing(false);
      }
    },
    [fetchReviewStatus, userId]
  );

  useEffect(() => {
    if (!userId) {
      return;
    }

    void synchronize();

    const unsubscribe = NetInfo.addEventListener((state) => {
      const offline =
        state.isConnected === false || state.isInternetReachable === false;
      setIsOffline(offline);

      if (!offline) {
        void synchronize();
      }
    });

    return unsubscribe;
  }, [synchronize, userId]);

  useEffect(() => {
    if (!userId) {
      return;
    }

    let active = true;
    settingsService
      .get(userId)
      .then((settings) => {
        if (active && settings) {
          setDefaultVisibility(settings.defaultReviewVisibility);
          setVisibility(settings.defaultReviewVisibility);
        }
      })
      .catch((settingsError) => {
        const message =
          settingsError instanceof Error
            ? settingsError.message
            : 'Unknown settings error';
        console.log('Unable to load review visibility default:', message);
      });

    return () => {
      active = false;
    };
  }, [userId]);

  useEffect(() => {
    const query = movieTitle.trim();
    if (
      query.length < 2 ||
      (selectedMovie && query === selectedMovie.title)
    ) {
      if (movieResults.length > 0) {
        setMovieResults([]);
      }
      if (isSearchingMovies) {
        setIsSearchingMovies(false);
      }
      return;
    }

    let active = true;
    const timer = setTimeout(() => {
      setIsSearchingMovies(true);
      movieCatalogService
        .search(query, { maximumResults: 8 })
        .then((page) => {
          if (active) {
            setMovieResults(page.movies);
          }
        })
        .catch((searchError) => {
          if (active) {
            setMovieResults([]);
            console.log(
              'Unable to search movies:',
              searchError instanceof Error
                ? searchError.message
                : searchError
            );
          }
        })
        .finally(() => {
          if (active) {
            setIsSearchingMovies(false);
          }
        });
    }, 350);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [movieTitle, selectedMovie]);

  useEffect(() => {
    if (hasUnsavedChanges || !pendingNavigationAction) {
      return;
    }

    navigation.dispatch(pendingNavigationAction);
    setPendingNavigationAction(null);
  }, [hasUnsavedChanges, navigation, pendingNavigationAction]);

  const handleSubmit = async (onSaved?: () => void) => {
    if (!movieTitle.trim() || !reviewText.trim() || rating === 0) {
      Alert.alert('Please choose a movie, rating, and write your review');
      return;
    }

    if (!userId || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    try {
      const review = await reviewService.create(userId, {
        movieTitle: movieTitle.trim(),
        movie: selectedMovie
          ? createMatchedMovieSnapshot(selectedMovie)
          : createManualMovieSnapshot(movieTitle),
        reviewText: reviewText.trim(),
        rating: String(rating),
        visibility,
      });

      setMovieTitle('');
      setSelectedMovie(null);
      setMovieResults([]);
      setReviewText('');
      setRating(0);
      setVisibility(defaultVisibility);
      await fetchReviewStatus();

      if (onSaved) {
        onSaved();
      } else if (review.syncStatus === 'synced') {
        Alert.alert('Review posted!');
      } else {
        Alert.alert(
          'Review saved on this device',
          'It will upload automatically when a connection is available.'
        );
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown database error';
      Alert.alert('Error saving review', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  usePreventRemove(hasUnsavedChanges, ({ data }) => {
    Alert.alert(
      'Post review before leaving?',
      "Your review hasn't been posted. Would you like to post it before leaving?",
      [
        {
          text: 'Keep Writing',
          style: 'cancel',
        },
        {
          text: 'Discard Draft',
          style: 'destructive',
          onPress: () => navigation.dispatch(data.action),
        },
        {
          text: 'Post Review',
          onPress: () =>
            void handleSubmit(() => setPendingNavigationAction(data.action)),
        },
      ]
    );
  });

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.content}>
        {isOffline && (
          <View style={styles.offlineNotice}>
            <Text style={styles.offlineNoticeText}>
              Offline mode: your review will stay on this device until it can
              sync.
            </Text>
          </View>
        )}

        {pendingCount > 0 && (
          <View style={styles.syncNotice}>
            <Text style={styles.syncNoticeText}>
              {pendingCount} {pendingCount === 1 ? 'change is' : 'changes are'}{' '}
              waiting to sync.
            </Text>
            <Pressable
              accessibilityRole="button"
              disabled={isSyncing}
              onPress={() => void synchronize(true)}
              style={({ pressed }) => [
                styles.retryButton,
                pressed && styles.retryButtonPressed,
                isSyncing && styles.disabled,
              ]}
            >
              <Text style={styles.retryButtonText}>
                {isSyncing ? 'Syncing…' : 'Retry'}
              </Text>
            </Pressable>
          </View>
        )}

        {pendingCount >= LARGE_QUEUE_WARNING_THRESHOLD && (
          <Text style={styles.queueWarning}>
            An unusually large number of changes are waiting. Keep the app open
            with a stable connection so it can catch up.
          </Text>
        )}

        <Text style={styles.label}>Movie Title</Text>
        <View style={styles.searchField}>
          <Ionicons
            accessibilityElementsHidden
            color="#7B8190"
            name="search-outline"
            size={24}
          />
          <TextInput
            accessibilityLabel="Movie title"
            autoCapitalize="words"
            onChangeText={(value) => {
              setMovieTitle(value);
              setSelectedMovie(null);
            }}
            placeholder="Search for a movie"
            placeholderTextColor="#9DA3AE"
            returnKeyType="next"
            style={styles.searchInput}
            value={movieTitle}
          />
        </View>
        {isSearchingMovies ? (
          <View style={styles.movieSearchStatus}>
            <ActivityIndicator color={colors.reviewAccent} size="small" />
            <Text style={styles.movieSearchStatusText}>Searching movies…</Text>
          </View>
        ) : null}
        {movieResults.length > 0 ? (
          <View style={styles.movieResults}>
            {movieResults.map((movie) => (
              <Pressable
                accessibilityLabel={`Select ${movie.title}${
                  movie.releaseYear ? ` (${movie.releaseYear})` : ''
                }`}
                accessibilityRole="button"
                key={movie.catalogId}
                onPress={() => {
                  setSelectedMovie(movie);
                  setMovieTitle(movie.title);
                  setMovieResults([]);
                  void movieCatalogService
                    .getById(movie.catalogId)
                    .catch(() => undefined);
                }}
                style={({ pressed }) => [
                  styles.movieResult,
                  pressed && styles.movieResultPressed,
                ]}
              >
                {movie.posterUrl ? (
                  <Image
                    source={{ uri: movie.posterUrl }}
                    style={styles.movieResultPoster}
                  />
                ) : (
                  <View style={styles.movieResultPosterPlaceholder}>
                    <Ionicons color="#9DA3AE" name="film-outline" size={21} />
                  </View>
                )}
                <View style={styles.movieResultText}>
                  <Text numberOfLines={1} style={styles.movieResultTitle}>
                    {movie.title}
                  </Text>
                  <Text numberOfLines={1} style={styles.movieResultDetails}>
                    {[
                      movie.releaseYear,
                      movie.genres.slice(0, 2).join(', '),
                    ]
                      .filter(Boolean)
                      .join(' · ') || 'Movie'}
                  </Text>
                </View>
                <Ionicons color="#858B96" name="chevron-forward" size={19} />
              </Pressable>
            ))}
          </View>
        ) : null}
        <Text style={styles.searchHint}>
          {selectedMovie
            ? `Selected${
                selectedMovie.releaseYear
                  ? ` · ${selectedMovie.releaseYear}`
                  : ''
              }. Edit the title to choose a different movie.`
            : isOffline
              ? 'Search cached movies, or type a title to create a manual offline review.'
              : 'Choose a result, or type a title to create a manual review.'}
        </Text>

        <Text style={[styles.label, styles.ratingLabel]}>Your Rating</Text>
        <View
          accessibilityLabel={
            rating === 0 ? 'No rating selected' : `${rating} out of 5 stars`
          }
          style={styles.starRow}
        >
          {STAR_VALUES.map((value) => {
            const isSelected = value <= rating;

            return (
              <Pressable
                accessibilityLabel={`${value} out of 5 stars`}
                accessibilityRole="button"
                accessibilityState={{ selected: rating === value }}
                hitSlop={8}
                key={value}
                onPress={() => setRating(value)}
                style={({ pressed }) => [
                  styles.starButton,
                  pressed && styles.starButtonPressed,
                ]}
              >
                <Ionicons
                  color={colors.reviewAccent}
                  name={isSelected ? 'star' : 'star-outline'}
                  size={42}
                />
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.ratingHint}>
          {rating === 0 ? 'Tap to rate' : `${rating} out of 5 stars`}
        </Text>

        <Text style={[styles.label, styles.reviewLabel]}>Your Review</Text>
        <TextInput
          accessibilityLabel="Your review"
          multiline
          onChangeText={setReviewText}
          placeholder="What did you think of the movie?"
          placeholderTextColor="#9DA3AE"
          style={styles.reviewInput}
          textAlignVertical="top"
          value={reviewText}
        />

        <Text style={[styles.label, styles.visibilityLabel]}>
          Who can see this review?
        </Text>
        <ReviewVisibilitySelector
          disabled={isSubmitting}
          onChange={setVisibility}
          value={visibility}
        />
        <Text style={styles.visibilityHint}>
          This choice applies only to this review and does not change your
          profile default.
        </Text>

        <Pressable
          accessibilityRole="button"
          disabled={isSubmitting}
          onPress={() => void handleSubmit()}
          style={({ pressed }) => [
            styles.postButton,
            pressed && styles.postButtonPressed,
            isSubmitting && styles.disabled,
          ]}
        >
          <Text style={styles.postButtonText}>
            {isSubmitting ? 'Posting…' : 'Post Review'}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 42,
  },
  content: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  offlineNotice: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#FFF4D6',
    marginBottom: 12,
  },
  offlineNoticeText: {
    color: '#6B4F00',
  },
  syncNotice: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: colors.reviewAccentSoft,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  syncNoticeText: {
    color: colors.reviewAccentText,
    flex: 1,
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
  queueWarning: {
    color: '#9A3412',
    marginBottom: 12,
  },
  visibilityLabel: {
    marginTop: 30,
  },
  visibilityHint: {
    color: '#7B8190',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 8,
  },
  label: {
    color: '#19191F',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 11,
  },
  searchField: {
    minHeight: 58,
    borderWidth: 1,
    borderColor: '#D9DCE3',
    borderRadius: 11,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
  },
  searchInput: {
    flex: 1,
    color: '#1D1D23',
    fontSize: 16,
    paddingVertical: 15,
  },
  searchHint: {
    color: '#7B8190',
    fontSize: 12,
    marginTop: 7,
  },
  movieSearchStatus: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 12,
  },
  movieSearchStatusText: {
    color: '#737A86',
    fontSize: 13,
  },
  movieResults: {
    borderWidth: 1,
    borderColor: '#E1E3E8',
    borderRadius: 11,
    marginTop: 8,
    overflow: 'hidden',
  },
  movieResult: {
    minHeight: 72,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  movieResultPressed: {
    backgroundColor: colors.reviewAccentSoft,
  },
  movieResultPoster: {
    width: 38,
    height: 56,
    borderRadius: 5,
    backgroundColor: '#ECEDEF',
  },
  movieResultPosterPlaceholder: {
    width: 38,
    height: 56,
    borderRadius: 5,
    backgroundColor: '#F1F2F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  movieResultText: {
    flex: 1,
  },
  movieResultTitle: {
    color: '#24252A',
    fontSize: 15,
    fontWeight: '700',
  },
  movieResultDetails: {
    color: '#7B8190',
    fontSize: 12,
    marginTop: 5,
  },
  ratingLabel: {
    marginTop: 36,
  },
  starRow: {
    width: '100%',
    maxWidth: 330,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  starButton: {
    borderRadius: 24,
  },
  starButtonPressed: {
    opacity: 0.55,
    transform: [{ scale: 0.94 }],
  },
  ratingHint: {
    color: '#767C88',
    fontSize: 14,
    marginTop: 10,
  },
  reviewLabel: {
    marginTop: 40,
  },
  reviewInput: {
    minHeight: 220,
    borderWidth: 1,
    borderColor: '#D9DCE3',
    borderRadius: 11,
    color: '#1D1D23',
    fontSize: 16,
    lineHeight: 23,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
  },
  postButton: {
    minHeight: 56,
    marginTop: 44,
    borderRadius: 10,
    backgroundColor: colors.reviewAccent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.reviewAccentShadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 3,
  },
  postButtonPressed: {
    backgroundColor: colors.reviewAccentPressed,
    transform: [{ scale: 0.99 }],
  },
  postButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.55,
  },
});
