import { mapFirebaseUser, mapFirebaseUserOrNull } from '../auth-user';

/** As much of a Firebase `User` as matters, and then some. */
function firebaseUser(overrides: Record<string, unknown> = {}) {
  return {
    uid: 'firebase-uid-1',
    email: 'someone@example.com',
    emailVerified: true,
    displayName: 'Someone',
    photoURL: 'https://example.com/photo.jpg',
    phoneNumber: '+900000000000',
    isAnonymous: false,
    providerId: 'firebase',
    providerData: [{ providerId: 'password', email: 'someone@example.com' }],
    metadata: { creationTime: 'Tue, 02 Sep 2026 00:00:00 GMT', lastSignInTime: 'now' },
    refreshToken: 'a-refresh-token',
    tenantId: null,
    getIdToken: () => Promise.resolve('an-id-token'),
    ...overrides,
  };
}

describe('mapFirebaseUser', () => {
  it('keeps the uid and the email', () => {
    expect(mapFirebaseUser(firebaseUser())).toEqual({
      uid: 'firebase-uid-1',
      email: 'someone@example.com',
    });
  });

  it('keeps nothing else, however much it was given', () => {
    expect(Object.keys(mapFirebaseUser(firebaseUser()))).toEqual(['uid', 'email']);
  });

  it.each([
    'displayName',
    'photoURL',
    'phoneNumber',
    'providerId',
    'providerData',
    'metadata',
    'refreshToken',
    'emailVerified',
    'tenantId',
    'getIdToken',
  ])('drops %s', (field) => {
    expect(mapFirebaseUser(firebaseUser())).not.toHaveProperty(field);
  });

  it('carries no token anywhere in what it returns', () => {
    const mapped = JSON.stringify(mapFirebaseUser(firebaseUser()));

    expect(mapped).not.toMatch(/token|refresh|provider/i);
  });

  it.each([
    ['absent', {}],
    ['null', { email: null }],
    ['not text', { email: 7 }],
  ])('turns an email that is %s into null', (_label, overrides) => {
    const user = firebaseUser();
    delete (user as Record<string, unknown>).email;

    expect(mapFirebaseUser({ ...user, ...overrides }).email).toBeNull();
  });

  it.each([
    ['no uid', {}],
    ['a blank uid', { uid: '   ' }],
    ['a uid that is not text', { uid: 7 }],
  ])('refuses a user with %s', (_label, overrides) => {
    const user = firebaseUser();
    delete (user as Record<string, unknown>).uid;

    expect(() => mapFirebaseUser({ ...user, ...overrides })).toThrow(/no uid/);
  });

  it.each([null, undefined, 'firebase-uid-1', 7])('refuses %p', (user) => {
    expect(() => mapFirebaseUser(user as never)).toThrow(/not a user|no uid/);
  });

  it('never returns the object it was given', () => {
    const user = firebaseUser();

    expect(mapFirebaseUser(user)).not.toBe(user);
  });

  it('changes nothing about what it was given', () => {
    const user = firebaseUser();
    const before = JSON.stringify(user);

    mapFirebaseUser(user);

    expect(JSON.stringify(user)).toBe(before);
  });
});

describe('mapFirebaseUserOrNull', () => {
  it.each([null, undefined])('says nobody is signed in for %p', (user) => {
    expect(mapFirebaseUserOrNull(user)).toBeNull();
  });

  it('maps a user the same way', () => {
    expect(mapFirebaseUserOrNull(firebaseUser())).toEqual({
      uid: 'firebase-uid-1',
      email: 'someone@example.com',
    });
  });
});

describe('what a mapping error gives away', () => {
  it('describes the shape, not the value', () => {
    expect(() => mapFirebaseUser({ uid: 7, email: 'someone@example.com' })).toThrow(
      'mapFirebaseUser received a user with no uid: a number.'
    );
  });

  it('names no email address', () => {
    const message = (() => {
      try {
        mapFirebaseUser({ email: 'someone@example.com' });
        return '';
      } catch (thrown) {
        return (thrown as Error).message;
      }
    })();

    expect(message).not.toMatch(/someone@example\.com/);
  });
});
