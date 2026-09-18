import type { WidgetSnapshotV1 } from '../domain/widget-snapshot-v1';
import { WIDGET_SNAPSHOT_VERSION, validateWidgetSnapshotV1 } from '../domain/widget-snapshot-v1';

import type { AvatarConfig } from '@/features/avatar/domain/avatar-config';
import type { CycleDashboard } from '@/features/cycle/application/get-cycle-dashboard';
import type { CycleDailySupport } from '@/features/cycle/domain/daily-support';
import type { ISODate } from '@/types/iso-date';

/**
 * What the snapshot is assembled from.
 *
 * Everything is passed in and nothing is read here: no database, no clock and
 * no catalogue. The caller has already done that work for the screen, and the
 * widget must be told the same thing the screen was.
 */
export type WidgetSnapshotV1Input = {
  readonly today: ISODate;
  /** `null` before anything has been recorded. */
  readonly cycleDashboard: CycleDashboard | null;
  /** `null` on a day with no phase, and for a phase nothing is written for. */
  readonly dailySupport: CycleDailySupport | null;
  readonly avatar: AvatarConfig | null;
};

/**
 * Copies today's state into the widget's contract.
 *
 * Nothing is calculated. The cycle day and phase are the dashboard's, the words
 * are the daily support's, and the avatar is whatever was saved: this function
 * exists so the widget and the home screen cannot disagree, which would be
 * exactly what recomputing here would risk.
 *
 * `today` is taken as given rather than read from the dashboard, because the
 * snapshot's date is the day it describes and a caller with no dashboard still
 * has one. Where both exist they are the same day — the dashboard was built for
 * `today` — and the snapshot records it once.
 *
 * `moodLabels` is left off entirely when there are none, rather than set to
 * `undefined`: the key's absence is what "nothing well supported to say" looks
 * like on the far side of `JSON.stringify`.
 *
 * The result is validated before it is returned, so a snapshot that could not
 * be read back is never handed out.
 *
 * Pure: every input is read and none is mutated.
 */
export function buildWidgetSnapshotV1(input: WidgetSnapshotV1Input): WidgetSnapshotV1 {
  const { today, cycleDashboard, dailySupport, avatar } = input;

  const snapshot: WidgetSnapshotV1 = {
    version: WIDGET_SNAPSHOT_VERSION,
    date: today,
    cycleDay: cycleDashboard?.cycleDay ?? null,
    phase: cycleDashboard?.phase ?? null,
    ...(dailySupport?.moodLabels === undefined ? {} : { moodLabels: dailySupport.moodLabels }),
    supportMessage: dailySupport?.supportMessage ?? null,
    avatar,
  };

  validateWidgetSnapshotV1(snapshot);

  return snapshot;
}
