import type { ISODate } from '@/types/iso-date';

/**
 * What a person can choose on a day, and the rule for changing these lists.
 *
 * ## Catalogue rule: entries are never removed, only hidden
 *
 * The id is what gets stored, and nothing in the database constrains it to this
 * file. That is deliberate — a CHECK that knew these values would have to be
 * migrated every time one is added, and would lock somebody out of their own
 * saved row the moment one is dropped.
 *
 * The price of that freedom is that deleting a line here does not delete the
 * rows pointing at it. It only makes them unreadable: what somebody recorded
 * about their own body quietly stops having a name.
 *
 * So to retire an entry, set `hidden: true`. It stops being offered to anyone
 * choosing now, and stays here so that what was already chosen can still be
 * read back and shown. Deleting the line is the one thing that is not allowed.
 *
 * An id is likewise permanent. Renaming one is the same as deleting it, with
 * the damage harder to see. `label` is the opposite: it is Turkish somebody
 * reads, not identity, and it can be reworded whenever the wording is wrong.
 */

/**
 * One choice, in any of the three catalogues.
 *
 * An id and whether it is retired, and nothing a person reads. The words used
 * to live here as a `label`, which made this file the one place in `domain/`
 * that decided what was on screen — and made the catalogues untranslatable
 * without rewriting the rules around them. They now live in
 * `presentation/daily-log-catalogues.ts`, one map per language, keyed by these
 * ids.
 *
 * What stays here is what is actually domain: which ids exist, what order they
 * are in, and which are retired. Those are facts about stored days. A label is
 * a fact about a reader.
 */
export type CatalogueEntry = {
  readonly id: string;
  /** Retired: never offered again, still readable on days that hold it. */
  readonly hidden?: true;
};

/**
 * How heavy the bleeding was.
 *
 * Four levels, and `spotting` is one of them rather than a lighter shade of
 * `light`. Spotting happens outside a recorded period as well as inside one,
 * and a person who has it has something to write down that is not "a light
 * period day".
 *
 * Ordered lightest to heaviest, and screens rely on that order.
 */
export const FLOW_LEVELS = [
  { id: 'spotting' },
  { id: 'light' },
  { id: 'medium' },
  { id: 'heavy' },
] as const satisfies readonly CatalogueEntry[];

/**
 * The ids a flow can have, derived rather than restated.
 *
 * This is what makes a label map exhaustive: `Record<FlowId, string>` in either
 * language fails to compile the moment an id is added here without a word for
 * it. The catalogue stays the single source of what exists.
 */
export type FlowId = (typeof FLOW_LEVELS)[number]['id'];

/**
 * What a person noticed.
 *
 * Ten, and the number is part of the design. These are the ones that (a) show
 * up across the luteal and menstrual stretch rather than clustering in one
 * phase, (b) are things somebody can observe without interpreting anything
 * about themselves, and (c) fit a two-column grid without scrolling at the
 * default text size. A longer list turns a quick note into a form.
 *
 * Nothing here is a symptom *of* anything. The app records what was noticed and
 * says nothing back about what it might mean.
 */
export const SYMPTOMS = [
  { id: 'cramps' },
  { id: 'headache' },
  { id: 'bloating' },
  { id: 'fatigue' },
  { id: 'breast-tenderness' },
  { id: 'back-pain' },
  { id: 'nausea' },
  { id: 'acne' },
  { id: 'appetite-change' },
  { id: 'sleep-trouble' },
] as const satisfies readonly CatalogueEntry[];

export type SymptomId = (typeof SYMPTOMS)[number]['id'];

/**
 * How the day felt, in the person's own reckoning.
 *
 * Five points, single choice, and the words are plain. None of them is
 * "normal": what is normal for somebody is not this app's to say, and a scale
 * with a normal on it turns a note into a verdict.
 *
 * Ordered best to worst, and screens rely on that order.
 */
export const MOODS = [
  { id: 'very-good' },
  { id: 'good' },
  { id: 'okay' },
  { id: 'bad' },
  { id: 'very-bad' },
] as const satisfies readonly CatalogueEntry[];

export type MoodId = (typeof MOODS)[number]['id'];

/** What is offered to somebody choosing now. Retired entries are not. */
export function offered(catalogue: readonly CatalogueEntry[]): readonly CatalogueEntry[] {
  return catalogue.filter((entry) => entry.hidden !== true);
}

/**
 * The entry with this id, or `null`.
 *
 * `null` rather than a throw: a stored day can name something a later build
 * retired, or something an older build has never heard of, and neither is a
 * fault worth refusing the whole day over. The caller decides what to show.
 */
export function entryById(
  catalogue: readonly CatalogueEntry[],
  id: string
): CatalogueEntry | null {
  return catalogue.find((entry) => entry.id === id) ?? null;
}

/**
 * `labelFor` used to live here and now lives in
 * `presentation/daily-log-catalogues.ts`, because a label is a word in a
 * language and this file is not allowed to know one. It keeps its `null` for an
 * unknown id, which is the part that was domain reasoning.
 */

/**
 * One day, as the person left it.
 *
 * Every part is optional, and a day with nothing in it does not exist: it is
 * deleted rather than stored empty, so that "cleared" and "never touched" stay
 * the same thing. `hasAnything` is the rule the repository and the screen both
 * ask.
 *
 * `symptoms` is a list rather than a set of flags so the catalogue can grow
 * without the shape of a stored day changing.
 */
export type DailyEntry = {
  readonly date: ISODate;
  readonly flowId: string | null;
  readonly moodId: string | null;
  readonly symptomIds: readonly string[];
};

/** Whether this day holds anything worth storing. */
export function hasAnything(entry: DailyEntry): boolean {
  return entry.flowId !== null || entry.moodId !== null || entry.symptomIds.length > 0;
}

/** A day with nothing recorded, which is what an unvisited date reads as. */
export function emptyDailyEntry(date: ISODate): DailyEntry {
  return { date, flowId: null, moodId: null, symptomIds: [] };
}
