import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { WidgetSnapshotV1 } from '../widget-snapshot-v1';
import { serializeWidgetSnapshotV1 } from '../widget-snapshot-v1';

import type { AvatarConfig } from '@/features/avatar/domain/avatar-config';
import type { ISODate } from '@/types/iso-date';

/**
 * The names the Android widget reads by.
 *
 * The widget parses this JSON in another process, in Kotlin, with no type
 * checker between the two sides. A rename here is invisible to `tsc` and would
 * show up as a card that silently went blank on someone's home screen, so the
 * names are pinned from both directions: the literals below, and a read of the
 * Kotlin file that must contain each one.
 */
const NATIVE_KOTLIN = join(
  __dirname,
  '../../../../../modules/widget-snapshot-bridge/android/src/main/java/expo/modules/widgetsnapshotbridge/WidgetSnapshotData.kt'
);

const SNAPSHOT_KEYS = [
  'version',
  'date',
  'cycleDay',
  'phase',
  'cycleDayLabel',
  'phaseLabel',
  'moodLabels',
  'supportMessage',
  'avatar',
] as const;

const AVATAR_KEYS = [
  'skinToneId',
  'hairStyleId',
  'hairColorId',
  'outfitId',
  'accessoryId',
] as const;

function avatar(): AvatarConfig {
  return {
    skinToneId: 'skin-tone-4',
    hairStyleId: 'bun',
    hairColorId: 'red',
    outfitId: 'dress',
    accessoryId: 'glasses',
  };
}

function snapshot(): WidgetSnapshotV1 {
  return {
    version: 1,
    date: '2026-09-18' as ISODate,
    cycleDay: 14,
    phase: 'ovulatory',
    cycleDayLabel: 'Döngünün 14. günü',
    phaseLabel: 'Yumurtlama',
    moodLabels: ['Yorgunluk olabilir'],
    supportMessage: 'Kendine alan tanı.',
    avatar: avatar(),
  };
}

const kotlin = readFileSync(NATIVE_KOTLIN, 'utf8');

describe('the JSON the widget is handed', () => {
  it('uses exactly the keys the widget reads', () => {
    const written = JSON.parse(serializeWidgetSnapshotV1(snapshot())) as Record<string, unknown>;

    expect(Object.keys(written).sort()).toEqual([...SNAPSHOT_KEYS].sort());
  });

  it('uses exactly the avatar keys the widget reads', () => {
    const written = JSON.parse(serializeWidgetSnapshotV1(snapshot())) as {
      avatar: Record<string, unknown>;
    };

    expect(Object.keys(written.avatar).sort()).toEqual([...AVATAR_KEYS].sort());
  });

  it('writes the version as the number 1', () => {
    // The widget compares it to an int; "1" would not match.
    expect(serializeWidgetSnapshotV1(snapshot())).toContain('"version":1');
  });

  it('writes an absent accessory as an absent key, which the widget reads as none', () => {
    const { accessoryId, ...rest } = avatar();

    void accessoryId;

    const text = serializeWidgetSnapshotV1({ ...snapshot(), avatar: rest });

    expect(text).not.toContain('accessoryId');
  });

  it('writes an absent mood list as an absent key', () => {
    const { moodLabels, ...rest } = snapshot();

    void moodLabels;

    expect(serializeWidgetSnapshotV1(rest)).not.toContain('moodLabels');
  });

  it('writes absent labels as absent keys, which the widget reads as its own', () => {
    const { cycleDayLabel, phaseLabel, ...rest } = snapshot();

    void cycleDayLabel;
    void phaseLabel;

    const text = serializeWidgetSnapshotV1(rest);

    // The Kotlin falls back to `widgetCycleDayLabel` / `widgetPhaseLabel` for
    // this shape, which is how a snapshot written before these fields existed
    // still draws rather than losing two lines.
    expect(text).not.toContain('cycleDayLabel');
    expect(text).not.toContain('phaseLabel');
  });

  it('names the fallback the widget uses when they are absent', () => {
    // Deleting either function would leave the absent-label case drawing
    // nothing, and nothing else in the suite reaches that path.
    expect(kotlin).toContain('fun widgetCycleDayLabel(');
    expect(kotlin).toContain('fun widgetPhaseLabel(');
    // And the one place the card and the screen reader both ask, so they
    // cannot end up in two different languages.
    expect(kotlin).toContain('fun cycleDayTextOf(');
    expect(kotlin).toContain('fun phaseTextOf(');
  });

  it('writes the phase as one of the four the widget can name', () => {
    // The widget prints nothing for a phase it cannot name, so a fifth value
    // would quietly lose the line rather than fail anywhere.
    for (const phase of ['menstrual', 'follicular', 'ovulatory', 'luteal'] as const) {
      expect(kotlin).toContain(`"${phase}" ->`);
    }
  });
});

describe('the Kotlin side reads the same names', () => {
  it.each(SNAPSHOT_KEYS)('reads %s', (key) => {
    expect(kotlin).toContain(`"${key}"`);
  });

  it.each(AVATAR_KEYS)('reads %s', (key) => {
    expect(kotlin).toContain(`"${key}"`);
  });

  it('agrees on the version it accepts', () => {
    expect(kotlin).toContain('WIDGET_SNAPSHOT_VERSION = 1');
  });
});
