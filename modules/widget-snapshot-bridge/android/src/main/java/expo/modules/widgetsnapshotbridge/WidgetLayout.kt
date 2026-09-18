package expo.modules.widgetsnapshotbridge

/**
 * How much room the launcher has given the widget, and what to do with it.
 *
 * A widget is resized by the person holding the phone, not by us, so the only
 * honest input is the size the launcher reports. Three classes rather than a
 * continuum: `RemoteViews` cannot set dimensions portably below API 31, so each
 * class is a layout file, and three files is as many as are worth keeping in
 * step with each other.
 *
 * Pure Kotlin with no Android imports, so the choosing can be tested off-device
 * — which matters, because the alternative is resizing a widget by hand on an
 * emulator every time a threshold moves.
 */
enum class WidgetSizeClass {
  /** Barely more than a tile: the avatar, the day, the phase, a short message. */
  SMALL,

  /** The default 4x2, and the shape this widget was designed around. */
  MEDIUM,

  /** Tall enough to give the message room and the moods a line each. */
  LARGE
}

/**
 * The widths and heights, in dp, where the layout changes.
 *
 * Chosen around the declared 4x2 cell — 250dp by 110dp — so the size the widget
 * is added at lands in `MEDIUM` rather than on a boundary, and a person has to
 * deliberately shrink or grow it to see something else.
 */
const val WIDGET_SMALL_MAX_WIDTH_DP = 200
const val WIDGET_SMALL_MAX_HEIGHT_DP = 100
const val WIDGET_LARGE_MIN_WIDTH_DP = 250
const val WIDGET_LARGE_MIN_HEIGHT_DP = 180

/**
 * The class for a reported size.
 *
 * Height decides more than width: the card is a column of text, so a short one
 * has to drop lines whatever its width, and a tall one has room for them
 * whether or not it is also wide.
 *
 * A size the launcher could not report — zero or negative, which happens before
 * the first `onAppWidgetOptionsChanged` — is read as `MEDIUM`, the size the
 * widget is added at.
 */
fun widgetSizeClass(widthDp: Int, heightDp: Int): WidgetSizeClass {
  if (widthDp <= 0 || heightDp <= 0) {
    return WidgetSizeClass.MEDIUM
  }

  if (widthDp < WIDGET_SMALL_MAX_WIDTH_DP || heightDp < WIDGET_SMALL_MAX_HEIGHT_DP) {
    return WidgetSizeClass.SMALL
  }

  if (widthDp >= WIDGET_LARGE_MIN_WIDTH_DP && heightDp >= WIDGET_LARGE_MIN_HEIGHT_DP) {
    return WidgetSizeClass.LARGE
  }

  return WidgetSizeClass.MEDIUM
}

/** How many moods a size can show. `SMALL` shows none: there is no room. */
fun widgetMoodLimit(size: WidgetSizeClass): Int = when (size) {
  WidgetSizeClass.SMALL -> 0
  WidgetSizeClass.MEDIUM -> WIDGET_MAX_MOOD_LABELS
  WidgetSizeClass.LARGE -> WIDGET_MAX_MOOD_LABELS
}

/**
 * The moods as one line, or as a line each where there is room for it.
 *
 * `null` when there is nothing to show, so the row can be hidden rather than
 * left as an empty strip.
 */
fun widgetMoodText(moodLabels: List<String>, size: WidgetSizeClass): String? {
  val limit = widgetMoodLimit(size)

  if (limit == 0 || moodLabels.isEmpty()) {
    return null
  }

  val shown = moodLabels.take(limit)

  return when (size) {
    // A tall card can afford a line each, which reads as a list rather than a
    // run-on sentence.
    WidgetSizeClass.LARGE -> shown.joinToString("\n") { "• $it" }
    else -> shown.joinToString(" · ")
  }
}

/**
 * The whole card as one sentence, for a screen reader.
 *
 * Built from the same words that are on screen, and never from an id: a person
 * chose "Topuz", and `bun` read aloud on a home screen would be the app talking
 * to itself. A part that is not shown is not described either.
 */
fun widgetContentDescription(snapshot: WidgetSnapshot?, size: WidgetSizeClass): String {
  if (snapshot == null) {
    return WIDGET_EMPTY_DESCRIPTION
  }

  val parts = listOfNotNull(
    widgetCycleDayLabel(snapshot.cycleDay),
    widgetPhaseLabel(snapshot.phase),
    snapshot.supportMessage,
    widgetMoodText(snapshot.moodLabels, size)?.replace("\n", ", ")?.replace("• ", "")
  )

  return if (parts.isEmpty()) WIDGET_EMPTY_DESCRIPTION else parts.joinToString(". ")
}

/**
 * What the card says when there is nothing to draw.
 *
 * Kept here rather than only in `strings.xml` so the description and the visible
 * text cannot drift apart, and so it can be tested without resources.
 */
const val WIDGET_EMPTY_DESCRIPTION = "Uygulamayı açarak widget'ı güncelle."
