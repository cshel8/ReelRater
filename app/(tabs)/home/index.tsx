import NetInfo from '@react-native-community/netinfo';
import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useNavigation } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { HomeHero } from '@/components/home/HomeHero';
import { HomeSearchPanel } from '@/components/home/HomeSearchPanel';
import { MediaPosterRow } from '@/components/home/MediaPosterRow';
import { colors } from '@/constants/colors';
import { homeFeedService, homeImageCacheService } from '@/services';
import type { HomeSection, HomeSectionContent } from '@/services/contracts';
import type { MediaSummary } from '@/types/domain';

const SECTIONS: HomeSection[] = ['trending', 'popularMovies', 'popularTv'];

type SectionContents = Partial<Record<HomeSection, HomeSectionContent>>;

const failedSection = (error: unknown): HomeSectionContent => ({
  items: [],
  source: 'cache',
  fetchedAt: null,
  remoteError:
    error instanceof Error ? error.message : 'Unable to load content.',
});

export default function Home() {
  const navigation = useNavigation();
  const scrollRef = useRef<ScrollView | null>(null);
  const wasOffline = useRef(false);
  const [contents, setContents] = useState<SectionContents>({});
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchActive, setSearchActive] = useState(false);
  const [searchHasQuery, setSearchHasQuery] = useState(false);

  const closeSearch = useCallback(() => {
    setSearchActive(false);
    setSearchHasQuery(false);
  }, []);

  // Leaving the Home *tab* resets scroll and dismisses search; returning
  // from nested Media Details keeps the user's place.
  useEffect(() => {
    const parentTabNavigation = navigation.getParent();
    if (!parentTabNavigation) {
      return;
    }
    return parentTabNavigation.addListener('blur', () => {
      scrollRef.current?.scrollTo({ animated: false, y: 0 });
      closeSearch();
    });
  }, [closeSearch, navigation]);

  const openDetails = useCallback((item: MediaSummary) => {
    router.push({
      pathname: '/home/media/[catalogId]',
      params: {
        catalogId: item.catalogId,
        summary: JSON.stringify(item),
      },
    });
  }, []);

  const loadSections = useCallback(async (forceRefresh = false) => {
    const results = await Promise.all(
      SECTIONS.map((section) =>
        homeFeedService
          .getSection(section, { forceRefresh })
          .catch(failedSection)
      )
    );
    setContents({
      trending: results[0],
      popularMovies: results[1],
      popularTv: results[2],
    });
    void homeImageCacheService.purgeStale().catch(() => undefined);
  }, []);

  useEffect(() => {
    let active = true;
    void loadSections().finally(() => {
      if (active) {
        setInitialLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [loadSections]);

  useEffect(
    () =>
      NetInfo.addEventListener((state) => {
        const online =
          Boolean(state.isConnected) && state.isInternetReachable !== false;
        if (online && wasOffline.current) {
          wasOffline.current = false;
          void loadSections();
        } else if (!online) {
          wasOffline.current = true;
        }
      }),
    [loadSections]
  );

  const trending = contents.trending;
  const popularMovies = contents.popularMovies;
  const popularTv = contents.popularTv;
  const allLoaded = SECTIONS.every((section) => contents[section]);
  const everySectionEmpty =
    allLoaded &&
    SECTIONS.every((section) => contents[section]!.items.length === 0);
  const anyRemoteError = SECTIONS.some(
    (section) => contents[section]?.remoteError
  );
  const showEmptyState = !initialLoading && everySectionEmpty;
  const showStaleBanner =
    !initialLoading && !everySectionEmpty && anyRemoteError;

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    void loadSections(true).finally(() => {
      setRefreshing(false);
    });
  }, [loadSections]);

  const brandHeaderTitle = useCallback(
    () => (
      <Text style={styles.brand}>
        Reel
        <Text style={styles.brandAccent}>Rater</Text>
      </Text>
    ),
    []
  );

  const searchHeaderButton = useCallback(
    () => (
      <Pressable
        accessibilityLabel={searchActive ? 'Close search' : 'Search'}
        accessibilityRole="button"
        hitSlop={8}
        onPress={() => {
          if (searchActive) {
            closeSearch();
          } else {
            setSearchActive(true);
          }
        }}
      >
        <Ionicons
          color="#17171C"
          name={searchActive ? 'close' : 'search'}
          size={22}
        />
      </Pressable>
    ),
    [closeSearch, searchActive]
  );

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          headerLeft: brandHeaderTitle,
          headerRight: searchHeaderButton,
          headerTitle: '',
          // Renders the wordmark as plain branding on iOS 26 instead of
          // inside the shared glass bar-button background.
          unstable_headerLeftItems: () => [
            {
              type: 'custom',
              element: brandHeaderTitle(),
              hidesSharedBackground: true,
            },
          ],
        }}
      />
      {searchActive ? (
        <HomeSearchPanel onQueryPresenceChange={setSearchHasQuery} />
      ) : null}
      {searchActive && searchHasQuery ? null : (
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        ref={scrollRef}
        refreshControl={
          <RefreshControl
            onRefresh={handleRefresh}
            refreshing={refreshing}
            tintColor={colors.reviewAccent}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {initialLoading ? (
          <>
            <View style={styles.loadingHero}>
              <ActivityIndicator color={colors.reviewAccent} size="large" />
            </View>
            <View style={styles.loadingRow}>
              {[0, 1, 2].map((index) => (
                <View key={index} style={styles.loadingPoster} />
              ))}
            </View>
          </>
        ) : showEmptyState ? (
          <>
            <View style={styles.emptyState}>
              <View style={styles.emptyIconBadge}>
                <Ionicons
                  color={colors.reviewAccent}
                  name="film-outline"
                  size={34}
                />
              </View>
              <Text style={styles.emptyTitle}>Nothing to show yet</Text>
              <Text style={styles.emptyBody}>
                We couldn&apos;t reach the movie catalog and there&apos;s no
                saved content on this device yet. Check your connection and
                try again.
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  void loadSections(true);
                }}
                style={({ pressed }) => [
                  styles.retryButton,
                  pressed ? styles.retryButtonPressed : null,
                ]}
              >
                <Text style={styles.retryButtonText}>Try Again</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <>
            <HomeHero
              items={trending?.items ?? []}
              onSelectItem={openDetails}
            />
            {showStaleBanner ? (
              <View style={styles.staleBanner}>
                <Ionicons
                  color={colors.reviewAccentText}
                  name="cloud-offline-outline"
                  size={16}
                />
                <Text style={styles.staleBannerText}>
                  Showing saved content — couldn&apos;t refresh just now.
                </Text>
              </View>
            ) : null}
            <MediaPosterRow
              items={popularMovies?.items ?? []}
              onSelectItem={openDetails}
              title="Popular Movies"
            />
            <MediaPosterRow
              items={popularTv?.items ?? []}
              onSelectItem={openDetails}
              title="Popular TV"
            />
            <View style={styles.bottomSpacer} />
          </>
        )}
      </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#F7F7F8',
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  brand: {
    color: '#17171C',
    fontSize: 22,
    fontWeight: '800',
  },
  brandAccent: {
    color: colors.reviewAccent,
  },
  loadingHero: {
    alignItems: 'center',
    backgroundColor: '#E8E9ED',
    height: 320,
    justifyContent: 'center',
  },
  loadingRow: {
    flexDirection: 'row',
    marginTop: 24,
    paddingHorizontal: 16,
  },
  loadingPoster: {
    backgroundColor: '#E8E9ED',
    borderRadius: 12,
    height: 165,
    marginRight: 12,
    width: 110,
  },
  staleBanner: {
    alignItems: 'center',
    backgroundColor: '#FCEAF0',
    borderRadius: 10,
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 16,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  staleBannerText: {
    color: colors.reviewAccentText,
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 90,
    paddingHorizontal: 32,
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
  bottomSpacer: {
    height: 28,
  },
});
