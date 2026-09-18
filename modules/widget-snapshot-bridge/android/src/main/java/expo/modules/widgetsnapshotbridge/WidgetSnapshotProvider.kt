package expo.modules.widgetsnapshotbridge

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Bundle
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
 * The card is drawn at whatever size the launcher reports, in one of three
 * layouts. The size is asked for per widget rather than assumed, because two
 * copies of the same widget can be different sizes on the same home screen.
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
      appWidgetManager.updateAppWidget(appWidgetId, buildViews(context, appWidgetManager, appWidgetId))
    }
  }

  /** Redraws one widget after it is resized, which is when the layout can change. */
  override fun onAppWidgetOptionsChanged(
    context: Context,
    appWidgetManager: AppWidgetManager,
    appWidgetId: Int,
    newOptions: Bundle?
  ) {
    super.onAppWidgetOptionsChanged(context, appWidgetManager, appWidgetId, newOptions)

    appWidgetManager.updateAppWidget(appWidgetId, buildViews(context, appWidgetManager, appWidgetId))
  }

  companion object {
    /**
     * The avatar bitmap's side, in pixels, per size class.
     *
     * Bigger than the view it sits in, so it stays sharp on a dense screen, and
     * still small: it crosses a process boundary on every redraw.
     */
    private fun avatarSizePx(size: WidgetSizeClass): Int = when (size) {
      WidgetSizeClass.SMALL -> 96
      WidgetSizeClass.MEDIUM -> 144
      WidgetSizeClass.LARGE -> 216
    }

    private fun layoutFor(size: WidgetSizeClass): Int = when (size) {
      WidgetSizeClass.SMALL -> R.layout.widget_snapshot_small
      WidgetSizeClass.MEDIUM -> R.layout.widget_snapshot
      WidgetSizeClass.LARGE -> R.layout.widget_snapshot_large
    }

    /**
     * Redraws every placed widget.
     *
     * Called after the app writes a new snapshot, which is the only thing that
     * can change what these show. Each widget is built separately because each
     * has its own size.
     *
     * There is no scheduler behind it, so a widget left alone while the app is
     * closed keeps the day it was given.
     */
    @JvmStatic
    fun refreshAll(context: Context) {
      val manager = AppWidgetManager.getInstance(context) ?: return
      val provider = ComponentName(context.packageName, WidgetSnapshotProvider::class.java.name)

      manager.getAppWidgetIds(provider).forEach { appWidgetId ->
        manager.updateAppWidget(appWidgetId, buildViews(context, manager, appWidgetId))
      }
    }

    private fun readSnapshot(context: Context): WidgetSnapshot? {
      val preferences = context.getSharedPreferences(
        WIDGET_SNAPSHOT_PREFERENCES_FILE,
        Context.MODE_PRIVATE
      )

      return parseWidgetSnapshot(preferences.getString(WIDGET_SNAPSHOT_KEY, null))
    }

    /**
     * The size the launcher says this widget has, as a class.
     *
     * The minimums are used rather than the maximums: they are the size in the
     * current orientation, and drawing for the larger of the two would overflow
     * whichever way the phone is not being held.
     */
    private fun sizeClassOf(manager: AppWidgetManager, appWidgetId: Int): WidgetSizeClass {
      val options = try {
        manager.getAppWidgetOptions(appWidgetId)
      } catch (error: Throwable) {
        null
      } ?: return WidgetSizeClass.MEDIUM

      return widgetSizeClass(
        options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0),
        options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0)
      )
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

    private fun buildViews(
      context: Context,
      manager: AppWidgetManager,
      appWidgetId: Int
    ): RemoteViews {
      val size = sizeClassOf(manager, appWidgetId)
      val views = RemoteViews(context.packageName, layoutFor(size))
      val snapshot = readSnapshot(context)

      openAppIntent(context)?.let { views.setOnClickPendingIntent(R.id.widget_root, it) }

      // One description for the whole card: it is one thing on the home screen,
      // and reading out four unlabelled fragments would not help anyone.
      views.setContentDescription(R.id.widget_root, widgetContentDescription(snapshot, size))

      // The avatar is decorative next to that description, and a second reading
      // of "Avatar" between the day and the phase is noise.
      views.setContentDescription(R.id.widget_avatar, "")

      views.setImageViewBitmap(
        R.id.widget_avatar,
        WidgetAvatarArtist.draw(snapshot?.avatar, avatarSizePx(size))
      )

      if (snapshot == null) {
        views.setViewVisibility(R.id.widget_content, View.GONE)
        views.setViewVisibility(R.id.widget_empty, View.VISIBLE)

        return views
      }

      views.setViewVisibility(R.id.widget_empty, View.GONE)
      views.setViewVisibility(R.id.widget_content, View.VISIBLE)

      setTextOrHide(views, R.id.widget_cycle_day, widgetCycleDayLabel(snapshot.cycleDay))
      setTextOrHide(views, R.id.widget_phase, widgetPhaseLabel(snapshot.phase))
      setTextOrHide(views, R.id.widget_message, snapshot.supportMessage)
      setTextOrHide(views, R.id.widget_moods, widgetMoodText(snapshot.moodLabels, size))

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
