import { createAgeBasedMovieCachePolicy } from '@/services/movies/movieCachePolicy';

describe('movie cache policy', () => {
  it('refreshes after 150 days and expires after 179 days', () => {
    const policy = createAgeBasedMovieCachePolicy({
      refreshAfterDays: 150,
      expireAfterDays: 179,
    });

    expect(
      policy.createWindow(new Date('2026-01-01T12:00:00.000Z'))
    ).toEqual({
      fetchedAt: '2026-01-01T12:00:00.000Z',
      refreshAfter: '2026-05-31T12:00:00.000Z',
      expiresAt: '2026-06-29T12:00:00.000Z',
    });
  });

  it('rejects an expiration that does not follow the refresh threshold', () => {
    expect(() =>
      createAgeBasedMovieCachePolicy({
        refreshAfterDays: 150,
        expireAfterDays: 150,
      })
    ).toThrow('Movie cache expiration must be later');
  });
});
