import { NO_FAILED_ATTEMPTS } from '../attempt-policy';
import type { LockRecord } from '../lock-record';
import { LOCK_RECORD_VERSION, isRecoverable, newLockRecord, validateLockRecord } from '../lock-record';

/**
 * The shape that is written down, and the check on what comes back.
 *
 * What comes back was not necessarily written by this build: a newer one may
 * have stored a shape this does not know, and a half-written record happens.
 */

function record(overrides: Partial<LockRecord> = {}): LockRecord {
  return {
    version: 1,
    salt: 'a1b2c3d4e5f60718',
    hash: 'deadbeef',
    iterations: 1,
    boundUid: 'uid-1',
    biometricsEnabled: false,
    attempts: NO_FAILED_ATTEMPTS,
    ...overrides,
  };
}

describe('newLockRecord', () => {
  it('starts with no failed attempts', () => {
    const created = newLockRecord({
      salt: 'aabb',
      hash: 'ccdd',
      iterations: 4,
      boundUid: 'uid-1',
      biometricsEnabled: true,
    });

    expect(created.attempts).toEqual(NO_FAILED_ATTEMPTS);
    expect(created.version).toBe(LOCK_RECORD_VERSION);
  });

  // The PIN is the one thing that must not be in here.
  it('holds no field that could be a PIN', () => {
    const created = newLockRecord({
      salt: 'aabb',
      hash: 'ccdd',
      iterations: 4,
      boundUid: null,
      biometricsEnabled: false,
    });

    expect(Object.keys(created).sort()).toEqual([
      'attempts',
      'biometricsEnabled',
      'boundUid',
      'hash',
      'iterations',
      'salt',
      'version',
    ]);
    expect(JSON.stringify(created)).not.toContain('pin');
  });
});

describe('validateLockRecord', () => {
  it('accepts a record this build wrote', () => {
    expect(() => validateLockRecord(record())).not.toThrow();
  });

  it('accepts one with no account bound', () => {
    expect(() => validateLockRecord(record({ boundUid: null }))).not.toThrow();
  });

  it.each([
    ['not an object', 'a string'],
    ['null', null],
    ['an array', []],
  ])('refuses %s', (_name, value) => {
    expect(() => validateLockRecord(value)).toThrow();
  });

  it('refuses a version it does not know', () => {
    expect(() => validateLockRecord(record({ version: 2 as unknown as 1 }))).toThrow(/version/);
  });

  it.each([
    ['salt', ''],
    ['salt', 'NOTHEX'],
    ['hash', ''],
    ['hash', 'zz'],
  ])('refuses a %s that is not hex', (field, value) => {
    expect(() => validateLockRecord(record({ [field]: value } as Partial<LockRecord>))).toThrow(
      new RegExp(field)
    );
  });

  it.each([0, -1, 1.5, Number.NaN])('refuses iterations of %p', (iterations) => {
    expect(() => validateLockRecord(record({ iterations }))).toThrow(/iterations/);
  });

  it('refuses a blank bound uid, which is neither an account nor none', () => {
    expect(() => validateLockRecord(record({ boundUid: '' }))).toThrow(/boundUid/);
  });

  it('refuses attempts that are missing or the wrong shape', () => {
    expect(() =>
      validateLockRecord(record({ attempts: undefined as unknown as LockRecord['attempts'] }))
    ).toThrow(/attempts/);
    expect(() =>
      validateLockRecord(
        record({ attempts: { failedAttempts: -1, lockedUntil: null } })
      )
    ).toThrow(/failedAttempts/);
  });

  // The refusal travels to a log line. It says what kind of thing arrived.
  it('never repeats a hash or a salt in its message', () => {
    try {
      validateLockRecord(record({ iterations: 0 }));
      throw new Error('should have refused');
    } catch (error) {
      const message = (error as Error).message;

      expect(message).not.toContain('a1b2c3d4e5f60718');
      expect(message).not.toContain('deadbeef');
    }
  });
});

describe('isRecoverable', () => {
  it('is true when an account is bound', () => {
    expect(isRecoverable(record({ boundUid: 'uid-1' }))).toBe(true);
  });

  // The person who was warned at setup that there would be no way back.
  it('is false when none is', () => {
    expect(isRecoverable(record({ boundUid: null }))).toBe(false);
  });
});
