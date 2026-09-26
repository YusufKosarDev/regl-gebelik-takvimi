package expo.modules.screenprivacy

/**
 * Which lever to pull on this Android version, and why there are two.
 *
 * Pure Kotlin with no Android imports, so the decision can be tested off-device
 * — which matters, because the alternative is two emulators and a rebuild every
 * time a threshold moves.
 *
 * ## The two levers are not equivalent
 *
 * `Activity.setRecentsScreenshotEnabled(false)` arrived in API 33. It blanks
 * the Overview thumbnail and nothing else: user screenshots, screen recording
 * and the Assistant are untouched. It is exactly the right tool and it costs
 * the person nothing.
 *
 * `FLAG_SECURE` works everywhere and is a blunt instrument. It blanks the
 * thumbnail *and* blocks every screenshot and screen recording — including the
 * one somebody wanted to take of their own calendar to show a doctor.
 *
 * ## Why the flag is not simply toggled on the way to the background
 *
 * Because that does not reliably work. The Overview thumbnail is captured
 * asynchronously with no guaranteed ordering against the activity lifecycle
 * callbacks, so a flag set in `onPause` or `onStop` can lose the race and the
 * snapshot is taken anyway. That race is the reason Google added the API 33
 * method in the first place. Below 33 the only dependable option is to hold the
 * flag for the whole session.
 *
 * ## So
 *
 *   - API 33 and up: blank the thumbnail, always, whether or not a lock is set.
 *     It costs nothing and there is no reason to show the cycle day in Overview
 *     to somebody flicking through their open apps.
 *   - API 32 and below: `FLAG_SECURE`, but only while a lock is set. Somebody
 *     who turned on an app lock has expressed exactly this preference, and the
 *     setup screen says screenshots will stop working.
 */

/** What the native side should actually do. */
enum class ScreenPrivacyAction {
  /** Blank the Overview thumbnail only. Screenshots keep working. */
  BLANK_RECENTS_THUMBNAIL,

  /** Hold FLAG_SECURE. Blocks the thumbnail and every screenshot. */
  HOLD_SECURE_FLAG,

  /** Neither: no lock on a version where the flag is the only option. */
  NOTHING
}

/** The API level where `setRecentsScreenshotEnabled` became available. */
const val RECENTS_SCREENSHOT_API = 33

fun screenPrivacyAction(sdkInt: Int, lockEnabled: Boolean): ScreenPrivacyAction {
  if (sdkInt >= RECENTS_SCREENSHOT_API) {
    return ScreenPrivacyAction.BLANK_RECENTS_THUMBNAIL
  }

  return if (lockEnabled) ScreenPrivacyAction.HOLD_SECURE_FLAG else ScreenPrivacyAction.NOTHING
}

/**
 * Whether this version blocks screenshots as the price of a blank thumbnail.
 *
 * Asked by the app so the setup screen only promises what will actually happen.
 */
fun blocksScreenshots(sdkInt: Int): Boolean = sdkInt < RECENTS_SCREENSHOT_API
