import type { AvatarConfig } from '@/features/avatar/domain/avatar-config';
import { validateAvatarConfig } from '@/features/avatar/domain/avatar-config';
import type { CyclePhase } from '@/features/cycle/domain/phases';
import { isCyclePhase } from '@/features/cycle/domain/phases';
import type { ISODate } from '@/types/iso-date';
import { isISODate } from '@/utils/date';

/**
 * What a home screen widget is told, version 1.
 *
 * A contract rather than a view model. A widget runs in another process, is
 * drawn by code this app does not control, and can be asked to redraw long
 * after the app was last open — so it is handed a flat, finished snapshot with
 * no functions, no dates to compute and nothing to look up. Everything it shows
 * is already decided here.
 *
 * `version` is part of the data and is checked on the way in. A widget built
 * against version 1 that meets a version 2 snapshot must refuse it rather than
 * read fields that have moved; the alternative is a widget quietly showing the
 * wrong day. That is also why this file is named for its version: version 2,
 * when there is one, is a new type beside this one rather than an edit to it.
 *
 * The nullable fields are nullable because the app genuinely does not always
 * know. No cycle recorded yet means no cycle day and no phase, and `null` says
 * that; a 0 or an empty string would be a number and a sentence the widget
 * would then have to interpret.
 *
 * `moodLabels` is optional for the reason it is optional everywhere else: a
 * phase with nothing well supported to say about mood says nothing, and a
 * present-but-empty list would be a card promising moods and showing none.
 */
export type WidgetSnapshotV1 = {
  readonly version: 1;
  readonly date: ISODate;

  readonly cycleDay: number | null;
  readonly phase: CyclePhase | null;

  readonly moodLabels?: readonly string[];
  readonly supportMessage: string | null;

  readonly avatar: AvatarConfig | null;
};

/** The only version this module reads or writes. */
export const WIDGET_SNAPSHOT_VERSION = 1;

function fail(field: string, value: unknown, reason: string): never {
  throw new Error(`WidgetSnapshotV1 has ${reason} ${field}: ${JSON.stringify(value)}.`);
}

function assertVersion(version: unknown): void {
  if (version !== WIDGET_SNAPSHOT_VERSION) {
    throw new Error(
      `WidgetSnapshotV1 expects version ${WIDGET_SNAPSHOT_VERSION}, received ` +
        `${JSON.stringify(version)}.`
    );
  }
}

function assertDate(date: unknown): void {
  if (typeof date !== 'string' || !isISODate(date)) {
    fail('date', date, 'an invalid');
  }
}

/**
 * The day of the cycle, when there is one.
 *
 * Counted from 1, never 0: day 1 is the first day of a period, and a widget
 * printing "0. gün" would be reporting a day nobody is on.
 */
function assertCycleDay(cycleDay: unknown): void {
  if (cycleDay === null) {
    return;
  }

  if (typeof cycleDay !== 'number' || !Number.isInteger(cycleDay)) {
    fail('cycleDay', cycleDay, 'a non-integer');
  }

  if ((cycleDay as number) < 1) {
    fail('cycleDay', cycleDay, 'an out-of-range');
  }
}

function assertPhase(phase: unknown): void {
  if (phase === null) {
    return;
  }

  if (typeof phase !== 'string' || !isCyclePhase(phase)) {
    fail('phase', phase, 'an invalid');
  }
}

/**
 * The moods, when the snapshot carries any.
 *
 * Absent is valid and skipped. A list that is there has to be usable, and the
 * same mood twice reads as two observations when it is one.
 */
function assertMoodLabels(moodLabels: unknown): void {
  if (moodLabels === undefined) {
    return;
  }

  if (!Array.isArray(moodLabels)) {
    fail('moodLabels', moodLabels, 'a non-array');
  }

  const labels = moodLabels as unknown[];

  if (labels.length === 0) {
    throw new Error('WidgetSnapshotV1 lists no moods; omit moodLabels instead.');
  }

  const seen = new Set<string>();

  labels.forEach((label, index) => {
    if (typeof label !== 'string' || label.trim() === '') {
      fail(`moodLabels[${index}]`, label, 'a blank');
    }

    const mood = (label as string).trim();

    if (seen.has(mood)) {
      throw new Error(`WidgetSnapshotV1 lists ${JSON.stringify(mood)} more than once.`);
    }

    seen.add(mood);
  });
}

function assertSupportMessage(supportMessage: unknown): void {
  if (supportMessage === null) {
    return;
  }

  if (typeof supportMessage !== 'string' || supportMessage.trim() === '') {
    fail('supportMessage', supportMessage, 'a blank');
  }
}

/**
 * The avatar, checked by the same rules the editor saves under.
 *
 * Delegated rather than restated: a widget drawing an avatar the app would
 * refuse to store would be drawing something nobody chose.
 */
function assertAvatar(avatar: unknown): void {
  if (avatar === null) {
    return;
  }

  if (typeof avatar !== 'object' || Array.isArray(avatar)) {
    fail('avatar', avatar, 'a non-object');
  }

  validateAvatarConfig(avatar as AvatarConfig);
}

/**
 * Checks one snapshot, throwing on the first rule it breaks.
 *
 * Pure: nothing is mutated, no field is trimmed or defaulted, and the snapshot
 * is read exactly as given.
 */
export function validateWidgetSnapshotV1(snapshot: WidgetSnapshotV1): void {
  if (typeof snapshot !== 'object' || snapshot === null || Array.isArray(snapshot)) {
    throw new Error(
      `validateWidgetSnapshotV1 received something that is not a snapshot: ${JSON.stringify(
        snapshot
      )}.`
    );
  }

  assertVersion(snapshot.version);
  assertDate(snapshot.date);
  assertCycleDay(snapshot.cycleDay);
  assertPhase(snapshot.phase);
  assertMoodLabels(snapshot.moodLabels);
  assertSupportMessage(snapshot.supportMessage);
  assertAvatar(snapshot.avatar);
}

/**
 * The snapshot as the text that crosses to the widget.
 *
 * Validated before it is written, because the far side cannot ask a question
 * about what it received — it either draws the snapshot or it does not.
 *
 * Plain `JSON.stringify`: no ordering, no whitespace and no encoding of its own,
 * so anything that can read JSON can read this.
 */
export function serializeWidgetSnapshotV1(snapshot: WidgetSnapshotV1): string {
  validateWidgetSnapshotV1(snapshot);

  return JSON.stringify(snapshot);
}

/**
 * The snapshot a piece of text claims to be.
 *
 * Everything is checked again on the way in. Text that has been sitting in
 * storage across an app update, a restore or a downgrade is not something this
 * app wrote a moment ago, and trusting it because the app wrote it once is how
 * a widget ends up drawing a day that is not today.
 *
 * Fields the reader does not know are ignored rather than refused, so a
 * snapshot written by a later build that only *added* fields still reads. A
 * different `version` is refused outright, since that is the marker for fields
 * that moved rather than fields that appeared.
 *
 * Pure: the text is read, and the object returned is the parsed one, not a
 * reference to anything the caller holds.
 */
export function parseWidgetSnapshotV1(json: string): WidgetSnapshotV1 {
  if (typeof json !== 'string') {
    throw new Error(
      `parseWidgetSnapshotV1 expects text, received ${JSON.stringify(json)}.`
    );
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(json);
  } catch (error) {
    throw new Error(
      `parseWidgetSnapshotV1 could not read the snapshot as JSON: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  validateWidgetSnapshotV1(parsed as WidgetSnapshotV1);

  return parsed as WidgetSnapshotV1;
}
