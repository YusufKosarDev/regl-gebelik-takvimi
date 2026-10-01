import type { SQLiteDatabase } from 'expo-sqlite';

import { getDailyLogHistory } from '../get-daily-log-history';

import type { CycleProfile } from '@/features/cycle/domain/types';
import type { ISODate } from '@/types/iso-date';
import { toISODate } from '@/utils/date';

/**
 * The daily log, placed in the cycle.
 *
 * The reads are faked; the phase index, the correlation and the ordering rule
 * stay real, so this pins the wiring rather than restating it.
 */

jest.mock('../../data/daily-log-repository', () => ({
  loadAllDailyEntries: jest.fn(),
  loadDailyEntry: jest.fn(),
  saveDailyEntry: jest.fn(),
  clearDailyEntry: jest.fn(),
  replaceDailyEntries: jest.fn(),
}));

jest.mock('@/features/cycle/data/cycle-repository', () => ({
  loadCycleProfile: jest.fn(),
  saveCycleProfile: jest.fn(),
}));

const dailyLog = jest.requireMock('../../data/daily-log-repository');
const cycle = jest.requireMock('@/features/cycle/data/cycle-repository');

const db = {} as SQLiteDatabase;
const TODAY = toISODate('2026-03-25');

/** Cycle 28 from 2026-03-02, so day 1 is 2 March and the luteal phase is late. */
const PROFILE: CycleProfile = {
  settings: { averageCycleLengthDays: 28, averagePeriodLengthDays: 5 },
  periodRecords: [
    { id: 'period-2026-03-02', startDate: toISODate('2026-03-02'), isOngoing: false },
  ],
};

function entry(date: string, symptomIds: readonly string[], moodId: string | null = null) {
  return { date: date as ISODate, flowId: null, moodId, symptomIds };
}

beforeEach(() => {
  jest.clearAllMocks();
  cycle.loadCycleProfile.mockResolvedValue(PROFILE);
  dailyLog.loadAllDailyEntries.mockResolvedValue([]);
});

describe('with nothing recorded', () => {
  it('comes back empty rather than null', async () => {
    // "Nothing logged yet" is a state the screen shows, not an absence it has
    // to guard against.
    const history = await getDailyLogHistory(db, TODAY);

    expect(history.entries).toEqual([]);
    expect(history.phased).toEqual([]);
    expect(history.symptomCorrelations).toEqual([]);
    expect(history.today).toBe(TODAY);
  });
});

describe('with no cycle to place the days in', () => {
  it('still lists the entries, with no phase on any of them', async () => {
    cycle.loadCycleProfile.mockResolvedValue(null);
    dailyLog.loadAllDailyEntries.mockResolvedValue([entry('2026-03-10', ['cramps'])]);

    const history = await getDailyLogHistory(db, TODAY);

    expect(history.profile).toBeNull();
    expect(history.entries).toHaveLength(1);
    expect(history.phased[0].phase).toBeNull();
    expect(history.symptomCorrelations).toEqual([]);
  });
});

describe('with a cycle and some days', () => {
  it('places each day in a phase', async () => {
    dailyLog.loadAllDailyEntries.mockResolvedValue([
      entry('2026-03-03', ['cramps']),
      entry('2026-03-20', ['headache']),
    ]);

    const history = await getDailyLogHistory(db, TODAY);

    // 3 March is day 2 of a five-day period; 20 March is day 19, well past
    // ovulation.
    expect(history.phased[0].phase).toBe('menstrual');
    expect(history.phased[1].phase).toBe('luteal');
  });

  it('counts symptoms and moods separately', async () => {
    dailyLog.loadAllDailyEntries.mockResolvedValue([
      entry('2026-03-20', ['cramps'], 'bad'),
      entry('2026-03-21', ['cramps'], 'bad'),
    ]);

    const history = await getDailyLogHistory(db, TODAY);

    expect(history.symptomCorrelations.map((c) => c.id)).toEqual(['cramps']);
    expect(history.moodCorrelations.map((c) => c.id)).toEqual(['bad']);
  });

  it('reports the baseline every share is measured against', async () => {
    dailyLog.loadAllDailyEntries.mockResolvedValue([entry('2026-03-20', ['cramps'])]);

    const history = await getDailyLogHistory(db, TODAY);
    const placed = Object.values(history.placedDayTally).reduce((a, b) => a + b, 0);

    expect(placed).toBe(1);
  });

  it('indexes from the first recorded day, not from the first period', async () => {
    // Somebody can log a symptom before their first recorded period. The day is
    // still theirs and still listed; it simply has no phase.
    dailyLog.loadAllDailyEntries.mockResolvedValue([
      entry('2026-01-15', ['cramps']),
      entry('2026-03-20', ['cramps']),
    ]);

    const history = await getDailyLogHistory(db, TODAY);

    expect(history.phased[0].phase).toBeNull();
    expect(history.phased[1].phase).toBe('luteal');
    expect(history.symptomCorrelations[0].placedCount).toBe(1);
  });

  it('reads both sides in one go', async () => {
    // Two awaited reads could land either side of a write - the entries from
    // before a period was recorded and the profile from after it.
    await getDailyLogHistory(db, TODAY);

    expect(dailyLog.loadAllDailyEntries).toHaveBeenCalledTimes(1);
    expect(cycle.loadCycleProfile).toHaveBeenCalledTimes(1);
  });
});
