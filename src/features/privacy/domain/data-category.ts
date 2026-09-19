import { describeValue } from '@/shared/logging';

/**
 * What this app holds, named once, so a later sync feature has something to
 * point at instead of a list someone retypes.
 *
 * The split here is not about size or convenience. Everything in
 * `DATA_CATEGORIES` is something a person entered or chose, and losing it to a
 * reinstall is losing their own record of themselves — that is what makes it
 * worth offering to sync. Everything in `EXCLUDED_FROM_CLOUD_SYNC` is something
 * this device worked out or stored for itself, and it can be rebuilt on the
 * next device from the categories that do sync.
 *
 * Nothing in this file syncs anything. There is no account, no network call and
 * no Firebase in this app; this is the boundary a sync feature would have to be
 * built inside of, written down before the feature exists rather than after.
 */

/** What a person entered, and the only thing a sync may ever carry. */
export const DATA_CATEGORIES = [
  'cycle-settings',
  'period-records',
  'pregnancy-profile',
  'avatar-config',
  'notification-preferences',
] as const;

export type DataCategory = (typeof DATA_CATEGORIES)[number];

/**
 * What this device keeps to itself.
 *
 * Each of these is either derived from the categories above, or a record of
 * what this particular device did — a queued alarm, a file another process
 * reads, which half of the app was last open. A second device has its own
 * answers to all of them, and copying this one's would be copying the wrong
 * thing.
 */
export const EXCLUDED_FROM_CLOUD_SYNC = [
  'widget-snapshot',
  'auth-session',
  'shared-preferences',
  'scheduled-notifications',
  'app-mode',
  'derived-cycle-data',
  'content-sources',
  'logs',
] as const;

export type ExcludedFromCloudSync = (typeof EXCLUDED_FROM_CLOUD_SYNC)[number];

/** One line of the inventory, and the reason behind it. */
export type DataInventoryEntry = {
  readonly id: DataCategory | ExcludedFromCloudSync;
  /** Everything is on the device. That is the point of the second field. */
  readonly storedOnDevice: true;
  readonly cloudSyncCandidate: boolean;
  readonly reason: string;
};

/**
 * The whole inventory, in one place.
 *
 * `docs/data-privacy.md` is the same table in prose, and a test holds the two
 * to each other: a category added here without a line there, or the other way
 * round, fails rather than drifting.
 */
export const DATA_INVENTORY: readonly DataInventoryEntry[] = [
  {
    id: 'cycle-settings',
    storedOnDevice: true,
    cloudSyncCandidate: true,
    reason: 'Kişinin kendi girdiği döngü ve regl süresi; yeniden kurulumda kaybolmamalı.',
  },
  {
    id: 'period-records',
    storedOnDevice: true,
    cloudSyncCandidate: true,
    reason: 'Kişinin kendi tuttuğu regl geçmişi; başka türlü geri getirilemez.',
  },
  {
    id: 'pregnancy-profile',
    storedOnDevice: true,
    cloudSyncCandidate: true,
    reason: 'Son regl tarihi ve tahmini doğum tarihi; kişinin girdiği kayıt.',
  },
  {
    id: 'avatar-config',
    storedOnDevice: true,
    cloudSyncCandidate: true,
    reason: 'Kişinin seçtiği görünüm; yeni cihazda yeniden seçtirmek gereksiz.',
  },
  {
    id: 'notification-preferences',
    storedOnDevice: true,
    cloudSyncCandidate: true,
    reason: 'Kişinin açıp kapattığı hatırlatıcılar; tercih, cihaz durumu değil.',
  },
  {
    id: 'widget-snapshot',
    storedOnDevice: true,
    cloudSyncCandidate: false,
    reason:
      'Bu cihazın ana ekranı için üretilmiş kopya; kaynak veriden her an yeniden üretilir, yedeğe girmez.',
  },
  {
    id: 'auth-session',
    storedOnDevice: true,
    cloudSyncCandidate: false,
    reason:
      'Firebase Auth oturumu ve tokeni; bu cihaza ait, zaten hesabın kendisinde duruyor.',
  },
  {
    id: 'shared-preferences',
    storedOnDevice: true,
    cloudSyncCandidate: false,
    reason: 'Android tarafındaki yerel depolama; içeriği bu cihaza ait.',
  },
  {
    id: 'scheduled-notifications',
    storedOnDevice: true,
    cloudSyncCandidate: false,
    reason:
      'Sistem kuyruğundaki alarmlar ve kimlikleri; her cihaz kendi kuyruğunu tercihlerden kurar.',
  },
  {
    id: 'app-mode',
    storedOnDevice: true,
    cloudSyncCandidate: false,
    reason: 'Hangi sekmenin açık olduğu gibi arayüz durumu; kişisel kayıt değil.',
  },
  {
    id: 'derived-cycle-data',
    storedOnDevice: true,
    cloudSyncCandidate: false,
    reason:
      'Döngü günü, evre, doğurganlık tahmini, ruh hali ve takvim; kayıtlardan hesaplanır.',
  },
  {
    id: 'content-sources',
    storedOnDevice: true,
    cloudSyncCandidate: false,
    reason: 'Uygulamayla gelen metin ve kaynak adresleri; kişiye ait veri değil.',
  },
  {
    id: 'logs',
    storedOnDevice: true,
    cloudSyncCandidate: false,
    reason: 'Yalnızca genel olay adları yazılır; sağlık verisi hiç girmez.',
  },
];

/** Whether something is one of the categories a sync may carry. */
export function isDataCategory(value: unknown): value is DataCategory {
  return typeof value === 'string' && (DATA_CATEGORIES as readonly string[]).includes(value);
}

/** Whether something is one of the things that stays on this device. */
export function isExcludedFromCloudSync(value: unknown): value is ExcludedFromCloudSync {
  return (
    typeof value === 'string' && (EXCLUDED_FROM_CLOUD_SYNC as readonly string[]).includes(value)
  );
}

/**
 * Whether a named piece of data may be carried by a sync.
 *
 * Anything this file has not been told about is refused rather than allowed:
 * a category nobody has thought about is exactly the one that should not leave
 * the device by default.
 */
export function isCloudSyncCandidate(id: string): boolean {
  if (isDataCategory(id)) {
    return true;
  }

  if (isExcludedFromCloudSync(id)) {
    return false;
  }

  throw new Error(`isCloudSyncCandidate received an id it does not know: ${describeValue(id)}.`);
}
