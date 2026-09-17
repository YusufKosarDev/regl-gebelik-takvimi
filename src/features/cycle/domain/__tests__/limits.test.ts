import {
  MAX_CYCLE_LENGTH_DAYS,
  MAX_PERIOD_LENGTH_DAYS,
  MIN_CYCLE_LENGTH_DAYS,
  MIN_PERIOD_LENGTH_DAYS,
} from '../limits';

// Pins the published numbers. Every screen, parser and validator now reads these,
// so a change here is a product decision, not an implementation detail.
describe('cycle limits', () => {
  it('bounds the cycle length at 15 to 90 days', () => {
    expect(MIN_CYCLE_LENGTH_DAYS).toBe(15);
    expect(MAX_CYCLE_LENGTH_DAYS).toBe(90);
  });

  it('bounds the period length at 1 to 20 days', () => {
    expect(MIN_PERIOD_LENGTH_DAYS).toBe(1);
    expect(MAX_PERIOD_LENGTH_DAYS).toBe(20);
  });
});
