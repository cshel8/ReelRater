import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';
import type { PosterFileStore } from '@/services/local/posterCacheTypes';

const POSTER_DIRECTORY_NAME = 'reelrater-posters';
const MAXIMUM_POSTER_BYTES = 10 * 1024 * 1024;

const extensionFor = (sourceUrl: string) => {
  try {
    const extension = new URL(sourceUrl).pathname
      .split('.')
      .at(-1)
      ?.toLowerCase();
    return extension && /^(avif|jpeg|jpg|png|webp)$/.test(extension)
      ? extension
      : 'jpg';
  } catch {
    return 'jpg';
  }
};

export const expoPosterFileStore: PosterFileStore = {
  async download(sourceUrl, cacheKey) {
    if (!FileSystem.cacheDirectory) {
      throw new Error('Poster cache directory is unavailable.');
    }

    const directory = `${FileSystem.cacheDirectory}${POSTER_DIRECTORY_NAME}/`;
    await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
    const digest = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      cacheKey
    );
    const extension = extensionFor(sourceUrl);
    const destination = `${directory}${digest}.${extension}`;
    const temporaryDestination = `${destination}.${Date.now()}.download`;

    try {
      const result = await FileSystem.downloadAsync(
        sourceUrl,
        temporaryDestination,
        { sessionType: FileSystem.FileSystemSessionType.FOREGROUND }
      );
      if (result.status < 200 || result.status >= 300) {
        throw new Error(`Poster download failed with status ${result.status}.`);
      }
      if (result.mimeType && !result.mimeType.startsWith('image/')) {
        throw new Error('Poster download did not return an image.');
      }
      const fileInfo = await FileSystem.getInfoAsync(temporaryDestination);
      if (
        !fileInfo.exists ||
        fileInfo.isDirectory ||
        fileInfo.size > MAXIMUM_POSTER_BYTES
      ) {
        throw new Error('Poster download is missing or too large.');
      }
      await FileSystem.deleteAsync(destination, { idempotent: true });
      await FileSystem.moveAsync({
        from: temporaryDestination,
        to: destination,
      });
      return destination;
    } catch (error) {
      await FileSystem.deleteAsync(temporaryDestination, {
        idempotent: true,
      }).catch(() => undefined);
      throw error;
    }
  },

  async exists(localUri) {
    return (await FileSystem.getInfoAsync(localUri)).exists;
  },

  async remove(localUri) {
    await FileSystem.deleteAsync(localUri, { idempotent: true });
  },

  async list() {
    if (!FileSystem.cacheDirectory) {
      return [];
    }
    const directory = `${FileSystem.cacheDirectory}${POSTER_DIRECTORY_NAME}/`;
    try {
      return (await FileSystem.readDirectoryAsync(directory)).map(
        (name) => `${directory}${name}`
      );
    } catch {
      return [];
    }
  },
};
