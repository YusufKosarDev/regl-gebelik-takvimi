// A date has to be told which language it is being read in.
//
// ## Why this rule exists
//
// `formatDisplayDate` and `formatDisplayMonth` take the language as an
// optional trailing argument, defaulting to Turkish. That default is not a
// convenience — it is what lets the eighty-odd assertions written before the
// second language existed go on calling these functions with one argument and
// go on proving the Turkish output is unchanged.
//
// The price is a hole exactly like the one `no-turkish-outside-catalogues`
// closes. A screen that forgets the argument renders "17 Eylül 2026" under an
// English heading. Types cannot catch it — the call is valid. The suite cannot
// catch it — `jest/expo-localization-mock.js` pins the device to Turkish, so
// the default and the correct answer agree in every test that does not say
// otherwise. Without this rule the default would be a trap that only a person
// holding an English phone could find.
//
// So the default exists for the tests, and this rule makes it unreachable
// everywhere else.
//
// ## What it forbids
//
// Calling either function without its language argument, anywhere outside a
// test. Tests are exempt because pinning the default is their job.
//
// It matches on the callee's name rather than on what it resolves to. An
// unrelated local function of the same name would be reported wrongly; there
// is none, and the alternative is type information this rule does not have.

/** Each guarded function, and how many arguments it takes with the language. */
const REQUIRED_ARGUMENTS = {
  formatDisplayDate: 2,
  formatDisplayMonth: 3,
};

/**
 * Functions that are Turkish by construction and have a catalogue-taking twin.
 *
 * ## Why these needed a rule of their own
 *
 * The trap above has a second shape this rule did not cover. Instead of an
 * optional trailing language, some presentation modules export a *pair*: a
 * `…In(messages, …)` that takes the catalogue half, and a bare one that calls it
 * with the Turkish half. The bare one exists so assertions written before the
 * second language go on proving the Turkish output is unchanged.
 *
 * Calling it from a screen is valid TypeScript, passes every test — because
 * `jest/expo-localization-mock.js` pins the suite to a Turkish phone, so the
 * Turkish answer and the correct answer agree — and renders Turkish to an
 * English reader. Exactly the hole the argument check closes for dates, in a
 * shape the argument check cannot see: the call is not missing anything.
 *
 * It is not hypothetical. `(lock)/index.tsx` built every wait sentence with
 * `waitMessage(…)` in all five places a wait can begin, so the lock screen —
 * the one screen whose job is to be understood by whoever is holding the phone
 * — counted down in Turkish however the app was set. Nothing caught it: a wait
 * is not a state the English screen sweep can reach, since that renders each
 * screen as it arrives and no further.
 *
 * So: these may be called from tests, which is what they are for, and nowhere
 * else. No production call site remains — the list is a floor, not a backlog.
 */
const TURKISH_ONLY = {
  waitMessage: 'waitMessageIn(messages, …)',
  getCyclePhaseLabel: 'getCyclePhaseLabelIn(labels, …)',
  getFertilityLevelLabel: 'getFertilityLevelLabelIn(labels, …)',
  getCalendarDayAccessibilityLabel: 'getCalendarDayAccessibilityLabelIn(labels, …)',
};

/** Tests pin the Turkish default on purpose, so they may call the short form. */
function isTest(filename) {
  const posix = filename.replace(/\\/g, '/');

  return /\/__tests__\/|\.test\.tsx?$/.test(posix);
}

module.exports = {
  rules: {
    'require-language-argument': {
      meta: {
        type: 'problem',
        docs: {
          description:
            'Date formatting must be given a language, so that a screen cannot render Turkish dates to an English reader.',
        },
        schema: [],
        messages: {
          missingLanguage:
            "{{name}} was called without a language, so it will render Turkish whatever the reader's phone says. Pass useLanguage() from the component, or the language of the catalogue half this function is written on.",
          turkishOnly:
            "{{name}} is the Turkish-only wrapper, kept for assertions. Outside a test it renders Turkish whatever the reader's phone says. Call {{instead}} with the catalogue half the screen is already reading.",
        },
      },

      create(context) {
        const filename = context.filename ?? context.getFilename();

        if (isTest(filename)) {
          return {};
        }

        return {
          CallExpression(node) {
            if (node.callee.type !== 'Identifier') {
              return;
            }

            const instead = TURKISH_ONLY[node.callee.name];

            if (instead !== undefined) {
              context.report({
                node,
                messageId: 'turkishOnly',
                data: { name: node.callee.name, instead },
              });

              return;
            }

            const required = REQUIRED_ARGUMENTS[node.callee.name];

            if (required === undefined || node.arguments.length >= required) {
              return;
            }

            // A spread could be carrying the language, and this rule cannot
            // see inside it. Saying nothing is better than being wrong.
            if (node.arguments.some((argument) => argument.type === 'SpreadElement')) {
              return;
            }

            context.report({
              node,
              messageId: 'missingLanguage',
              data: { name: node.callee.name },
            });
          },
        };
      },
    },
  },
};
