import type { FlowId, MoodId, SymptomId } from '../domain/catalogues';

import type { Messages } from '@/i18n';

/**
 * What the three catalogues are called, in each language.
 *
 * The ids, their order and which are retired live in `domain/catalogues.ts`.
 * Only the words are here, keyed by those ids, so that adding a choice is one
 * edit in the domain and one word per language — and so that neither language
 * can quietly hold a choice the other does not.
 *
 * Typed as `Record<FlowId, string>` and its siblings rather than a loose map.
 * The id types are derived from the catalogues themselves, so a new id with no
 * English word fails `tsc` rather than reaching somebody as a blank chip.
 *
 * ## Nothing here interprets anything
 *
 * Same rule as the rest of this feature: these name what somebody noticed and
 * say nothing about what it means. "Cramps", not "period pain"; "Okay", not
 * "normal".
 */

export type FlowLabels = Readonly<Record<FlowId, string>>;
export type SymptomLabels = Readonly<Record<SymptomId, string>>;
export type MoodLabels = Readonly<Record<MoodId, string>>;

const flowLabelsTr: FlowLabels = {
  spotting: 'Leke',
  light: 'Hafif',
  medium: 'Orta',
  heavy: 'Yoğun',
};

/**
 * "Spotting" is the clinical word in English and the plain one too, which is
 * lucky: it is the only one of the four that names a thing rather than a
 * degree, exactly as `Leke` does.
 */
const flowLabelsEn: FlowLabels = {
  spotting: 'Spotting',
  light: 'Light',
  medium: 'Medium',
  heavy: 'Heavy',
};

const symptomLabelsTr: SymptomLabels = {
  cramps: 'Kramp',
  headache: 'Baş ağrısı',
  bloating: 'Şişkinlik',
  fatigue: 'Yorgunluk',
  'breast-tenderness': 'Göğüs hassasiyeti',
  'back-pain': 'Bel ağrısı',
  nausea: 'Mide bulantısı',
  acne: 'Akne',
  'appetite-change': 'İştah değişimi',
  'sleep-trouble': 'Uyku sorunu',
};

/**
 * Plain words, and none of them a diagnosis.
 *
 * "Trouble sleeping" rather than "insomnia", "Breast tenderness" rather than
 * "mastalgia": somebody is noting what they felt, not classifying it. The
 * Turkish makes the same choice, which is why `Uyku sorunu` is not
 * `uykusuzluk`.
 */
const symptomLabelsEn: SymptomLabels = {
  cramps: 'Cramps',
  headache: 'Headache',
  bloating: 'Bloating',
  fatigue: 'Fatigue',
  'breast-tenderness': 'Breast tenderness',
  'back-pain': 'Back pain',
  nausea: 'Nausea',
  acne: 'Acne',
  'appetite-change': 'Appetite change',
  'sleep-trouble': 'Trouble sleeping',
};

const moodLabelsTr: MoodLabels = {
  'very-good': 'Çok iyi',
  good: 'İyi',
  okay: 'Orta',
  bad: 'Kötü',
  'very-bad': 'Çok kötü',
};

/**
 * Five points, and the middle one is not "normal".
 *
 * `Orta` is "middling", not "normal" — what is normal for somebody is not this
 * app's to say, and a scale with a normal on it turns a note into a verdict.
 * "Okay" carries the same shrug. "Average" would not: it implies a comparison
 * with other people, which is the one thing this feature never does.
 */
const moodLabelsEn: MoodLabels = {
  'very-good': 'Very good',
  good: 'Good',
  okay: 'Okay',
  bad: 'Bad',
  'very-bad': 'Very bad',
};

export type DailyLogCatalogueLabels = {
  readonly flows: FlowLabels;
  readonly symptoms: SymptomLabels;
  readonly moods: MoodLabels;
};

export const dailyLogCatalogueLabels: Messages<DailyLogCatalogueLabels> = {
  tr: { flows: flowLabelsTr, symptoms: symptomLabelsTr, moods: moodLabelsTr },
  en: { flows: flowLabelsEn, symptoms: symptomLabelsEn, moods: moodLabelsEn },
};

/**
 * The word for an id, or `null` when this build has no word for it.
 *
 * `null` rather than the raw id, and rather than a throw. A stored day can name
 * something a later build retired or something an older build never heard of;
 * `sleep-trouble` on a card would be worse than one fewer word. The caller
 * decides what to show, which in practice means it shows nothing.
 *
 * Takes a plain `string` because that is what comes back out of the database.
 * The typed ids guard what goes *in* to the maps; this guards what comes out.
 */
export function labelFor(
  labels: Readonly<Record<string, string>>,
  id: string
): string | null {
  return labels[id] ?? null;
}
