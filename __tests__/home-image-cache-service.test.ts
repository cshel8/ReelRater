import type {
  HomeImageCacheEntry,
  HomeImageCacheMetadataRepository,
} from '@/services/local/homeImageCacheTypes';
import type { PosterFileStore } from '@/services/local/posterCacheTypes';
import { createHomeImageCacheService } from '@/services/movies/homeImageCacheService';

const now = new Date('2026-10-18T12:00:00.000Z');

const entry: HomeImageCacheEntry = {
  sourceUrl: 'https://image.example/w780/dune2-wide.jpg',
  catalogId: 'tmdb:movie:693134',
  localUri: 'file://cache/reelrater-home-images/dune2.jpg',
  lastAccessedAt: '2026-10-17T12:00:00.000Z',
};

const createRepository = (): jest.Mocked<HomeImageCacheMetadataRepository> => ({
  get: jest.fn().mockResolvedValue(null),
  saveAndPrune: jest.fn().mockResolvedValue([]),
  remove: jest.fn().mockResolvedValue(null),
  takeStale: jest.fn().mockResolvedValue([]),
  listLocalUris: jest.fn().mockResolvedValue([]),
  markAccessed: jest.fn().mockResolvedValue(undefined),
  clear: jest.fn().mockResolvedValue([]),
});

const createFileStore = (): jest.Mocked<PosterFileStore> => ({
  download: jest.fn().mockResolvedValue(entry.localUri),
  exists: jest.fn().mockResolvedValue(true),
  remove: jest.fn().mockResolvedValue(undefined),
  list: jest.fn().mockResolvedValue([]),
});

describe('Home image cache service', () => {
  it('returns an existing verified file and refreshes its access time', async () => {
    const repository = createRepository();
    const fileStore = createFileStore();
    repository.get.mockResolvedValue(entry);
    const service = createHomeImageCacheService(
      repository,
      fileStore,
      () => now
    );

    await expect(
      service.resolve({
        catalogId: entry.catalogId,
        sourceUrl: entry.sourceUrl,
      })
    ).resolves.toBe(entry.localUri);
    expect(repository.markAccessed).toHaveBeenCalledWith(
      entry.sourceUrl,
      now.toISOString()
    );
    expect(fileStore.download).not.toHaveBeenCalled();
  });

  it('re-downloads when the recorded file is missing on disk', async () => {
    const repository = createRepository();
    const fileStore = createFileStore();
    repository.get.mockResolvedValue(entry);
    fileStore.exists.mockResolvedValue(false);
    const service = createHomeImageCacheService(
      repository,
      fileStore,
      () => now
    );

    await expect(
      service.resolve({
        catalogId: entry.catalogId,
        sourceUrl: entry.sourceUrl,
      })
    ).resolves.toBe(entry.localUri);
    expect(repository.remove).toHaveBeenCalledWith(entry.sourceUrl);
    expect(fileStore.download).toHaveBeenCalledWith(
      entry.sourceUrl,
      entry.sourceUrl
    );
    expect(repository.saveAndPrune).toHaveBeenCalledWith(
      {
        sourceUrl: entry.sourceUrl,
        catalogId: entry.catalogId,
        localUri: entry.localUri,
        lastAccessedAt: now.toISOString(),
      },
      80
    );
  });

  it('does not download when downloads are disallowed', async () => {
    const repository = createRepository();
    const fileStore = createFileStore();
    const service = createHomeImageCacheService(
      repository,
      fileStore,
      () => now
    );

    await expect(
      service.resolve({
        catalogId: entry.catalogId,
        sourceUrl: entry.sourceUrl,
        allowDownload: false,
      })
    ).resolves.toBeNull();
    expect(fileStore.download).not.toHaveBeenCalled();
  });

  it('returns null and leaves no partial state when a download fails', async () => {
    const repository = createRepository();
    const fileStore = createFileStore();
    fileStore.download.mockRejectedValue(new Error('Network unavailable'));
    const service = createHomeImageCacheService(
      repository,
      fileStore,
      () => now
    );

    await expect(
      service.resolve({
        catalogId: entry.catalogId,
        sourceUrl: entry.sourceUrl,
      })
    ).resolves.toBeNull();
    expect(repository.saveAndPrune).not.toHaveBeenCalled();
  });

  it('removes the downloaded file when metadata persistence fails', async () => {
    const repository = createRepository();
    const fileStore = createFileStore();
    repository.saveAndPrune.mockRejectedValue(new Error('Database unavailable'));
    const service = createHomeImageCacheService(
      repository,
      fileStore,
      () => now
    );

    await expect(
      service.resolve({
        catalogId: entry.catalogId,
        sourceUrl: entry.sourceUrl,
      })
    ).resolves.toBeNull();
    expect(fileStore.remove).toHaveBeenCalledWith(entry.localUri);
  });

  it('deletes files evicted by the storage limit', async () => {
    const repository = createRepository();
    const fileStore = createFileStore();
    repository.saveAndPrune.mockResolvedValue([
      'file://cache/reelrater-home-images/old-1.jpg',
      'file://cache/reelrater-home-images/old-2.jpg',
    ]);
    const service = createHomeImageCacheService(
      repository,
      fileStore,
      () => now,
      2
    );

    await service.resolve({
      catalogId: entry.catalogId,
      sourceUrl: entry.sourceUrl,
    });

    expect(repository.saveAndPrune).toHaveBeenCalledWith(
      expect.objectContaining({ sourceUrl: entry.sourceUrl }),
      2
    );
    expect(fileStore.remove).toHaveBeenCalledWith(
      'file://cache/reelrater-home-images/old-1.jpg'
    );
    expect(fileStore.remove).toHaveBeenCalledWith(
      'file://cache/reelrater-home-images/old-2.jpg'
    );
  });

  it('shares one in-flight resolution per source URL', async () => {
    const repository = createRepository();
    const fileStore = createFileStore();
    let releaseDownload!: (uri: string) => void;
    fileStore.download.mockReturnValue(
      new Promise((resolve) => {
        releaseDownload = resolve;
      })
    );
    const service = createHomeImageCacheService(
      repository,
      fileStore,
      () => now
    );

    const input = {
      catalogId: entry.catalogId,
      sourceUrl: entry.sourceUrl,
    };
    const first = service.resolve(input);
    const second = service.resolve(input);
    releaseDownload(entry.localUri);
    await expect(Promise.all([first, second])).resolves.toEqual([
      entry.localUri,
      entry.localUri,
    ]);
    expect(fileStore.download).toHaveBeenCalledTimes(1);
  });

  it('purges stale entries and sweeps orphaned files', async () => {
    const repository = createRepository();
    const fileStore = createFileStore();
    repository.takeStale.mockResolvedValue([
      'file://cache/reelrater-home-images/stale.jpg',
    ]);
    repository.listLocalUris.mockResolvedValue([entry.localUri]);
    fileStore.list.mockResolvedValue([
      entry.localUri,
      'file://cache/reelrater-home-images/orphan.jpg',
    ]);
    const service = createHomeImageCacheService(
      repository,
      fileStore,
      () => now,
      80,
      30
    );

    await service.purgeStale();

    expect(repository.takeStale).toHaveBeenCalledWith(
      '2026-09-18T12:00:00.000Z'
    );
    expect(fileStore.remove).toHaveBeenCalledWith(
      'file://cache/reelrater-home-images/stale.jpg'
    );
    expect(fileStore.remove).toHaveBeenCalledWith(
      'file://cache/reelrater-home-images/orphan.jpg'
    );
    expect(fileStore.remove).not.toHaveBeenCalledWith(entry.localUri);
  });

  it('clears all metadata and removes the stored files', async () => {
    const repository = createRepository();
    const fileStore = createFileStore();
    repository.clear.mockResolvedValue([entry.localUri]);
    const service = createHomeImageCacheService(
      repository,
      fileStore,
      () => now
    );

    await service.clear();

    expect(fileStore.remove).toHaveBeenCalledWith(entry.localUri);
  });
});
