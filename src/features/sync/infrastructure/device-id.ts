import AsyncStorage from '@react-native-async-storage/async-storage';

import { describeValue } from '@/shared/logging';

/**
 * A name this installation calls itself by, so a sync can recognise its own
 * writes.
 *
 * Made up here and kept here. It is not the hardware's id, not the account's,
 * not an advertising id and not derived from anything about the person or the
 * phone: it is a random string this app invented the first time it needed one,
 * and it means nothing anywhere else. Reinstalling the app gets a new one, and
 * that is correct — it is a different copy of the app, and nothing is lost by
 * it being called something new.
 *
 * It is a label rather than a secret. Nothing is authorised by holding it, so
 * it does not need to be unguessable; it needs to be the same tomorrow as it
 * was today, and different from whatever another phone calls itself.
 *
 * Kept in the same key-value store the small app state already uses, for the
 * same reason: it is one short string, not a queryable record.
 */

export const DEVICE_ID_STORAGE_KEY = 'sync-device-id';

/**
 * A fresh identifier.
 *
 * `crypto.randomUUID` where the runtime has it, which is the best answer and
 * costs nothing to ask for. Where it does not, a string of the same shape built
 * from `Math.random` and the clock: weaker randomness than a UUID deserves, and
 * entirely enough for a label whose only job is to differ from the label on
 * another phone.
 *
 * No dependency for either. A device id is not worth a package.
 */
export function generateDeviceId(): string {
  const runtimeCrypto = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;

  if (typeof runtimeCrypto?.randomUUID === 'function') {
    return runtimeCrypto.randomUUID();
  }

  const random = () => Math.random().toString(36).slice(2, 10);

  return `device-${Date.now().toString(36)}-${random()}${random()}`;
}

/** Whether something read out of storage is usable as an id. */
function isUsableDeviceId(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

/**
 * This installation's id, the same one every time it is asked for.
 *
 * Read once from storage; written only when there is nothing there. The value
 * is deliberately not cached in memory: the read is one key from a store the
 * app already talks to, and a cache would be a second place for the answer to
 * live and to go stale during a test.
 *
 * A stored value that is not usable — blank, or whatever a corrupt write left
 * behind — is replaced rather than raised over. Nothing depends on the old one:
 * an id nobody can read is not an identity to preserve, and refusing to sync
 * over it would be a strange way to protect it.
 */
export async function getDeviceId(): Promise<string> {
  const stored = await AsyncStorage.getItem(DEVICE_ID_STORAGE_KEY);

  if (isUsableDeviceId(stored)) {
    return stored;
  }

  const created = generateDeviceId();

  await AsyncStorage.setItem(DEVICE_ID_STORAGE_KEY, created);

  return created;
}

/**
 * Forgets the stored id.
 *
 * Nothing in the app calls this. It is here for a test, and for the day
 * somebody needs a deliberate way to make this installation look like a new
 * one — which is a decision, not something a failure should do by accident.
 */
export async function clearDeviceId(): Promise<void> {
  await AsyncStorage.removeItem(DEVICE_ID_STORAGE_KEY);
}

/**
 * What an envelope builder needs from this module, as a value it can be given.
 *
 * Passed in rather than imported where it is used, so the thing that builds an
 * envelope can be tested without a storage layer and cannot quietly acquire
 * one.
 */
export type DeviceIdProvider = () => Promise<string>;

/** The provider the app uses. */
export const deviceIdProvider: DeviceIdProvider = getDeviceId;

/** A provider that always answers with the same given id, for tests. */
export function fixedDeviceIdProvider(deviceId: string): DeviceIdProvider {
  if (!isUsableDeviceId(deviceId)) {
    throw new Error(`fixedDeviceIdProvider needs an id: received ${describeValue(deviceId)}.`);
  }

  return () => Promise.resolve(deviceId);
}
