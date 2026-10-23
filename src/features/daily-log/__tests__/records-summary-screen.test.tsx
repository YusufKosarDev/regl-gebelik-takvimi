import { render } from '@testing-library/react-native';
import React from 'react';

import RecordsSummaryScreen from '@/app/(app)/records-summary';
import type { DailyEntry } from '@/features/daily-log/domain/catalogues';
import { MIN_ENTRIES_FOR_CORRELATION } from '@/features/daily-log/domain/symptom-phase-correlation';
import { recordsSummaryMessages } from '@/features/daily-log/presentation/records-summary-messages';
import type { ISODate } from '@/types/iso-date';

/**
 * The promises this screen makes, as tests.
 *
 * Three of them, and each is a rule from somewhere else in the codebase that
 * this screen is the most likely place to break:
 *
 * - no bar under five entries, which is the number the domain uses and for the
 *   same reason;
 * - the disclaimer under everything, every time, including when there is
 *   nothing above it;
 * - the baseline drawn, because four counts without it are four numbers.
 */

jest.mock('expo-router', () => require('../../../../jest/expo-router-mock'));

jest.mock('@/storage/db', () => ({
  openAppDatabase: jest.fn(),
  DATABASE_NAME: 'regl-gebelik.db',
}));

jest.mock('@/features/daily-log/data/daily-log-repository', () => ({
  loadAllDailyEntries: jest.fn(),
}));

jest.mock('@/features/cycle/data/cycle-repository', () => ({
  loadCycleProfile: jest.fn(),
}));

const db = jest.requireMock('@/storage/db');
const dailyLog = jest.requireMock('@/features/daily-log/data/daily-log-repository');
const cycle = jest.requireMock('@/features/cycle/data/cycle-repository');

const tr = recordsSummaryMessages.tr;

/** A day holding one symptom, on a date the cycle can place. */
function entry(date: string, symptomIds: readonly string[]): DailyEntry {
  return { date: date as ISODate, flowId: null, moodId: null, symptomIds, notes: null } as DailyEntry;
}

/**
 * Days spread forward from a recorded period start.
 *
 * The dates matter only in that the cycle can place them, which is what makes
 * `placedCount` non-zero — the whole screen is about placed days.
 */
function daysHolding(symptom: string, howMany: number): readonly DailyEntry[] {
  return Array.from({ length: howMany }, (_, index) =>
    entry(`2026-09-${String(3 + index).padStart(2, '0')}`, [symptom])
  );
}

function profile(startDates: readonly string[]) {
  // `CycleProfile` keeps the two averages under `settings`, and `endDate` is
  // absent rather than null on a record that has none.
  return {
    settings: { averageCycleLengthDays: 28, averagePeriodLengthDays: 5 },
    periodRecords: startDates.map((startDate, index) => ({
      id: `r${index}`,
      startDate: startDate as ISODate,
      isOngoing: false,
    })),
  };
}

async function open() {
  const view = await render(<RecordsSummaryScreen />);

  // The screen reads the database in an effect; let it land.
  await view.findByText(tr.screenTitle);

  return view;
}

/** Every string anywhere in the tree. */
function texts(tree: unknown): string[] {
  const out: string[] = [];

  const walk = (value: unknown): void => {
    if (typeof value === 'string') {
      out.push(value);
    } else if (Array.isArray(value)) {
      value.forEach(walk);
    } else if (value !== null && typeof value === 'object') {
      walk((value as { children?: unknown }).children);
    }
  };

  walk(tree);

  return out;
}

beforeEach(() => {
  db.openAppDatabase.mockResolvedValue({});
  cycle.loadCycleProfile.mockResolvedValue(profile(['2026-09-01']));
  dailyLog.loadAllDailyEntries.mockResolvedValue([]);
});

describe('the records summary with enough of one symptom', () => {
  beforeEach(() => {
    dailyLog.loadAllDailyEntries.mockResolvedValue(
      daysHolding('cramps', MIN_ENTRIES_FOR_CORRELATION)
    );
  });

  it('draws a bar for it', async () => {
    const view = await open();

    expect(view.getByTestId('bar-cramps')).toBeTruthy();
  });

  it('draws the baseline too, because a bar without it is a number', async () => {
    const view = await open();

    expect(view.getByTestId('baseline-bar')).toBeTruthy();
  });

  it('says what the baseline is for', async () => {
    const view = await open();

    expect(view.getByText(tr.baselineNote)).toBeTruthy();
  });

  it('does not offer the below-threshold note when nothing is below it', async () => {
    const view = await open();

    expect(view.queryByText(tr.belowThresholdNote)).toBeNull();
  });

  /**
   * Each bar's row is a heading, so the bars are something to jump between.
   *
   * Without it the screen is one flat run and the only way to reach the fourth
   * symptom with a screen reader is to hear the first three. The bar itself
   * carries all four counts in one spoken stop - `phase-breakdown-bar.tsx` says
   * why - which only helps if there is a way to get to the right bar.
   */
  it('heads each bar, so a screen reader can move between them', async () => {
    const view = await open();

    const headings = view
      .getAllByRole('header')
      .map((node) => node.props.children)
      .filter((text): text is string => typeof text === 'string');

    expect(headings).toContain(tr.barHeading('Kramp', MIN_ENTRIES_FOR_CORRELATION));
  });
});

describe('the records summary with too little of one symptom', () => {
  beforeEach(() => {
    dailyLog.loadAllDailyEntries.mockResolvedValue(
      daysHolding('cramps', MIN_ENTRIES_FOR_CORRELATION - 1)
    );
  });

  /**
   * The rule the screen exists to keep.
   *
   * Four days drawn as a bar is a bar whose length means four. The count is
   * still shown — somebody is entitled to see what they recorded — but as a
   * number, which cannot be misread as a measurement.
   */
  it('draws no bar for it', async () => {
    const view = await open();

    expect(view.queryByTestId('bar-cramps')).toBeNull();
  });

  it('shows the count instead', async () => {
    const view = await open();

    expect(
      texts(view.toJSON()).some((text) =>
        text.includes(tr.countOnly('Kramp', MIN_ENTRIES_FOR_CORRELATION - 1))
      )
    ).toBe(true);
  });

  it('says why the bar is missing rather than leaving a gap', async () => {
    const view = await open();

    expect(view.getByText(tr.belowThresholdNote)).toBeTruthy();
  });
});

describe('the records summary with nothing recorded', () => {
  it('says so rather than drawing empty sections', async () => {
    const view = await open();

    expect(view.getByText(tr.emptyTitle)).toBeTruthy();
    expect(view.queryByTestId('baseline-bar')).toBeNull();
  });

  /**
   * The disclaimer is about what the screen is, not about any line on it, so
   * it is there when there are no lines at all. The panel this screen opens
   * from makes the same promise and has the same test.
   */
  it('still carries the disclaimer', async () => {
    const view = await open();

    expect(view.getByText(tr.disclaimer)).toBeTruthy();
  });
});

describe('the cycle length section', () => {
  beforeEach(() => {
    dailyLog.loadAllDailyEntries.mockResolvedValue(daysHolding('cramps', 1));
  });

  it('asks for more starts rather than reporting from two', async () => {
    // Two starts make one gap, and the domain needs three gaps before a median
    // is a choice between observations rather than an average of two numbers.
    cycle.loadCycleProfile.mockResolvedValue(profile(['2026-07-01', '2026-08-01']));

    const view = await open();

    expect(view.getByText(tr.cycleLengthNotEnough)).toBeTruthy();
  });

  it('reports the spread in days and puts no word on it', async () => {
    cycle.loadCycleProfile.mockResolvedValue(
      profile(['2026-05-01', '2026-06-01', '2026-07-01', '2026-08-01'])
    );

    const view = await open();
    const written = texts(view.toJSON()).join(' | ').toLowerCase();

    // `build-cycle-outlook.ts` dropped `assessCycleRegularity` so the app would
    // not label a body. The spread is a number of days and stays one.
    for (const label of ['düzensiz', 'düzenli', 'irregular', 'regular']) {
      expect([label, written.includes(label)]).toEqual([label, false]);
    }
  });
});
