package expo.modules.widgetsnapshotbridge

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.view.View
import android.widget.RemoteViews

/**
 * The home screen widget.
 *
 * It reads the snapshot the app last stored and draws it. It never opens the
 * database, never runs JavaScript and never waits on anything: a widget is
 * redrawn by the launcher whenever it likes, often with the app long since
 * killed, so everything it shows has to be already decided and already written
 * down.
 *
 * Nothing here can throw its way into the launcher's process. A missing,
 * unreadable or differently-versioned snapshot all come back as `null` from the
 * parser and land on the same empty state, which asks for the one thing that
 * would fix it.
 */
class WidgetSnapshotProvider : AppWidgetProvider() {

  override fun onUpdate(
    context: Context,
    appWidgetManager: AppWidgetManager,
    appWidgetIds: IntArray
  ) {
    appWidgetIds.forEach { appWidgetId ->
      appWidgetManager.updateAppWidget(appWidgetId, buildViews(context))
    }
  }

  companion object {
    /** The avatar bitmap's side, in pixels. Small: it crosses a process. */
    private const val AVATAR_SIZE_PX = 132

    /**
     * Redraws every placed widget.
     *
     * Called after the app writes a new snapshot, which is the only thing that
     * can change what these show. There is no scheduler behind it yet, so a
     * widget left alone while the app is closed keeps the day it was given.
     */
    @JvmStatic
    fun refreshAll(context: Context) {
      val manager = AppWidgetManager.getInstance(context) ?: return
      val provider = ComponentName(context.packageName, WidgetSnapshotProvider::class.java.name)
      val ids = manager.getAppWidgetIds(provider)

      if (ids.isEmpty()) {
        return
      }

      val views = buildViews(context)

      ids.forEach { manager.updateAppWidget(it, views) }
    }

    private fun readSnapshot(context: Context): WidgetSnapshot? {
      val preferences = context.getSharedPreferences(
        WIDGET_SNAPSHOT_PREFERENCES_FILE,
        Context.MODE_PRIVATE
      )

      return parseWidgetSnapshot(preferences.getString(WIDGET_SNAPSHOT_KEY, null))
    }

    /** Opens the app, which is the only thing tapping the widget does. */
    private fun openAppIntent(context: Context): PendingIntent? {
      val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)
        ?: return null

      launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)

      return PendingIntent.getActivity(
        context,
        0,
        launch,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      )
    }

    private fun buildViews(context: Context): RemoteViews {
      val views = RemoteViews(context.packageName, R.layout.widget_snapshot)
      val snapshot = readSnapshot(context)

      openAppIntent(context)?.let { views.setOnClickPendingIntent(R.id.widget_root, it) }

      if (snapshot == null) {
        views.setViewVisibility(R.id.widget_content, View.GONE)
        views.setViewVisibility(R.id.widget_empty, View.VISIBLE)

        return views
      }

      views.setViewVisibility(R.id.widget_empty, View.GONE)
      views.setViewVisibility(R.id.widget_content, View.VISIBLE)

      views.setImageViewBitmap(
        R.id.widget_avatar,
        WidgetAvatarArtist.draw(snapshot.avatar, AVATAR_SIZE_PX)
      )

      setTextOrHide(views, R.id.widget_cycle_day, widgetCycleDayLabel(snapshot.cycleDay))
      setTextOrHide(views, R.id.widget_phase, widgetPhaseLabel(snapshot.phase))
      setTextOrHide(views, R.id.widget_message, snapshot.supportMessage)
      setTextOrHide(views, R.id.widget_moods, widgetMoodSummary(snapshot.moodLabels))

      return views
    }

    /**
     * Shows a line, or removes it.
     *
     * Hidden rather than blank: an empty row on a small card reads as something
     * that failed to load, and every one of these is legitimately absent
     * sometimes.
     */
    private fun setTextOrHide(views: RemoteViews, viewId: Int, text: String?) {
      if (text.isNullOrBlank()) {
        views.setViewVisibility(viewId, View.GONE)

        return
      }

      views.setTextViewText(viewId, text)
      views.setViewVisibility(viewId, View.VISIBLE)
    }
  }
}
