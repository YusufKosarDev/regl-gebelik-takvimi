package expo.modules.widgetsnapshotbridge

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Choosing a layout for the size the launcher reports.
 *
 * The thresholds are tested from both sides, because a widget is resized by
 * dragging and every boundary is somewhere a person's finger will stop.
 */
class WidgetSizeClassTest {

  @Test
  fun `the size the widget is added at is medium`() {
    // The declared cell: 250dp by 110dp.
    assertEquals(WidgetSizeClass.MEDIUM, widgetSizeClass(250, 110))
  }

  @Test
  fun `a short card is small however wide`() {
    assertEquals(WidgetSizeClass.SMALL, widgetSizeClass(360, 99))
    assertEquals(WidgetSizeClass.SMALL, widgetSizeClass(250, 80))
  }

  @Test
  fun `a narrow card is small however tall`() {
    assertEquals(WidgetSizeClass.SMALL, widgetSizeClass(199, 320))
    assertEquals(WidgetSizeClass.SMALL, widgetSizeClass(160, 200))
  }

  @Test
  fun `a tall and wide card is large`() {
    assertEquals(WidgetSizeClass.LARGE, widgetSizeClass(250, 180))
    assertEquals(WidgetSizeClass.LARGE, widgetSizeClass(360, 320))
  }

  @Test
  fun `tall but not wide enough stays medium`() {
    assertEquals(WidgetSizeClass.MEDIUM, widgetSizeClass(249, 180))
  }

  @Test
  fun `wide but not tall enough stays medium`() {
    assertEquals(WidgetSizeClass.MEDIUM, widgetSizeClass(360, 179))
  }

  @Test
  fun `each boundary is decided on the exact dp`() {
    assertEquals(WidgetSizeClass.SMALL, widgetSizeClass(WIDGET_SMALL_MAX_WIDTH_DP - 1, 200))
    assertEquals(WidgetSizeClass.MEDIUM, widgetSizeClass(WIDGET_SMALL_MAX_WIDTH_DP, 120))

    assertEquals(WidgetSizeClass.SMALL, widgetSizeClass(300, WIDGET_SMALL_MAX_HEIGHT_DP - 1))
    assertEquals(WidgetSizeClass.MEDIUM, widgetSizeClass(300, WIDGET_SMALL_MAX_HEIGHT_DP))

    assertEquals(
      WidgetSizeClass.LARGE,
      widgetSizeClass(WIDGET_LARGE_MIN_WIDTH_DP, WIDGET_LARGE_MIN_HEIGHT_DP)
    )
    assertEquals(
      WidgetSizeClass.MEDIUM,
      widgetSizeClass(WIDGET_LARGE_MIN_WIDTH_DP, WIDGET_LARGE_MIN_HEIGHT_DP - 1)
    )
    assertEquals(
      WidgetSizeClass.MEDIUM,
      widgetSizeClass(WIDGET_LARGE_MIN_WIDTH_DP - 1, WIDGET_LARGE_MIN_HEIGHT_DP)
    )
  }

  @Test
  fun `a size the launcher could not report falls back to the one it was added at`() {
    assertEquals(WidgetSizeClass.MEDIUM, widgetSizeClass(0, 0))
    assertEquals(WidgetSizeClass.MEDIUM, widgetSizeClass(0, 200))
    assertEquals(WidgetSizeClass.MEDIUM, widgetSizeClass(250, 0))
    assertEquals(WidgetSizeClass.MEDIUM, widgetSizeClass(-1, -1))
  }
}

class WidgetMoodTextTest {

  private val moods = listOf("Yorgunluk olabilir", "Unutkanlık olabilir", "Uykusuzluk olabilir", "Dördüncü")

  @Test
  fun `a small card shows no moods at all`() {
    assertEquals(0, widgetMoodLimit(WidgetSizeClass.SMALL))
    assertNull(widgetMoodText(moods, WidgetSizeClass.SMALL))
  }

  @Test
  fun `a medium card joins them onto one line`() {
    val text = widgetMoodText(moods, WidgetSizeClass.MEDIUM)

    assertEquals("Yorgunluk olabilir · Unutkanlık olabilir · Uykusuzluk olabilir", text)
    assertFalse(text!!.contains("\n"))
  }

  @Test
  fun `a large card gives them a line each`() {
    val text = widgetMoodText(moods, WidgetSizeClass.LARGE)

    assertEquals(
      "• Yorgunluk olabilir\n• Unutkanlık olabilir\n• Uykusuzluk olabilir",
      text
    )
  }

  @Test
  fun `no moods means no row, whatever the size`() {
    WidgetSizeClass.values().forEach { size ->
      assertNull(widgetMoodText(emptyList(), size))
    }
  }

  @Test
  fun `a single mood reads the same either way`() {
    assertEquals("bir", widgetMoodText(listOf("bir"), WidgetSizeClass.MEDIUM))
    assertEquals("• bir", widgetMoodText(listOf("bir"), WidgetSizeClass.LARGE))
  }

  @Test
  fun `no size shows more than a few`() {
    WidgetSizeClass.values().forEach { size ->
      val text = widgetMoodText(moods, size) ?: ""

      assertFalse(text.contains("Dördüncü"))
    }
  }
}

class WidgetContentDescriptionTest {

  private fun snapshot(
    cycleDay: Int? = 1,
    phase: String? = "menstrual",
    moods: List<String> = listOf("Kramplar olabilir"),
    message: String? = "Kendine alan tanı.",
    avatar: WidgetAvatar? = WidgetAvatar("skin-tone-4", "bun", "red", "dress", "glasses")
  ) = WidgetSnapshot("2026-09-18", cycleDay, phase, moods, message, avatar)

  @Test
  fun `describes the whole card in one sentence`() {
    val spoken = widgetContentDescription(snapshot(), WidgetSizeClass.MEDIUM)

    assertEquals("Döngünün 1. günü. Regl. Kendine alan tanı.. Kramplar olabilir", spoken)
  }

  @Test
  fun `says the empty state when there is nothing to draw`() {
    assertEquals(WIDGET_EMPTY_DESCRIPTION, widgetContentDescription(null, WidgetSizeClass.MEDIUM))
    assertEquals(WIDGET_EMPTY_DESCRIPTION, widgetContentDescription(null, WidgetSizeClass.SMALL))
    assertEquals(WIDGET_EMPTY_DESCRIPTION, widgetContentDescription(null, WidgetSizeClass.LARGE))
  }

  @Test
  fun `leaves out what the card does not show`() {
    // A small card drops the moods, so the description drops them too.
    val spoken = widgetContentDescription(snapshot(), WidgetSizeClass.SMALL)

    assertFalse(spoken.contains("Kramplar"))
    assertTrue(spoken.contains("Döngünün 1. günü"))
  }

  @Test
  fun `reads the large layout's bullets as a list, not as bullets`() {
    val spoken = widgetContentDescription(
      snapshot(moods = listOf("bir", "iki")),
      WidgetSizeClass.LARGE
    )

    assertFalse(spoken.contains("•"))
    assertTrue(spoken.contains("bir, iki"))
  }

  @Test
  fun `describes a snapshot with nothing known as the empty state`() {
    val bare = WidgetSnapshot("2026-09-18", null, null, emptyList(), null, null)

    assertEquals(WIDGET_EMPTY_DESCRIPTION, widgetContentDescription(bare, WidgetSizeClass.MEDIUM))
  }

  @Test
  fun `describes a partial snapshot with only what it has`() {
    val spoken = widgetContentDescription(
      snapshot(cycleDay = null, phase = null, moods = emptyList()),
      WidgetSizeClass.MEDIUM
    )

    assertEquals("Kendine alan tanı.", spoken)
  }

  @Test
  fun `never reads out a catalogue id`() {
    val ids = listOf(
      "skin-tone-4", "bun", "red", "dress", "glasses",
      "menstrual", "follicular", "ovulatory", "luteal"
    )

    WidgetSizeClass.values().forEach { size ->
      val spoken = widgetContentDescription(snapshot(), size)

      ids.forEach { id -> assertFalse("$spoken should not contain $id", spoken.contains(id)) }
    }
  }

  @Test
  fun `never reads out an id it does not know either`() {
    val stranger = snapshot(
      phase = "gebelik",
      avatar = WidgetAvatar("skin-tone-99", "mohawk", "teal", "spacesuit", "monocle")
    )

    WidgetSizeClass.values().forEach { size ->
      val spoken = widgetContentDescription(stranger, size)

      assertFalse(spoken.contains("gebelik"))
      assertFalse(spoken.contains("mohawk"))
      assertFalse(spoken.contains("monocle"))
    }
  }

  @Test
  fun `keeps a long message whole for a screen reader`() {
    // The card ellipsizes it; a screen reader has no reason to.
    val long = "Regl öncesi günlerde belirtiler herkeste aynı değildir, aydan aya da " +
      "değişebilir. Hareket, uyku ve kendine nazik davranmak bazı kişilere iyi gelir."
    val spoken = widgetContentDescription(snapshot(message = long), WidgetSizeClass.SMALL)

    assertTrue(spoken.contains(long))
  }
}
