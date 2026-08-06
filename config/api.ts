const defaultApiBaseUrl = 'http://127.0.0.1:3000';

export const apiBaseUrl = (
  process.env.EXPO_PUBLIC_API_BASE_URL ?? defaultApiBaseUrl
).replace(/\/$/, '');
