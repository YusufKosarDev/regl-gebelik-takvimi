package expo.modules.widgetsnapshotbridge

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF

/**
 * Draws the avatar into a bitmap for `RemoteViews`.
 *
 * A widget cannot run views of its own, so the figure is painted once here and
 * handed over as an image. Only geometry lives in this file — every colour and
 * silhouette decision is `widgetAvatarLook`'s, which is why that one is testable
 * and this one is not.
 */
object WidgetAvatarArtist {

  fun draw(avatar: WidgetAvatar?, sizePx: Int): Bitmap {
    val look = widgetAvatarLook(avatar)
    val size = sizePx.coerceAtLeast(24)
    val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)
    val paint = Paint(Paint.ANTI_ALIAS_FLAG)

    val unit = size / 100f
    fun u(value: Float) = value * unit

    val headLeft = u(28f)
    val headTop = u(18f)
    val headRight = u(72f)
    val headBottom = u(70f)
    val headWidth = headRight - headLeft

    // Hair behind the head: how far it falls is the whole of what a widget-sized
    // drawing can say about the style.
    val fall = when (look.hairShape) {
      WidgetHairShape.CLOSE -> u(4f)
      WidgetHairShape.KNOT -> u(2f)
      WidgetHairShape.MID -> u(22f)
      WidgetHairShape.FULL -> u(16f)
      WidgetHairShape.LONG -> u(38f)
    }
    val spread = if (look.hairShape == WidgetHairShape.FULL) u(12f) else u(3f)

    paint.color = look.hair
    canvas.drawRoundRect(
      RectF(headLeft - spread, headTop - u(6f), headRight + spread, headBottom + fall),
      headWidth * 0.5f,
      headWidth * 0.5f,
      paint
    )

    // The garment, drawn before the head so the shoulders sit behind the chin.
    paint.color = look.outfit
    canvas.drawRoundRect(
      RectF(u(20f), u(74f), u(80f), u(100f)),
      u(10f),
      u(10f),
      paint
    )

    // Ears, which is where earrings hang from.
    paint.color = look.skinShade
    canvas.drawCircle(headLeft + u(1f), u(50f), u(6f), paint)
    canvas.drawCircle(headRight - u(1f), u(50f), u(6f), paint)

    paint.color = look.skin
    canvas.drawRoundRect(
      RectF(headLeft, headTop, headRight, headBottom),
      headWidth * 0.46f,
      headWidth * 0.46f,
      paint
    )

    // The fringe, over the forehead.
    paint.color = look.hair
    canvas.drawRoundRect(
      RectF(headLeft - u(2f), headTop - u(4f), headRight + u(2f), headTop + u(16f)),
      headWidth * 0.4f,
      headWidth * 0.4f,
      paint
    )

    if (look.hairShape == WidgetHairShape.KNOT) {
      canvas.drawCircle(u(50f), headTop - u(6f), u(10f), paint)
    }

    // Eyes and a mouth, in a shade dark enough to read on any of the skins.
    paint.color = look.skinShade
    canvas.drawCircle(u(42f), u(46f), u(3.5f), paint)
    canvas.drawCircle(u(58f), u(46f), u(3.5f), paint)
    canvas.drawRoundRect(RectF(u(44f), u(58f), u(56f), u(61f)), u(2f), u(2f), paint)

    when (look.accessory) {
      WidgetAccessory.GLASSES -> {
        paint.color = WIDGET_ACCESSORY_COLOR
        paint.style = Paint.Style.STROKE
        paint.strokeWidth = u(2f)
        canvas.drawCircle(u(42f), u(46f), u(7f), paint)
        canvas.drawCircle(u(58f), u(46f), u(7f), paint)
        canvas.drawLine(u(49f), u(46f), u(51f), u(46f), paint)
        paint.style = Paint.Style.FILL
      }

      WidgetAccessory.EARRINGS -> {
        paint.color = WIDGET_ACCESSORY_COLOR
        canvas.drawCircle(headLeft + u(1f), u(56f), u(4f), paint)
        canvas.drawCircle(headRight - u(1f), u(56f), u(4f), paint)
      }

      WidgetAccessory.HAIR_CLIP -> {
        paint.color = WIDGET_ACCESSORY_COLOR
        canvas.drawRoundRect(
          RectF(headLeft + u(2f), headTop + u(4f), headLeft + u(16f), headTop + u(9f)),
          u(2.5f),
          u(2.5f),
          paint
        )
      }

      null -> Unit
    }

    return bitmap
  }
}
