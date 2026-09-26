import { PIN_LENGTH, assertPin, checkPin, isValidPin, pinsMatch } from '../pin';

/**
 * What counts as a PIN.
 *
 * The values here are not anybody's PIN; they are shapes. The one thing this
 * file also checks is that a refusal never repeats what it refused.
 */

describe('checkPin', () => {
  it('accepts six digits', () => {
    expect(checkPin('123456')).toBeNull();
    expect(checkPin('000000')).toBeNull();
    expect(checkPin('999999')).toBeNull();
    expect(isValidPin('012345')).toBe(true);
  });

  it('is six, not four or eight', () => {
    expect(PIN_LENGTH).toBe(6);
    expect(checkPin('1234')).toBe('wrong-length');
    expect(checkPin('12345')).toBe('wrong-length');
    expect(checkPin('1234567')).toBe('wrong-length');
    expect(checkPin('')).toBe('wrong-length');
  });

  it('refuses anything that is not a digit', () => {
    expect(checkPin('12345a')).toBe('not-digits');
    expect(checkPin('12 456')).toBe('not-digits');
    expect(checkPin('12.456')).toBe('not-digits');
    expect(checkPin('-12345')).toBe('not-digits');
  });

  // The pad cannot produce these, but a stored PIN could arrive from anywhere,
  // and a hash written from one would not match on a device that normalises
  // differently.
  it('refuses digits that are not 0-9', () => {
    expect(checkPin('١٢٣٤٥٦')).toBe('not-digits');
    expect(checkPin('１２３４５６')).toBe('not-digits');
  });

  it('refuses a value that is not text at all', () => {
    expect(checkPin(123456 as unknown as string)).toBe('wrong-length');
    expect(checkPin(null as unknown as string)).toBe('wrong-length');
    expect(checkPin(undefined as unknown as string)).toBe('wrong-length');
  });
});

describe('assertPin', () => {
  it('passes a usable PIN through', () => {
    expect(() => assertPin('654321')).not.toThrow();
  });

  it('refuses one that is not', () => {
    expect(() => assertPin('12')).toThrow(/6-digit PIN/);
  });

  // The whole point of the feature is that nobody else sees the PIN. A thrown
  // message reaches a log, a crash report or a screenshot of a red box.
  it('never repeats what it refused', () => {
    const refused = '987654';

    try {
      assertPin(`${refused}x`);
      throw new Error('should have refused');
    } catch (error) {
      const message = (error as Error).message;

      expect(message).not.toContain(refused);
      expect(message).not.toContain('9');
      expect(message).toContain('text');
    }
  });
});

describe('pinsMatch', () => {
  it('is true only for the same six digits', () => {
    expect(pinsMatch('123456', '123456')).toBe(true);
    expect(pinsMatch('123456', '123457')).toBe(false);
    expect(pinsMatch('123456', '654321')).toBe(false);
  });
});
