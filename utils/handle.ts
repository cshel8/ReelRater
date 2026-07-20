const HANDLE_PATTERN = /^[A-Za-z0-9_]{3,20}$/;

export function formatHandle(value: string): string {
  return value.trim().replace(/^@/, '');
}

export function normalizeHandle(value: string): string {
  return formatHandle(value).toLowerCase();
}

export function isValidHandle(value: string): boolean {
  return HANDLE_PATTERN.test(formatHandle(value));
}
