import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CommunityPreferenceRepository } from '@/services/local/communityPreferenceTypes';
import type { CommunityActivePreferences } from '@/types/domain';

const keyForUser = (userId: string) =>
  `reelrater:community:last-active:${userId}`;

const isPreferences = (value: unknown): value is CommunityActivePreferences => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    (candidate.mediaFilter === 'all' ||
      candidate.mediaFilter === 'movie' ||
      candidate.mediaFilter === 'tv') &&
    (candidate.sort === 'newest' ||
      candidate.sort === 'oldest' ||
      candidate.sort === 'highest' ||
      candidate.sort === 'lowest')
  );
};

export const asyncStorageCommunityPreferenceRepository: CommunityPreferenceRepository = {
  async getForUser(userId) {
    const stored = await AsyncStorage.getItem(keyForUser(userId));
    if (!stored) {
      return null;
    }
    try {
      const value = JSON.parse(stored) as unknown;
      return isPreferences(value) ? value : null;
    } catch {
      return null;
    }
  },

  async setForUser(userId, preferences) {
    await AsyncStorage.setItem(keyForUser(userId), JSON.stringify(preferences));
  },

  async removeForUser(userId) {
    await AsyncStorage.removeItem(keyForUser(userId));
  },
};
