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

/** One choice, in any of the three catalogues. */
export type CatalogueEntry = {
  readonly id: string;
  readonly label: string;
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
export const FLOW_LEVELS: readonly CatalogueEntry[] = [
  { id: 'spotting', label: 'Leke' },
  { id: 'light', label: 'Hafif' },
  { id: 'medium', label: 'Orta' },
  { id: 'heavy', label: 'Yoğun' },
];

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
export const SYMPTOMS: readonly CatalogueEntry[] = [
  { id: 'cramps', label: 'Kramp' },
  { id: 'headache', label: 'Baş ağrısı' },
  { id: 'bloating', label: 'Şişkinlik' },
  { id: 'fatigue', label: 'Yorgunluk' },
  { id: 'breast-tenderness', label: 'Göğüs hassasiyeti' },
  { id: 'back-pain', label: 'Bel ağrısı' },
  { id: 'nausea', label: 'Mide bulantısı' },
  { id: 'acne', label: 'Akne' },
  { id: 'appetite-change', label: 'İştah değişimi' },
  { id: 'sleep-trouble', label: 'Uyku sorunu' },
];

/**
 * How the day felt, in the person's own reckoning.
 *
 * Five points, single choice, and the words are plain. None of them is
 * "normal": what is normal for somebody is not this app's to say, and a scale
 * with a normal on it turns a note into a verdict.
 *
 * Ordered best to worst, and screens rely on that order.
 */
export const MOODS: readonly CatalogueEntry[] = [
  { id: 'very-good', label: 'Çok iyi' },
  { id: 'good', label: 'İyi' },
  { id: 'okay', label: 'Orta' },
  { id: 'bad', label: 'Kötü' },
  { id: 'very-bad', label: 'Çok kötü' },
];

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

/** The label for an id, or `null` when nothing in the catalogue has it. */
export function labelFor(catalogue: readonly CatalogueEntry[], id: string): string | null {
  return entryById(catalogue, id)?.label ?? null;
}

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
