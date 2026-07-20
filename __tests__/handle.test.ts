import { formatHandle, isValidHandle, normalizeHandle } from '@/utils/handle';

describe('handle utilities', () => {
  it('preserves display capitalization and removes a leading @', () => {
    expect(formatHandle(' @ConnorMovies ')).toBe('ConnorMovies');
  });

  it('normalizes handles for case-insensitive uniqueness', () => {
    expect(normalizeHandle('ConnorMovies')).toBe('connormovies');
  });

  it('accepts only supported handle characters and lengths', () => {
    expect(isValidHandle('Connor_123')).toBe(true);
    expect(isValidHandle('no spaces')).toBe(false);
    expect(isValidHandle('ab')).toBe(false);
  });
});
