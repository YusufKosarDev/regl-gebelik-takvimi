import { describeError } from './describe-error';
import type { LogEvent } from './log-events';
import { isLogEvent } from './log-events';

/**
 * The one way this app writes to the console.
 *
 * Everything it handles is health data: when a period started, when a baby is
 * due, what someone's avatar looks like and the messages built out of those. A
 * log line is not private — it goes to logcat, to whatever is attached to the
 * device and into any report collected from it — so none of that is written,
 * in a development build or a released one.
 *
 * The event has to come from the catalogue. A caller cannot assemble a line, so
 * there is no call site where a date could be concatenated onto one, and a
 * string built at runtime is dropped rather than written.
 *
 * Errors are described, never serialised: the class name and a platform code if
 * there is one, never the message and never the stack.
 */
export function logEvent(event: LogEvent, error?: unknown): void {
  if (!isLogEvent(event)) {
    return;
  }

  const described = error === undefined ? null : describeError(error);

  // `warn` rather than `error`: these are things the app recovered from, and a
  // released build should not be shouting about a reminder that could not be
  // queued.
  console.warn(described === null ? `[app] ${event}` : `[app] ${event} (${described})`);
}
