/**
 * The numeric bounds a cycle profile has to satisfy.
 *
 * These live in the domain because they are rules, not UI choices: the stepper
 * screens, the route param parsers and `validateCycleSettings` all have to agree
 * on them, and the only way to guarantee that is for there to be one copy.
 *
 * Plain values, no logic. Changing one here changes every screen and check that
 * reads it, which is the point.
 *
 * Deliberately *not* the source for the SQLite CHECK constraints: migrations are
 * immutable history, so their literals stay written out in the migration file.
 */

export const MIN_CYCLE_LENGTH_DAYS = 15;
export const MAX_CYCLE_LENGTH_DAYS = 90;

export const MIN_PERIOD_LENGTH_DAYS = 1;
export const MAX_PERIOD_LENGTH_DAYS = 20;
