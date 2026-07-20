export function formatReviewDate(value: string): string | null {
  const date = new Date(value);

  if (Number.isNaN(date.getTime()) || date.getFullYear() <= 1970) {
    return null;
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}
