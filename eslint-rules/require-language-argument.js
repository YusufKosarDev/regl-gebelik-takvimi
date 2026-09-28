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
