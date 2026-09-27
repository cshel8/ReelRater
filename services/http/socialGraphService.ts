import { apiBaseUrl } from '@/config/api';
import { firebaseAuthService } from '@/services/firebase/authService';
import type { SocialGraphInitializationService } from '@/services/contracts';

async function authorizedRequest(path: string, method: 'POST' | 'DELETE', body?: unknown) {
  const accessToken = await firebaseAuthService.getAccessToken();
  if (!accessToken) {
    throw new Error('Sign in again before changing follow relationships.');
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (response.ok) {
    return;
  }

  try {
    const body = (await response.json()) as { error?: { message?: unknown } };
    if (typeof body.error?.message === 'string') {
      throw new Error(body.error.message);
    }
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
  }
  throw new Error(`Social request failed with status ${response.status}.`);
}

export const httpSocialGraphInitializationService: SocialGraphInitializationService = {
  async initializeCounters(userId) {
    // The server derives the actor from the ID token. The argument is retained
    // so signup can verify it is initializing the just-created account.
    const accessToken = await firebaseAuthService.getAccessToken();
    if (!accessToken) {
      throw new Error('Sign in again before completing your profile.');
    }
    const response = await fetch(`${apiBaseUrl}/api/v1/social/counters`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (!response.ok) {
      throw new Error('Unable to initialize your social profile.');
    }
    void userId;
  },
};

export const httpSocialGraphMutations = {
  async relationshipStatuses(userIds: string[]) {
    if (userIds.length === 0) return {} as Record<string, 'active' | 'pending' | null>;
    const accessToken = await firebaseAuthService.getAccessToken();
    if (!accessToken) throw new Error('Sign in again before loading relationship status.');
    const response = await fetch(`${apiBaseUrl}/api/v1/social/relationship-statuses`, {
      method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ userIds }),
    });
    if (!response.ok) throw new Error(`Unable to load relationship status (${response.status}).`);
    const body = await response.json() as { statuses?: Record<string, unknown> };
    return Object.fromEntries(Object.entries(body.statuses ?? {}).map(([id, status]) => [id, status === 'active' || status === 'pending' ? status : null]));
  },
  follow(followedUserId: string) {
    return authorizedRequest(
      `/api/v1/social/follows/${encodeURIComponent(followedUserId)}`,
      'POST'
    );
  },
  unfollow(followedUserId: string) {
    return authorizedRequest(
      `/api/v1/social/follows/${encodeURIComponent(followedUserId)}`,
      'DELETE'
    );
  },
  removeFollower(followerId: string) {
    return authorizedRequest(
      `/api/v1/social/followers/${encodeURIComponent(followerId)}`,
      'DELETE'
    );
  },
  approveFollower(followerId: string) {
    return authorizedRequest(
      `/api/v1/social/follow-requests/${encodeURIComponent(followerId)}/approve`,
      'POST'
    );
  },
  rejectFollower(followerId: string) {
    return authorizedRequest(
      `/api/v1/social/follow-requests/${encodeURIComponent(followerId)}`,
      'DELETE'
    );
  },
};
