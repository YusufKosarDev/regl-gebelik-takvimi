import { NativeModule, requireOptionalNativeModule } from 'expo';

/**
 * The native side of the widget snapshot store.
 *
 * Text in, text out. Nothing here knows what a snapshot means — the shape is
 * the JS contract's business, and keeping the native surface to three string
 * operations means a change to the snapshot needs no rebuild of the app.
 */
declare class WidgetSnapshotBridgeModule extends NativeModule {
  /** Rejects on a blank string, and on a write the platform could not commit. */
  writeSnapshot(json: string): Promise<void>;
  /** `null` when nothing has been stored. */
  readSnapshot(): Promise<string | null>;
  clearSnapshot(): Promise<void>;
}

/**
 * `null` wherever the native module is not built in.
 *
 * Android-only, and only in a build that includes it: Expo Go ships a fixed set
 * of modules and this is not one of them. Optional rather than required so the
 * absence is a value the adapter can explain, instead of a module-not-found
 * thrown while the bundle is still loading.
 */
export default requireOptionalNativeModule<WidgetSnapshotBridgeModule>('WidgetSnapshotBridge');
