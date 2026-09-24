import {
  MINIMUM_PASSWORD_LENGTH,
  isPasswordLongEnough,
} from '@/features/auth/domain/password-policy';

describe('the minimum', () => {
  it('is eight, which is what the messages and the hint are built from', () => {
    // Pinned because three pieces of user-facing text are derived from it. If
    // the number moves, they move with it, and this says so out loud.
    expect(MINIMUM_PASSWORD_LENGTH).toBe(8);
  });

  it('is longer than the six Firebase would settle for', () => {
    // The whole reason this rule exists in the app rather than in the console.
    expect(MINIMUM_PASSWORD_LENGTH).toBeGreaterThan(6);
  });
});

describe('measuring a password somebody is choosing', () => {
  it.each([
    ['', false],
    ['a', false],
    ['1234567', false],
    ['12345678', true],
    ['123456789', true],
  ])('%s -> %s', (password, expected) => {
    expect(isPasswordLongEnough(password)).toBe(expected);
  });

  it('accepts exactly the minimum, not one more', () => {
    // An off-by-one here turns into a form that refuses a password matching the
    // hint it just showed.
    expect(isPasswordLongEnough('x'.repeat(MINIMUM_PASSWORD_LENGTH))).toBe(true);
    expect(isPasswordLongEnough('x'.repeat(MINIMUM_PASSWORD_LENGTH - 1))).toBe(false);
  });

  it('counts a space as a character', () => {
    // A space in a password is a character in a password; the screen does not
    // trim it and neither does this.
    expect(isPasswordLongEnough('a b c d')).toBe(false);
    expect(isPasswordLongEnough('a b c d ')).toBe(true);
  });
});
