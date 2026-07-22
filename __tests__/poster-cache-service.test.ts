import type {
  PosterCacheMetadataRepository,
  PosterCacheService,
  PosterFileStore,
} from '@/services/local/posterCacheTypes';
import { createPosterCacheService } from '@/services/movies/posterCacheService';

const retention = {
  fetchedAt: '2026-01-01T12:00:00.000Z',
  refreshAfter: '2026-05-31T12:00:00.000Z',
  expiresAt: '2026-06-29T12:00:00.000Z',
};

const input = {
  catalogId: 'catalog:1',
  posterUrl: 'https://image.example/poster.jpg',
  catalogDataRetention: retention,
};

const createMetadata = (): jest.Mocked<PosterCacheMetadataRepository> => ({
  get: jest.fn().mockResolvedValue(null),
  saveAndPrune: jest.fn().mockResolvedValue([]),
  remove: jest.fn().mockResolvedValue(null),
  takeExpired: jest.fn().mockResolvedValue([]),
  listLocalUris: jest.fn().mockResolvedValue([]),
  markAccessed: jest.fn().mockResolvedValue(undefined),
  clear: jest.fn().mockResolvedValue([]),
});

const createFileStore = (): jest.Mocked<PosterFileStore> => ({
  download: jest.fn().mockResolvedValue('file://poster.jpg'),
  exists: jest.fn().mockResolvedValue(true),
  remove: jest.fn().mockResolvedValue(undefined),
  list: jest.fn().mockResolvedValue([]),
});

describe('poster cache service', () => {
  it('reuses an existing file from the same catalog retention window', async () => {
    const metadata = createMetadata();
    const files = createFileStore();
    metadata.get.mockResolvedValue({
      catalogId: input.catalogId,
      sourceUrl: input.posterUrl,
      localUri: 'file://existing.jpg',
      catalogDataRetention: retention,
      lastAccessedAt: '2026-01-02T12:00:00.000Z',
    });
    const service = createPosterCacheService(
      metadata,
      files,
      () => new Date('2026-06-01T12:00:00.000Z')
    );

    await expect(service.resolve(input)).resolves.toBe('file://existing.jpg');
    expect(files.download).not.toHaveBeenCalled();
    expect(metadata.markAccessed).toHaveBeenCalledWith(
      input.catalogId,
      '2026-06-01T12:00:00.000Z'
    );
  });

  it('downloads a new file without restarting the catalog retention window', async () => {
    const metadata = createMetadata();
    const files = createFileStore();
    metadata.saveAndPrune.mockResolvedValue(['file://evicted.jpg']);
    const service = createPosterCacheService(
      metadata,
      files,
      () => new Date('2026-06-01T12:00:00.000Z')
    );

    await expect(service.resolve(input)).resolves.toBe('file://poster.jpg');
    expect(metadata.saveAndPrune).toHaveBeenCalledWith(
      expect.objectContaining({
        catalogDataRetention: retention,
        lastAccessedAt: '2026-06-01T12:00:00.000Z',
      }),
      5
    );
    expect(files.remove).toHaveBeenCalledWith('file://evicted.jpg');
  });

  it('removes expired metadata and files instead of downloading them', async () => {
    const metadata = createMetadata();
    const files = createFileStore();
    metadata.remove.mockResolvedValue('file://expired.jpg');
    const service = createPosterCacheService(
      metadata,
      files,
      () => new Date('2026-06-29T12:00:00.000Z')
    );

    await expect(service.resolve(input)).resolves.toBeNull();
    expect(files.download).not.toHaveBeenCalled();
    expect(files.remove).toHaveBeenCalledWith('file://expired.jpg');
  });

  it('does not start a missing poster download while offline', async () => {
    const metadata = createMetadata();
    const files = createFileStore();
    const service = createPosterCacheService(
      metadata,
      files,
      () => new Date('2026-06-01T12:00:00.000Z')
    );

    await expect(
      service.resolve({ ...input, allowDownload: false })
    ).resolves.toBeNull();
    expect(files.download).not.toHaveBeenCalled();
  });

  it('shares a simultaneous download for the same catalog window', async () => {
    const metadata = createMetadata();
    const files = createFileStore();
    let finishDownload: ((uri: string) => void) | undefined;
    files.download.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishDownload = resolve;
        })
    );
    const service = createPosterCacheService(
      metadata,
      files,
      () => new Date('2026-06-01T12:00:00.000Z')
    );

    const first = service.resolve(input);
    const second = service.resolve(input);
    await Promise.resolve();
    finishDownload?.('file://poster.jpg');

    await expect(Promise.all([first, second])).resolves.toEqual([
      'file://poster.jpg',
      'file://poster.jpg',
    ]);
    expect(files.download).toHaveBeenCalledTimes(1);
  });

  it('removes untracked files left behind by interrupted writes', async () => {
    const metadata = createMetadata();
    const files = createFileStore();
    metadata.listLocalUris.mockResolvedValue(['file://known.jpg']);
    files.list.mockResolvedValue([
      'file://known.jpg',
      'file://orphan.download',
    ]);
    const service = createPosterCacheService(metadata, files);

    await service.purgeExpired();

    expect(files.remove).toHaveBeenCalledWith('file://orphan.download');
    expect(files.remove).not.toHaveBeenCalledWith('file://known.jpg');
  });
});
