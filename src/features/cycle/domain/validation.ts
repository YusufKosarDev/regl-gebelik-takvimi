import {
  MAX_CYCLE_LENGTH_DAYS,
  MAX_PERIOD_DURATION_DAYS,
  MAX_PERIOD_LENGTH_DAYS,
  MIN_CYCLE_LENGTH_DAYS,
  MIN_PERIOD_LENGTH_DAYS,
} from './limits';
import type { CycleProfile, CycleSettings, PeriodRecord } from './types';

import { daysBetween, isISODate } from '@/utils/date';

/**
 * Validation rules for the cycle domain.
 *
 * Every function is pure: it reads its argument, throws on the first rule it
 * breaks, and never mutates, reorders or copies the input. No storage, no React
 * and no clock access, so results depend only on the values passed in.
 */

function assertIntegerInRange(value: number, field: string, min: number, max: number): void {
  if (!Number.isInteger(value)) {
    throw new Error(`${field} must be an integer, received ${value}.`);
  }

  if (value < min || value > max) {
    throw new Error(`${field} must be between ${min} and ${max}, received ${value}.`);
  }
}

export function validateCycleSettings(settings: CycleSettings): void {
  assertIntegerInRange(
    settings.averageCycleLengthDays,
    'averageCycleLengthDays',
    MIN_CYCLE_LENGTH_DAYS,
    MAX_CYCLE_LENGTH_DAYS
  );
  assertIntegerInRange(
    settings.averagePeriodLengthDays,
    'averagePeriodLengthDays',
    MIN_PERIOD_LENGTH_DAYS,
    MAX_PERIOD_LENGTH_DAYS
  );

  if (settings.averagePeriodLengthDays > settings.averageCycleLengthDays) {
    throw new Error(
      `averagePeriodLengthDays (${settings.averagePeriodLengthDays}) cannot exceed ` +
        `averageCycleLengthDays (${settings.averageCycleLengthDays}).`
    );
  }
}

export function validatePeriodRecord(record: PeriodRecord): void {
  if (record.id.trim() === '') {
    throw new Error('PeriodRecord id must be a non-empty string.');
  }

  if (!isISODate(record.startDate)) {
    throw new Error(`PeriodRecord "${record.id}" has an invalid startDate: "${record.startDate}".`);
  }

  if (typeof record.isOngoing !== 'boolean') {
    throw new Error(
      `PeriodRecord "${record.id}" has a non-boolean isOngoing: ${JSON.stringify(record.isOngoing)}.`
    );
  }

  if (record.isOngoing && record.endDate !== undefined) {
    throw new Error(
      `PeriodRecord "${record.id}" is marked ongoing but already ends on ${record.endDate}.`
    );
  }

  // A finished period with no recorded end date is fine: that is history nobody
  // wrote the end of, not a period still running.
  if (record.endDate === undefined) {
    return;
  }

  if (!isISODate(record.endDate)) {
    throw new Error(`PeriodRecord "${record.id}" has an invalid endDate: "${record.endDate}".`);
  }

  const span = daysBetween(record.startDate, record.endDate);

  if (span < 0) {
    throw new Error(
      `PeriodRecord "${record.id}" ends before it starts: ` +
        `${record.startDate} -> ${record.endDate}.`
    );
  }

  const durationDays = span + 1;

  if (durationDays > MAX_PERIOD_DURATION_DAYS) {
    throw new Error(
      `PeriodRecord "${record.id}" spans ${durationDays} days, ` +
        `which exceeds the maximum of ${MAX_PERIOD_DURATION_DAYS}.`
    );
  }
}

export function validateCycleProfile(profile: CycleProfile): void {
  validateCycleSettings(profile.settings);

  const seenIds = new Set<string>();
  const seenStartDates = new Set<string>();
  let ongoingCount = 0;

  for (const record of profile.periodRecords) {
    validatePeriodRecord(record);

    if (record.isOngoing) {
      ongoingCount += 1;
    }

    if (seenIds.has(record.id)) {
      throw new Error(`Duplicate PeriodRecord id: "${record.id}".`);
    }
    seenIds.add(record.id);

    if (seenStartDates.has(record.startDate)) {
      throw new Error(`Duplicate PeriodRecord startDate: "${record.startDate}".`);
    }
    seenStartDates.add(record.startDate);
  }

  // Only one period can be happening at a time, so more than one is corruption
  // rather than a state to interpret.
  if (ongoingCount > 1) {
    throw new Error(`CycleProfile has ${ongoingCount} ongoing period records; at most 1 is valid.`);
  }
}
