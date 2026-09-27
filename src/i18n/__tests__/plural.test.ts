import { plural } from '../plural';

describe('plural', () => {
  it('uses the singular for exactly one', () => {
    expect(plural(1, '1 symptom', '2 symptoms')).toBe('1 symptom');
  });

  it.each([0, 2, 3, 11, 100])('uses the other form for %i', (count) => {
    expect(plural(count, 'one', 'other')).toBe('other');
  });

  /**
   * Zero takes the plural in English — "0 symptoms", not "0 symptom".
   *
   * Stated as its own case because it is the one an `n > 1` boundary gets
   * wrong, and because a day with nothing recorded is a real screen.
   */
  it('treats zero as plural', () => {
    expect(plural(0, '1 symptom', '0 symptoms')).toBe('0 symptoms');
  });

  it('does not treat negative one as singular', () => {
    // Nothing in this app counts below zero, and if something starts to, the
    // answer should not be silently grammatical.
    expect(plural(-1, 'one', 'other')).toBe('other');
  });
});
