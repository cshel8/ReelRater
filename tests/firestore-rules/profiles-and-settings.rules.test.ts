import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import {
  clientDb,
  createRulesTestEnvironment,
  profile,
  RULES_TEST_PROJECT,
  seed,
} from './helpers';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

describe('Firestore profile and settings rules', () => {
  let testEnvironment: RulesTestEnvironment;

  beforeAll(async () => {
    testEnvironment = await createRulesTestEnvironment();
  });

  beforeEach(async () => {
    await testEnvironment.clearFirestore();
    await seed(testEnvironment, 'users/owner', profile({ handle: 'owner', handleNormalized: 'owner' }));
  });

  afterAll(async () => {
    await testEnvironment.cleanup();
  });

  it('denies anonymous profile reads and allows signed-in basic-profile reads', async () => {
    await assertFails(getDoc(doc(clientDb(testEnvironment), 'users', 'owner')));
    await assertSucceeds(getDoc(doc(clientDb(testEnvironment, 'viewer'), 'users', 'owner')));
  });

  it('allows only the owner to update allowed profile fields and blocks counter writes', async () => {
    await assertSucceeds(
      updateDoc(doc(clientDb(testEnvironment, 'owner'), 'users', 'owner'), {
        displayName: 'Updated Owner',
      })
    );
    await assertFails(
      updateDoc(doc(clientDb(testEnvironment, 'viewer'), 'users', 'owner'), {
        displayName: 'Not allowed',
      })
    );
    await assertFails(
      updateDoc(doc(clientDb(testEnvironment, 'owner'), 'users', 'owner'), {
        followerCount: 500,
      })
    );
    await assertFails(
      updateDoc(doc(clientDb(testEnvironment, 'owner'), 'users', 'owner'), {
        followingCount: 500,
      })
    );
  });

  it('allows an owner to create the approved profile shape but denies unexpected fields', async () => {
    await seed(testEnvironment, 'handles/newowner', {
      userId: 'new-owner',
      handle: 'newowner',
      handleNormalized: 'newowner',
    });
    const valid = {
      displayName: 'New Owner',
      handle: 'newowner',
      handleNormalized: 'newowner',
      accountPrivacy: 'public',
      profileImage: null,
      createdAt: new Date(),
    };
    await assertSucceeds(setDoc(doc(clientDb(testEnvironment, 'new-owner'), 'users', 'new-owner'), valid));
    await seed(testEnvironment, 'handles/invalidowner', {
      userId: 'invalid-owner',
      handle: 'invalidowner',
      handleNormalized: 'invalidowner',
    });
    await assertFails(
      setDoc(doc(clientDb(testEnvironment, 'invalid-owner'), 'users', 'invalid-owner'), {
        ...valid,
        handle: 'invalidowner',
        handleNormalized: 'invalidowner',
        followerCount: 0,
      })
    );
  });

  it('allows only the settings owner to read and write settings', async () => {
    const settings = {
      defaultReviewVisibility: 'private',
      defaultMediaFilter: 'all',
      defaultSort: 'newest',
      updatedAt: serverTimestamp(),
    };
    await assertSucceeds(setDoc(doc(clientDb(testEnvironment, 'owner'), 'userSettings', 'owner'), settings));
    await assertSucceeds(getDoc(doc(clientDb(testEnvironment, 'owner'), 'userSettings', 'owner')));
    await assertFails(getDoc(doc(clientDb(testEnvironment, 'viewer'), 'userSettings', 'owner')));
    await assertFails(setDoc(doc(clientDb(testEnvironment, 'viewer'), 'userSettings', 'owner'), settings));
  });
});

void RULES_TEST_PROJECT;
