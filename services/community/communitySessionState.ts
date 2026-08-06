import type { CommunityActivePreferences } from '@/types/domain';

const scrollOffsetsByUser = new Map<string, number>();
const currentPreferencesByUser = new Map<string, CommunityActivePreferences>();
const pendingPreferenceUpdatesByUser = new Map<
  string,
  CommunityActivePreferences
>();
let activeUserId: string | null = null;

/**
 * Keeps Community scroll offsets in memory only. A change of authenticated
 * account starts a fresh session, and an app restart naturally clears this
 * module state.
 */
export function beginCommunitySessionForUser(userId: string | null): void {
  if (activeUserId === userId) {
    return;
  }
  activeUserId = userId;
  scrollOffsetsByUser.clear();
  currentPreferencesByUser.clear();
  pendingPreferenceUpdatesByUser.clear();
}

export function getCommunityScrollOffset(userId: string): number {
  return scrollOffsetsByUser.get(userId) ?? 0;
}

export function setCommunityScrollOffset(userId: string, offset: number): void {
  scrollOffsetsByUser.set(userId, Math.max(0, offset));
}

export function resetCommunityScrollOffset(userId: string): void {
  scrollOffsetsByUser.delete(userId);
}

/** The current in-memory Community configuration for this signed-in session. */
export function setCurrentCommunityPreferences(
  userId: string,
  preferences: CommunityActivePreferences
): void {
  currentPreferencesByUser.set(userId, preferences);
}

export function getCurrentCommunityPreferences(
  userId: string
): CommunityActivePreferences | null {
  return currentPreferencesByUser.get(userId) ?? null;
}

/**
 * Applies a Preferences-screen save to Community the next time it receives
 * focus. Search and scroll are intentionally reset with the new view.
 */
export function publishCommunityPreferenceUpdate(
  userId: string,
  preferences: CommunityActivePreferences
): void {
  setCurrentCommunityPreferences(userId, preferences);
  pendingPreferenceUpdatesByUser.set(userId, preferences);
  resetCommunityScrollOffset(userId);
}

export function consumeCommunityPreferenceUpdate(
  userId: string
): CommunityActivePreferences | null {
  const preferences = pendingPreferenceUpdatesByUser.get(userId) ?? null;
  pendingPreferenceUpdatesByUser.delete(userId);
  return preferences;
}
