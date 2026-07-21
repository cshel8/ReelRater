import {
  InvalidMovieCatalogIdError,
  InvalidMovieCursorError,
  MovieCatalogUpstreamError,
  type MovieCatalogService,
  type MovieDetails,
  type MovieSearchOptions,
  type MovieSearchPage,
  type MovieSummary,
} from './types.js';

type FetchImplementation = typeof fetch;

type TmdbSearchMovie = {
  id: number;
  title: string;
  release_date?: string;
  genre_ids?: number[];
  poster_path?: string | null;
};

type TmdbSearchResponse = {
  page: number;
  results: TmdbSearchMovie[];
  total_pages: number;
};

type TmdbMovieDetails = TmdbSearchMovie & {
  overview?: string | null;
  genres?: { id: number; name: string }[];
};

type TmdbConfiguration = {
  images: {
    secure_base_url: string;
    poster_sizes: string[];
  };
};

type TmdbGenreResponse = {
  genres: { id: number; name: string }[];
};

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const CATALOG_ID_PREFIX = 'tmdb:';

const getReleaseYear = (releaseDate?: string) => {
  const year = releaseDate?.slice(0, 4);
  return year && /^\d{4}$/.test(year) ? Number.parseInt(year, 10) : null;
};

const encodeCursor = (page: number) =>
  Buffer.from(JSON.stringify({ page }), 'utf8').toString('base64url');

const decodeCursor = (cursor?: string) => {
  if (!cursor) {
    return 1;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf8')
    ) as { page?: unknown };
    if (
      typeof parsed.page !== 'number' ||
      !Number.isInteger(parsed.page) ||
      parsed.page < 1
    ) {
      throw new Error('Invalid page');
    }
    return parsed.page;
  } catch {
    throw new InvalidMovieCursorError('Invalid movie search cursor');
  }
};

const parseCatalogId = (catalogId: string) => {
  if (!catalogId.startsWith(CATALOG_ID_PREFIX)) {
    throw new InvalidMovieCatalogIdError('Unsupported movie catalog ID');
  }

  const rawId = catalogId.slice(CATALOG_ID_PREFIX.length);
  if (!/^\d+$/.test(rawId)) {
    throw new InvalidMovieCatalogIdError('Invalid movie catalog ID');
  }
  const id = Number.parseInt(rawId, 10);
  if (!Number.isSafeInteger(id) || id < 1) {
    throw new InvalidMovieCatalogIdError('Invalid movie catalog ID');
  }
  return id;
};

export class TmdbMovieCatalog implements MovieCatalogService {
  private configurationPromise: Promise<TmdbConfiguration> | null = null;
  private genresPromise: Promise<Map<number, string>> | null = null;

  constructor(
    private readonly accessToken: string,
    private readonly fetchImplementation: FetchImplementation = fetch
  ) {}

  async search(
    query: string,
    options: MovieSearchOptions = {}
  ): Promise<MovieSearchPage> {
    const page = decodeCursor(options.cursor);
    const maximumResults = Math.min(
      20,
      Math.max(1, options.maximumResults ?? 20)
    );
    const [response, configuration, genres] = await Promise.all([
      this.request<TmdbSearchResponse>('/search/movie', {
        query,
        page: String(page),
        include_adult: 'false',
        language: 'en-US',
      }),
      this.getConfiguration(),
      this.getGenres(),
    ]);

    return {
      movies: response.results
        .slice(0, maximumResults)
        .map((movie) => this.toSummary(movie, configuration, genres)),
      nextCursor:
        response.page < response.total_pages
          ? encodeCursor(response.page + 1)
          : null,
    };
  }

  async getById(catalogId: string): Promise<MovieDetails | null> {
    const movieId = parseCatalogId(catalogId);
    const [movie, configuration] = await Promise.all([
      this.request<TmdbMovieDetails | null>(
        `/movie/${movieId}`,
        { language: 'en-US' },
        true
      ),
      this.getConfiguration(),
    ]);

    if (!movie) {
      return null;
    }

    return {
      catalogId: `${CATALOG_ID_PREFIX}${movie.id}`,
      title: movie.title,
      releaseYear: getReleaseYear(movie.release_date),
      genres: movie.genres?.map((genre) => genre.name) ?? [],
      posterUrl: this.posterUrl(movie.poster_path, configuration),
      overview: movie.overview?.trim() || null,
    };
  }

  private getConfiguration() {
    this.configurationPromise ??=
      this.request<TmdbConfiguration>('/configuration');
    return this.configurationPromise;
  }

  private getGenres() {
    this.genresPromise ??= this.request<TmdbGenreResponse>(
      '/genre/movie/list',
      { language: 'en-US' }
    ).then(
      (response) =>
        new Map(response.genres.map((genre) => [genre.id, genre.name]))
    );
    return this.genresPromise;
  }

  private toSummary(
    movie: TmdbSearchMovie,
    configuration: TmdbConfiguration,
    genres: Map<number, string>
  ): MovieSummary {
    return {
      catalogId: `${CATALOG_ID_PREFIX}${movie.id}`,
      title: movie.title,
      releaseYear: getReleaseYear(movie.release_date),
      genres: (movie.genre_ids ?? [])
        .map((genreId) => genres.get(genreId))
        .filter((genre): genre is string => Boolean(genre)),
      posterUrl: this.posterUrl(movie.poster_path, configuration),
    };
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
