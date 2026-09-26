package expo.modules.screenprivacy

import android.app.Activity
import android.os.Build
import android.view.WindowManager
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

internal class MissingActivityException :
  CodedException("ERR_SCREEN_PRIVACY_NO_ACTIVITY", "There is no current activity.", null)

/**
 * Keeps the app's own screen out of the task switcher.
 *
 * The decision lives in `ScreenPrivacyPolicy`, which is pure and tested
 * off-device. This file does what it is told, on the UI thread, and says
 * nothing about what is on the screen: the cycle day, the phase and the
 * messages built from them all cross this app, and logcat is readable by
 * anything holding the device.
 *
 * Nothing here is reported back except whether it worked.
 */
class ScreenPrivacyModule : Module() {

  override fun definition() = ModuleDefinition {
    Name("ScreenPrivacy")

    /**
     * Applies the right protection for this Android version and lock state.
     *
     * Called on the lock being set or removed, and once on start. Idempotent:
     * calling it twice with the same argument does the same thing twice.
     */
    AsyncFunction("apply") { lockEnabled: Boolean ->
      val activity = appContext.currentActivity ?: throw MissingActivityException()

      when (screenPrivacyAction(Build.VERSION.SDK_INT, lockEnabled)) {
        ScreenPrivacyAction.BLANK_RECENTS_THUMBNAIL -> blankRecentsThumbnail(activity)
        ScreenPrivacyAction.HOLD_SECURE_FLAG -> setSecureFlag(activity, true)
        ScreenPrivacyAction.NOTHING -> setSecureFlag(activity, false)
      }
    }

    /** Whether a blank thumbnail costs screenshots on this version. */
    Function("blocksScreenshots") {
      blocksScreenshots(Build.VERSION.SDK_INT)
    }
  }

  /**
   * API 33 and up. Blanks the Overview thumbnail and touches nothing else.
   *
   * Set once and left set: there is no state to restore, because it does not
   * take anything away from the person.
   */
  private fun blankRecentsThumbnail(activity: Activity) {
    if (Build.VERSION.SDK_INT >= RECENTS_SCREENSHOT_API) {
      activity.runOnUiThread {
        @Suppress("DEPRECATION")
        activity.setRecentsScreenshotEnabled(false)
      }
    }
  }

  /**
   * API 32 and below. Held for the whole session rather than toggled.
   *
   * Toggling it around the background transition is the obvious thing to try
   * and it does not work: the Overview snapshot is taken asynchronously with no
   * guaranteed ordering against the lifecycle callbacks, so the flag can lose
   * the race and the thumbnail is captured anyway.
   */
  private fun setSecureFlag(activity: Activity, secure: Boolean) {
    activity.runOnUiThread {
      if (secure) {
        activity.window.setFlags(
          WindowManager.LayoutParams.FLAG_SECURE,
          WindowManager.LayoutParams.FLAG_SECURE
        )
      } else {
        activity.window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
      }
    }
  }
}
