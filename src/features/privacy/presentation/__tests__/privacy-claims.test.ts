import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * The claims the app's copy may never start making.
 *
 * ## Why a negative test, and why over the files rather than the strings
 *
 * The privacy copy drifts in one direction. Nobody rewrites a careful sentence
 * into a reckless one on purpose; somebody shortens a long qualification, or
 * reassures, and an absolute appears where a conditional was. That edit passes
 * every test the app has, because every one of them asserts what the copy says
 * rather than what it may not.
 *
 * It already happened. The account screen promised "none of it is sent
 * anywhere", which stopped being true the moment somebody made an account -
 * and a catalogue test pinned that sentence word for word, so the suite was
 * green while the screen was wrong.
 *
 * Scanning the files catches an unrendered string as well as a rendered one.
 * That matters: a false claim sitting in a catalogue is one wiring-up away
 * from a screen, and the one this found - `accountSectionDescription`, "Hesap
 * açmak isteğe bağlı. Verilerin telefonunda kalır." - had been dead for long
 * enough that two rounds walked past it.
 *
 * ## What is forbidden
 *
 * Unconditional claims about where records go. The app sends records to the
 * person's own account when they back up, sync, or turn automatic sync on, so
 * any sentence saying data stays on the phone, full stop, is false - however
 * gently it is put. The true version always carries the condition, which is
 * why the patterns below are anchored on the absence of one.
 *
 * Adding a string here is not a licence to write the claim elsewhere: the
 * point is that there is nowhere it is true.
 *
 * ## Narrow on purpose, after a false positive
 *
 * A first version matched "stays on your phone" generally and flagged the
 * account-deletion panel's "Your records will stay on your phone. You can go on
 * using the app without an account." That sentence is correct: it describes
 * what happens to local records when somebody deletes their account, not where
 * records live in general. An assertion that flags right copy teaches the next
 * person the wrong rule, so the English pattern is anchored on "either way" -
 * the phrase that denies the condition rather than omitting it.
 */
const CATALOGUES = [
  ['auth', join(__dirname, '..', '..', '..', 'auth', 'presentation', 'auth-messages.ts')],
  [
    'settings',
    join(__dirname, '..', '..', '..', 'cycle', 'presentation', 'settings-messages.ts'),
  ],
  [
    'deletion',
    join(__dirname, '..', '..', '..', 'deletion', 'presentation', 'deletion-messages.ts'),
  ],
  [
    'export',
    join(__dirname, '..', '..', '..', 'export', 'presentation', 'export-messages.ts'),
  ],
  [
    'onboarding',
    join(__dirname, '..', '..', '..', 'onboarding', 'presentation', 'onboarding-messages.ts'),
  ],
] as const;

/**
 * Sentences that are absolute about where records live.
 *
 * Each is the shape of a reassurance rather than a specific string: "kalır"
 * and "stays" with nothing conditional attached, and the handful of phrasings
 * that mean "goes nowhere".
 */
const FORBIDDEN: readonly (readonly [string, RegExp])[] = [
  ['verilerin telefonunda kalır', /[Vv]erilerin(iz)? telefonun[du]a kalır/],
  ['kayıtların telefonunda kalır', /[Kk]ayıtların(ız)? telefonun[du]a kalır/],
  ['telefonundan çıkmaz', /telefonun[du]an çıkmaz/],
  ['hiçbir yere gitmez, unconditionally', /hiçbir yere gitmez\./],
  ['hiçbir yere gönderilmez, unconditionally', /hiçbir yere gönderilmez\./],
  ['stays on your phone either way', /stays? on your phone,? either way/i],
  ['never leaves your phone', /never leaves? (your|this) phone/i],
  ['goes nowhere', /goes nowhere\./i],
  ['none of it is sent anywhere', /none of it is sent anywhere/i],
];

describe('no catalogue claims records stay on the phone without a condition', () => {
  it.each(CATALOGUES)('%s', (_name, path) => {
    const contents = readFileSync(path, 'utf8');

    for (const [described, pattern] of FORBIDDEN) {
      expect([described, pattern.test(contents)]).toEqual([described, false]);
    }
  });
});
