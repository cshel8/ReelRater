import { afterAll, beforeAll, beforeEach, describe, it } from '@jest/globals';
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  clientDb,
  createRulesTestEnvironment,
  profile,
  relationship,
  seed,
} from './helpers';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

describe('Firestore social-graph rules and Community query shapes', () => {
  let testEnvironment: RulesTestEnvironment;

  beforeAll(async () => {
    testEnvironment = await createRulesTestEnvironment();
  });

  beforeEach(async () => {
    await testEnvironment.clearFirestore();
    await seed(testEnvironment, 'users/public-owner', profile({ handle: 'publicowner', handleNormalized: 'publicowner' }));
    await seed(testEnvironment, 'users/private-owner', profile({ handle: 'privateowner', handleNormalized: 'privateowner', accountPrivacy: 'private' }));
    await seed(testEnvironment, 'users/active-viewer', profile({ handle: 'activeviewer', handleNormalized: 'activeviewer' }));
    await seed(testEnvironment, 'users/pending-viewer', profile({ handle: 'pendingviewer', handleNormalized: 'pendingviewer' }));
    await seed(testEnvironment, 'users/unrelated', profile({ handle: 'unrelated', handleNormalized: 'unrelated' }));

    await seed(testEnvironment, 'followRelationships/public-owner/followers/active-viewer', relationship('active-viewer', 'public-owner', 'active'));
    await seed(testEnvironment, 'followRelationships/public-owner/followers/pending-viewer', relationship('pending-viewer', 'public-owner', 'pending'));
    await seed(testEnvironment, 'followRelationships/private-owner/followers/active-viewer', relationship('active-viewer', 'private-owner', 'active'));
    await seed(testEnvironment, 'followRelationships/private-owner/followers/pending-viewer', relationship('pending-viewer', 'private-owner', 'pending'));
    await seed(testEnvironment, 'followRelationships/active-viewer/followers/private-owner', relationship('private-owner', 'active-viewer', 'active'));
    await seed(testEnvironment, 'followRelationships/public-owner/followers/active-pending', relationship('active-viewer', 'public-owner', 'pending'));
  });

  afterAll(async () => {
    await testEnvironment.cleanup();
  });

  const followersQuery = (userId: string, followedUserId: string) =>
    query(
      collection(clientDb(testEnvironment, userId), 'followRelationships', followedUserId, 'followers'),
      where('status', '==', 'active')
    );

  const followingQuery = (userId: string, followerId: string) =>
    query(
      collectionGroup(clientDb(testEnvironment, userId), 'followers'),
      where('followerId', '==', followerId),
      where('status', '==', 'active')
    );

  it('denies every direct client follow mutation', async () => {
    const relationshipPath = doc(
      clientDb(testEnvironment, 'active-viewer'),
      'followRelationships',
      'public-owner',
      'followers',
      'active-viewer'
    );
    await assertFails(setDoc(relationshipPath, relationship('active-viewer', 'public-owner', 'active')));
    await assertFails(updateDoc(relationshipPath, { status: 'pending' }));
    await assertFails(deleteDoc(relationshipPath));
  });

  it('allows public followers/following lists to signed-in users', async () => {
    await assertSucceeds(getDocs(followersQuery('unrelated', 'public-owner')));
    await assertSucceeds(getDocs(followingQuery('unrelated', 'public-owner')));
  });

  it('allows private social lists only to the owner and active followers', async () => {
    await assertSucceeds(getDocs(followersQuery('private-owner', 'private-owner')));
    await assertSucceeds(getDocs(followersQuery('active-viewer', 'private-owner')));
    await assertFails(getDocs(followersQuery('pending-viewer', 'private-owner')));
    await assertFails(getDocs(followersQuery('unrelated', 'private-owner')));

    await assertSucceeds(getDocs(followingQuery('private-owner', 'private-owner')));
    await assertSucceeds(getDocs(followingQuery('active-viewer', 'private-owner')));
    await assertFails(getDocs(followingQuery('pending-viewer', 'private-owner')));
    await assertFails(getDocs(followingQuery('unrelated', 'private-owner')));
  });

  it('authorizes Community’s exact active-only following query and excludes pending relationships', async () => {
    const snapshot = await assertSucceeds(
      getDocs(followingQuery('active-viewer', 'active-viewer'))
    );
    expect(snapshot.docs).toHaveLength(2);
    expect(snapshot.docs.every((relationshipDocument) => relationshipDocument.data().status === 'active')).toBe(true);

    await assertFails(
      getDocs(
        query(
          collectionGroup(clientDb(testEnvironment, 'active-viewer'), 'followers'),
          where('followerId', '==', 'active-viewer')
        )
      )
    );
  });
});
