import type { CommunityActivePreferences } from '@/types/domain';

/**
 * Device-local Community browsing preferences. These values are intentionally
 * separate from the account defaults saved by SettingsService.
 */
export interface CommunityPreferenceRepository {
  getForUser(userId: string): Promise<CommunityActivePreferences | null>;
  setForUser(
    userId: string,
    preferences: CommunityActivePreferences
  ): Promise<void>;
  removeForUser(userId: string): Promise<void>;
}
