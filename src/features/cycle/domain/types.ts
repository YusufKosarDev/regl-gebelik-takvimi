import type { ISODate } from '@/types/iso-date';

export type CycleSettings = {
  readonly averageCycleLengthDays: number;
  readonly averagePeriodLengthDays: number;
};

/**
 * One recorded period.
 *
 * `isOngoing` is required rather than optional because a missing `endDate` alone
 * is ambiguous: it can mean "still bleeding" or "this is history and nobody
 * wrote down when it stopped". Those need different answers, so the record says
 * which it is instead of leaving it to be guessed.
 *
 * - `isOngoing: true` — happening now, and `endDate` must be absent.
 * - `isOngoing: false` with an `endDate` — finished, on a known day.
 * - `isOngoing: false` without one — finished, on a day nobody recorded.
 */
export type PeriodRecord = {
  readonly id: string;
  readonly startDate: ISODate;
  readonly endDate?: ISODate;
  readonly isOngoing: boolean;
};

export type CycleProfile = {
  readonly settings: CycleSettings;
  readonly periodRecords: readonly PeriodRecord[];
};
