import WidgetSnapshotBridge from '../../../../modules/widget-snapshot-bridge/src/WidgetSnapshotBridgeModule';
import type { WidgetSnapshotV1 } from '../domain/widget-snapshot-v1';
import { parseWidgetSnapshotV1, serializeWidgetSnapshotV1 } from '../domain/widget-snapshot-v1';

/**
 * The app's side of the widget snapshot store.
 *
 * The only place the native bridge is spoken to. Above this line the app deals
 * in `WidgetSnapshotV1`; below it, in strings — so the contract is enforced
 * once, here, and the native module never has to know what a snapshot is.
 *
 * Every read is validated. Text in `SharedPreferences` survives app updates,
 * restores and downgrades, so what comes back is not something this build
 * necessarily wrote, and treating it as trusted is how a widget ends up drawing
 * a day that has passed.
 */

const UNAVAILABLE_MESSAGE =
  'The widget snapshot bridge is not available in this build. It is an Android ' +
  'native module, so it needs a development build or a release build — Expo Go ' +
  'does not include it.';

/**
 * The native module, or a clear refusal.
 *
 * Nothing is faked when it is missing. A stub that silently did nothing would
 * make a widget that never updates look exactly like one that has nothing to
 * say, and the difference matters while this is being built.
 */
function bridge(): NonNullable<typeof WidgetSnapshotBridge> {
  if (WidgetSnapshotBridge === null || WidgetSnapshotBridge === undefined) {
    throw new Error(UNAVAILABLE_MESSAGE);
  }

  return WidgetSnapshotBridge;
}

/** Whether this build can reach the store at all. */
export function isWidgetSnapshotBridgeAvailable(): boolean {
  return WidgetSnapshotBridge !== null && WidgetSnapshotBridge !== undefined;
}

/**
 * Stores the snapshot for the widget to draw.
 *
 * Serialized first, which validates it: a snapshot the app could not read back
 * never reaches storage, so the widget is never handed something it will choke
 * on. A failure from the native side is passed on rather than swallowed —
 * whether the widget is up to date is the caller's business to know.
 *
 * The snapshot is read, never mutated.
 */
export async function saveWidgetSnapshot(snapshot: WidgetSnapshotV1): Promise<void> {
  const json = serializeWidgetSnapshotV1(snapshot);

  await bridge().writeSnapshot(json);
}

/**
 * The stored snapshot, or `null` when there is none.
 *
 * `null` is an answer, not a failure: nothing has been stored yet. Text that is
 * there but unreadable is the opposite — it throws, because a corrupt snapshot
 * is a thing to notice rather than to quietly replace with "no data".
 */
export async function loadWidgetSnapshot(): Promise<WidgetSnapshotV1 | null> {
  const json = await bridge().readSnapshot();

  if (json === null || json === undefined) {
    return null;
  }

  return parseWidgetSnapshotV1(json);
}

/**
 * Removes the stored snapshot.
 *
 * Only this one key. Whatever else the app may come to keep for the widget is
 * not this function's to clear.
 */
export async function clearWidgetSnapshot(): Promise<void> {
  await bridge().clearSnapshot();
}
