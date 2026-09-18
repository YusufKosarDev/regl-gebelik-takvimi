import * as Notifications from 'expo-notifications';

/**
 * Finding this app's own notifications again, and nothing else.
 *
 * Every reminder carries a versioned `type` in its payload, and that is the only
 * thing ever matched on. It is how cancelling stays surgical — one kind goes,
 * every other kind stays, including kinds this build has never heard of — and it
 * is why no identifier has to be stored anywhere: the queue already knows what
 * is in it, survives restarts, and is the one place that cannot go stale.
 *
 * Shared by both reminders on purpose. The guarantee that a sync only removes
 * its own is worth making once rather than restating it per feature.
 */

function hasType(data: unknown, type: string): boolean {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return false;
  }

  return (data as { type?: unknown }).type === type;
}

/**
 * Cancels every scheduled notification carrying this exact type.
 *
 * Returns how many went, which is what makes "exactly one afterwards" something
 * a test can check rather than assume.
 */
export async function cancelScheduledRemindersOfType(type: string): Promise<number> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const ours = scheduled.filter((request) => hasType(request.content?.data, type));

  for (const request of ours) {
    await Notifications.cancelScheduledNotificationAsync(request.identifier);
  }

  return ours.length;
}
