import { getOpenPeriodRecord } from './open-period';
import type { CycleProfile } from './types';

/**
 * Which period action the stored data allows, if any.
 *
 * `getOpenPeriodRecord` refuses to choose between several open records rather
 * than closing one the person did not mean to close. The screen cannot act on
 * that either, so it offers nothing instead of crashing on the way past.
 */
export function resolvePeriodAction(profile: CycleProfile): 'start' | 'end' | 'none' {
  try {
    return getOpenPeriodRecord(profile) === null ? 'start' : 'end';
  } catch {
    return 'none';
  }
}
