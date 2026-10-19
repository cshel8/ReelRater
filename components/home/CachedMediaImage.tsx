import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  Image,
  StyleSheet,
  View,
  type ImageStyle,
  type StyleProp,
} from 'react-native';
import { colors } from '@/constants/colors';
import { homeImageCacheService } from '@/services';
import type { MediaCatalogId } from '@/types/domain';

/**
 * Renders a Home catalog image through the persistent Home image cache.
 * Preference order: verified local file, then the remote URL, then a
 * placeholder — so cached metadata always renders even without an image.
 */
export function CachedMediaImage({
  accessibilityLabel,
  allowDownload = true,
  catalogId,
  iconSize = 28,
  sourceUrl,
  style,
}: {
  accessibilityLabel: string;
  /** Pass false for transient content (e.g. search results) so already
   *  cached files are reused without adding new downloads to the cache. */
  allowDownload?: boolean;
  catalogId: MediaCatalogId;
  iconSize?: number;
  sourceUrl: string | null;
  style?: StyleProp<ImageStyle>;
}) {
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [remoteFailed, setRemoteFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setLocalUri(null);
    setRemoteFailed(false);
    if (!sourceUrl) {
      return;
    }

    homeImageCacheService
      .resolve({ allowDownload, catalogId, sourceUrl })
      .then((uri) => {
        if (active && uri) {
          setLocalUri(uri);
        }
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [allowDownload, catalogId, sourceUrl]);

  if (!sourceUrl || remoteFailed) {
    return (
      <View
        accessibilityLabel={accessibilityLabel}
        style={[styles.placeholder, style]}
      >
        <Ionicons
          color={colors.reviewAccent}
          name="film-outline"
          size={iconSize}
        />
      </View>
    );
  }

  return (
    <Image
      accessibilityLabel={accessibilityLabel}
      onError={() => {
        if (localUri) {
          setLocalUri(null);
        } else {
          setRemoteFailed(true);
        }
      }}
      resizeMode="cover"
      source={{ uri: localUri ?? sourceUrl }}
      style={style}
    />
  );
}

const styles = StyleSheet.create({
  placeholder: {
    alignItems: 'center',
    backgroundColor: colors.reviewAccentSoft,
    justifyContent: 'center',
  },
});
