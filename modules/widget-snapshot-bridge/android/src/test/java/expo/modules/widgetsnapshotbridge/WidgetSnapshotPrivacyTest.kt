package expo.modules.widgetsnapshotbridge

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * What the native side is allowed to say out loud.
 *
 * The snapshot is health data: a cycle day, a phase, the messages built from
 * them and an avatar. It crosses this module on its way to a widget, and logcat
 * is readable by anything holding the device, so none of it is written down —
 * not in a log line and not in an exception message that becomes one.
 */
class WidgetSnapshotPrivacyTest {

  private val snapshot =
    """{"version":1,"date":"2026-09-18","cycleDay":14,"phase":"ovulatory",""" +
      """"supportMessage":"Kendine alan tanı.",""" +
      """"avatar":{"skinToneId":"skin-tone-4","hairStyleId":"bun","hairColorId":"red",""" +
      """"outfitId":"dress"}}"""

  private fun leaks(text: String): Boolean {
    val markers = listOf(
      "2026-09-18",
      "ovulatory",
      "Kendine alan",
      "skin-tone-4",
      "bun",
      "dress",
      "cycleDay"
    )

    return markers.any { text.contains(it) }
  }

  @Test
  fun `the write failure says what failed, not what it was writing`() {
    val message = WriteFailedException("store").message ?: ""

    assertFalse(leaks(message))
    assertTrue(message.contains("Could not store the widget snapshot"))
  }

  @Test
  fun `the blank refusal quotes nothing`() {
    val message = BlankSnapshotException().message ?: ""

    assertFalse(leaks(message))
  }

  @Test
  fun `the missing context error quotes nothing`() {
    assertFalse(leaks(MissingContextException().message ?: ""))
  }

  @Test
  fun `a snapshot that cannot be parsed produces nothing to write down`() {
    // The parser answers with null rather than an exception carrying the text,
    // so a stored snapshot from another version cannot reach a log through one.
    assertTrue(parseWidgetSnapshot("{\"version\":2,\"date\":\"2026-09-18\"}") == null)
    assertTrue(parseWidgetSnapshot("not json at all") == null)
  }

  @Test
  fun `parsing a good snapshot still works, so this is not passing by accident`() {
    val parsed = parseWidgetSnapshot(snapshot)

    assertTrue(parsed != null)
    assertTrue(parsed?.cycleDay == 14)
  }

  @Test
  fun `the preferences file and key are the only ones named`() {
    assertTrue(WIDGET_SNAPSHOT_PREFERENCES_FILE == "widget_snapshot")
    assertTrue(WIDGET_SNAPSHOT_KEY == "snapshot_v1")
  }
}
