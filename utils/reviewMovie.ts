import type {
  CatalogDataRetention,
  MovieSummary,
  Review,
  ReviewMovieSnapshot,
} from '@/types/domain';
import {
  defaultMovieCachePolicy,
  type MovieCachePolicy,
} from '@/services/movies/movieCachePolicy';

export const UNAVAILABLE_MOVIE_TITLE = 'Movie details temporarily unavailable';

export const createManualMovieSnapshot = (
  title: string
): ReviewMovieSnapshot => ({
  matchStatus: 'manual',
  catalogId: null,
  title: title.trim(),
  releaseYear: null,
  genres: [],
  posterUrl: null,
});

export const createMatchedMovieSnapshot = (
  movie: MovieSummary,
  fetchedAt = new Date(),
  policy: MovieCachePolicy = defaultMovieCachePolicy
): ReviewMovieSnapshot => {
  const { catalogDataRetention, ...movieFields } = movie;
  return {
    ...movieFields,
    matchStatus: 'matched',
    catalogDataRetention:
      readCatalogDataRetention(catalogDataRetention) ??
      policy.createWindow(fetchedAt),
  };
};

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

export const readReviewMovieSnapshot = (
  value: unknown,
  fallbackTitle: string
): ReviewMovieSnapshot => {
  if (!value || typeof value !== 'object') {
    return createManualMovieSnapshot(fallbackTitle);
  }

  const candidate = value as Record<string, unknown>;
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
    matchStatus: 'manual',
    catalogId: null,
    title,
    releaseYear,
    genres,
    posterUrl,
  };
};

export const isReviewCatalogDataExpired = (
  movie: ReviewMovieSnapshot | undefined,
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
  movie: ReviewMovieSnapshot | undefined,
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
  movie: ReviewMovieSnapshot | undefined,
  currentTime = new Date()
): ReviewMovieSnapshot | undefined => {
  if (!movie || movie.matchStatus === 'manual') {
    return movie;
  }
  if (!isReviewCatalogDataExpired(movie, currentTime)) {
    return movie;
  }

  return {
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
