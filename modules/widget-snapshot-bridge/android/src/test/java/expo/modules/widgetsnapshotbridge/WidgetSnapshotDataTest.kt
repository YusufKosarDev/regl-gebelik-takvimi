package expo.modules.widgetsnapshotbridge

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The widget's parsing, off-device.
 *
 * Only the pure half is covered here — the parser and the id-to-look mapping —
 * because that is the half that decides what a card says. The drawing and the
 * `RemoteViews` wiring need a device and are covered by the smoke run.
 */
class WidgetSnapshotDataTest {

  private fun snapshotJson(
    version: Int = 1,
    date: String = "\"2026-09-18\"",
    cycleDay: String = "14",
    phase: String = "\"ovulatory\"",
    moods: String? = null,
    labels: String? = null,
    message: String = "\"Kendine alan tanı.\"",
    avatar: String = """{"skinToneId":"skin-tone-4","hairStyleId":"bun","hairColorId":"red","outfitId":"dress","accessoryId":"glasses"}"""
  ): String {
    val moodPart = if (moods == null) "" else """"moodLabels":$moods,"""
    val labelPart = if (labels == null) "" else "$labels,"

    return """{"version":$version,"date":$date,"cycleDay":$cycleDay,"phase":$phase,$labelPart$moodPart"supportMessage":$message,"avatar":$avatar}"""
  }

  @Test
  fun `reads a full snapshot`() {
    val snapshot = parseWidgetSnapshot(snapshotJson(moods = """["Yorgunluk olabilir","Unutkanlık olabilir"]"""))

    assertNotNull(snapshot)
    assertEquals("2026-09-18", snapshot!!.date)
    assertEquals(14, snapshot.cycleDay)
    assertEquals("ovulatory", snapshot.phase)
    assertEquals("Kendine alan tanı.", snapshot.supportMessage)
    assertEquals(listOf("Yorgunluk olabilir", "Unutkanlık olabilir"), snapshot.moodLabels)
  }

  @Test
  fun `reads the avatar`() {
    val avatar = parseWidgetSnapshot(snapshotJson())!!.avatar

    assertNotNull(avatar)
    assertEquals("skin-tone-4", avatar!!.skinToneId)
    assertEquals("bun", avatar.hairStyleId)
    assertEquals("red", avatar.hairColorId)
    assertEquals("dress", avatar.outfitId)
    assertEquals("glasses", avatar.accessoryId)
  }

  @Test
  fun `reads an avatar with no accessory`() {
    val json = snapshotJson(
      avatar = """{"skinToneId":"skin-tone-1","hairStyleId":"short","hairColorId":"black","outfitId":"t-shirt"}"""
    )

    assertNull(parseWidgetSnapshot(json)!!.avatar!!.accessoryId)
  }

  @Test
  fun `reads a snapshot with no moods as having none`() {
    assertTrue(parseWidgetSnapshot(snapshotJson())!!.moodLabels.isEmpty())
  }

  @Test
  fun `reads an empty mood list as having none`() {
    assertTrue(parseWidgetSnapshot(snapshotJson(moods = "[]"))!!.moodLabels.isEmpty())
  }

  @Test
  fun `skips blank moods rather than printing them`() {
    val snapshot = parseWidgetSnapshot(snapshotJson(moods = """["iyi","","   ",null]"""))

    assertEquals(listOf("iyi"), snapshot!!.moodLabels)
  }

  @Test
  fun `reads a null avatar as none`() {
    assertNull(parseWidgetSnapshot(snapshotJson(avatar = "null"))!!.avatar)
  }

  @Test
  fun `refuses a half avatar rather than drawing part of one`() {
    val json = snapshotJson(avatar = """{"skinToneId":"skin-tone-1"}""")

    assertNull(parseWidgetSnapshot(json)!!.avatar)
  }

  @Test
  fun `reads a null cycle day and phase as not known`() {
    val snapshot = parseWidgetSnapshot(snapshotJson(cycleDay = "null", phase = "null", message = "null"))

    assertNotNull(snapshot)
    assertNull(snapshot!!.cycleDay)
    assertNull(snapshot.phase)
    assertNull(snapshot.supportMessage)
  }

  @Test
  fun `reads a cycle day of zero as not known`() {
    assertNull(parseWidgetSnapshot(snapshotJson(cycleDay = "0"))!!.cycleDay)
  }

  @Test
  fun `refuses nothing stored`() {
    assertNull(parseWidgetSnapshot(null))
    assertNull(parseWidgetSnapshot(""))
    assertNull(parseWidgetSnapshot("   "))
  }

  @Test
  fun `refuses text that is not json`() {
    assertNull(parseWidgetSnapshot("not json"))
    assertNull(parseWidgetSnapshot("{"))
    assertNull(parseWidgetSnapshot("""{"version":1,"""))
    assertNull(parseWidgetSnapshot("[]"))
  }

  @Test
  fun `refuses another version`() {
    assertNull(parseWidgetSnapshot(snapshotJson(version = 2)))
    assertNull(parseWidgetSnapshot(snapshotJson(version = 0)))
    assertNull(parseWidgetSnapshot("""{"date":"2026-09-18"}"""))
  }

  @Test
  fun `refuses a snapshot with no date`() {
    assertNull(parseWidgetSnapshot(snapshotJson(date = "null")))
    assertNull(parseWidgetSnapshot(snapshotJson(date = "\"\"")))
  }

  @Test
  fun `ignores fields it does not know`() {
    val json = """{"version":1,"date":"2026-09-18","cycleDay":3,"phase":"menstrual","supportMessage":"a","avatar":null,"fertilityLevel":"low"}"""

    assertEquals(3, parseWidgetSnapshot(json)!!.cycleDay)
  }
}

class WidgetSnapshotLabelsTest {

  @Test
  fun `names the four phases in Turkish`() {
    assertEquals("Regl", widgetPhaseLabel("menstrual"))
    assertEquals("Foliküler", widgetPhaseLabel("follicular"))
    assertEquals("Yumurtlama", widgetPhaseLabel("ovulatory"))
    assertEquals("Luteal", widgetPhaseLabel("luteal"))
  }

  @Test
  fun `names no phase it does not know, rather than printing the id`() {
    assertNull(widgetPhaseLabel("gebelik"))
    assertNull(widgetPhaseLabel(null))
    assertNull(widgetPhaseLabel(""))
  }

  @Test
  fun `names the cycle day`() {
    assertEquals("Döngünün 1. günü", widgetCycleDayLabel(1))
    assertEquals("Döngünün 28. günü", widgetCycleDayLabel(28))
    assertNull(widgetCycleDayLabel(null))
  }

  @Test
  fun `joins the moods and stops at a few`() {
    assertNull(widgetMoodSummary(emptyList()))
    assertEquals("bir", widgetMoodSummary(listOf("bir")))
    assertEquals("bir · iki", widgetMoodSummary(listOf("bir", "iki")))
    assertEquals(
      "bir · iki · üç",
      widgetMoodSummary(listOf("bir", "iki", "üç", "dört", "beş"))
    )
  }
}

class WidgetAvatarLookTest {

  private fun avatar(
    skinToneId: String = "skin-tone-4",
    hairStyleId: String = "bun",
    hairColorId: String = "red",
    outfitId: String = "dress",
    accessoryId: String? = null,
    expressionId: String? = null,
    backgroundId: String? = null
  ) = WidgetAvatar(
    skinToneId,
    hairStyleId,
    hairColorId,
    outfitId,
    accessoryId,
    expressionId,
    backgroundId
  )

  @Test
  fun `gives every catalogue skin tone its own colour`() {
    val colors = (1..8).map { widgetAvatarLook(avatar(skinToneId = "skin-tone-$it")).skin }

    assertEquals(8, colors.toSet().size)
  }

  @Test
  fun `gives every catalogue hair colour its own`() {
    // Also the colours a covering can be: a headscarf is a hair style, so it
    // takes its colour from this same list.
    val ids = listOf(
      "black", "dark-brown", "brown", "light-brown", "blonde", "red",
      "auburn", "grey", "burgundy"
    )
    val colors = ids.map { widgetAvatarLook(avatar(hairColorId = it)).hair }

    assertEquals(ids.size, colors.toSet().size)
  }

  @Test
  fun `gives every catalogue outfit its own`() {
    val ids = listOf("t-shirt", "sweatshirt", "shirt", "dress", "tunic", "vest")
    val colors = ids.map { widgetAvatarLook(avatar(outfitId = it)).outfit }

    assertEquals(ids.size, colors.toSet().size)
  }

  @Test
  fun `maps the hair styles onto shapes it can draw`() {
    assertEquals(WidgetHairShape.CLOSE, widgetAvatarLook(avatar(hairStyleId = "short")).hairShape)
    assertEquals(WidgetHairShape.MID, widgetAvatarLook(avatar(hairStyleId = "medium")).hairShape)
    assertEquals(WidgetHairShape.LONG, widgetAvatarLook(avatar(hairStyleId = "long")).hairShape)
    assertEquals(WidgetHairShape.FULL, widgetAvatarLook(avatar(hairStyleId = "curly")).hairShape)
    assertEquals(WidgetHairShape.KNOT, widgetAvatarLook(avatar(hairStyleId = "bun")).hairShape)
    assertEquals(WidgetHairShape.LONG, widgetAvatarLook(avatar(hairStyleId = "wavy")).hairShape)
    assertEquals(WidgetHairShape.LONG, widgetAvatarLook(avatar(hairStyleId = "braid")).hairShape)
    assertEquals(WidgetHairShape.MID, widgetAvatarLook(avatar(hairStyleId = "ponytail")).hairShape)
    assertEquals(
      WidgetHairShape.FULL,
      widgetAvatarLook(avatar(hairStyleId = "short-wavy")).hairShape
    )
  }

  /**
   * All three coverings draw as one shape, and that is the decision.
   *
   * They differ by how they are tied, and none of that survives at the size a
   * launcher draws this. What has to survive is cloth round the face instead of
   * hair — so `KNOT` is wrong for the knotted one however tempting, because
   * `KNOT` is drawn as a bun and a bun is hair.
   */
  @Test
  fun `maps every catalogue backdrop onto its colour`() {
    val ids = listOf("lavender", "rose", "stone", "ice")
    val colors = ids.map { widgetAvatarLook(avatar(backgroundId = it)).background }

    assertEquals(ids.size, colors.toSet().size)
    assertTrue(colors.all { it != null })
  }

  @Test
  fun `draws no disc when no backdrop was chosen`() {
    assertNull(widgetAvatarLook(avatar(backgroundId = null)).background)
  }

  @Test
  fun `draws no disc for a backdrop it does not have`() {
    assertNull(widgetAvatarLook(avatar(backgroundId = "a-colour-from-later")).background)
  }

  /**
   * The expression changes nothing here, and that is the decision.
   *
   * The face a widget draws is two 3px dots and a 12x3 bar; what separates a
   * smile from a calm mouth is the curve of that bar, and none of it survives
   * at this size. So `expressionId` crosses the boundary and is ignored.
   *
   * Pinned rather than left implicit, because "the widget ignores it" and "the
   * widget forgot it" look identical from the outside — and the day somebody
   * adds a mouth shape to the look, this test is what tells them it was a
   * choice they are reversing.
   */
  @Test
  fun `looks the same whatever the expression is`() {
    val faces = listOf("calm", "smiling", "tired", "thoughtful", "a-face-from-later")
    val looks = faces.map { widgetAvatarLook(avatar(expressionId = it)) }

    assertEquals(1, looks.toSet().size)
    assertEquals(widgetAvatarLook(avatar(expressionId = null)), looks.first())
  }

  @Test
  fun `maps every headscarf onto the covering shape`() {
    val ids = listOf("headscarf-plain", "headscarf-draped", "headscarf-knotted")

    for (id in ids) {
      assertEquals(WidgetHairShape.WRAP, widgetAvatarLook(avatar(hairStyleId = id)).hairShape)
    }
  }

  @Test
  fun `maps every accessory`() {
    assertEquals(WidgetAccessory.GLASSES, widgetAvatarLook(avatar(accessoryId = "glasses")).accessory)
    assertEquals(WidgetAccessory.HAIR_CLIP, widgetAvatarLook(avatar(accessoryId = "hair-clip")).accessory)
    assertEquals(WidgetAccessory.EARRINGS, widgetAvatarLook(avatar(accessoryId = "earrings")).accessory)
    assertEquals(WidgetAccessory.NECKLACE, widgetAvatarLook(avatar(accessoryId = "necklace")).accessory)
    assertEquals(WidgetAccessory.BROOCH, widgetAvatarLook(avatar(accessoryId = "brooch")).accessory)
  }

  @Test
  fun `wears nothing when no accessory was chosen`() {
    val look = widgetAvatarLook(avatar(accessoryId = null))

    assertNull(look.accessory)
    assertEquals(false, look.hasAccessory)
  }

  @Test
  fun `wears nothing rather than guessing at one it cannot draw`() {
    assertNull(widgetAvatarLook(avatar(accessoryId = "monocle")).accessory)
  }

  @Test
  fun `falls back to neutral for an id it does not know`() {
    val stranger = widgetAvatarLook(
      avatar(skinToneId = "skin-tone-99", hairStyleId = "mohawk", hairColorId = "teal", outfitId = "spacesuit")
    )
    val real = (1..6).map { widgetAvatarLook(avatar(skinToneId = "skin-tone-$it")).skin }

    assertEquals(false, real.contains(stranger.skin))
    assertEquals(WidgetHairShape.CLOSE, stranger.hairShape)
  }

  @Test
  fun `keeps the parts it does know`() {
    val half = widgetAvatarLook(avatar(outfitId = "spacesuit"))

    assertEquals(widgetAvatarLook(avatar()).skin, half.skin)
    assertEquals(widgetAvatarLook(avatar()).hair, half.hair)
  }

  @Test
  fun `draws a neutral figure when there is no avatar at all`() {
    val look = widgetAvatarLook(null)

    assertNull(look.accessory)
    assertEquals(WidgetHairShape.CLOSE, look.hairShape)
    assertEquals(false, (1..6).map { widgetAvatarLook(avatar(skinToneId = "skin-tone-$it")).skin }.contains(look.skin))
  }

  @Test
  fun `gives the same look every time`() {
    assertEquals(widgetAvatarLook(avatar(accessoryId = "glasses")), widgetAvatarLook(avatar(accessoryId = "glasses")))
  }
}

/**
 * The finished words the app now sends, and the fallback for a snapshot that
 * does not carry them.
 *
 * Building these here was the one thing this widget still decided for itself,
 * and it decided them in Turkish on every device while `supportMessage` beside
 * them arrived in the person's own language. The app sends them now; the two
 * label functions stay as the fallback so an older snapshot still draws.
 */
class WidgetSnapshotLabelFieldsTest {

  private fun json(labels: String?): String =
    """{"version":1,"date":"2026-09-18","cycleDay":14,"phase":"ovulatory",""" +
      (if (labels == null) "" else "$labels,") +
      """"supportMessage":"Kendine alan tanı.","avatar":null}"""

  @Test
  fun `reads the words the app sent`() {
    val snapshot = parseWidgetSnapshot(
      json(""""cycleDayLabel":"Cycle day 14","phaseLabel":"Ovulation"""")
    )!!

    assertEquals("Cycle day 14", snapshot.cycleDayLabel)
    assertEquals("Ovulation", snapshot.phaseLabel)
  }

  @Test
  fun `prefers the words the app sent over its own`() {
    val snapshot = parseWidgetSnapshot(
      json(""""cycleDayLabel":"Cycle day 14","phaseLabel":"Ovulation"""")
    )!!

    assertEquals("Cycle day 14", cycleDayTextOf(snapshot))
    assertEquals("Ovulation", phaseTextOf(snapshot))
  }

  @Test
  fun `falls back to its own words for a snapshot without them`() {
    val snapshot = parseWidgetSnapshot(json(null))!!

    assertNull(snapshot.cycleDayLabel)
    assertNull(snapshot.phaseLabel)
    assertEquals("Döngünün 14. günü", cycleDayTextOf(snapshot))
    assertEquals("Yumurtlama", phaseTextOf(snapshot))
  }

  @Test
  fun `treats a blank or null label as absent`() {
    for (labels in listOf(
      """"cycleDayLabel":"","phaseLabel":"   """",
      """"cycleDayLabel":null,"phaseLabel":null"""
    )) {
      val snapshot = parseWidgetSnapshot(json(labels))!!

      // A blank would draw as a line with nothing on it, which is worse than
      // the line being hidden. The fallback answers instead.
      assertEquals("Döngünün 14. günü", cycleDayTextOf(snapshot))
      assertEquals("Yumurtlama", phaseTextOf(snapshot))
    }
  }

  @Test
  fun `has nothing to say about a day with no cycle and no words`() {
    val snapshot = parseWidgetSnapshot(
      """{"version":1,"date":"2026-09-18","cycleDay":null,"phase":null,"supportMessage":null,"avatar":null}"""
    )!!

    assertNull(cycleDayTextOf(snapshot))
    assertNull(phaseTextOf(snapshot))
  }
}
