/**
 * Everything this app is allowed to say in a log line.
 *
 * A closed list rather than a format string: the logger refuses anything that
 * is not one of these, so there is no call site where a date, an avatar id or a
 * snapshot could be appended to a message. Each entry names what failed, not
 * what it was working on.
 */
export const LOG_EVENTS = [
  'account delete failed',
  'app mode change failed',
  'app state load failed',
  'automatic sync failed',
  'avatar load failed',
  'avatar save failed',
  'cloud backup delete failed',
  'cycle data load failed',
  'cycle settings load failed',
  'cycle settings save failed',
  'local data wipe failed',
  'notification preference change failed',
  'notification sync failed',
  'onboarding completion failed',
  'period history load failed',
  'period record delete failed',
  'period record save failed',
  'period record update failed',
  'pregnancy due date update failed',
  'pregnancy load failed',
  'pregnancy start failed',
  'pregnancy stop failed',
  'reminder cancel failed',
  'source link open failed',
  'sync state clear failed',
  'widget sync failed',
] as const;

export type LogEvent = (typeof LOG_EVENTS)[number];

/** Whether something is one of the sentences this app may write. */
export function isLogEvent(value: unknown): value is LogEvent {
  return typeof value === 'string' && (LOG_EVENTS as readonly string[]).includes(value);
}
