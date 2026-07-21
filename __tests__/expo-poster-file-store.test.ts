import * as FileSystem from 'expo-file-system/legacy';
import { expoPosterFileStore } from '@/services/local/expoPosterFileStore';

jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: jest.fn().mockResolvedValue('poster-digest'),
}));

jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file://cache/',
  FileSystemSessionType: { FOREGROUND: 1 },
  makeDirectoryAsync: jest.fn().mockResolvedValue(undefined),
  downloadAsync: jest.fn(),
  getInfoAsync: jest.fn(),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
  moveAsync: jest.fn().mockResolvedValue(undefined),
  readDirectoryAsync: jest.fn().mockResolvedValue([]),
}));

describe('Expo poster file store', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (FileSystem.downloadAsync as jest.Mock).mockResolvedValue({
      uri: 'file://temporary',
      status: 200,
      headers: {},
      mimeType: 'image/jpeg',
    });
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({
      exists: true,
      uri: 'file://temporary',
      size: 250_000,
      isDirectory: false,
      modificationTime: 0,
    });
  });

  it('validates and atomically moves a downloaded poster', async () => {
    await expect(
      expoPosterFileStore.download(
        'https://image.example/poster.jpg',
        'catalog:1:2026-01-01'
      )
    ).resolves.toBe('file://cache/reelrater-posters/poster-digest.jpg');
    expect(FileSystem.moveAsync).toHaveBeenCalledWith({
      from: expect.stringContaining('.download'),
      to: 'file://cache/reelrater-posters/poster-digest.jpg',
    });
  });

  it('rejects a response that is not an image and deletes the temporary file', async () => {
    (FileSystem.downloadAsync as jest.Mock).mockResolvedValue({
      uri: 'file://temporary',
      status: 200,
      headers: {},
      mimeType: 'text/html',
    });

    await expect(
      expoPosterFileStore.download(
        'https://image.example/poster.jpg',
        'catalog:1:2026-01-01'
      )
    ).rejects.toThrow('did not return an image');
    expect(FileSystem.moveAsync).not.toHaveBeenCalled();
    expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
      expect.stringContaining('.download'),
      { idempotent: true }
    );
  });
});
