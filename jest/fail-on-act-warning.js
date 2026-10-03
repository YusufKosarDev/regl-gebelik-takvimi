/**
 * Turns React's act warning into a failing test.
 *
 * ## What the warning means
 *
 * "An update to X inside a test was not wrapped in act(...)" says a component
 * changed state after the test stopped waiting for it. Usually that is a test
 * asserting before a screen has finished arriving, which is harmless in itself.
 * Sometimes it is a screen writing state after it has gone, which is a real
 * leak - and the two print exactly the same line.
 *
 * ## Why it fails rather than prints
 *
 * There were nine of these, printed on every run, all of them the harmless
 * kind. Nine expected warnings in the output are nine reasons not to read the
 * tenth. They were all fixed; this is what stops the tenth from joining them
 * unnoticed.
 *
 * React routes the warning through `console.error`, so that is what is
 * intercepted. Everything else is passed through untouched - several suites
 * assert on logged output, and a few deliberately exercise code that logs.
 *
 * ## If this fails on your change
 *
 * It is not asking you to wrap the assertion. It is saying something updated
 * after the test moved on: either await what you started (`renderSettled` and
 * `settle` in `jest/render-settled.ts` exist for that), or look at why the
 * component is still writing state.
 */

const originalError = console.error;

const isActWarning = (args) => {
  const [first] = args;

  return typeof first === 'string' && first.includes('not wrapped in act');
};

beforeEach(() => {
  console.error = (...args) => {
    if (isActWarning(args)) {
      // Thrown rather than recorded, so the stack points at the line that
      // started the update rather than at the end of the run.
      throw new Error(
        'A state update landed outside act(). See jest/fail-on-act-warning.js. ' +
          'React said: ' +
          String(args[0]).slice(0, 200)
      );
    }

    originalError(...args);
  };
});

afterEach(() => {
  console.error = originalError;
});
