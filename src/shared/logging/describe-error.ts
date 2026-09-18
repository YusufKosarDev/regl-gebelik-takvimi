/**
 * The part of a thrown value that is safe to write down.
 *
 * Not the message and not the stack. A message is built at the throw site out of
 * whatever was being worked on, which in this app means a period date, a due
 * date or an avatar; a stack can carry the same through a wrapped cause. What is
 * left is the class name and, when the platform supplies one, a machine code
 * like `ERR_WIDGET_SNAPSHOT_WRITE_FAILED` — both of them fixed text chosen by a
 * developer rather than anything a person entered.
 *
 * Both are checked against a shape before they are used, so a name or a code
 * assembled out of user data at runtime is dropped instead of written.
 */

/** Class names are letters, as written in the source. */
const SAFE_NAME = /^[A-Za-z]{0,40}(Error|Exception)$/;

/** Platform codes are shouted constants: `ERR_SOMETHING_FAILED`. */
const SAFE_CODE = /^[A-Z][A-Z0-9_]{1,60}$/;

function safeName(error: unknown): string | null {
  if (typeof error !== 'object' || error === null) {
    return null;
  }

  const { name } = error as { name?: unknown };

  return typeof name === 'string' && SAFE_NAME.test(name) ? name : null;
}

function safeCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null) {
    return null;
  }

  const { code } = error as { code?: unknown };

  return typeof code === 'string' && SAFE_CODE.test(code) ? code : null;
}

/**
 * Describes a thrown value in fixed text, or `null` when there is nothing safe
 * to say about it. `null` is a real answer: a string thrown on its own could be
 * anything, so nothing about it is written.
 */
export function describeError(error: unknown): string | null {
  const name = safeName(error);
  const code = safeCode(error);

  if (name === null) {
    return code;
  }

  return code === null ? name : `${name} ${code}`;
}
