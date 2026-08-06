import {
  beginCommunitySessionForUser,
  consumeCommunityPreferenceUpdate,
  getCurrentCommunityPreferences,
  getCommunityScrollOffset,
  publishCommunityPreferenceUpdate,
  setCommunityScrollOffset,
} from '@/services/community/communitySessionState';

describe('Community session state', () => {
  it('keeps scroll position for the active account but clears it when accounts change', () => {
    beginCommunitySessionForUser('user-1');
    setCommunityScrollOffset('user-1', 320);

    beginCommunitySessionForUser('user-1');
    expect(getCommunityScrollOffset('user-1')).toBe(320);

    beginCommunitySessionForUser('user-2');
    expect(getCommunityScrollOffset('user-1')).toBe(0);
    expect(getCommunityScrollOffset('user-2')).toBe(0);
  });

  it('publishes a saved preference update without leaking it to another account', () => {
    beginCommunitySessionForUser('user-1');
    setCommunityScrollOffset('user-1', 320);
    publishCommunityPreferenceUpdate('user-1', {
      mediaFilter: 'movie',
      sort: 'highest',
    });

    expect(getCurrentCommunityPreferences('user-1')).toEqual({
      mediaFilter: 'movie',
      sort: 'highest',
    });
    expect(getCommunityScrollOffset('user-1')).toBe(0);
    expect(consumeCommunityPreferenceUpdate('user-1')).toEqual({
      mediaFilter: 'movie',
      sort: 'highest',
    });

    beginCommunitySessionForUser('user-2');
    expect(getCurrentCommunityPreferences('user-1')).toBeNull();
    expect(consumeCommunityPreferenceUpdate('user-1')).toBeNull();
  });
});
