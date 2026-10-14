import { readdirSync, readFileSync, statSync } from 'fs';
import { join, sep } from 'path';

/**
 * A scan of the source rather than of behaviour, modelled on
 * `no-raw-logging.test.ts` and for the same reason: the rule it holds cannot be
 * checked by calling anything.
 *
 * ## What it guards
 *
 * Past the end of the predicted period the app stops inferring. A cycle day is
 * arithmetic from a record and stays true however far out it is asked; a phase
 * or a fertility level read off that count is a claim about a cycle that has
 * not happened. `predictionHorizonFor` in `domain/predictions.ts` is the one
 * place that decides where that line falls.
 *
 * Anything that turns a date or a cycle day into a phase or a fertility level
 * has to ask it. That is a convention, and a convention is exactly what failed
 * before: the horizon arithmetic was written inline in the calendar, the
 * dashboard derived today's phase straight from `getCyclePhase`, and the home
 * screen went on saying "Luteal" for a day the calendar had already stopped
 * speaking about. It was found by paging on a device, with a clean diff and
 * 6,973 green tests. Nothing in the suite noticed, because every test of what
 * those screens do was passing.
 *
 * So a fifth consumer appearing unguarded is the same defect waiting to
 * happen, and this is what makes it fail here instead of on somebody's phone.
 *
 * ## How an exemption is written
 *
 * One consumer legitimately needs no check, and the comment it already carried
 * is the format: `build-cycle-day-ring.ts` says "No horizon check here",
 * names `predictionHorizonFor` as the thing it is skipping, and then sets out
 * the arithmetic for why the ring cannot reach the horizon — along with the
 * condition that would invalidate it.
 *
 * That prose was written before this guard existed and happens to be exactly
 * what a guard would want to read, which is the best evidence the shape is
 * natural rather than invented for a test.
 *
 * An exemption must therefore carry its reason and not only its marker. The
 * ring's premise is checkable arithmetic; the next one may not be, and
 * somebody writing "No horizon check here" with nothing after it should not
 * get past this.
 */

const ROOT = join(__dirname, '..', '..', '..', '..');

/**
 * The four ways a phase or a fertility level is produced.
 *
 * Two convenient ones that take a profile and a date, and two lower-level ones
 * that take settings and a cycle day. The calendar uses the second pair.
 *
 * Written out because a scan that watched only the first pair would have let
 * the calendar's two call sites through — and that is not hypothetical: the
 * sweep that preceded this guard checked `getCyclePhase` and
 * `getEstimatedFertilityLevel` and missed `resolveCyclePhase` and
 * `resolveFertilityLevel` entirely. It reached the right answer by luck. The
 * test below pins the list against what the domain actually exports, so the
 * next name cannot be missed the same way.
 */
const INFERENCE_FUNCTIONS = [
  'getCyclePhase',
  'resolveCyclePhase',
  'getEstimatedFertilityLevel',
  'resolveFertilityLevel',
] as const;

/** The files that define them, which are allowed to call each other. */
const DOMAIN_DIRECTORY = join('features', 'cycle', 'domain');

/**
 * How far above a call the check or the exemption may sit.
 *
 * Twenty lines, which is what the two guarded call sites need: the dashboard
 * computes `beyondHorizon` on the line before, and the calendar's
 * `isBeyondHorizon` is fifteen lines up with the paragraph explaining the
 * trade-off in between. Wider than that and "somewhere in the same file" would
 * pass for a check the call does not actually make.
 */
const WINDOW = 20;

/** Enough prose that an exemption has to argue rather than assert. */
const MINIMUM_REASON = 200;

const MARKER = 'No horizon check here';

const HORIZON_REFERENCE =
  /predictionHorizonFor|predictionHorizonFrom|isBeyondPredictionHorizon|[bB]eyondHorizon/;

function filesUnder(directory: string, extensions: readonly string[]): string[] {
  const found: string[] = [];

  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);

    if (statSync(path).isDirectory()) {
      if (entry === 'node_modules' || entry === 'build') continue;
      found.push(...filesUnder(path, extensions));
      continue;
    }

    if (extensions.some((extension) => entry.endsWith(extension))) {
      found.push(path);
    }
  }

  return found;
}

/** Everything that could consume an inference: the app, minus where they live. */
function consumerSources(): string[] {
  return filesUnder(join(ROOT, 'src'), ['.ts', '.tsx']).filter(
    (path) => !path.includes('__tests__') && !path.includes(DOMAIN_DIRECTORY)
  );
}

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

function relative(path: string): string {
  return path.slice(ROOT.length + 1).split(sep).join('/');
}

type CallSite = {
  readonly file: string;
  readonly line: number;
  readonly fn: string;
  readonly before: string;
};

/** Every call to one of the four, with the twenty lines above it. */
function callSites(): CallSite[] {
  const sites: CallSite[] = [];

  for (const path of consumerSources()) {
    const lines = read(path).split(/\r?\n/);

    lines.forEach((line, index) => {
      for (const fn of INFERENCE_FUNCTIONS) {
        // A call, not an import or a mention in a comment.
        if (!new RegExp('\\b' + fn + '\\s*\\(').test(line)) continue;
        if (/^\s*(\/\/|\*)/.test(line)) continue;
        if (/^\s*import\b/.test(line)) continue;

        sites.push({
          file: relative(path),
          line: index + 1,
          fn,
          before: lines.slice(Math.max(0, index - WINDOW), index + 1).join('\n'),
        });
      }
    });
  }

  return sites;
}

/** Does the window carry an exemption that says why, not just that? */
function exemption(before: string): { readonly claimed: boolean; readonly reasoned: boolean } {
  if (!before.includes(MARKER)) {
    return { claimed: false, reasoned: false };
  }

  const commentProse = before
    .split('\n')
    .filter((line) => /^\s*\/\//.test(line))
    .join(' ')
    .replace(/\/\//g, '')
    .trim();

  return {
    claimed: true,
    reasoned:
      commentProse.length >= MINIMUM_REASON && /predictionHorizon/.test(commentProse),
  };
}

describe('the horizon is asked wherever the app infers from a cycle day', () => {
  it('finds sources and call sites, so a broken scan cannot pass quietly', () => {
    expect(consumerSources().length).toBeGreaterThan(50);

    // Five today: two in the calendar, two in the dashboard, one in the ring.
    // A floor rather than an exact count, so adding a guarded consumer is not
    // a failing test — but a scan that found none would be.
    expect(callSites().length).toBeGreaterThanOrEqual(5);
  });

  it('watches every way the domain offers to make an inference', () => {
    // The guard is only as complete as this list. If `cycle-phase.ts` or
    // `fertility-level.ts` grows a fifth export that answers with a phase or a
    // level, it has to be named above or this scan would quietly stop covering
    // the app.
    const exported = [
      ...read(join(ROOT, 'src', 'features', 'cycle', 'domain', 'cycle-phase.ts')).matchAll(
        /export function (\w+)/g
      ),
      ...read(join(ROOT, 'src', 'features', 'cycle', 'domain', 'fertility-level.ts')).matchAll(
        /export function (\w+)/g
      ),
    ].map((match) => match[1]);

    expect([...exported].sort()).toEqual([...INFERENCE_FUNCTIONS].sort());
  });

  it('asks the horizon, or says in writing why it does not, at every call', () => {
    const unguarded = callSites()
      .filter((site) => !HORIZON_REFERENCE.test(site.before))
      .filter((site) => !exemption(site.before).claimed)
      .map((site) => `${site.file}:${site.line} calls ${site.fn}`);

    expect(unguarded).toEqual([]);
  });

  it('refuses an exemption that gives no reason', () => {
    const unreasoned = callSites()
      .filter((site) => exemption(site.before).claimed)
      .filter((site) => !exemption(site.before).reasoned)
      .map((site) => `${site.file}:${site.line} claims an exemption without arguing it`);

    expect(unreasoned).toEqual([]);
  });

  it('has exactly one exemption, and it is the ring', () => {
    // Not a count for its own sake: an exemption is a place the rule does not
    // run, so a second one appearing is worth somebody reading this test to
    // find out why.
    const exempt = callSites()
      .filter((site) => exemption(site.before).claimed)
      .map((site) => site.file);

    expect([...new Set(exempt)]).toEqual([
      'src/features/cycle/application/build-cycle-day-ring.ts',
    ]);
  });
});
