import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  signOut,
} from 'firebase/auth';
import { apiBaseUrl } from '@/config/api';
import { auth } from '@/config/firebase';
import type { AccountDeletionService } from '@/services/contracts';
import { accountLocalDataService } from '@/services/local/accountLocalDataService';

function deletionEndpoint(): string {
  const url = new URL(`${apiBaseUrl}/api/v1/account`);
  const localHost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (url.protocol !== 'https:' && !localHost) {
    throw new Error(
      'Account deletion requires an HTTPS API connection. Configure the ReelRater API with HTTPS before using this feature.'
    );
  }
  return url.toString();
}

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: { message?: unknown } };
    if (typeof body.error?.message === 'string') {
      return body.error.message;
    }
  } catch {
    // Use the status fallback below for a non-JSON response.
  }
  return `Account deletion failed with status ${response.status}.`;
}

export const firebaseAccountDeletionService: AccountDeletionService = {
  async deleteCurrentAccount(password) {
    const user = auth.currentUser;
    if (!user?.email) {
      throw new Error('Sign in again before deleting your account.');
    }

    const credential = EmailAuthProvider.credential(user.email, password);
    try {
      await reauthenticateWithCredential(user, credential);
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        (error.code === 'auth/invalid-credential' ||
          error.code === 'auth/wrong-password')
      ) {
        throw new Error('The password you entered is incorrect.');
      }
      throw error;
    }
    const idToken = await user.getIdToken(true);
    const response = await fetch(deletionEndpoint(), {
      method: 'DELETE',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
    });
    if (!response.ok) {
      throw new Error(await readError(response));
    }

    await accountLocalDataService.removeForUser(user.uid);
    await signOut(auth).catch(() => undefined);
  },
};
