import type {
  CatalogDataRetention,
  MediaSummary,
  Review,
  ReviewMediaSnapshot,
  ReviewMediaTarget,
} from '@/types/domain';
import {
  defaultMovieCachePolicy,
  type MovieCachePolicy,
} from '@/services/movies/movieCachePolicy';

export const UNAVAILABLE_MOVIE_TITLE = 'Movie details temporarily unavailable';

export const createManualMediaSnapshot = (
  title: string,
  target: ReviewMediaTarget
): ReviewMediaSnapshot => ({
  ...target,
  matchStatus: 'manual',
  catalogId: null,
  title: title.trim(),
  releaseYear: null,
  genres: [],
  posterUrl: null,
});

/** @deprecated Prefer createManualMediaSnapshot for new code. */
export const createManualMovieSnapshot = (title: string) =>
  createManualMediaSnapshot(title, {
    mediaType: 'movie',
    reviewTargetType: 'movie',
  });

export const createMatchedMediaSnapshot = (
  media: MediaSummary,
  fetchedAt = new Date(),
  policy: MovieCachePolicy = defaultMovieCachePolicy
): ReviewMediaSnapshot => {
  const { catalogDataRetention, ...mediaFields } = media;
  return {
    ...mediaFields,
    matchStatus: 'matched',
    catalogDataRetention:
      readCatalogDataRetention(catalogDataRetention) ??
      policy.createWindow(fetchedAt),
  };
};

/** @deprecated Prefer createMatchedMediaSnapshot for new code. */
export const createMatchedMovieSnapshot = (
  movie: Omit<MediaSummary, 'mediaType' | 'reviewTargetType'>,
  fetchedAt = new Date(),
  policy: MovieCachePolicy = defaultMovieCachePolicy
) =>
  createMatchedMediaSnapshot(
    { ...movie, mediaType: 'movie', reviewTargetType: 'movie' },
    fetchedAt,
    policy
  );

export const readCatalogDataRetention = (
  value: unknown
): CatalogDataRetention | undefined => {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.fetchedAt !== 'string' ||
    typeof candidate.refreshAfter !== 'string' ||
    typeof candidate.expiresAt !== 'string'
  ) {
    return undefined;
  }

  const fetchedAt = new Date(candidate.fetchedAt).getTime();
  const refreshAfter = new Date(candidate.refreshAfter).getTime();
  const expiresAt = new Date(candidate.expiresAt).getTime();
  if (
    !Number.isFinite(fetchedAt) ||
    !Number.isFinite(refreshAfter) ||
    !Number.isFinite(expiresAt) ||
    refreshAfter <= fetchedAt ||
    expiresAt <= refreshAfter
  ) {
    return undefined;
  }

  return {
    fetchedAt: new Date(fetchedAt).toISOString(),
    refreshAfter: new Date(refreshAfter).toISOString(),
    expiresAt: new Date(expiresAt).toISOString(),
  };
};

const readReviewMediaTarget = (
  candidate: Record<string, unknown>
): ReviewMediaTarget =>
  candidate.mediaType === 'tv' && candidate.reviewTargetType === 'series'
    ? { mediaType: 'tv', reviewTargetType: 'series' }
    : { mediaType: 'movie', reviewTargetType: 'movie' };

export const readReviewMediaSnapshot = (
  value: unknown,
  fallbackTitle: string
): ReviewMediaSnapshot => {
  if (!value || typeof value !== 'object') {
    return createManualMovieSnapshot(fallbackTitle);
  }

  const candidate = value as Record<string, unknown>;
  const reviewTarget = readReviewMediaTarget(candidate);
  const title =
    typeof candidate.title === 'string' && candidate.title.trim()
      ? candidate.title.trim()
      : fallbackTitle.trim();
  const releaseYear =
    typeof candidate.releaseYear === 'number' &&
    Number.isInteger(candidate.releaseYear)
      ? candidate.releaseYear
      : null;
  const genres = Array.isArray(candidate.genres)
    ? candidate.genres.filter(
        (genre): genre is string => typeof genre === 'string'
      )
    : [];
  const posterUrl =
    typeof candidate.posterUrl === 'string' ? candidate.posterUrl : null;

  if (
    candidate.matchStatus === 'matched' &&
    typeof candidate.catalogId === 'string' &&
    candidate.catalogId
  ) {
    return {
      ...reviewTarget,
      matchStatus: 'matched',
      catalogId: candidate.catalogId,
      title,
      releaseYear,
      genres,
      posterUrl,
      catalogDataRetention: readCatalogDataRetention(
        candidate.catalogDataRetention
      ),
    };
  }

  return {
    ...reviewTarget,
    matchStatus: 'manual',
    catalogId: null,
    title,
    releaseYear,
    genres,
    posterUrl,
  };
};

/** @deprecated Prefer readReviewMediaSnapshot for new code. */
export const readReviewMovieSnapshot = readReviewMediaSnapshot;

export const isReviewCatalogDataExpired = (
  movie: ReviewMediaSnapshot | undefined,
  currentTime = new Date()
) => {
  if (!movie || movie.matchStatus === 'manual') {
    return false;
  }

  const expiresAt = movie.catalogDataRetention?.expiresAt;
  if (!expiresAt) {
    return true;
  }

  const expirationTime = new Date(expiresAt).getTime();
  return (
    !Number.isFinite(expirationTime) ||
    expirationTime <= currentTime.getTime()
  );
};

export const isReviewCatalogDataRefreshDue = (
  movie: ReviewMediaSnapshot | undefined,
  currentTime = new Date()
) => {
  if (!movie || movie.matchStatus === 'manual') {
    return false;
  }

  const refreshAfter = movie.catalogDataRetention?.refreshAfter;
  if (!refreshAfter) {
    return true;
  }

  const refreshTime = new Date(refreshAfter).getTime();
  return (
    !Number.isFinite(refreshTime) || refreshTime <= currentTime.getTime()
  );
};

export const getDisplayReviewMovie = (
  movie: ReviewMediaSnapshot | undefined,
  currentTime = new Date()
): ReviewMediaSnapshot | undefined => {
  if (!movie || movie.matchStatus === 'manual') {
    return movie;
  }
  if (!isReviewCatalogDataExpired(movie, currentTime)) {
    return movie;
  }

  return {
    ...(movie.mediaType === 'tv'
      ? ({ mediaType: 'tv', reviewTargetType: 'series' } as const)
      : ({ mediaType: 'movie', reviewTargetType: 'movie' } as const)),
    matchStatus: 'matched',
    catalogId: movie.catalogId,
    title: UNAVAILABLE_MOVIE_TITLE,
    releaseYear: null,
    genres: [],
    posterUrl: null,
    catalogDataRetention: movie.catalogDataRetention,
  };
};

export const getDisplayReviewMovieTitle = (
  review: Pick<Review, 'movie' | 'movieTitle'>,
  currentTime = new Date()
) =>
  isReviewCatalogDataExpired(review.movie, currentTime)
    ? UNAVAILABLE_MOVIE_TITLE
    : review.movieTitle;

export const getDisplayReviewMovieMetadata = (
  review: Pick<Review, 'movie'>,
  currentTime = new Date()
): string | null => {
  const movie = getDisplayReviewMovie(review.movie, currentTime);
  if (!movie) {
    return null;
  }

  const metadata = [
    movie.releaseYear === null ? null : String(movie.releaseYear),
    movie.genres.length > 0 ? movie.genres.join(', ') : null,
  ].filter((value): value is string => Boolean(value));

  return metadata.length > 0 ? metadata.join(' · ') : null;
};

export const redactExpiredReviewCatalogData = <T extends Review>(
  review: T,
  currentTime = new Date()
): T => {
  const displayMovie = getDisplayReviewMovie(review.movie, currentTime);
  if (displayMovie === review.movie) {
    return review;
  }
  if (
    review.movieTitle === UNAVAILABLE_MOVIE_TITLE &&
    review.movie?.title === UNAVAILABLE_MOVIE_TITLE &&
    review.movie.releaseYear === null &&
    review.movie.genres.length === 0 &&
    review.movie.posterUrl === null
  ) {
    return review;
  }

  return {
    ...review,
    movieTitle: UNAVAILABLE_MOVIE_TITLE,
    movie: displayMovie,
  };
};
