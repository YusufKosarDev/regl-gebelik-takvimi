/**
 * Thrown when the stored backup holds something this build cannot write back.
 *
 * In `domain/` rather than beside the repository that throws it. It is not a
 * Firestore failure and says nothing about the network or the account: it is
 * this app refusing, on purpose, because writing would delete a field a newer
 * build put there. The repository is where the refusal is detected; what the
 * refusal *means* is a rule, and rules live here.
 *
 * It also has to survive a test that replaces the repository module wholesale.
 * An error class exported from a mocked module is `undefined` at the catch
 * site, and `instanceof undefined` throws — so the one thing that must never
 * break is the check that decides whether somebody's data was protected.
 */
export class OutdatedAppError extends Error {
  /**
   * The payload keys this build has no meaning for.
   *
   * Schema names, never anything a person typed. They are safe in a log line;
   * what is in those fields is not, and is not here.
   */
  readonly unknownFields: readonly string[];

  constructor(unknownFields: readonly string[]) {
    super(`The stored backup holds ${unknownFields.length} field(s) this build cannot write.`);

    this.name = 'OutdatedAppError';
    this.unknownFields = unknownFields;
  }
}

/** Whether something is this refusal, rather than a fault. */
export function isOutdatedAppError(error: unknown): error is OutdatedAppError {
  return error instanceof OutdatedAppError;
}
