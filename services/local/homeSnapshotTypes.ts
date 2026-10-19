import type { HomeSection } from '@/services/contracts';
import type { MediaSummary } from '@/types/domain';

export type HomeSectionSnapshot = {
  section: HomeSection;
  items: MediaSummary[];
  fetchedAt: string;
};

/**
 * Device-local persistence for Home browse snapshots. Content is public,
 * non-personalized catalog data, so snapshots are deliberately not scoped to
 * an account and carry no privacy or authorization metadata.
 */
export interface HomeSnapshotRepository {
  get(section: HomeSection): Promise<HomeSectionSnapshot | null>;
  /** Atomically replaces the stored snapshot for the given section. */
  replace(snapshot: HomeSectionSnapshot): Promise<void>;
  clear(): Promise<void>;
}
