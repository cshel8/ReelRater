import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createFirebaseAccountDataDeleter } from './firebaseAccountDeletion.js';

type Data = Record<string, unknown>;

class FakeFirestore {
  readonly documents = new Map<string, Data>();

  constructor(entries: Record<string, Data>) {
    for (const [path, data] of Object.entries(entries)) {
      this.documents.set(path, { ...data });
    }
  }

  doc(path: string) {
    return {
      path,
      get: async () => this.snapshot(path),
    };
  }

  collection(path: string) {
    return this.query((documentPath) => {
      const parts = documentPath.split('/');
      return path === 'reviews' || path === 'handles'
        ? parts.length === 2 && parts[0] === path
        : documentPath.startsWith(`${path}/`) && parts.length === path.split('/').length + 1;
    });
  }

  collectionGroup(collectionId: string) {
    return this.query((documentPath) => {
      const parts = documentPath.split('/');
      return parts.length >= 2 && parts.at(-2) === collectionId;
    });
  }

  bulkWriter() {
    return {
      delete: (reference: { path: string }) => this.documents.delete(reference.path),
      close: async () => undefined,
    };
  }

  async runTransaction<T>(operation: (transaction: {
    get(reference: { path: string }): Promise<ReturnType<FakeFirestore['snapshot']>>;
    delete(reference: { path: string }): void;
    update(reference: { path: string }, data: Data): void;
  }) => Promise<T>) {
    return operation({
      get: async (reference) => this.snapshot(reference.path),
      delete: (reference) => {
        this.documents.delete(reference.path);
      },
      update: (reference, data) => {
        const current = this.documents.get(reference.path) ?? {};
        this.documents.set(reference.path, { ...current, ...data });
      },
    });
  }

  private query(matchesPath: (path: string) => boolean) {
    let field: string | null = null;
    let expected: unknown;
    return {
      where: (nextField: string, _operator: string, nextExpected: unknown) => {
        field = nextField;
        expected = nextExpected;
        return {
          get: async () => ({
            docs: [...this.documents.entries()]
              .filter(([path, data]) =>
                matchesPath(path) && (field === null || data[field] === expected)
              )
              .map(([path]) => ({ ref: this.doc(path) })),
          }),
        };
      },
      get: async () => ({
        docs: [...this.documents.entries()]
          .filter(([path]) => matchesPath(path))
          .map(([path]) => ({ ref: this.doc(path) })),
      }),
    };
  }

  private snapshot(path: string) {
    const data = this.documents.get(path);
    return {
      exists: data !== undefined,
      data: () => data,
    };
  }
}

const asAdminFirestore = (firestore: FakeFirestore) =>
  firestore as unknown as FirebaseFirestore.Firestore;

const deleterFor = ({
  authError,
  assetError,
  documents,
}: {
  authError?: unknown;
  assetError?: unknown;
  documents: Record<string, Data>;
}) => {
  const firestore = new FakeFirestore(documents);
  let authDeleteCalls = 0;
  let assetCleanupCalls = 0;
  const deleter = createFirebaseAccountDataDeleter({
    firestore: asAdminFirestore(firestore),
    auth: {
      deleteUser: async () => {
        authDeleteCalls += 1;
        if (authError) throw authError;
      },
    } as never,
    userAssetCleaner: {
      deleteAssetsForUser: async () => {
        assetCleanupCalls += 1;
        if (assetError) throw assetError;
      },
    },
  });
  return {
    authDeleteCalls: () => authDeleteCalls,
    deleter,
    firestore,
    assetCleanupCalls: () => assetCleanupCalls,
  };
};

test('deletes multiple owned reviews, social relationships, profile data, active user assets, and Auth', async () => {
  const fixture = deleterFor({
    documents: {
      'users/deleted': { followerCount: 1, followingCount: 1 },
      'users/alex': { followingCount: 3 },
      'users/bob': { followerCount: 4 },
      'userSettings/deleted': { defaultReviewVisibility: 'private' },
      'handles/deleted_handle': { userId: 'deleted' },
      'reviews/one': { userId: 'deleted' },
      'reviews/two': { userId: 'deleted' },
      'followRelationships/deleted/followers/alex': {
        followerId: 'alex', followedUserId: 'deleted', status: 'active',
      },
      'followRelationships/bob/followers/deleted': {
        followerId: 'deleted', followedUserId: 'bob', status: 'active',
      },
    },
  });

  await fixture.deleter.deleteAll('deleted');

  assert.equal(fixture.firestore.documents.has('reviews/one'), false);
  assert.equal(fixture.firestore.documents.has('reviews/two'), false);
  assert.equal(fixture.firestore.documents.has('handles/deleted_handle'), false);
  assert.equal(fixture.firestore.documents.has('users/deleted'), false);
  assert.equal(fixture.firestore.documents.has('userSettings/deleted'), false);
  assert.equal(
    fixture.firestore.documents.has('followRelationships/deleted/followers/alex'),
    false
  );
  assert.equal(
    fixture.firestore.documents.has('followRelationships/bob/followers/deleted'),
    false
  );
  assert.equal(fixture.firestore.documents.get('users/alex')?.followingCount, 2);
  assert.equal(fixture.firestore.documents.get('users/bob')?.followerCount, 3);
  assert.equal(fixture.assetCleanupCalls(), 1);
  assert.equal(fixture.authDeleteCalls(), 1);
});

test('retries safely after profile removal and does not decrement an already-removed relationship twice', async () => {
  const fixture = deleterFor({
    documents: {
      'users/alex': { followingCount: 2 },
      // This old handle can still be recovered without users/deleted.
      'handles/deleted_handle': { userId: 'deleted' },
      'followRelationships/deleted/followers/alex': {
        followerId: 'alex', followedUserId: 'deleted', status: 'active',
      },
    },
    assetError: new Error('Asset provider temporarily unavailable'),
  });

  await assert.rejects(() => fixture.deleter.deleteAll('deleted'));
  assert.equal(fixture.firestore.documents.has('handles/deleted_handle'), false);
  assert.equal(fixture.firestore.documents.get('users/alex')?.followingCount, 1);

  const retry = createFirebaseAccountDataDeleter({
    firestore: asAdminFirestore(fixture.firestore),
    auth: { deleteUser: async () => undefined } as never,
  });
  await retry.deleteAll('deleted');
  assert.equal(fixture.firestore.documents.get('users/alex')?.followingCount, 1);
});

test('uses the current no-op asset cleaner and treats an already-deleted Auth user as completed', async () => {
  const firestore = new FakeFirestore({});
  let authDeleteCalls = 0;

  const noProviderDeleter = createFirebaseAccountDataDeleter({
    firestore: asAdminFirestore(firestore),
    auth: {
      deleteUser: async () => {
        authDeleteCalls += 1;
        throw { code: 'auth/user-not-found' };
      },
    } as never,
  });
  await noProviderDeleter.deleteAll('already-deleted');
  assert.equal(authDeleteCalls, 1);
});

test('preserves retryability for genuine user-asset-provider and Auth failures', async () => {
  const assetFailure = deleterFor({
    documents: { 'users/deleted': {} },
    assetError: Object.assign(new Error('denied'), { code: 403 }),
  });
  await assert.rejects(() => assetFailure.deleter.deleteAll('deleted'));
  assert.equal(assetFailure.authDeleteCalls(), 0);

  const authFailure = deleterFor({
    authError: { code: 'auth/internal-error' },
    documents: { 'users/deleted': {} },
  });
  await assert.rejects(() => authFailure.deleter.deleteAll('deleted'));
  assert.equal(authFailure.assetCleanupCalls(), 1);
  assert.equal(authFailure.authDeleteCalls(), 1);
});
