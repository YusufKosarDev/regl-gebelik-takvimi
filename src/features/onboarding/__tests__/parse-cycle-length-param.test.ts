import { parseCycleLengthParam } from '../parse-cycle-length-param';

describe('parseCycleLengthParam', () => {
  it.each(['15', '28', '90'])('accepts "%s"', (value) => {
    expect(parseCycleLengthParam(value)).toBe(Number(value));
  });

  it('rejects a missing value', () => {
    expect(parseCycleLengthParam(undefined)).toBeNull();
  });

  it('rejects an empty string', () => {
    expect(parseCycleLengthParam('')).toBeNull();
  });

  it.each(['abc', '28abc', 'NaN', 'Infinity'])('rejects the non-numeric "%s"', (value) => {
    expect(parseCycleLengthParam(value)).toBeNull();
  });

  it.each(['28.5', '28,5', '2e1'])('rejects the non-integer "%s"', (value) => {
    expect(parseCycleLengthParam(value)).toBeNull();
  });

  it.each(['14', '0', '91', '1000'])('rejects the out-of-range "%s"', (value) => {
    expect(parseCycleLengthParam(value)).toBeNull();
  });

  it.each(['-28', '+28', ' 28', '28 '])('rejects the malformed "%s"', (value) => {
    expect(parseCycleLengthParam(value)).toBeNull();
  });

  it('rejects an array of values', () => {
    expect(parseCycleLengthParam(['28'])).toBeNull();
    expect(parseCycleLengthParam(['28', '30'])).toBeNull();
    expect(parseCycleLengthParam([])).toBeNull();
  });

  it('accepts every value the domain allows', () => {
    for (let days = 15; days <= 90; days += 1) {
      expect(parseCycleLengthParam(String(days))).toBe(days);
    }
  });
});
