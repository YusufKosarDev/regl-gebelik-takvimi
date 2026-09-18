package expo.modules.widgetsnapshotbridge

/**
 * What an avatar looks like on the home screen.
 *
 * The app's own renderer is not copied here and could not be: a widget draws
 * through `RemoteViews`, in the launcher's process, at a size the launcher
 * chooses. This is the platform's own plain reading of the same choices — a
 * head, hair, a garment and maybe an accessory — and it is allowed to look
 * simpler than the one inside the app.
 *
 * Keyed by the catalogue ids, because those are the contract. An id this build
 * has no entry for falls back to neutral rather than to a guess, and no id ever
 * reaches the screen as text.
 *
 * Pure Kotlin and no Android imports, so the mapping can be tested off-device.
 */

/** How the hair sits, which is all a widget-sized drawing can say about style. */
enum class WidgetHairShape {
  /** Cropped close to the head. */
  CLOSE,

  /** Falls to about the jaw. */
  MID,

  /** Falls past the shoulders. */
  LONG,

  /** Wider than the head. */
  FULL,

  /** Gathered above the head. */
  KNOT
}

data class WidgetAvatarLook(
  val skin: Int,
  val skinShade: Int,
  val hair: Int,
  val hairShape: WidgetHairShape,
  val outfit: Int,
  val hasAccessory: Boolean,
  val accessory: WidgetAccessory?
)

enum class WidgetAccessory {
  GLASSES,
  HAIR_CLIP,
  EARRINGS
}

private const val NEUTRAL_SKIN = 0xFFCBC3BC.toInt()
private const val NEUTRAL_SKIN_SHADE = 0xFFB3ABA4.toInt()
private const val NEUTRAL_HAIR = 0xFF8E8A86.toInt()
private const val NEUTRAL_OUTFIT = 0xFF9A9A9A.toInt()

private val SKIN_COLORS = mapOf(
  "skin-tone-1" to (0xFFF6DFCE.toInt() to 0xFFE8C9B3.toInt()),
  "skin-tone-2" to (0xFFEFC9A9.toInt() to 0xFFDDB08C.toInt()),
  "skin-tone-3" to (0xFFD9A277.toInt() to 0xFFC2885E.toInt()),
  "skin-tone-4" to (0xFFB77C52.toInt() to 0xFF9E653F.toInt()),
  "skin-tone-5" to (0xFF8A5736.toInt() to 0xFF734527.toInt()),
  "skin-tone-6" to (0xFF58361F.toInt() to 0xFF452817.toInt())
)

private val HAIR_COLORS = mapOf(
  "black" to 0xFF1E1C1B.toInt(),
  "dark-brown" to 0xFF3C2415.toInt(),
  "brown" to 0xFF6A4322.toInt(),
  "light-brown" to 0xFFA8754A.toInt(),
  "blonde" to 0xFFD9B268.toInt(),
  "red" to 0xFFA7381E.toInt()
)

private val HAIR_SHAPES = mapOf(
  "short" to WidgetHairShape.CLOSE,
  "medium" to WidgetHairShape.MID,
  "long" to WidgetHairShape.LONG,
  "curly" to WidgetHairShape.FULL,
  "bun" to WidgetHairShape.KNOT,
  "wavy" to WidgetHairShape.LONG
)

private val OUTFIT_COLORS = mapOf(
  "t-shirt" to 0xFF7C8CA1.toInt(),
  "sweatshirt" to 0xFF8F7C9C.toInt(),
  "shirt" to 0xFF6F9080.toInt(),
  "dress" to 0xFFA8798A.toInt()
)

private val ACCESSORIES = mapOf(
  "glasses" to WidgetAccessory.GLASSES,
  "hair-clip" to WidgetAccessory.HAIR_CLIP,
  "earrings" to WidgetAccessory.EARRINGS
)

/** The colour of an accessory, which is the same warm metal for all of them. */
const val WIDGET_ACCESSORY_COLOR: Int = 0xFFE2B84B.toInt()

/**
 * The look for one avatar, or the neutral one when there is no avatar at all.
 *
 * Total: every id resolves to something, so the drawing has no absent case and
 * no reason to throw. An accessory this build cannot draw becomes none, because
 * drawing the wrong one would be worse than drawing nothing.
 */
fun widgetAvatarLook(avatar: WidgetAvatar?): WidgetAvatarLook {
  if (avatar == null) {
    return WidgetAvatarLook(
      skin = NEUTRAL_SKIN,
      skinShade = NEUTRAL_SKIN_SHADE,
      hair = NEUTRAL_HAIR,
      hairShape = WidgetHairShape.CLOSE,
      outfit = NEUTRAL_OUTFIT,
      hasAccessory = false,
      accessory = null
    )
  }

  val skin = SKIN_COLORS[avatar.skinToneId]
  val accessory = avatar.accessoryId?.let { ACCESSORIES[it] }

  return WidgetAvatarLook(
    skin = skin?.first ?: NEUTRAL_SKIN,
    skinShade = skin?.second ?: NEUTRAL_SKIN_SHADE,
    hair = HAIR_COLORS[avatar.hairColorId] ?: NEUTRAL_HAIR,
    hairShape = HAIR_SHAPES[avatar.hairStyleId] ?: WidgetHairShape.CLOSE,
    outfit = OUTFIT_COLORS[avatar.outfitId] ?: NEUTRAL_OUTFIT,
    hasAccessory = accessory != null,
    accessory = accessory
  )
}
