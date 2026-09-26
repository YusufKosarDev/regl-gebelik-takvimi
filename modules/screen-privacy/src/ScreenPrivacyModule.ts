import { NativeModule, requireOptionalNativeModule } from 'expo';

/**
 * The native side of keeping this app out of the task switcher.
 *
 * Two operations and no state. What to do on which Android version is decided
 * in Kotlin, where the version number is, and tested there off-device.
 */
declare class ScreenPrivacyModule extends NativeModule {
  /**
   * Applies the right protection for this Android version and lock state.
   *
   * Rejects when there is no current activity, which is a real state during a
   * cold start rather than a fault.
   */
  apply(lockEnabled: boolean): Promise<void>;

  /**
   * Whether a blank task-switcher thumbnail costs screenshots here.
   *
   * True below Android 13, where `FLAG_SECURE` is the only dependable lever and
   * it takes screenshots with it. The setup screen asks so it only promises
   * what will actually happen.
   */
  blocksScreenshots(): boolean;
}

/**
 * `null` wherever the native module is not built in.
 *
 * Android-only and only in a build that includes it. Optional rather than
 * required so the absence is a value the adapter can explain, instead of a
 * module-not-found thrown while the bundle is still loading.
 */
export default requireOptionalNativeModule<ScreenPrivacyModule>('ScreenPrivacy');
