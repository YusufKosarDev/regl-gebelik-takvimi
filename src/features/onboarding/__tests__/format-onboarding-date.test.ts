import type { ISODate } from '@/types/iso-date';
import { toISODate } from '@/utils/date';

import { formatOnboardingDate } from '../format-onboarding-date';

describe('formatOnboardingDate', () => {
  it('formats a date in Turkish', () => {
    expect(formatOnboardingDate(toISODate('2026-09-17'))).toBe('17 Eylül 2026');
  });

  it.each<[string, string]>([
    ['2026-01-01', '1 Ocak 2026'],
    ['2026-02-28', '28 Şubat 2026'],
    ['2026-03-09', '9 Mart 2026'],
    ['2026-04-30', '30 Nisan 2026'],
    ['2026-05-15', '15 Mayıs 2026'],
    ['2026-06-01', '1 Haziran 2026'],
    ['2026-07-04', '4 Temmuz 2026'],
    ['2026-08-31', '31 Ağustos 2026'],
    ['2026-09-17', '17 Eylül 2026'],
    ['2026-10-10', '10 Ekim 2026'],
    ['2026-11-11', '11 Kasım 2026'],
    ['2026-12-31', '31 Aralık 2026'],
  ])('formats %s as %s', (iso, expected) => {
    expect(formatOnboardingDate(toISODate(iso))).toBe(expected);
  });

  it('drops the leading zero from single digit days', () => {
    expect(formatOnboardingDate(toISODate('2026-09-01'))).toBe('1 Eylül 2026');
  });

  it('formats a leap day', () => {
    expect(formatOnboardingDate(toISODate('2024-02-29'))).toBe('29 Şubat 2024');
  });

  it('does not depend on the device locale', () => {
    // A fixed table, so the output cannot change with Intl availability.
    const formatted = formatOnboardingDate('2026-09-17' as ISODate);

    expect(formatted).toBe('17 Eylül 2026');
    expect(formatted).not.toMatch(/September|Sep/);
  });
});
