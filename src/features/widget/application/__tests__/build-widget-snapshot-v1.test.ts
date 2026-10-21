import type { WidgetSnapshotV1Input } from '../build-widget-snapshot-v1';
import { buildWidgetSnapshotV1 } from '../build-widget-snapshot-v1';

import type { AvatarConfig } from '@/features/avatar/domain/avatar-config';
import type { CycleDashboard } from '@/features/cycle/application/get-cycle-dashboard';
import { buildCycleDashboard } from '@/features/cycle/application/get-cycle-dashboard';
import { CYCLE_DAILY_SUPPORT } from '@/features/cycle/data/cycle-daily-support';
import type { CycleDailySupport } from '@/features/cycle/domain/daily-support';
import { getCycleDailySupport } from '@/features/cycle/domain/daily-support';
import { CYCLE_PHASES } from '@/features/cycle/domain/phases';
import type { CycleProfile } from '@/features/cycle/domain/types';
import { cycleLabels } from '@/features/cycle/presentation/cycle-labels';
import { widgetMessages } from '@/features/widget/presentation/widget-messages';
import type { ISODate } from '@/types/iso-date';
import { parseWidgetSnapshotV1, serializeWidgetSnapshotV1 } from '@/features/widget/domain/widget-snapshot-v1';

const date = (value: string) => value as ISODate;

/** Cycle 28 from 2026-09-01: days 1-5 menstrual, 14 ovulatory, 15 on luteal. */
function profile(): CycleProfile {
  return {
    settings: { averageCycleLengthDays: 28, averagePeriodLengthDays: 5 },
    periodRecords: [{ id: 'r0', startDate: date('2026-09-01'), isOngoing: false }],
  };
}

function dashboard(today = '2026-09-18'): CycleDashboard {
  return buildCycleDashboard(profile(), date(today));
}

function support(phase: (typeof CYCLE_PHASES)[number] = 'luteal'): CycleDailySupport {
  const found = getCycleDailySupport(CYCLE_DAILY_SUPPORT, phase);

  if (found === null) {
    throw new Error(`no content for the ${phase} phase`);
  }

  return found;
}

function avatar(overrides: Partial<AvatarConfig> = {}): AvatarConfig {
  return {
    skinToneId: 'skin-tone-3',
    hairStyleId: 'bun',
    hairColorId: 'red',
    outfitId: 'dress',
    ...overrides,
  };
}

/**
 * The builder with the Turkish catalogues.
 *
 * Every case written before the card's words moved out of Kotlin asserts
 * Turkish, so the default here is Turkish and those cases are untouched. The
 * two language cases at the bottom pass their own halves.
 */
function build(input: Omit<WidgetSnapshotV1Input, 'messages' | 'labels'>) {
  return buildWidgetSnapshotV1({
    ...input,
    messages: widgetMessages.tr,
    labels: cycleLabels.tr,
  });
}

describe('buildWidgetSnapshotV1 with everything to hand', () => {
  it('stamps the version', () => {
    const snapshot = build({
      today: date('2026-09-18'),
      cycleDashboard: dashboard(),
      dailySupport: support(),
      avatar: avatar(),
    });

    expect(snapshot.version).toBe(1);
  });

  it('records the day it was asked about', () => {
    const snapshot = build({
      today: date('2026-09-18'),
      cycleDashboard: dashboard(),
      dailySupport: support(),
      avatar: avatar(),
    });

    expect(snapshot.date).toBe('2026-09-18');
  });

  it('copies the cycle day and phase the dashboard reported', () => {
    const cycleDashboard = dashboard();

    const snapshot = build({
      today: date('2026-09-18'),
      cycleDashboard,
      dailySupport: support(),
      avatar: avatar(),
    });

    expect(snapshot.cycleDay).toBe(cycleDashboard.cycleDay);
    expect(snapshot.phase).toBe(cycleDashboard.phase);
  });

  it('computes nothing of its own', () => {
    // A dashboard that disagrees with the date proves the builder copies rather
    // than calculates: it reports the dashboard's day, not the date's.
    const snapshot = build({
      today: date('2026-09-18'),
      cycleDashboard: dashboard('2026-09-03'),
      dailySupport: support('menstrual'),
      avatar: null,
    });

    expect(snapshot.date).toBe('2026-09-18');
    expect(snapshot.cycleDay).toBe(3);
    expect(snapshot.phase).toBe('menstrual');
  });

  it('copies the support message', () => {
    const dailySupport = support();

    const snapshot = build({
      today: date('2026-09-18'),
      cycleDashboard: dashboard(),
      dailySupport,
      avatar: null,
    });

    expect(snapshot.supportMessage).toBe(dailySupport.supportMessage);
  });

  it('copies the moods', () => {
    const dailySupport = support();

    const snapshot = build({
      today: date('2026-09-18'),
      cycleDashboard: dashboard(),
      dailySupport,
      avatar: null,
    });

    expect(snapshot.moodLabels).toEqual(dailySupport.moodLabels);
  });

  it('carries the avatar through as it was given', () => {
    const chosen = avatar({ accessoryId: 'glasses' });

    const snapshot = build({
      today: date('2026-09-18'),
      cycleDashboard: dashboard(),
      dailySupport: support(),
      avatar: chosen,
    });

    expect(snapshot.avatar).toEqual(chosen);
  });

  it('carries no source or fertility field across', () => {
    // The widget's contract is not the dashboard's; only the listed fields go.
    const snapshot = build({
      today: date('2026-09-18'),
      cycleDashboard: dashboard(),
      dailySupport: support(),
      avatar: avatar(),
    });

    expect(Object.keys(snapshot).sort()).toEqual([
      'avatar',
      'cycleDay',
      'cycleDayLabel',
      'date',
      'moodLabels',
      'phase',
      'phaseLabel',
      'supportMessage',
      'version',
    ]);
  });
});

/**
 * The words the card prints, which used to be built in Kotlin.
 *
 * The Turkish half is asserted against the exact strings the Kotlin `when` and
 * template produced, because the point of moving them was the English half —
 * not a reworded Turkish card.
 */
describe('buildWidgetSnapshotV1 and the card’s own words', () => {
  function wordsIn(language: 'tr' | 'en') {
    return buildWidgetSnapshotV1({
      today: date('2026-09-18'),
      cycleDashboard: dashboard(),
      dailySupport: support(),
      avatar: avatar(),
      messages: widgetMessages[language],
      labels: cycleLabels[language],
    });
  }

  it('names the day and the phase in Turkish exactly as the Kotlin did', () => {
    const snapshot = wordsIn('tr');

    expect(snapshot.cycleDayLabel).toBe('Döngünün 18. günü');
    expect(snapshot.phaseLabel).toBe('Luteal');
  });

  it('names them in English when that is the language', () => {
    const snapshot = wordsIn('en');

    expect(snapshot.cycleDayLabel).toBe('Cycle day 18');
    expect(snapshot.phaseLabel).toBe('Luteal');
  });

  it('names the menstrual phase differently in each', () => {
    // 'Regl' and 'Period' — the one phase whose two words are not the same,
    // so this is what proves the catalogue is actually being read.
    expect(
      buildWidgetSnapshotV1({
        today: date('2026-09-02'),
        cycleDashboard: dashboard('2026-09-02'),
        dailySupport: support('menstrual'),
        avatar: avatar(),
        messages: widgetMessages.tr,
        labels: cycleLabels.tr,
      }).phaseLabel
    ).toBe('Regl');

    expect(
      buildWidgetSnapshotV1({
        today: date('2026-09-02'),
        cycleDashboard: dashboard('2026-09-02'),
        dailySupport: support('menstrual'),
        avatar: avatar(),
        messages: widgetMessages.en,
        labels: cycleLabels.en,
      }).phaseLabel
    ).toBe('Period');
  });

  it('leaves both keys off when there is no cycle to name', () => {
    const snapshot = build({
      today: date('2026-09-18'),
      cycleDashboard: null,
      dailySupport: null,
      avatar: null,
    });

    // A card hides the line it has nothing to put on, so the absence is the
    // key not being there rather than a null or an empty string.
    expect('cycleDayLabel' in snapshot).toBe(false);
    expect('phaseLabel' in snapshot).toBe(false);
    expect(serializeWidgetSnapshotV1(snapshot)).not.toContain('cycleDayLabel');
    expect(serializeWidgetSnapshotV1(snapshot)).not.toContain('phaseLabel');
  });
});

describe('buildWidgetSnapshotV1 with a phase that says nothing about mood', () => {
  it('leaves the key off entirely', () => {
    const snapshot = build({
      today: date('2026-09-14'),
      cycleDashboard: dashboard('2026-09-14'),
      dailySupport: support('ovulatory'),
      avatar: null,
    });

    expect('moodLabels' in snapshot).toBe(false);
    expect(snapshot.moodLabels).toBeUndefined();
  });

  it('still carries the message', () => {
    const snapshot = build({
      today: date('2026-09-14'),
      cycleDashboard: dashboard('2026-09-14'),
      dailySupport: support('ovulatory'),
      avatar: null,
    });

    expect(snapshot.phase).toBe('ovulatory');
    expect(snapshot.supportMessage).toBe(support('ovulatory').supportMessage);
  });

  it('writes no mood key into the JSON either', () => {
    const snapshot = build({
      today: date('2026-09-14'),
      cycleDashboard: dashboard('2026-09-14'),
      dailySupport: support('ovulatory'),
      avatar: null,
    });

    expect(serializeWidgetSnapshotV1(snapshot)).not.toContain('moodLabels');
  });
});

describe('buildWidgetSnapshotV1 with nothing recorded', () => {
  it('reports no cycle day and no phase', () => {
    const snapshot = build({
      today: date('2026-09-18'),
      cycleDashboard: null,
      dailySupport: null,
      avatar: null,
    });

    expect(snapshot.cycleDay).toBeNull();
    expect(snapshot.phase).toBeNull();
  });

  it('reports no message and no moods', () => {
    const snapshot = build({
      today: date('2026-09-18'),
      cycleDashboard: null,
      dailySupport: null,
      avatar: null,
    });

    expect(snapshot.supportMessage).toBeNull();
    expect('moodLabels' in snapshot).toBe(false);
  });

  it('still records the date and the version', () => {
    const snapshot = build({
      today: date('2026-09-18'),
      cycleDashboard: null,
      dailySupport: null,
      avatar: null,
    });

    expect(snapshot.date).toBe('2026-09-18');
    expect(snapshot.version).toBe(1);
  });

  it('still round-trips', () => {
    const snapshot = build({
      today: date('2026-09-18'),
      cycleDashboard: null,
      dailySupport: null,
      avatar: null,
    });

    expect(parseWidgetSnapshotV1(serializeWidgetSnapshotV1(snapshot))).toEqual(snapshot);
  });
});

describe('buildWidgetSnapshotV1 with some of it missing', () => {
  it('keeps the cycle when there is no avatar', () => {
    const snapshot = build({
      today: date('2026-09-18'),
      cycleDashboard: dashboard(),
      dailySupport: support(),
      avatar: null,
    });

    expect(snapshot.avatar).toBeNull();
    expect(snapshot.phase).toBe('luteal');
  });

  it('keeps the avatar when there is no cycle', () => {
    const chosen = avatar();

    const snapshot = build({
      today: date('2026-09-18'),
      cycleDashboard: null,
      dailySupport: null,
      avatar: chosen,
    });

    expect(snapshot.avatar).toEqual(chosen);
    expect(snapshot.cycleDay).toBeNull();
  });

  it('keeps the phase when nothing is written for it', () => {
    const snapshot = build({
      today: date('2026-09-18'),
      cycleDashboard: dashboard(),
      dailySupport: null,
      avatar: null,
    });

    expect(snapshot.phase).toBe('luteal');
    expect(snapshot.supportMessage).toBeNull();
    expect('moodLabels' in snapshot).toBe(false);
  });

  it('reports a day with no phase as having none', () => {
    // Before the first recorded period there is no cycle day to be on.
    const snapshot = build({
      today: date('2026-08-25'),
      cycleDashboard: dashboard('2026-08-25'),
      dailySupport: null,
      avatar: avatar(),
    });

    expect(snapshot.cycleDay).toBeNull();
    expect(snapshot.phase).toBeNull();
  });
});

describe('buildWidgetSnapshotV1 across the phases', () => {
  it.each([
    ['2026-09-03', 'menstrual'],
    ['2026-09-10', 'follicular'],
    ['2026-09-14', 'ovulatory'],
    ['2026-09-20', 'luteal'],
  ] as const)('builds a readable snapshot for %s', (today, phase) => {
    const snapshot = build({
      today: date(today),
      cycleDashboard: dashboard(today),
      dailySupport: support(phase),
      avatar: avatar(),
    });

    expect(snapshot.phase).toBe(phase);
    expect(parseWidgetSnapshotV1(serializeWidgetSnapshotV1(snapshot))).toEqual(snapshot);
  });
});

describe('buildWidgetSnapshotV1 refusing what it could not write', () => {
  it('refuses a date that is not one', () => {
    expect(() =>
      build({
        today: date('2026-02-30'),
        cycleDashboard: null,
        dailySupport: null,
        avatar: null,
      })
    ).toThrow(/invalid date/);
  });

  it('refuses an avatar the editor would not save', () => {
    expect(() =>
      build({
        today: date('2026-09-18'),
        cycleDashboard: null,
        dailySupport: null,
        avatar: avatar({ outfitId: '  ' }),
      })
    ).toThrow(/blank outfitId/);
  });
});

describe('buildWidgetSnapshotV1 purity', () => {
  it('does not change the dashboard it was given', () => {
    const cycleDashboard = dashboard();
    const before = JSON.stringify(cycleDashboard);

    build({
      today: date('2026-09-18'),
      cycleDashboard,
      dailySupport: support(),
      avatar: avatar(),
    });

    expect(JSON.stringify(cycleDashboard)).toBe(before);
  });

  it('does not change the daily support it was given', () => {
    const dailySupport = support();
    const before = JSON.stringify(dailySupport);

    build({
      today: date('2026-09-18'),
      cycleDashboard: dashboard(),
      dailySupport,
      avatar: avatar(),
    });

    expect(JSON.stringify(dailySupport)).toBe(before);
  });

  it('does not change the shipped content it read that support from', () => {
    const before = JSON.stringify(CYCLE_DAILY_SUPPORT);

    build({
      today: date('2026-09-18'),
      cycleDashboard: dashboard(),
      dailySupport: support(),
      avatar: avatar(),
    });

    expect(JSON.stringify(CYCLE_DAILY_SUPPORT)).toBe(before);
  });

  it('does not change the avatar it was given', () => {
    const chosen = avatar({ accessoryId: 'glasses' });
    const before = JSON.stringify(chosen);

    build({
      today: date('2026-09-18'),
      cycleDashboard: dashboard(),
      dailySupport: support(),
      avatar: chosen,
    });

    expect(JSON.stringify(chosen)).toBe(before);
  });

  it('does not change its input object', () => {
    const input = {
      today: date('2026-09-18'),
      cycleDashboard: dashboard(),
      dailySupport: support(),
      avatar: avatar(),
    };
    const before = JSON.stringify(input);

    build(input);

    expect(JSON.stringify(input)).toBe(before);
  });

  it('builds the same snapshot every time', () => {
    const input = {
      today: date('2026-09-18'),
      cycleDashboard: dashboard(),
      dailySupport: support(),
      avatar: avatar(),
    };

    expect(build(input)).toEqual(build(input));
  });
});
