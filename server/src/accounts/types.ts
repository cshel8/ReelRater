export interface VerifiedAccountIdentity {
  userId: string;
  authenticatedAt: Date;
}

export interface AccountIdentityVerifier {
  verify(idToken: string): Promise<VerifiedAccountIdentity>;
}

export interface AccountDataDeleter {
  deleteAll(userId: string): Promise<void>;
}

/**
 * Deletes assets owned by one user from an active remote asset provider.
 * ReelRater has no such provider today; a future provider (for example S3)
 * can implement this without coupling account deletion to Firebase Storage.
 */
export interface UserAssetCleaner {
  deleteAssetsForUser(userId: string): Promise<void>;
}
