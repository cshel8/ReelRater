import type {
  HomeImageCacheMetadataRepository,
  HomeImageCacheService,
} from '@/services/local/homeImageCacheTypes';
import type { PosterFileStore } from '@/services/local/posterCacheTypes';

const DEFAULT_MAXIMUM_IMAGES = 80;
const DEFAULT_RETENTION_DAYS = 30;
const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

/**
 * Persistent cache for Home poster and backdrop files. Unlike the Reviews
 * poster cache, entries are matched by source URL alone so frequent snapshot
 * refreshes never force unchanged images to re-download, and retention is a
 * sliding last-access window rather than catalog retention metadata.
 */
export const createHomeImageCacheService = (
  metadataRepository: HomeImageCacheMetadataRepository,
  fileStore: PosterFileStore,
  clock: () => Date = () => new Date(),
  maximumImages = DEFAULT_MAXIMUM_IMAGES,
  retentionDays = DEFAULT_RETENTION_DAYS
): HomeImageCacheService => {
  const activeResolutions = new Map<string, Promise<string | null>>();

  const removeFiles = async (uris: string[]) => {
    await Promise.all(
      [...new Set(uris)].map((uri) =>
        fileStore.remove(uri).catch(() => undefined)
      )
    );
  };

  const resolveImage: HomeImageCacheService['resolve'] = async (input) => {
    const currentTime = clock();
    const existing = await metadataRepository.get(input.sourceUrl);
    if (existing && (await fileStore.exists(existing.localUri))) {
      await metadataRepository.markAccessed(
        input.sourceUrl,
        currentTime.toISOString()
      );
      return existing.localUri;
    }

    if (existing) {
      await metadataRepository.remove(input.sourceUrl);
    }

    if (input.allowDownload === false) {
      return null;
    }

    let downloadedUri: string | null = null;
    try {
      downloadedUri = await fileStore.download(
        input.sourceUrl,
        input.sourceUrl
      );
      const evictedUris = await metadataRepository.saveAndPrune(
        {
          sourceUrl: input.sourceUrl,
          catalogId: input.catalogId,
          localUri: downloadedUri,
          lastAccessedAt: currentTime.toISOString(),
        },
        maximumImages
      );
      await removeFiles(evictedUris.filter((uri) => uri !== downloadedUri));
      return downloadedUri;
    } catch {
      if (downloadedUri) {
        await fileStore.remove(downloadedUri).catch(() => undefined);
      }
      return null;
    }
  };

  return {
    resolve(input) {
      const resolutionKey =
        `${input.sourceUrl}:${input.allowDownload !== false}`;
      const active = activeResolutions.get(resolutionKey);
      if (active) {
        return active;
      }

      const resolution = resolveImage(input).finally(() => {
        activeResolutions.delete(resolutionKey);
      });
      activeResolutions.set(resolutionKey, resolution);
      return resolution;
    },

    async purgeStale() {
      const cutoff = new Date(
        clock().getTime() - retentionDays * DAY_IN_MILLISECONDS
      ).toISOString();
      const staleUris = await metadataRepository.takeStale(cutoff);
      await removeFiles(staleUris);
      if (activeResolutions.size === 0) {
        const [knownUris, storedUris] = await Promise.all([
          metadataRepository.listLocalUris(),
          fileStore.list(),
        ]);
        const known = new Set(knownUris);
        await removeFiles(storedUris.filter((uri) => !known.has(uri)));
      }
    },

    async clear() {
      const uris = await metadataRepository.clear();
      await removeFiles(uris);
    },
  };
};
