import { parsePeriodLengthParam } from '../parse-period-length-param';

describe('parsePeriodLengthParam', () => {
  it.each([
    ['1', 28, 1],
    ['5', 28, 5],
    ['20', 28, 20],
    ['15', 15, 15],
    ['18', 18, 18],
  ])('accepts "%s" for a %i day cycle', (value, cycleLength, expected) => {
    expect(parsePeriodLengthParam(value, cycleLength)).toBe(expected);
  });

  it('rejects a missing value', () => {
    expect(parsePeriodLengthParam(undefined, 28)).toBeNull();
  });

  it('rejects an empty string', () => {
    expect(parsePeriodLengthParam('', 28)).toBeNull();
  });

  it.each(['abc', '5abc', 'NaN', 'Infinity'])('rejects the non-numeric "%s"', (value) => {
    expect(parsePeriodLengthParam(value, 28)).toBeNull();
  });

  it.each(['5.5', '5,5', '2e1'])('rejects the non-integer "%s"', (value) => {
    expect(parsePeriodLengthParam(value, 28)).toBeNull();
  });

  it.each(['0', '21', '100'])('rejects the out-of-range "%s"', (value) => {
    expect(parsePeriodLengthParam(value, 28)).toBeNull();
  });

  it.each(['-5', '+5', ' 5', '5 '])('rejects the malformed "%s"', (value) => {
    expect(parsePeriodLengthParam(value, 28)).toBeNull();
  });

  it('rejects an array of values', () => {
    expect(parsePeriodLengthParam(['5'], 28)).toBeNull();
    expect(parsePeriodLengthParam(['5', '6'], 28)).toBeNull();
    expect(parsePeriodLengthParam([], 28)).toBeNull();
  });

  it('rejects a period longer than the cycle', () => {
    expect(parsePeriodLengthParam('16', 15)).toBeNull();
    expect(parsePeriodLengthParam('19', 18)).toBeNull();
  });

  it('accepts a period exactly as long as a short cycle', () => {
    expect(parsePeriodLengthParam('15', 15)).toBe(15);
  });

  it('caps at 20 even for a long cycle', () => {
    expect(parsePeriodLengthParam('20', 90)).toBe(20);
    expect(parsePeriodLengthParam('21', 90)).toBeNull();
  });
});
