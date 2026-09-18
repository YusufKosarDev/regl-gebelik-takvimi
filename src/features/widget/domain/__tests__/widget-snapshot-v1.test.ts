import type { WidgetSnapshotV1 } from '../widget-snapshot-v1';
import {
  WIDGET_SNAPSHOT_VERSION,
  parseWidgetSnapshotV1,
  serializeWidgetSnapshotV1,
  validateWidgetSnapshotV1,
} from '../widget-snapshot-v1';

import type { AvatarConfig } from '@/features/avatar/domain/avatar-config';
import type { CyclePhase } from '@/features/cycle/domain/phases';
import { CYCLE_PHASES } from '@/features/cycle/domain/phases';
import type { ISODate } from '@/types/iso-date';

function avatar(overrides: Partial<AvatarConfig> = {}): AvatarConfig {
  return {
    skinToneId: 'skin-tone-3',
    hairStyleId: 'bun',
    hairColorId: 'red',
    outfitId: 'dress',
    ...overrides,
  };
}

/** A complete snapshot, with everything a widget could be told. */
function snapshot(overrides: Partial<WidgetSnapshotV1> = {}): WidgetSnapshotV1 {
  return {
    version: 1,
    date: '2026-09-18' as ISODate,
    cycleDay: 18,
    phase: 'luteal',
    moodLabels: ['Yorgunluk olabilir', 'Unutkanlık olabilir'],
    supportMessage: 'Kendine nazik davranmak iyi gelebilir.',
    avatar: avatar(),
    ...overrides,
  };
}

/** The same snapshot with no moods at all, as a phase with none would be. */
function withoutMoods(overrides: Partial<WidgetSnapshotV1> = {}): WidgetSnapshotV1 {
  const { moodLabels, ...rest } = snapshot(overrides);

  void moodLabels;

  return rest;
}

/** The emptiest snapshot the contract allows: a date, and nothing known. */
function empty(): WidgetSnapshotV1 {
  return {
    version: 1,
    date: '2026-09-18' as ISODate,
    cycleDay: null,
    phase: null,
    supportMessage: null,
    avatar: null,
  };
}

describe('WIDGET_SNAPSHOT_VERSION', () => {
  it('is 1', () => {
    expect(WIDGET_SNAPSHOT_VERSION).toBe(1);
  });
});

describe('validateWidgetSnapshotV1 with a usable snapshot', () => {
  it('accepts a full one', () => {
    expect(() => validateWidgetSnapshotV1(snapshot())).not.toThrow();
  });

  it('accepts one with nothing known but the date', () => {
    expect(() => validateWidgetSnapshotV1(empty())).not.toThrow();
  });

  it('accepts one with no moods', () => {
    expect(() => validateWidgetSnapshotV1(withoutMoods())).not.toThrow();
  });

  it('accepts an explicitly undefined mood list', () => {
    expect(() => validateWidgetSnapshotV1(snapshot({ moodLabels: undefined }))).not.toThrow();
  });

  it('accepts a single mood', () => {
    expect(() => validateWidgetSnapshotV1(snapshot({ moodLabels: ['tek'] }))).not.toThrow();
  });

  it.each(CYCLE_PHASES)('accepts the %s phase', (phase) => {
    expect(() => validateWidgetSnapshotV1(snapshot({ phase }))).not.toThrow();
  });

  it('accepts cycle day 1', () => {
    expect(() => validateWidgetSnapshotV1(snapshot({ cycleDay: 1 }))).not.toThrow();
  });

  it('accepts a long cycle day', () => {
    expect(() => validateWidgetSnapshotV1(snapshot({ cycleDay: 90 }))).not.toThrow();
  });

  it('accepts an avatar with an accessory', () => {
    expect(() =>
      validateWidgetSnapshotV1(snapshot({ avatar: avatar({ accessoryId: 'glasses' }) }))
    ).not.toThrow();
  });

  it('accepts a phase with no support message', () => {
    // The two are independent: the widget can know the phase and still have
    // nothing written to say about it.
    expect(() =>
      validateWidgetSnapshotV1(withoutMoods({ supportMessage: null }))
    ).not.toThrow();
  });

  it('returns nothing', () => {
    expect(validateWidgetSnapshotV1(snapshot())).toBeUndefined();
  });
});

describe('validateWidgetSnapshotV1 with a bad version', () => {
  it.each([0, 2, -1, 1.5, '1', null, undefined])('refuses %p', (version) => {
    expect(() =>
      validateWidgetSnapshotV1(snapshot({ version: version as 1 }))
    ).toThrow(/expects version 1/);
  });

  it('names the version it found', () => {
    expect(() => validateWidgetSnapshotV1(snapshot({ version: 2 as 1 }))).toThrow(
      'WidgetSnapshotV1 expects version 1, received 2.'
    );
  });
});

describe('validateWidgetSnapshotV1 with a bad date', () => {
  it.each(['', '  ', '2026-13-01', '2026-02-30', '18-09-2026', '2026-9-18', 'bugün'])(
    'refuses %p',
    (date) => {
      expect(() => validateWidgetSnapshotV1(snapshot({ date: date as ISODate }))).toThrow(
        /invalid date/
      );
    }
  );

  it.each([null, undefined, 20260918])('refuses %p, which is not text', (date) => {
    expect(() => validateWidgetSnapshotV1(snapshot({ date: date as unknown as ISODate }))).toThrow(
      /invalid date/
    );
  });

  it('accepts a leap day that exists', () => {
    expect(() =>
      validateWidgetSnapshotV1(snapshot({ date: '2028-02-29' as ISODate }))
    ).not.toThrow();
  });
});

describe('validateWidgetSnapshotV1 with a bad cycle day', () => {
  it.each([0, -1, -20])('refuses %p, which is no day of a cycle', (cycleDay) => {
    expect(() => validateWidgetSnapshotV1(snapshot({ cycleDay }))).toThrow(/out-of-range cycleDay/);
  });

  it.each([1.5, Number.NaN, Number.POSITIVE_INFINITY])('refuses %p', (cycleDay) => {
    expect(() => validateWidgetSnapshotV1(snapshot({ cycleDay }))).toThrow(
      /non-integer cycleDay/
    );
  });

  it.each(['18', undefined, {}])('refuses %p, which is not a number', (cycleDay) => {
    expect(() =>
      validateWidgetSnapshotV1(snapshot({ cycleDay: cycleDay as unknown as number }))
    ).toThrow(/non-integer cycleDay/);
  });
});

describe('validateWidgetSnapshotV1 with a bad phase', () => {
  it.each(['gebelik', 'Luteal', '', 'LUTEAL'])('refuses %p', (phase) => {
    expect(() => validateWidgetSnapshotV1(snapshot({ phase: phase as CyclePhase }))).toThrow(
      /invalid phase/
    );
  });

  it.each([undefined, 3, {}])('refuses %p, which is not text', (phase) => {
    expect(() =>
      validateWidgetSnapshotV1(snapshot({ phase: phase as unknown as CyclePhase }))
    ).toThrow(/invalid phase/);
  });
});

describe('validateWidgetSnapshotV1 with bad moods', () => {
  it('refuses an empty list, which is not the same as none', () => {
    expect(() => validateWidgetSnapshotV1(snapshot({ moodLabels: [] }))).toThrow(
      /lists no moods; omit moodLabels instead/
    );
  });

  it('refuses a list that is not a list', () => {
    expect(() =>
      validateWidgetSnapshotV1(snapshot({ moodLabels: 'yorgunluk' as unknown as string[] }))
    ).toThrow(/non-array moodLabels/);
  });

  it.each(['', '   ', '\t\n'])('refuses the blank mood %p', (mood) => {
    expect(() => validateWidgetSnapshotV1(snapshot({ moodLabels: ['iyi', mood] }))).toThrow(
      /blank moodLabels\[1\]/
    );
  });

  it('refuses a mood that is not text', () => {
    expect(() =>
      validateWidgetSnapshotV1(snapshot({ moodLabels: [7] as unknown as string[] }))
    ).toThrow(/blank moodLabels\[0\]/);
  });

  it('refuses the same mood twice', () => {
    expect(() =>
      validateWidgetSnapshotV1(snapshot({ moodLabels: ['yorgunluk', 'yorgunluk'] }))
    ).toThrow(/lists "yorgunluk" more than once/);
  });

  it('refuses a repeat that differs only by surrounding whitespace', () => {
    expect(() =>
      validateWidgetSnapshotV1(snapshot({ moodLabels: ['yorgunluk', ' yorgunluk '] }))
    ).toThrow(/more than once/);
  });
});

describe('validateWidgetSnapshotV1 with a bad support message', () => {
  it.each(['', '   ', '\n'])('refuses %p', (supportMessage) => {
    expect(() => validateWidgetSnapshotV1(snapshot({ supportMessage }))).toThrow(
      /blank supportMessage/
    );
  });

  it.each([undefined, 7, {}])('refuses %p, which is neither text nor null', (supportMessage) => {
    expect(() =>
      validateWidgetSnapshotV1(snapshot({ supportMessage: supportMessage as unknown as string }))
    ).toThrow(/blank supportMessage/);
  });
});

describe('validateWidgetSnapshotV1 with a bad avatar', () => {
  it.each(['skinToneId', 'hairStyleId', 'hairColorId', 'outfitId'] as const)(
    'refuses one with a blank %s',
    (field) => {
      expect(() =>
        validateWidgetSnapshotV1(snapshot({ avatar: avatar({ [field]: '  ' }) }))
      ).toThrow(new RegExp(`blank ${field}`));
    }
  );

  it('refuses one with a blank accessory', () => {
    expect(() =>
      validateWidgetSnapshotV1(snapshot({ avatar: avatar({ accessoryId: '' }) }))
    ).toThrow(/blank accessoryId/);
  });

  it.each([undefined, 'skin-tone-1', 7])('refuses %p in place of an avatar', (value) => {
    expect(() =>
      validateWidgetSnapshotV1(snapshot({ avatar: value as unknown as AvatarConfig }))
    ).toThrow();
  });

  it('refuses an array in place of an avatar', () => {
    expect(() =>
      validateWidgetSnapshotV1(snapshot({ avatar: [] as unknown as AvatarConfig }))
    ).toThrow(/non-object avatar/);
  });

  it('accepts an avatar whose ids this build does not offer', () => {
    // The widget draws what was chosen; whether an option still ships is the
    // catalogue's business, not the contract's.
    expect(() =>
      validateWidgetSnapshotV1(snapshot({ avatar: avatar({ hairStyleId: 'mohawk' }) }))
    ).not.toThrow();
  });
});

describe('validateWidgetSnapshotV1 with something that is not a snapshot', () => {
  it.each([null, undefined, 'snapshot', 7, true, []])('refuses %p', (value) => {
    expect(() => validateWidgetSnapshotV1(value as unknown as WidgetSnapshotV1)).toThrow();
  });
});

describe('validateWidgetSnapshotV1 purity', () => {
  it('leaves the snapshot as it found it', () => {
    const shot = snapshot();
    const before = JSON.stringify(shot);

    validateWidgetSnapshotV1(shot);

    expect(JSON.stringify(shot)).toBe(before);
  });

  it('does not trim the stored moods as a side effect', () => {
    const shot = snapshot({ moodLabels: [' yorgunluk '] });

    validateWidgetSnapshotV1(shot);

    expect(shot.moodLabels).toEqual([' yorgunluk ']);
  });

  it('does not give a snapshot the mood list it did not have', () => {
    const shot = withoutMoods();

    validateWidgetSnapshotV1(shot);

    expect('moodLabels' in shot).toBe(false);
  });

  it('leaves it alone even when it rejects it', () => {
    const shot = snapshot({ cycleDay: 0 });
    const before = JSON.stringify(shot);

    expect(() => validateWidgetSnapshotV1(shot)).toThrow();
    expect(JSON.stringify(shot)).toBe(before);
  });
});

describe('serializeWidgetSnapshotV1', () => {
  it('writes JSON', () => {
    expect(JSON.parse(serializeWidgetSnapshotV1(snapshot()))).toEqual(snapshot());
  });

  it('carries the version in the text', () => {
    expect(serializeWidgetSnapshotV1(snapshot())).toContain('"version":1');
  });

  it('leaves the mood key out when there are none', () => {
    expect(serializeWidgetSnapshotV1(withoutMoods())).not.toContain('moodLabels');
  });

  it('writes nulls rather than dropping the keys', () => {
    const text = serializeWidgetSnapshotV1(empty());

    expect(text).toContain('"cycleDay":null');
    expect(text).toContain('"phase":null');
    expect(text).toContain('"supportMessage":null');
    expect(text).toContain('"avatar":null');
  });

  it('refuses to write a snapshot that could not be read back', () => {
    expect(() => serializeWidgetSnapshotV1(snapshot({ cycleDay: 0 }))).toThrow(
      /out-of-range cycleDay/
    );
  });

  it('does not mutate the snapshot it writes', () => {
    const shot = snapshot();
    const before = JSON.stringify(shot);

    serializeWidgetSnapshotV1(shot);

    expect(JSON.stringify(shot)).toBe(before);
  });
});

describe('parseWidgetSnapshotV1', () => {
  it('reads back what was written', () => {
    expect(parseWidgetSnapshotV1(serializeWidgetSnapshotV1(snapshot()))).toEqual(snapshot());
  });

  it('round-trips the emptiest snapshot', () => {
    expect(parseWidgetSnapshotV1(serializeWidgetSnapshotV1(empty()))).toEqual(empty());
  });

  it('round-trips one with no moods, still without the key', () => {
    const read = parseWidgetSnapshotV1(serializeWidgetSnapshotV1(withoutMoods()));

    expect('moodLabels' in read).toBe(false);
    expect(read).toEqual(withoutMoods());
  });

  it('round-trips an avatar with an accessory', () => {
    const shot = snapshot({ avatar: avatar({ accessoryId: 'earrings' }) });

    expect(parseWidgetSnapshotV1(serializeWidgetSnapshotV1(shot))).toEqual(shot);
  });

  it('hands back an object the caller did not already hold', () => {
    const shot = snapshot();
    const read = parseWidgetSnapshotV1(serializeWidgetSnapshotV1(shot));

    expect(read).not.toBe(shot);
    expect(read.avatar).not.toBe(shot.avatar);
  });
});

describe('parseWidgetSnapshotV1 with text it cannot use', () => {
  it.each(['', '{', 'not json', '{"version":1,', '[1,2', 'undefined'])(
    'refuses %p',
    (json) => {
      expect(() => parseWidgetSnapshotV1(json)).toThrow(/could not read the snapshot as JSON/);
    }
  );

  it.each([null, undefined, 7, {}])('refuses %p, which is not text', (json) => {
    expect(() => parseWidgetSnapshotV1(json as unknown as string)).toThrow(/expects text/);
  });

  it('refuses valid JSON that is not a snapshot', () => {
    expect(() => parseWidgetSnapshotV1('null')).toThrow(/not a snapshot/);
    expect(() => parseWidgetSnapshotV1('[]')).toThrow(/not a snapshot/);
    expect(() => parseWidgetSnapshotV1('"snapshot"')).toThrow(/not a snapshot/);
  });

  it('refuses a snapshot from another version', () => {
    const text = JSON.stringify({ ...snapshot(), version: 2 });

    expect(() => parseWidgetSnapshotV1(text)).toThrow(/expects version 1, received 2/);
  });

  it('refuses one with no version at all', () => {
    const { version, ...rest } = snapshot();

    void version;

    expect(() => parseWidgetSnapshotV1(JSON.stringify(rest))).toThrow(/expects version 1/);
  });

  it('checks the rest as well as the version', () => {
    const text = JSON.stringify({ ...snapshot(), date: '2026-02-30' });

    expect(() => parseWidgetSnapshotV1(text)).toThrow(/invalid date/);
  });

  it('refuses a mood list that arrived empty', () => {
    const text = JSON.stringify({ ...snapshot(), moodLabels: [] });

    expect(() => parseWidgetSnapshotV1(text)).toThrow(/lists no moods/);
  });

  it('refuses an avatar that arrived broken', () => {
    const text = JSON.stringify({ ...snapshot(), avatar: { skinToneId: 'skin-tone-1' } });

    expect(() => parseWidgetSnapshotV1(text)).toThrow(/hairStyleId/);
  });
});

describe('parseWidgetSnapshotV1 with fields it does not know', () => {
  it('reads a snapshot that carries extra keys', () => {
    const text = JSON.stringify({ ...snapshot(), fertilityLevel: 'low', pregnancyWeek: 12 });

    expect(() => parseWidgetSnapshotV1(text)).not.toThrow();
  });

  it('keeps the fields it does know', () => {
    const text = JSON.stringify({ ...snapshot(), somethingNew: true });
    const read = parseWidgetSnapshotV1(text);

    expect(read.date).toBe('2026-09-18');
    expect(read.phase).toBe('luteal');
    expect(read.cycleDay).toBe(18);
  });

  it('does not strip them either', () => {
    // Nothing is rewritten on the way in: a later build added them for a reason,
    // and dropping them here would silently undo that on a round trip.
    const text = JSON.stringify({ ...snapshot(), somethingNew: true });
    const read = parseWidgetSnapshotV1(text) as WidgetSnapshotV1 & { somethingNew?: boolean };

    expect(read.somethingNew).toBe(true);
  });

  it('still refuses an extra field alongside a broken known one', () => {
    const text = JSON.stringify({ ...snapshot(), somethingNew: true, cycleDay: 0 });

    expect(() => parseWidgetSnapshotV1(text)).toThrow(/cycleDay/);
  });
});
