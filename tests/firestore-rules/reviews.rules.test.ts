import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import {
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import {
  clientDb,
  createRulesTestEnvironment,
  profile,
  relationship,
  review,
  seed,
} from './helpers';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

describe('Firestore review visibility rules', () => {
  let testEnvironment: RulesTestEnvironment;

  beforeAll(async () => {
    testEnvironment = await createRulesTestEnvironment();
  });

  beforeEach(async () => {
    await testEnvironment.clearFirestore();
    await seed(testEnvironment, 'users/author', profile({ handle: 'author', handleNormalized: 'author', accountPrivacy: 'private' }));
    await seed(testEnvironment, 'users/active', profile({ handle: 'active', handleNormalized: 'active' }));
    await seed(testEnvironment, 'users/pending', profile({ handle: 'pending', handleNormalized: 'pending' }));
    await seed(testEnvironment, 'users/other', profile({ handle: 'other', handleNormalized: 'other' }));
    await seed(testEnvironment, 'followRelationships/author/followers/active', relationship('active', 'author', 'active'));
    await seed(testEnvironment, 'followRelationships/author/followers/pending', relationship('pending', 'author', 'pending'));
    await seed(testEnvironment, 'reviews/public', review('author', 'public'));
    await seed(testEnvironment, 'reviews/followers', review('author', 'followers'));
    await seed(testEnvironment, 'reviews/private', review('author', 'private'));
  });

  afterAll(async () => {
    await testEnvironment.cleanup();
  });

  it('allows public reviews from a private account to every signed-in user', async () => {
    await assertSucceeds(getDoc(doc(clientDb(testEnvironment, 'other'), 'reviews', 'public')));
  });

  it('allows followers-only reviews only to the owner and active followers', async () => {
    await assertSucceeds(getDoc(doc(clientDb(testEnvironment, 'author'), 'reviews', 'followers')));
    await assertSucceeds(getDoc(doc(clientDb(testEnvironment, 'active'), 'reviews', 'followers')));
    await assertFails(getDoc(doc(clientDb(testEnvironment, 'pending'), 'reviews', 'followers')));
    await assertFails(getDoc(doc(clientDb(testEnvironment, 'other'), 'reviews', 'followers')));
  });

  it('allows only the owner to read only-me reviews', async () => {
    await assertSucceeds(getDoc(doc(clientDb(testEnvironment, 'author'), 'reviews', 'private')));
    await assertFails(getDoc(doc(clientDb(testEnvironment, 'active'), 'reviews', 'private')));
  });

  it('enforces review ownership for creates and updates', async () => {
    await assertSucceeds(setDoc(doc(clientDb(testEnvironment, 'author'), 'reviews', 'new'), review('author', 'public')));
    await assertFails(setDoc(doc(clientDb(testEnvironment, 'other'), 'reviews', 'forged'), review('author', 'public')));
    await assertFails(setDoc(doc(clientDb(testEnvironment, 'other'), 'reviews', 'public'), review('other', 'public')));
  });

  it('authorizes the public-profile public-review query shape', async () => {
    await assertSucceeds(
      getDocs(query(collection(clientDb(testEnvironment, 'other'), 'reviews'), where('userId', '==', 'author'), where('visibility', '==', 'public')))
    );
  });

  it('authorizes public-profile followers-only and paginated query shapes for an active follower', async () => {
    const reviews = collection(clientDb(testEnvironment, 'active'), 'reviews');
    await assertSucceeds(
      getDocs(
        query(
          reviews,
          where('userId', '==', 'author'),
          where('visibility', '==', 'followers')
        )
      )
    );
    await assertSucceeds(
      getDocs(
        query(
          reviews,
          where('userId', '==', 'author'),
          where('visibility', 'in', ['public', 'followers']),
          orderBy('createdAt', 'desc'),
          orderBy(documentId(), 'desc'),
          limit(11)
        )
      )
    );
  });
});
