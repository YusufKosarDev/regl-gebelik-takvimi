import { DELETION_FAILURES, isDeletionFailure } from '../deletion-outcome';

describe('the failures a deletion can report', () => {
  it('names every one this app knows how to explain', () => {
    expect([...DELETION_FAILURES]).toEqual([
      'not-configured',
      'signed-out',
      'invalid-credentials',
      'requires-recent-login',
      'network-failed',
      'too-many-requests',
      'cloud-delete-failed',
      'account-delete-failed',
      'local-failed',
      'unknown',
    ]);
  });

  it('keeps the two halves of the middle apart', () => {
    // After one, nothing was deleted; after the other, the backup already went.
    // A screen cannot say the right thing if these share a code.
    expect(DELETION_FAILURES).toContain('cloud-delete-failed');
    expect(DELETION_FAILURES).toContain('account-delete-failed');
  });

  it.each([...DELETION_FAILURES])('recognises %s', (failure) => {
    expect(isDeletionFailure(failure)).toBe(true);
  });

  it.each([
    ['something invented', 'nope'],
    ['a number', 1],
    ['null', null],
    ['undefined', undefined],
    ['an object', {}],
  ])('refuses %s', (_label, value) => {
    expect(isDeletionFailure(value)).toBe(false);
  });
});
