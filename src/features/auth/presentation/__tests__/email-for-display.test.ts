import { emailForDisplay } from '../email-for-display';

/**
 * Where a long address is allowed to wrap.
 *
 * The rule is about the break opportunity, not about the characters: the
 * address itself must come back unchanged once the invisible character is
 * taken out again, because this is shown to somebody checking which account
 * they are signed into.
 */
describe('emailForDisplay', () => {
  it('offers a break between the local part and the domain', () => {
    expect(emailForDisplay('someone@example.com')).toBe('someone\u200B@example.com');
  });

  it('changes nothing else about the address', () => {
    const address = 'regl.wrap.test.1013@disposable-example.test';

    expect(emailForDisplay(address).replace(/\u200B/g, '')).toBe(address);
  });

  it('breaks at the last @, which is the one separating the domain', () => {
    expect(emailForDisplay('"odd@local"@example.com')).toBe('"odd@local"\u200B@example.com');
  });

  it('leaves an address with no domain separator alone', () => {
    expect(emailForDisplay('not-an-address')).toBe('not-an-address');
    expect(emailForDisplay('@example.com')).toBe('@example.com');
    expect(emailForDisplay('')).toBe('');
  });
});
