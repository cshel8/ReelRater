import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  doc,
  setDoc,
} from 'firebase/firestore';

export const RULES_TEST_PROJECT = 'reelrater-rules-test';

export async function createRulesTestEnvironment() {
  return initializeTestEnvironment({
    projectId: RULES_TEST_PROJECT,
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
    },
  });
}

export async function seed(
  testEnvironment: RulesTestEnvironment,
  path: string,
  data: Record<string, unknown>
) {
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), path), data);
  });
}

export const profile = (
  overrides: Record<string, unknown> = {}
): Record<string, unknown> => ({
  displayName: 'Example User',
  handle: 'exampleuser',
  handleNormalized: 'exampleuser',
  accountPrivacy: 'public',
  profileImage: null,
  createdAt: new Date('2026-08-11T00:00:00.000Z'),
  followerCount: 0,
  followingCount: 0,
  ...overrides,
});

export const relationship = (
  followerId: string,
  followedUserId: string,
  status: 'active' | 'pending'
) => ({
  followerId,
  followedUserId,
  status,
  createdAt: new Date('2026-08-11T00:00:00.000Z'),
  acceptedAt: status === 'active' ? new Date('2026-08-11T00:00:00.000Z') : null,
});

export const review = (
  userId: string,
  visibility: 'public' | 'followers' | 'private'
) => ({
  userId,
  movieTitle: 'Arrival',
  movie: null,
  reviewText: 'Thoughtful science fiction.',
  rating: '5',
  visibility,
  createdAt: new Date('2026-08-11T00:00:00.000Z'),
});

export const clientDb = (testEnvironment: RulesTestEnvironment, userId?: string) =>
  userId
    ? testEnvironment.authenticatedContext(userId).firestore()
    : testEnvironment.unauthenticatedContext().firestore();
