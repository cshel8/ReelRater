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
