import { useLocalSearchParams } from 'expo-router';
import { MediaDetailsScreen } from '@/components/media/MediaDetailsScreen';
import type { MediaSummary } from '@/types/domain';

const single = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

/** The summary param is produced by our own navigation pushes; anything
 *  malformed simply falls back to a catalog-ID-only details fetch. */
const parseSummary = (value: string | undefined): MediaSummary | null => {
  if (!value) {
    return null;
  }
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return typeof parsed?.catalogId === 'string' &&
      typeof parsed?.title === 'string'
      ? (parsed as unknown as MediaSummary)
      : null;
  } catch {
    return null;
  }
};

export default function HomeMediaDetails() {
  const params = useLocalSearchParams<{
    catalogId?: string | string[];
    summary?: string | string[];
  }>();
  const catalogId = single(params.catalogId) ?? '';
  const initialSummary = parseSummary(single(params.summary));

  return (
    <MediaDetailsScreen
      catalogId={catalogId}
      initialSummary={initialSummary}
    />
  );
}
