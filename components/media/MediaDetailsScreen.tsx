import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { CachedMediaImage } from '@/components/home/CachedMediaImage';
import { heroGradientUri } from '@/components/home/heroGradient';
import { colors } from '@/constants/colors';
import { mediaCatalogService } from '@/services';
import type { MediaDetails, MediaSummary } from '@/types/domain';

type LoadStatus = 'loading' | 'loaded' | 'failed';

const metaLine = (media: MediaSummary) => {
  const parts = [
    ...media.genres.slice(0, 3),
    ...(media.releaseYear !== null ? [String(media.releaseYear)] : []),
  ];
  return parts.join(' • ');
};

/**
 * A reusable cinematic details view for movies and TV series. It renders
 * instantly from an optional already-loaded summary, then enriches through
 * the cache-aware catalog service so offline behavior matches the rest of
 * the app: saved metadata stays visible, missing images degrade to
 * placeholders, and unavailable fields are hidden rather than invented.
 */
export function MediaDetailsScreen({
  catalogId,
  initialSummary,
}: {
  catalogId: string;
  initialSummary?: MediaSummary | null;
}) {
  const [details, setDetails] = useState<MediaDetails | null>(null);
  const [status, setStatus] = useState<LoadStatus>('loading');

  const loadDetails = useCallback(async () => {
    setStatus('loading');
    try {
      const loaded = await mediaCatalogService.getById(catalogId);
      setDetails(loaded);
      setStatus(loaded ? 'loaded' : 'failed');
    } catch {
      setStatus('failed');
    }
  }, [catalogId]);

  useEffect(() => {
    void loadDetails();
  }, [loadDetails]);

  const media: MediaSummary | MediaDetails | null =
    details ?? initialSummary ?? null;

  if (!media) {
    if (status === 'loading') {
      return (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.reviewAccent} size="large" />
        </View>
      );
    }
    return (
      <View style={styles.centered}>
        <View style={styles.emptyIconBadge}>
          <Ionicons
            color={colors.reviewAccent}
            name="film-outline"
            size={34}
          />
        </View>
        <Text style={styles.emptyTitle}>Couldn&apos;t load details</Text>
        <Text style={styles.emptyBody}>
          Check your connection and try again.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            void loadDetails();
          }}
          style={({ pressed }) => [
            styles.retryButton,
            pressed ? styles.retryButtonPressed : null,
          ]}
        >
          <Text style={styles.retryButtonText}>Try Again</Text>
        </Pressable>
      </View>
    );
  }

  const backdropUrl =
    details?.backdropUrl ?? initialSummary?.backdropUrl ?? null;
  const rating = details?.rating;
  const meta = metaLine(media);
  const synopsis = details?.overview?.trim() ?? '';
  // Cache-fallback results carry catalogDataRetention; cached browse/search
  // metadata without a stored synopsis does not prove the catalog returned
  // an empty one, so only a fresh remote response may claim "no synopsis".
  const synopsisConfirmedMissing =
    status === 'loaded' &&
    details !== null &&
    details.catalogDataRetention === undefined;

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      style={styles.screen}
    >
      <View style={styles.backdropBlock}>
        <CachedMediaImage
          accessibilityLabel={`Backdrop for ${media.title}`}
          catalogId={media.catalogId}
          iconSize={44}
          sourceUrl={backdropUrl ?? media.posterUrl}
          style={styles.backdrop}
        />
        <Image
          resizeMode="stretch"
          source={{ uri: heroGradientUri }}
          style={styles.backdropGradient}
        />
      </View>
      <View style={styles.content}>
        <View style={styles.titleRow}>
          <CachedMediaImage
            accessibilityLabel={`Poster for ${media.title}`}
            catalogId={media.catalogId}
            sourceUrl={media.posterUrl}
            style={styles.poster}
          />
          <View style={styles.titleColumn}>
            <Text style={styles.title}>{media.title}</Text>
            <View style={styles.typeChip}>
              <Text style={styles.typeChipText}>
                {media.mediaType === 'tv' ? 'TV Series' : 'Movie'}
              </Text>
            </View>
            {meta ? <Text style={styles.meta}>{meta}</Text> : null}
            {typeof rating === 'number' ? (
              <View style={styles.ratingRow}>
                <Ionicons
                  color={colors.reviewAccent}
                  name="star"
                  size={15}
                />
                <Text style={styles.ratingText}>
                  {rating.toFixed(1)} / 10 · TMDB
                </Text>
              </View>
            ) : null}
          </View>
        </View>
        {status === 'loading' ? (
          <ActivityIndicator
            color={colors.reviewAccent}
            style={styles.overviewLoading}
          />
        ) : (
          <>
            <Text style={styles.sectionHeading}>Synopsis</Text>
            {synopsis ? (
              // State A: an available (possibly cached) synopsis.
              <View style={styles.synopsisCard}>
                <Text style={styles.overview}>{synopsis}</Text>
              </View>
            ) : synopsisConfirmedMissing ? (
              // State B: the catalog responded and confirmed no synopsis.
              <Text style={styles.noSynopsis}>No synopsis available.</Text>
            ) : (
              // State C: a synopsis could not be retrieved (failed request
              // or unverified cached metadata only).
              <View style={styles.offlineNote}>
                <Ionicons
                  color={colors.reviewAccentText}
                  name="cloud-offline-outline"
                  size={16}
                />
                <Text style={styles.offlineNoteText}>
                  Connect to the internet to load this synopsis.
                </Text>
              </View>
            )}
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#F7F7F8',
    flex: 1,
  },
  centered: {
    alignItems: 'center',
    backgroundColor: '#F7F7F8',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  backdropBlock: {
    backgroundColor: '#17171C',
    height: 230,
  },
  backdrop: {
    height: 230,
    width: '100%',
  },
  backdropGradient: {
    bottom: 0,
    height: 110,
    left: 0,
    opacity: 0.55,
    position: 'absolute',
    right: 0,
    width: '100%',
  },
  content: {
    padding: 16,
  },
  titleRow: {
    flexDirection: 'row',
  },
  poster: {
    borderRadius: 12,
    height: 150,
    marginTop: -44,
    overflow: 'hidden',
    width: 100,
  },
  titleColumn: {
    flex: 1,
    marginLeft: 14,
  },
  title: {
    color: '#17171C',
    fontSize: 22,
    fontWeight: '800',
  },
  typeChip: {
    alignSelf: 'flex-start',
    backgroundColor: colors.reviewAccentSoft,
    borderRadius: 8,
    marginTop: 8,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  typeChipText: {
    color: colors.reviewAccentText,
    fontSize: 12,
    fontWeight: '700',
  },
  meta: {
    color: '#5B616C',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 8,
  },
  ratingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
    marginTop: 8,
  },
  ratingText: {
    color: '#17171C',
    fontSize: 13,
    fontWeight: '700',
  },
  offlineNote: {
    alignItems: 'center',
    backgroundColor: '#FCEAF0',
    borderRadius: 10,
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  offlineNoteText: {
    color: colors.reviewAccentText,
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
  overviewLoading: {
    marginTop: 24,
  },
  sectionHeading: {
    color: '#17171C',
    fontSize: 17,
    fontWeight: '700',
    marginTop: 20,
  },
  synopsisCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    elevation: 2,
    marginTop: 10,
    padding: 16,
    shadowColor: '#000000',
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  overview: {
    color: '#2C3039',
    fontSize: 15,
    lineHeight: 22,
  },
  noSynopsis: {
    color: '#5B616C',
    fontSize: 14,
    marginTop: 10,
  },
  emptyIconBadge: {
    alignItems: 'center',
    backgroundColor: colors.reviewAccentSoft,
    borderRadius: 36,
    height: 72,
    justifyContent: 'center',
    width: 72,
  },
  emptyTitle: {
    color: '#17171C',
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
  },
  emptyBody: {
    color: '#5B616C',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: colors.reviewAccent,
    borderRadius: 12,
    marginTop: 20,
    paddingHorizontal: 28,
    paddingVertical: 12,
  },
  retryButtonPressed: {
    backgroundColor: colors.reviewAccentPressed,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
