import { apiBaseUrl } from '@/config/api';

export type HealthStatus = {
  ok: boolean;
  app: string;
  served_by: string;
  time: string;
};

export const healthService = {
  async get(): Promise<HealthStatus> {
    const response = await fetch(`${apiBaseUrl}/health`, {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Health check failed with status ${response.status}`);
    }

    return response.json();
  },
};
