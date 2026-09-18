package expo.modules.widgetsnapshotbridge

import android.content.Context
import android.content.SharedPreferences
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * The one file and the one key this module touches.
 *
 * A file of its own rather than the app's default preferences: a widget reads
 * this from another process, and sharing a file with everything else the app
 * stores would put unrelated settings one typo away from a widget update.
 *
 * The key carries the contract version it holds. A later snapshot version gets
 * its own key beside this one, so a widget built for version 1 keeps reading
 * version 1 rather than finding fields that moved under it.
 */
internal const val WIDGET_SNAPSHOT_PREFERENCES_FILE = "widget_snapshot"
internal const val WIDGET_SNAPSHOT_KEY = "snapshot_v1"

internal class MissingContextException :
  CodedException("ERR_WIDGET_SNAPSHOT_NO_CONTEXT", "The Android context is not available.", null)

internal class BlankSnapshotException :
  CodedException(
    "ERR_WIDGET_SNAPSHOT_BLANK",
    "Refusing to store a blank widget snapshot; use clearSnapshot to remove it.",
    null
  )

internal class WriteFailedException(action: String) :
  CodedException("ERR_WIDGET_SNAPSHOT_WRITE_FAILED", "Could not $action the widget snapshot.", null)

/**
 * Storage for the snapshot a home screen widget will draw.
 *
 * App-private `SharedPreferences`, which is what an `AppWidgetProvider` in this
 * same app can read without a content provider or a permission. Nothing here
 * knows what a snapshot means: it is text in, text out, and the JS side owns
 * the shape.
 *
 * Writes use `commit()` rather than `apply()`. `apply()` returns immediately and
 * swallows a failure, which for a widget means silently drawing yesterday with
 * no way to find out; `commit()` reports, so a failed write can be an error the
 * caller sees.
 *
 * Only `snapshot_v1` in `widget_snapshot` is ever read, written or removed —
 * `clearSnapshot` removes that key rather than clearing the file, so anything
 * else stored alongside it later is not collateral.
 */
class WidgetSnapshotBridgeModule : Module() {
  private val preferences: SharedPreferences
    get() {
      val context = appContext.reactContext ?: throw MissingContextException()

      return context.getSharedPreferences(WIDGET_SNAPSHOT_PREFERENCES_FILE, Context.MODE_PRIVATE)
    }

  /**
   * Redraws whatever is on the home screen.
   *
   * Best effort on purpose: the snapshot is already stored by the time this
   * runs, so a launcher that refuses the update leaves a stale card rather than
   * a failed write, and reporting it as a failed write would be a lie.
   */
  private fun refreshWidgets() {
    try {
      appContext.reactContext?.let { WidgetSnapshotProvider.refreshAll(it) }
    } catch (error: Throwable) {
      // Nothing to do and nobody to tell: the data is saved either way.
    }
  }

  override fun definition() = ModuleDefinition {
    Name("WidgetSnapshotBridge")

    AsyncFunction("writeSnapshot") { json: String ->
      // Blank is not an empty snapshot, it is a missing one, and storing it
      // would leave a widget parsing "" forever instead of finding nothing.
      if (json.isBlank()) {
        throw BlankSnapshotException()
      }

      if (!preferences.edit().putString(WIDGET_SNAPSHOT_KEY, json).commit()) {
        throw WriteFailedException("store")
      }

      refreshWidgets()
    }

    AsyncFunction("readSnapshot") { ->
      preferences.getString(WIDGET_SNAPSHOT_KEY, null)
    }

    AsyncFunction("clearSnapshot") { ->
      if (!preferences.edit().remove(WIDGET_SNAPSHOT_KEY).commit()) {
        throw WriteFailedException("remove")
      }

      refreshWidgets()
    }
  }
}
