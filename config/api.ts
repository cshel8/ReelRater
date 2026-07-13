const defaultApiBaseUrl = 'http://reelrater-alb-1439476693.us-east-1.elb.amazonaws.com';

export const apiBaseUrl = (
  process.env.EXPO_PUBLIC_API_BASE_URL ?? defaultApiBaseUrl
).replace(/\/$/, '');
