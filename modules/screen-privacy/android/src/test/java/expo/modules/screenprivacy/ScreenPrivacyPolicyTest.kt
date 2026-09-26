package expo.modules.screenprivacy

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Which lever on which Android version.
 *
 * Every boundary is tested from both sides. The app's `minSdkVersion` is 24 and
 * its `targetSdkVersion` is 36, so both branches ship and both are real.
 */
class ScreenPrivacyPolicyTest {

  @Test
  fun `the API 33 method is used from API 33`() {
    assertEquals(
      ScreenPrivacyAction.BLANK_RECENTS_THUMBNAIL,
      screenPrivacyAction(33, lockEnabled = true)
    )
    assertEquals(
      ScreenPrivacyAction.BLANK_RECENTS_THUMBNAIL,
      screenPrivacyAction(36, lockEnabled = true)
    )
  }

  /**
   * Blanking the thumbnail costs nothing on a version that has the method, so
   * there is no reason to show the cycle day in Overview to somebody flicking
   * through their open apps.
   */
  @Test
  fun `and is used whether or not a lock is set`() {
    assertEquals(
      ScreenPrivacyAction.BLANK_RECENTS_THUMBNAIL,
      screenPrivacyAction(33, lockEnabled = false)
    )
  }

  @Test
  fun `below API 33 the flag is the only option, and only with a lock`() {
    assertEquals(ScreenPrivacyAction.HOLD_SECURE_FLAG, screenPrivacyAction(32, lockEnabled = true))
    assertEquals(ScreenPrivacyAction.HOLD_SECURE_FLAG, screenPrivacyAction(24, lockEnabled = true))
  }

  /**
   * Without a lock the flag would take screenshots away from somebody who never
   * asked for the trade.
   */
  @Test
  fun `and nothing at all without one`() {
    assertEquals(ScreenPrivacyAction.NOTHING, screenPrivacyAction(32, lockEnabled = false))
    assertEquals(ScreenPrivacyAction.NOTHING, screenPrivacyAction(24, lockEnabled = false))
  }

  @Test
  fun `the boundary is at 33, from both sides`() {
    assertEquals(
      ScreenPrivacyAction.HOLD_SECURE_FLAG,
      screenPrivacyAction(RECENTS_SCREENSHOT_API - 1, lockEnabled = true)
    )
    assertEquals(
      ScreenPrivacyAction.BLANK_RECENTS_THUMBNAIL,
      screenPrivacyAction(RECENTS_SCREENSHOT_API, lockEnabled = true)
    )
  }

  /**
   * What the setup screen promises has to match what will happen.
   */
  @Test
  fun `screenshots are only blocked below 33`() {
    assertTrue(blocksScreenshots(24))
    assertTrue(blocksScreenshots(32))
    assertFalse(blocksScreenshots(33))
    assertFalse(blocksScreenshots(36))
  }

  /**
   * The app supports every one of these, so none of them may fall through.
   */
  @Test
  fun `every supported API level gets an answer`() {
    for (sdk in 24..40) {
      assertTrue(screenPrivacyAction(sdk, lockEnabled = true) != ScreenPrivacyAction.NOTHING)
    }
  }
}
