import { createCommunityCacheLifecycleService } from '@/services/community/communityCacheLifecycleService';
import { createLifecycleAwareFollowService } from '@/services/community/lifecycleAwareFollowService';
import { createLifecycleAwareAuthService } from '@/services/community/lifecycleAwareAuthService';
import {
  beginCommunitySessionForUser,
  isFollowingAuthorInvalidatedForSession,
} from '@/services/community/communitySessionState';
import type { AuthService, FollowService } from '@/services/contracts';
import type { CommunityCacheRepository } from '@/services/local/communityCacheTypes';

function setup() {
  const cache = {
    invalidateFollowingAuthor: jest.fn(),
    clearForViewer: jest.fn(),
  } as unknown as jest.Mocked<CommunityCacheRepository>;
  const lifecycle = createCommunityCacheLifecycleService(cache);
  return { cache, lifecycle };
}

describe('Community cache lifecycle service', () => {
  beforeEach(() => beginCommunitySessionForUser(null));

  it('invalidates only after a successful self-unfollow and fails closed if local cleanup fails', async () => {
    const { cache, lifecycle } = setup();
    const remote = { unfollow: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<FollowService>;
    cache.invalidateFollowingAuthor.mockRejectedValue(new Error('SQLite unavailable'));
    const followService = createLifecycleAwareFollowService(remote, lifecycle);
    beginCommunitySessionForUser('viewer-a');

    await expect(followService.unfollow('viewer-a', 'maya')).resolves.toBeUndefined();
    expect(cache.invalidateFollowingAuthor).toHaveBeenCalledWith('viewer-a', 'maya');
    expect(isFollowingAuthorInvalidatedForSession('viewer-a', 'maya')).toBe(true);
  });

  it('does not invalidate cache when remote unfollow fails', async () => {
    const { cache, lifecycle } = setup();
    const remote = { unfollow: jest.fn().mockRejectedValue(new Error('Request failed')) } as unknown as jest.Mocked<FollowService>;
    const followService = createLifecycleAwareFollowService(remote, lifecycle);
    beginCommunitySessionForUser('viewer-a');

    await expect(followService.unfollow('viewer-a', 'maya')).rejects.toThrow('Request failed');
    expect(cache.invalidateFollowingAuthor).not.toHaveBeenCalled();
    expect(isFollowingAuthorInvalidatedForSession('viewer-a', 'maya')).toBe(false);
  });

  it('does not purge the viewer cache when removing somebody else as a follower', async () => {
    const { cache, lifecycle } = setup();
    const remote = { removeFollower: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<FollowService>;
    const followService = createLifecycleAwareFollowService(remote, lifecycle);

    await followService.removeFollower('viewer-a', 'other-user');
    expect(cache.invalidateFollowingAuthor).not.toHaveBeenCalled();
  });

  it('clears only the signed-out viewer after successful sign-out', async () => {
    const { cache, lifecycle } = setup();
    const remote = { signOut: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<AuthService>;
    const authService = createLifecycleAwareAuthService(remote, lifecycle);

    await authService.signOut('viewer-a');
    expect(remote.signOut).toHaveBeenCalledWith();
    expect(cache.clearForViewer).toHaveBeenCalledWith('viewer-a');
    expect(cache.clearForViewer).not.toHaveBeenCalledWith('viewer-b');
  });

  it('does not prevent sign-out when local Community cleanup fails', async () => {
    const { cache, lifecycle } = setup();
    const remote = { signOut: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<AuthService>;
    cache.clearForViewer.mockRejectedValue(new Error('SQLite unavailable'));
    const authService = createLifecycleAwareAuthService(remote, lifecycle);

    await expect(authService.signOut('viewer-a')).resolves.toBeUndefined();
    expect(remote.signOut).toHaveBeenCalled();
  });
});
