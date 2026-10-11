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

/**
 * What the app assumes when nobody has said.
 *
 * These lived in an onboarding screen that asked for both of them before it
 * asked the one thing it cannot guess. The screen pre-filled each question
 * with the figure most people would give and then asked it anyway, which is
 * two screens somebody can quit on for an answer the app already had.
 *
 * Here because two places need them now: the onboarding, which no longer
 * asks, and the settings screen, which offers them as the starting point.
 * `limits.test.ts` holds them inside the range above - a default outside it
 * is a profile the app writes and then refuses to load.
 */
export const DEFAULT_CYCLE_LENGTH_DAYS = 28;
export const DEFAULT_PERIOD_LENGTH_DAYS = 5;

export const MIN_CYCLE_LENGTH_DAYS = 15;
export const MAX_CYCLE_LENGTH_DAYS = 90;

export const MIN_PERIOD_LENGTH_DAYS = 1;
export const MAX_PERIOD_LENGTH_DAYS = 20;

/**
 * Longest span a single recorded period may cover, counting both end days.
 *
 * Its own rule, about one record rather than the profile's average, so it stays
 * a separate constant even though it currently matches `MAX_PERIOD_LENGTH_DAYS`.
 */
export const MAX_PERIOD_DURATION_DAYS = 20;
