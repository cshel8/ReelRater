import type { UserAssetCleaner } from './types.js';

/**
 * Current ReelRater configuration has no remote user-asset persistence
 * provider. This is intentionally explicit rather than treating a Firebase
 * Storage failure as an empty user asset set.
 */
export const noRemoteUserAssetCleaner: UserAssetCleaner = {
  async deleteAssetsForUser() {
    // No active remote user-asset provider to clean up.
  },
};
