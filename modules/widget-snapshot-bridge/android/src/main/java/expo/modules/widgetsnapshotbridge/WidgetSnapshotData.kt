package expo.modules.widgetsnapshotbridge

import org.json.JSONArray
import org.json.JSONObject

/**
 * The widget's reading of `WidgetSnapshotV1`.
 *
 * Deliberately a separate shape from the JS type rather than a generated mirror
 * of it: the widget only needs what it draws, and a field it does not read is a
 * field it cannot be broken by. The key names below are the contract, and the JS
 * side has a test that fails if any of them is renamed.
 *
 * No Android class is touched in this file, so the parsing can be tested without
 * a device.
 */
data class WidgetAvatar(
  val skinToneId: String,
  val hairStyleId: String,
  val hairColorId: String,
  val outfitId: String,
  val accessoryId: String?
)

data class WidgetSnapshot(
  val date: String,
  val cycleDay: Int?,
  val phase: String?,
  /**
   * The day and the phase as finished words, in the app's own language.
   *
   * `null` when the snapshot does not carry them, which is what a build older
   * than these fields writes. The provider then falls back to
   * `widgetCycleDayLabel` and `widgetPhaseLabel` below and the card reads in
   * Turkish, exactly as it did before — so an old snapshot still draws rather
   * than losing two lines.
   *
   * New snapshots always carry them when there is anything to name. Building
   * them here was the one thing this widget still decided for itself, and it
   * decided it in Turkish on every device while `supportMessage` beside it
   * arrived in the person's own language.
   */
  val cycleDayLabel: String?,
  val phaseLabel: String?,
  val moodLabels: List<String>,
  val supportMessage: String?,
  val avatar: WidgetAvatar?
)

/** The only version this widget can read. A different one is not read at all. */
const val WIDGET_SNAPSHOT_VERSION = 1

/** The most moods a widget-sized card can show without turning into a list. */
const val WIDGET_MAX_MOOD_LABELS = 3

private const val KEY_VERSION = "version"
private const val KEY_DATE = "date"
private const val KEY_CYCLE_DAY = "cycleDay"
private const val KEY_PHASE = "phase"
private const val KEY_CYCLE_DAY_LABEL = "cycleDayLabel"
private const val KEY_PHASE_LABEL = "phaseLabel"
private const val KEY_MOOD_LABELS = "moodLabels"
private const val KEY_SUPPORT_MESSAGE = "supportMessage"
private const val KEY_AVATAR = "avatar"
private const val KEY_SKIN_TONE_ID = "skinToneId"
private const val KEY_HAIR_STYLE_ID = "hairStyleId"
private const val KEY_HAIR_COLOR_ID = "hairColorId"
private const val KEY_OUTFIT_ID = "outfitId"
private const val KEY_ACCESSORY_ID = "accessoryId"

/** `null` where the key is absent, JSON null, or not text. */
private fun JSONObject.optText(key: String): String? {
  if (!has(key) || isNull(key)) {
    return null
  }

  val value = optString(key, "")

  return value.ifBlank { null }
}

private fun parseMoodLabels(array: JSONArray?): List<String> {
  if (array == null) {
    return emptyList()
  }

  val labels = mutableListOf<String>()

  for (index in 0 until array.length()) {
    if (array.isNull(index)) {
      continue
    }

    val label = array.optString(index, "")

    if (label.isNotBlank()) {
      labels.add(label)
    }
  }

  return labels
}

/**
 * The avatar, when the snapshot carries a complete one.
 *
 * All four required ids or nothing: a half avatar would be drawn as a person
 * with a missing face, and no avatar at all is the honest way to say the app has
 * not been told what to draw.
 */
private fun parseAvatar(json: JSONObject?): WidgetAvatar? {
  if (json == null) {
    return null
  }

  val skinToneId = json.optText(KEY_SKIN_TONE_ID) ?: return null
  val hairStyleId = json.optText(KEY_HAIR_STYLE_ID) ?: return null
  val hairColorId = json.optText(KEY_HAIR_COLOR_ID) ?: return null
  val outfitId = json.optText(KEY_OUTFIT_ID) ?: return null

  return WidgetAvatar(
    skinToneId = skinToneId,
    hairStyleId = hairStyleId,
    hairColorId = hairColorId,
    outfitId = outfitId,
    accessoryId = json.optText(KEY_ACCESSORY_ID)
  )
}

/**
 * Reads the stored text, or `null` when there is nothing usable in it.
 *
 * One `null` for every reason it could fail: nothing stored, text that is not
 * JSON, a version this widget does not know, or a snapshot with no date. A
 * widget has nobody to report an error to and no way to ask again, so the only
 * useful distinction is "something to draw" or "not yet" — and the caller draws
 * the empty state for the second.
 *
 * It never throws. A crash here is a crash in the launcher's process, which is
 * far worse than a card that says to open the app.
 */
fun parseWidgetSnapshot(stored: String?): WidgetSnapshot? {
  if (stored.isNullOrBlank()) {
    return null
  }

  return try {
    val json = JSONObject(stored)

    if (json.optInt(KEY_VERSION, -1) != WIDGET_SNAPSHOT_VERSION) {
      return null
    }

    val date = json.optText(KEY_DATE) ?: return null

    WidgetSnapshot(
      date = date,
      // `optInt` cannot tell a missing key from a zero, and a cycle day is
      // counted from 1, so anything below that is read as "not known".
      cycleDay = json.optInt(KEY_CYCLE_DAY, 0).takeIf { it >= 1 },
      phase = json.optText(KEY_PHASE),
      // `optText` answers null for absent, JSON null and blank alike, which is
      // the three ways these can fail to be a usable label.
      cycleDayLabel = json.optText(KEY_CYCLE_DAY_LABEL),
      phaseLabel = json.optText(KEY_PHASE_LABEL),
      moodLabels = parseMoodLabels(json.optJSONArray(KEY_MOOD_LABELS)),
      supportMessage = json.optText(KEY_SUPPORT_MESSAGE),
      avatar = parseAvatar(json.optJSONObject(KEY_AVATAR))
    )
  } catch (error: Throwable) {
    null
  }
}

/**
 * The Turkish name of a phase, or `null` for one this widget does not know.
 *
 * ## This is now the fallback, not the source
 *
 * The app sends `phaseLabel` with the snapshot, in whatever language it is set
 * to, and the provider prefers it. This is what draws a snapshot written before
 * that field existed: Turkish, which is what those snapshots were showing
 * anyway, so nothing changes for them.
 *
 * It also stays because it is the only place in this file that matches on the
 * four phase ids, and `widget-snapshot-native-contract.test.ts` reads this file
 * to check all four are still accounted for. Losing the branch would lose that
 * check along with it.
 *
 * A phase id it cannot name is left off the card rather than printed raw —
 * `luteal` on a home screen is the app talking to itself.
 */
fun widgetPhaseLabel(phase: String?): String? = when (phase) {
  "menstrual" -> "Regl"
  "follicular" -> "Foliküler"
  "ovulatory" -> "Yumurtlama"
  "luteal" -> "Luteal"
  else -> null
}

/**
 * "Döngünün 14. günü", or `null` when there is no day to name.
 *
 * The fallback for `cycleDayLabel`, on the same terms as `widgetPhaseLabel`
 * above: it draws a snapshot written before the field existed, in the language
 * that snapshot was already being drawn in.
 */
fun widgetCycleDayLabel(cycleDay: Int?): String? =
  cycleDay?.let { "Döngünün $it. günü" }

/**
 * The cycle day as the card prints it, whatever the snapshot carries.
 *
 * The snapshot's own `cycleDayLabel` when it has one — that is the app's
 * language. Otherwise the Turkish fallback, for a snapshot written before the
 * field existed.
 *
 * One function so the card and the screen reader cannot disagree: they both ask
 * here, and before this the provider and `widgetContentDescription` each called
 * the label function separately.
 */
fun cycleDayTextOf(snapshot: WidgetSnapshot): String? =
  snapshot.cycleDayLabel ?: widgetCycleDayLabel(snapshot.cycleDay)

/** The phase as the card prints it, on the same terms as the cycle day. */
fun phaseTextOf(snapshot: WidgetSnapshot): String? =
  snapshot.phaseLabel ?: widgetPhaseLabel(snapshot.phase)

/** At most a few moods, joined the way a sentence would join them. */
fun widgetMoodSummary(moodLabels: List<String>): String? {
  if (moodLabels.isEmpty()) {
    return null
  }

  return moodLabels.take(WIDGET_MAX_MOOD_LABELS).joinToString(" · ")
}
