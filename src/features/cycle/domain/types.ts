import type { ISODate } from '@/types/iso-date';

export type CycleSettings = {
  readonly averageCycleLengthDays: number;
  readonly averagePeriodLengthDays: number;
};

export type PeriodRecord = {
  readonly id: string;
  readonly startDate: ISODate;
  readonly endDate?: ISODate;
};

export type CycleProfile = {
  readonly settings: CycleSettings;
  readonly periodRecords: readonly PeriodRecord[];
};
