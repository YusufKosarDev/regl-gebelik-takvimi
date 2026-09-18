import { AUTH_ERROR_CODES, AuthError, isAuthErrorCode, toAuthError } from '../auth-error';

/** What the SDK throws: a code, and a message written for a developer. */
function firebaseError(code: string, message = 'Firebase: Error (auth/internal-error).') {
  const error = new Error(message) as Error & { code: string };
  error.code = code;

  return error;
}

describe('AuthError', () => {
  it('carries the code it was made with', () => {
    expect(new AuthError('weak-password').code).toBe('weak-password');
  });

  it('builds its message out of the code alone', () => {
    expect(new AuthError('invalid-credentials').message).toBe('Auth failed: invalid-credentials.');
  });

  it('is an Error, so it travels like one', () => {
    expect(new AuthError('unknown')).toBeInstanceOf(Error);
    expect(new AuthError('unknown').name).toBe('AuthError');
  });
});

describe('the codes this app knows', () => {
  it('lists them once each', () => {
    expect(new Set(AUTH_ERROR_CODES).size).toBe(AUTH_ERROR_CODES.length);
  });

  it.each(AUTH_ERROR_CODES)('%s is recognised', (code) => {
    expect(isAuthErrorCode(code)).toBe(true);
  });

  it.each(['auth/wrong-password', 'someone@example.com', '', null, 7])(
    'does not recognise %p',
    (value) => {
      expect(isAuthErrorCode(value)).toBe(false);
    }
  );
});

describe('toAuthError', () => {
  it.each([
    ['auth/invalid-email', 'invalid-email'],
    ['auth/missing-email', 'invalid-email'],
    ['auth/user-not-found', 'invalid-credentials'],
    ['auth/wrong-password', 'invalid-credentials'],
    ['auth/invalid-credential', 'invalid-credentials'],
    ['auth/user-disabled', 'invalid-credentials'],
    ['auth/email-already-in-use', 'email-already-in-use'],
    ['auth/weak-password', 'weak-password'],
    ['auth/too-many-requests', 'too-many-requests'],
    ['auth/network-request-failed', 'network-failed'],
  ])('turns %s into %s', (firebaseCode, expected) => {
    expect(toAuthError(firebaseError(firebaseCode)).code).toBe(expected);
  });

  it('tells a wrong password and a missing account apart from nothing', () => {
    // On purpose: a different answer for each would say which addresses have
    // accounts to anyone who tried one.
    expect(toAuthError(firebaseError('auth/wrong-password')).code).toBe(
      toAuthError(firebaseError('auth/user-not-found')).code
    );
  });

  it.each([
    ['a code nobody has mapped', firebaseError('auth/operation-not-allowed')],
    ['an error with no code', new Error('something went wrong')],
    ['a thrown string', 'auth/wrong-password'],
    ['nothing', null],
    ['undefined', undefined],
    ['a thrown object', { message: 'auth/wrong-password' }],
  ])('calls %s unknown', (_label, thrown) => {
    expect(toAuthError(thrown).code).toBe('unknown');
  });

  it('ignores a code that is not the shape of an SDK code', () => {
    expect(toAuthError({ code: 'auth/someone@example.com' }).code).toBe('unknown');
  });

  it('hands an AuthError back rather than burying it', () => {
    const original = new AuthError('not-configured');

    expect(toAuthError(original)).toBe(original);
  });

  it('always returns an AuthError', () => {
    expect(toAuthError(firebaseError('auth/weak-password'))).toBeInstanceOf(AuthError);
  });
});

describe('what an auth error gives away', () => {
  const sensitive = [
    ['an address in the message', firebaseError('auth/wrong-password', 'Bad password for someone@example.com')],
    ['a password in the message', firebaseError('auth/weak-password', 'Password hunter2 is too weak')],
    ['an API key in the message', firebaseError('auth/invalid-api-key', 'Invalid API key: AIzaSyEXAMPLE')],
  ] as const;

  it.each(sensitive)('drops %s', (_label, thrown) => {
    const message = toAuthError(thrown).message;

    expect(message).not.toMatch(/someone@example\.com|hunter2|AIzaSy/);
  });

  it('keeps no reference to what it was thrown', () => {
    const thrown = firebaseError('auth/wrong-password', 'Bad password for someone@example.com');
    const mapped = toAuthError(thrown) as AuthError & { cause?: unknown };

    expect(mapped.cause).toBeUndefined();
    expect(JSON.stringify({ ...mapped, message: mapped.message })).not.toMatch(
      /someone@example\.com/
    );
  });

  it('carries no stack from the SDK', () => {
    const thrown = firebaseError('auth/wrong-password', 'Bad password for someone@example.com');
    thrown.stack = 'at signIn (someone@example.com:1:1)';

    expect(toAuthError(thrown).stack ?? '').not.toMatch(/someone@example\.com/);
  });

  it('says only what code it was, whatever it was given', () => {
    for (const [, thrown] of sensitive) {
      expect(toAuthError(thrown).message).toMatch(/^Auth failed: [a-z-]+\.$/);
    }
  });
});
