import type { CommunityActivePreferences, UserSettings } from '@/types/domain';
import { DEFAULT_COMMUNITY_PREFERENCES } from '@/types/domain';

const mapDefaultSort = (
  sort: UserSettings['defaultSort']
): CommunityActivePreferences['sort'] =>
  sort === 'highestRated'
    ? 'highest'
    : sort === 'lowestRated'
      ? 'lowest'
      : sort;

const isCommunityMediaFilter = (value: unknown): value is CommunityActivePreferences['mediaFilter'] =>
  value === 'all' || value === 'movie' || value === 'tv';

const isCommunityDefaultSort = (value: unknown): value is UserSettings['defaultSort'] =>
  value === 'newest' ||
  value === 'oldest' ||
  value === 'highestRated' ||
  value === 'lowestRated';

/**
 * Determines a Community session's first filter and sort without coupling the
 * screen to AsyncStorage or Firebase. Local browsing state wins over account
 * defaults, then the stable hard-coded fallback is used.
 */
export const resolveInitialCommunityPreferences = (
  localPreferences: CommunityActivePreferences | null,
  settings: UserSettings | null
): CommunityActivePreferences =>
  localPreferences ?? resolveCommunityDefaultPreferences(settings);

/** Resolves account defaults without considering this device's active view. */
export const resolveCommunityDefaultPreferences = (
  settings: UserSettings | null
): CommunityActivePreferences => {
  if (
    settings &&
    isCommunityMediaFilter(settings.defaultMediaFilter) &&
    isCommunityDefaultSort(settings.defaultSort)
  ) {
    return {
      mediaFilter: settings.defaultMediaFilter,
      sort: mapDefaultSort(settings.defaultSort),
    };
  }

  return {
    mediaFilter: DEFAULT_COMMUNITY_PREFERENCES.defaultMediaFilter,
    sort: DEFAULT_COMMUNITY_PREFERENCES.defaultSort,
  };
};
