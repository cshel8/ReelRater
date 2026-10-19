import {
  InvalidMovieCatalogIdError,
  InvalidMovieCursorError,
  MovieCatalogUpstreamError,
  type MediaBrowseOptions,
  type MediaCatalogService,
  type MediaDetails,
  type MediaSearchOptions,
  type MediaSearchPage,
  type MediaSummary,
  type MediaTarget,
} from './types.js';

type FetchImplementation = typeof fetch;
type MediaType = MediaTarget['mediaType'];

type TmdbSearchMovie = {
  id: number;
  title: string;
  release_date?: string;
  genre_ids?: number[];
  poster_path?: string | null;
  backdrop_path?: string | null;
};

type TmdbSearchSeries = {
  id: number;
  name: string;
  first_air_date?: string;
  genre_ids?: number[];
  poster_path?: string | null;
  backdrop_path?: string | null;
};

type TmdbSearchResponse<T> = {
  page: number;
  results: T[];
  total_pages: number;
};

type TmdbMovieDetails = TmdbSearchMovie & {
  overview?: string | null;
  genres?: { id: number; name: string }[];
  vote_average?: number;
};

type TmdbSeriesDetails = TmdbSearchSeries & {
  overview?: string | null;
  genres?: { id: number; name: string }[];
  vote_average?: number;
};

type TmdbConfiguration = {
  images: {
    secure_base_url: string;
    poster_sizes: string[];
    backdrop_sizes?: string[];
  };
};

type TmdbGenreResponse = {
  genres: { id: number; name: string }[];
};

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const MOVIE_ID_PREFIX = 'tmdb:movie:';
const TV_ID_PREFIX = 'tmdb:tv:';
const LEGACY_MOVIE_ID_PREFIX = 'tmdb:';

const mediaTarget = (mediaType: MediaType): MediaTarget =>
  mediaType === 'tv'
    ? { mediaType: 'tv', reviewTargetType: 'series' }
    : { mediaType: 'movie', reviewTargetType: 'movie' };

const getYear = (date?: string) => {
  const year = date?.slice(0, 4);
  return year && /^\d{4}$/.test(year) ? Number.parseInt(year, 10) : null;
};

const encodeCursor = (page: number, mediaType: MediaType) =>
  Buffer.from(JSON.stringify({ page, mediaType }), 'utf8').toString(
    'base64url'
  );

const decodeCursor = (cursor: string | undefined, mediaType: MediaType) => {
  if (!cursor) {
    return 1;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf8')
    ) as { page?: unknown; mediaType?: unknown };
    if (
      typeof parsed.page !== 'number' ||
      !Number.isInteger(parsed.page) ||
      parsed.page < 1 ||
      (parsed.mediaType !== undefined && parsed.mediaType !== mediaType)
    ) {
      throw new Error('Invalid cursor');
    }
    return parsed.page;
  } catch {
    throw new InvalidMovieCursorError('Invalid media search cursor');
  }
};

const parseNumericId = (value: string) => {
  if (!/^\d+$/.test(value)) {
    throw new InvalidMovieCatalogIdError('Invalid media catalog ID');
  }
  const id = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(id) || id < 1) {
    throw new InvalidMovieCatalogIdError('Invalid media catalog ID');
  }
  return id;
};

const parseCatalogId = (catalogId: string) => {
  if (catalogId.startsWith(MOVIE_ID_PREFIX)) {
    return {
      mediaType: 'movie' as const,
      id: parseNumericId(catalogId.slice(MOVIE_ID_PREFIX.length)),
    };
  }
  if (catalogId.startsWith(TV_ID_PREFIX)) {
    return {
      mediaType: 'tv' as const,
      id: parseNumericId(catalogId.slice(TV_ID_PREFIX.length)),
    };
  }
  if (catalogId.startsWith(LEGACY_MOVIE_ID_PREFIX)) {
    return {
      mediaType: 'movie' as const,
      id: parseNumericId(catalogId.slice(LEGACY_MOVIE_ID_PREFIX.length)),
    };
  }
  throw new InvalidMovieCatalogIdError('Unsupported media catalog ID');
};

const catalogId = (mediaType: MediaType, id: number) =>
  `${mediaType === 'tv' ? TV_ID_PREFIX : MOVIE_ID_PREFIX}${id}`;

const browseMaximum = (requested: number | undefined) =>
  Math.min(20, Math.max(1, requested ?? 20));

/** TMDB reports 0 for unrated titles; expose those as no rating. */
const toRating = (voteAverage: number | undefined) =>
  typeof voteAverage === 'number' && voteAverage > 0 ? voteAverage : null;

export class TmdbMediaCatalog implements MediaCatalogService {
  private configurationPromise: Promise<TmdbConfiguration> | null = null;
  private readonly genrePromises: Partial<
    Record<MediaType, Promise<Map<number, string>>>
  > = {};

  constructor(
    private readonly accessToken: string,
    private readonly fetchImplementation: FetchImplementation = fetch
  ) {}

  async search(
    query: string,
    options: MediaSearchOptions = {}
  ): Promise<MediaSearchPage> {
    const type = options.mediaType ?? 'movie';
    const page = decodeCursor(options.cursor, type);
    const maximumResults = Math.min(
      20,
      Math.max(1, options.maximumResults ?? 20)
    );
    const [configuration, genres] = await Promise.all([
      this.getConfiguration(),
      this.getGenres(type),
    ]);
    const parameters = {
      query,
      page: String(page),
      include_adult: 'false',
      language: 'en-US',
    };

    let items: MediaSummary[];
    let responsePage: number;
    let totalPages: number;
    if (type === 'tv') {
      const response = await this.request<
        TmdbSearchResponse<TmdbSearchSeries>
      >('/search/tv', parameters);
      items = response.results
        .slice(0, maximumResults)
        .map((series) => this.toSeriesSummary(series, configuration, genres));
      responsePage = response.page;
      totalPages = response.total_pages;
    } else {
      const response = await this.request<TmdbSearchResponse<TmdbSearchMovie>>(
        '/search/movie',
        parameters
      );
      items = response.results
        .slice(0, maximumResults)
        .map((movie) => this.toMovieSummary(movie, configuration, genres));
      responsePage = response.page;
      totalPages = response.total_pages;
    }

    return {
      items,
      nextCursor:
        responsePage < totalPages
          ? encodeCursor(responsePage + 1, type)
          : null,
    };
  }

  async trending(options: MediaBrowseOptions = {}): Promise<MediaSummary[]> {
    const [configuration, genres] = await Promise.all([
      this.getConfiguration(),
      this.getGenres('movie'),
    ]);
    const response = await this.request<TmdbSearchResponse<TmdbSearchMovie>>(
      '/trending/movie/week',
      { language: 'en-US' }
    );
    return response.results
      .slice(0, browseMaximum(options.maximumResults))
      .map((movie) => ({
        ...this.toMovieSummary(movie, configuration, genres),
        backdropUrl: this.backdropUrl(movie.backdrop_path, configuration),
      }));
  }

  async popular(
    mediaType: MediaType,
    options: MediaBrowseOptions = {}
  ): Promise<MediaSummary[]> {
    const [configuration, genres] = await Promise.all([
      this.getConfiguration(),
      this.getGenres(mediaType),
    ]);
    const maximumResults = browseMaximum(options.maximumResults);

    if (mediaType === 'tv') {
      const response = await this.request<TmdbSearchResponse<TmdbSearchSeries>>(
        '/tv/popular',
        { language: 'en-US' }
      );
      return response.results.slice(0, maximumResults).map((series) => ({
        ...this.toSeriesSummary(series, configuration, genres),
        backdropUrl: this.backdropUrl(series.backdrop_path, configuration),
      }));
    }

    const response = await this.request<TmdbSearchResponse<TmdbSearchMovie>>(
      '/movie/popular',
      { language: 'en-US' }
    );
    return response.results.slice(0, maximumResults).map((movie) => ({
      ...this.toMovieSummary(movie, configuration, genres),
      backdropUrl: this.backdropUrl(movie.backdrop_path, configuration),
    }));
  }

  async getById(value: string): Promise<MediaDetails | null> {
    const parsed = parseCatalogId(value);
    const configuration = await this.getConfiguration();

    if (parsed.mediaType === 'tv') {
      const series = await this.request<TmdbSeriesDetails | null>(
        `/tv/${parsed.id}`,
        { language: 'en-US' },
        true
      );
      return series
        ? {
            ...mediaTarget('tv'),
            catalogId: catalogId('tv', series.id),
            title: series.name,
            releaseYear: getYear(series.first_air_date),
            genres: series.genres?.map((genre) => genre.name) ?? [],
            posterUrl: this.posterUrl(series.poster_path, configuration),
            backdropUrl: this.backdropUrl(series.backdrop_path, configuration),
            overview: series.overview?.trim() || null,
            rating: toRating(series.vote_average),
          }
        : null;
    }

    const movie = await this.request<TmdbMovieDetails | null>(
      `/movie/${parsed.id}`,
      { language: 'en-US' },
      true
    );
    return movie
      ? {
          ...mediaTarget('movie'),
          catalogId: catalogId('movie', movie.id),
          title: movie.title,
          releaseYear: getYear(movie.release_date),
          genres: movie.genres?.map((genre) => genre.name) ?? [],
          posterUrl: this.posterUrl(movie.poster_path, configuration),
          backdropUrl: this.backdropUrl(movie.backdrop_path, configuration),
          overview: movie.overview?.trim() || null,
          rating: toRating(movie.vote_average),
        }
      : null;
  }

  private getConfiguration() {
    this.configurationPromise ??=
      this.request<TmdbConfiguration>('/configuration');
    return this.configurationPromise;
  }

  private getGenres(mediaType: MediaType) {
    this.genrePromises[mediaType] ??= this.request<TmdbGenreResponse>(
      `/genre/${mediaType === 'tv' ? 'tv' : 'movie'}/list`,
      { language: 'en-US' }
    ).then(
      (response) =>
        new Map(response.genres.map((genre) => [genre.id, genre.name]))
    );
    return this.genrePromises[mediaType]!;
  }

  private toMovieSummary(
    movie: TmdbSearchMovie,
    configuration: TmdbConfiguration,
    genres: Map<number, string>
  ): MediaSummary {
    return {
      ...mediaTarget('movie'),
      catalogId: catalogId('movie', movie.id),
      title: movie.title,
      releaseYear: getYear(movie.release_date),
      genres: this.genreNames(movie.genre_ids, genres),
      posterUrl: this.posterUrl(movie.poster_path, configuration),
    };
  }

  private toSeriesSummary(
    series: TmdbSearchSeries,
    configuration: TmdbConfiguration,
    genres: Map<number, string>
  ): MediaSummary {
    return {
      ...mediaTarget('tv'),
      catalogId: catalogId('tv', series.id),
      title: series.name,
      releaseYear: getYear(series.first_air_date),
      genres: this.genreNames(series.genre_ids, genres),
      posterUrl: this.posterUrl(series.poster_path, configuration),
    };
  }

  private genreNames(ids: number[] | undefined, genres: Map<number, string>) {
    return (ids ?? [])
      .map((genreId) => genres.get(genreId))
      .filter((genre): genre is string => Boolean(genre));
  }

  private posterUrl(
    posterPath: string | null | undefined,
    configuration: TmdbConfiguration
  ) {
    if (!posterPath) {
      return null;
    }
    const sizes = configuration.images.poster_sizes;
    const size = sizes.includes('w342')
      ? 'w342'
      : sizes.includes('w500')
        ? 'w500'
        : sizes.at(-1);
    return size
      ? `${configuration.images.secure_base_url}${size}${posterPath}`
      : null;
  }

  private backdropUrl(
    backdropPath: string | null | undefined,
    configuration: TmdbConfiguration
  ) {
    const sizes = configuration.images.backdrop_sizes;
    if (!backdropPath || !sizes?.length) {
      return null;
    }
    const size = sizes.includes('w780')
      ? 'w780'
      : sizes.includes('w1280')
        ? 'w1280'
        : sizes.at(-1);
    return size
      ? `${configuration.images.secure_base_url}${size}${backdropPath}`
      : null;
  }

  private async request<T>(
    path: string,
    parameters: Record<string, string> = {},
    returnNullForNotFound = false
  ): Promise<T> {
    const url = new URL(`${TMDB_BASE_URL}${path}`);
    Object.entries(parameters).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });

    const response = await this.fetchImplementation(url, {
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${this.accessToken}`,
      },
    });

    if (returnNullForNotFound && response.status === 404) {
      return null as T;
    }
    if (!response.ok) {
      throw new MovieCatalogUpstreamError(response.status);
    }
    return (await response.json()) as T;
  }
}

/** @deprecated Prefer TmdbMediaCatalog for new code. */
export const TmdbMovieCatalog = TmdbMediaCatalog;
