// Turkish belongs in a catalogue, not in a screen.
//
// ## Why this rule exists
//
// Until English was added, the test suite was the thing that caught a stray
// Turkish literal: a screen that hard-coded a sentence still rendered it, and
// an assertion somewhere would notice if it changed. That stopped being true
// the moment `jest/expo-localization-mock.js` pinned the suite to Turkish
// rendering. A screen that ignores `useMessages()` and writes Turkish inline
// now passes every test, looks right in Turkish, and shows Turkish to an
// English user.
//
// Nothing else can catch that. Types cannot — a string literal is a valid
// string. The suite cannot — it only ever renders Turkish. So this rule is not
// a tidiness preference; it is the only mechanism standing between the app and
// a screen that is half-translated.
//
// ## What it forbids
//
// A string literal containing a Turkish-specific letter, anywhere outside the
// allow-list below. Turkish-specific letters only: matching on ASCII words
// would flag English prose, and a Turkish string with no special letter is
// rare enough to be worth missing rather than drowning the rule in noise.
//
// Comments are not checked. The doc comments in this repository are English
// prose that quotes Turkish constantly, and they are documentation, not
// interface text.
//
// ## Where Turkish is allowed
//
// The Turkish half of a translated pair, and nowhere else.
//
// This list used to carry four entries marked TEMPORARY, with a note saying the
// last removal would prove the migration finished. Only one of them left: the
// avatar option names. The other three hold a Turkish half that is meant to
// stay — a month table, and two files of health content whose sentences cannot
// be separated from the citations beside them — so they were reclassified
// rather than removed, with the reason written where each entry is.
//
// What proves it finished is therefore not an empty list. It is that every file
// on this list exports a `Messages<T>` pair and has a parity test holding the
// two halves to each other. Adding an entry without one would re-open exactly
// the hole this rule closes, which is why each entry says why it is here.

const TURKISH_LETTERS = /[ğüşıöçĞÜŞİÖÇ]/;

/**
 * Files allowed to contain Turkish, as substrings of a POSIX-style path.
 *
 * Every entry is permanent and says why. Two kinds: the Turkish catalogues
 * themselves, and the developer documentation that happens to be written in
 * Turkish and is never rendered.
 *
 * A new entry needs a reason and a parity test. One added without either is how
 * this rule quietly stops working.
 */
const ALLOWED = [
  // Permanent: the Turkish catalogues. This is where Turkish lives.
  'src/features/*/presentation/',
  'src/shared/presentation/',

  // Permanent: developer documentation, never rendered. `DATA_INVENTORY[].reason`
  // is prose that `docs/data-privacy.md` mirrors and a test binds the two;
  // translating it would mean translating the document it documents.
  'src/features/privacy/domain/data-category.ts',

  // Permanent: the health content, in both languages. It stayed in data/
  // rather than moving to presentation/ because each claim travels with the
  // page it came from, and separating a sentence from its citation is the one
  // thing these two files exist to prevent.
  'src/features/pregnancy/data/pregnancy-weekly-content.ts',
  'src/features/cycle/data/cycle-daily-support.ts',
  // Permanent: the avatar option names, in both languages. They stayed beside
  // their ids rather than moving to presentation/ because `avatar-option.ts`
  // states the catalogue rule in terms of the two together — retire an entry by
  // hiding it, "and leave it in the catalogue so that what was already chosen
  // still has a name." Splitting the name away would put the two halves of that
  // rule in two files.
  'src/features/avatar/data/avatar-catalog.ts',
  // Permanent: the month names, in both languages. This file is not waiting to
  // be converted — it has been, and the Turkish half is half of the answer.
  // `require-language-argument` is what keeps a caller from getting that half
  // by accident.
  'src/utils/format-date.ts',
];

/** Turns an allow-list entry into a matcher over a POSIX-style path. */
function matches(filename, entry) {
  if (entry.includes('*')) {
    const pattern = entry.split('*').map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'));
    return new RegExp(pattern.join('[^/]*')).test(filename);
  }

  return filename.includes(entry);
}

function isAllowed(filename) {
  const posix = filename.replace(/\\/g, '/');

  // Tests assert against Turkish text by design; that is the point of them.
  if (/\/__tests__\/|\.test\.tsx?$/.test(posix)) return true;

  return ALLOWED.some((entry) => matches(posix, entry));
}

module.exports = {
  rules: {
    'no-turkish-outside-catalogues': {
      meta: {
        type: 'problem',
        docs: {
          description:
            'Turkish interface text must live in a presentation catalogue, so that every string has an English counterpart the compiler can check.',
        },
        schema: [],
        messages: {
          turkishOutsideCatalogue:
            'Turkish string outside a presentation catalogue. Move it to this feature\'s *-messages.ts and read it through useMessages(), or the English build will show Turkish here.',
        },
      },

      create(context) {
        const filename = context.filename ?? context.getFilename();

        if (isAllowed(filename)) {
          return {};
        }

        /** Reports a node whose text contains a Turkish-specific letter. */
        const check = (node, value) => {
          if (typeof value === 'string' && TURKISH_LETTERS.test(value)) {
            context.report({ node, messageId: 'turkishOutsideCatalogue' });
          }
        };

        return {
          Literal(node) {
            check(node, node.value);
          },
          TemplateElement(node) {
            check(node, node.value.cooked ?? node.value.raw);
          },
          JSXText(node) {
            check(node, node.value);
          },
        };
      },
    },
  },
};
