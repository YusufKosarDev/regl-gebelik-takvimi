/**
 * What can go wrong signing in, in this app's own words.
 *
 * A Firebase error carries a message written for a developer and, for some
 * failures, an echo of what was sent — which for sign-in means an email address
 * and, in a stack, whatever was near the password. None of that crosses this
 * boundary. What crosses is one of these codes: a fixed string, chosen here,
 * that a screen can turn into a sentence in Turkish and a test can assert on.
 *
 * The codes are deliberately coarse. `invalid-credentials` covers a wrong
 * password and an account that does not exist, because telling those apart in
 * an error tells whoever is asking which email addresses have accounts.
 */
export const AUTH_ERROR_CODES = [
  'not-configured',
  'invalid-email',
  'invalid-credentials',
  'email-already-in-use',
  'weak-password',
  'too-many-requests',
  'network-failed',
  'unknown',
] as const;

export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[number];

/** Whether something is one of this app's auth codes. */
export function isAuthErrorCode(value: unknown): value is AuthErrorCode {
  return typeof value === 'string' && (AUTH_ERROR_CODES as readonly string[]).includes(value);
}

/**
 * An auth failure, with a code and nothing else.
 *
 * The message is built from the code alone, so there is no path by which an
 * address, a password or an SDK message ends up in it — including when
 * something logs `error.message` years from now.
 */
export class AuthError extends Error {
  readonly code: AuthErrorCode;

  constructor(code: AuthErrorCode) {
    super(`Auth failed: ${code}.`);

    this.name = 'AuthError';
    this.code = code;
  }
}

/**
 * What each Firebase code means here.
 *
 * Read off `error.code`, which is a fixed string the SDK chooses
 * (`auth/wrong-password`), never off the message, which is prose that changes
 * between versions and quotes what it was given.
 */
const FROM_FIREBASE: Readonly<Record<string, AuthErrorCode>> = {
  'auth/invalid-email': 'invalid-email',
  'auth/missing-email': 'invalid-email',
  'auth/user-not-found': 'invalid-credentials',
  'auth/wrong-password': 'invalid-credentials',
  'auth/invalid-credential': 'invalid-credentials',
  'auth/invalid-login-credentials': 'invalid-credentials',
  'auth/user-disabled': 'invalid-credentials',
  'auth/email-already-in-use': 'email-already-in-use',
  'auth/weak-password': 'weak-password',
  'auth/missing-password': 'weak-password',
  'auth/too-many-requests': 'too-many-requests',
  'auth/network-request-failed': 'network-failed',
};

function firebaseCodeOf(error: unknown): string | null {
  if (typeof error !== 'object' || error === null) {
    return null;
  }

  const { code } = error as { code?: unknown };

  // The shape is checked as well as the type: a "code" assembled at runtime out
  // of user input is not something to look up or to keep.
  return typeof code === 'string' && /^auth\/[a-z-]+$/.test(code) ? code : null;
}

/**
 * The app's error for whatever the SDK threw.
 *
 * Anything unrecognised becomes `unknown` rather than being passed through. A
 * failure nobody has mapped is exactly the one whose message has not been read,
 * and letting it travel would be letting an unread message travel with it.
 *
 * An `AuthError` handed back in is returned as it is, so wrapping twice does
 * not bury a good code under `unknown`.
 */
export function toAuthError(error: unknown): AuthError {
  if (error instanceof AuthError) {
    return error;
  }

  const code = firebaseCodeOf(error);

  return new AuthError(code === null ? 'unknown' : FROM_FIREBASE[code] ?? 'unknown');
}
