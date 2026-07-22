import type {
  PosterCacheMetadataRepository,
  PosterCacheService,
  PosterFileStore,
} from '@/services/local/posterCacheTypes';

const DEFAULT_MAXIMUM_POSTERS = 5;

export const createPosterCacheService = (
  metadataRepository: PosterCacheMetadataRepository,
  fileStore: PosterFileStore,
  clock: () => Date = () => new Date(),
  maximumPosters = DEFAULT_MAXIMUM_POSTERS
): PosterCacheService => {
  const activeResolutions = new Map<string, Promise<string | null>>();

  const removeFiles = async (uris: string[]) => {
    await Promise.all(
      [...new Set(uris)].map((uri) =>
        fileStore.remove(uri).catch(() => undefined)
      )
    );
  };

  const resolvePoster: PosterCacheService['resolve'] = async (input) => {
    const currentTime = clock();
    const expiresAt = new Date(
      input.catalogDataRetention.expiresAt
    ).getTime();
    if (
      !Number.isFinite(expiresAt) ||
      expiresAt <= currentTime.getTime()
    ) {
      const expiredUri = await metadataRepository.remove(input.catalogId);
      if (expiredUri) {
        await fileStore.remove(expiredUri).catch(() => undefined);
      }
      return null;
    }

    const existing = await metadataRepository.get(input.catalogId);
    const matchesCurrentCatalogData =
      existing?.sourceUrl === input.posterUrl &&
      existing.catalogDataRetention.fetchedAt ===
        input.catalogDataRetention.fetchedAt;
    if (
      existing &&
      matchesCurrentCatalogData &&
      (await fileStore.exists(existing.localUri))
    ) {
      await metadataRepository.markAccessed(
        input.catalogId,
        currentTime.toISOString()
      );
      return existing.localUri;
    }

    if (existing && !(await fileStore.exists(existing.localUri))) {
      await metadataRepository.remove(input.catalogId);
    }

    if (input.allowDownload === false) {
      return null;
    }

    let downloadedUri: string | null = null;
    try {
      downloadedUri = await fileStore.download(
        input.posterUrl,
        `${input.catalogId}:${input.catalogDataRetention.fetchedAt}`
      );
      const evictedUris = await metadataRepository.saveAndPrune(
        {
          catalogId: input.catalogId,
          sourceUrl: input.posterUrl,
          localUri: downloadedUri,
          catalogDataRetention: input.catalogDataRetention,
          lastAccessedAt: currentTime.toISOString(),
        },
        maximumPosters
      );
      await removeFiles(evictedUris);
      if (existing?.localUri && existing.localUri !== downloadedUri) {
        await fileStore.remove(existing.localUri).catch(() => undefined);
      }
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
        `${input.catalogId}:${input.catalogDataRetention.fetchedAt}:` +
        `${input.allowDownload !== false}`;
      const active = activeResolutions.get(resolutionKey);
      if (active) {
        return active;
      }

      const resolution = resolvePoster(input).finally(() => {
        activeResolutions.delete(resolutionKey);
      });
      activeResolutions.set(resolutionKey, resolution);
      return resolution;
    },

    async purgeExpired() {
      const expiredUris = await metadataRepository.takeExpired(
        clock().toISOString()
      );
      await removeFiles(expiredUris);
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
