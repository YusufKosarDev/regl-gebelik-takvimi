import type { SQLiteDatabase } from 'expo-sqlite';

import type { CloudSyncPayloadV1 } from '../domain/cloud-sync-payload-v1';
import {
  CLOUD_SYNC_PAYLOAD_VERSION,
  validateCloudSyncPayloadV1,
} from '../domain/cloud-sync-payload-v1';

import { loadAvatarConfig } from '@/features/avatar/data/avatar-repository';
import { loadCycleProfile } from '@/features/cycle/data/cycle-repository';
import { loadNotificationPreferences } from '@/features/notifications/data/notification-preferences-repository';
import { loadPregnancyProfile } from '@/features/pregnancy/data/pregnancy-repository';

/**
 * Collects what a sync would be allowed to carry.
 *
 * Four reads, all of them repositories, and nothing else. No clock, no
 * dashboard, no daily support, no widget snapshot and no notification queue:
 * every one of those is either worked out from what is read here or belongs to
 * this device, and a payload that carried one would be sending an answer
 * instead of the thing the answer comes from.
 *
 * Nothing is sent. This builds the payload and hands it back; there is no
 * account, no upload and no network call anywhere in this app.
 *
 * The reads run together because none of them depends on another, and a person
 * with a long history should not wait four times over for something that is one
 * round trip's worth of work.
 *
 * The result is validated before it is returned, so a payload that could not be
 * read back is never handed out — and a corrupt row is found here rather than
 * on whatever would have received it.
 *
 * Reads only: nothing in the database is written, including by the validators,
 * which are pure.
 */
export async function buildCloudSyncPayloadV1(db: SQLiteDatabase): Promise<CloudSyncPayloadV1> {
  const [cycle, pregnancyProfile, avatarConfig, notificationPreferences] = await Promise.all([
    loadCycleProfile(db),
    loadPregnancyProfile(db),
    loadAvatarConfig(db),
    loadNotificationPreferences(db),
  ]);

  const payload: CloudSyncPayloadV1 = {
    version: CLOUD_SYNC_PAYLOAD_VERSION,
    cycleSettings: cycle?.settings ?? null,
    // An empty list rather than `null`: "nothing recorded yet" and "no history
    // to send" are the same thing, and a reader should not have to tell them
    // apart.
    periodRecords: cycle?.periodRecords ?? [],
    pregnancyProfile,
    avatarConfig,
    notificationPreferences,
  };

  validateCloudSyncPayloadV1(payload);

  return payload;
}
