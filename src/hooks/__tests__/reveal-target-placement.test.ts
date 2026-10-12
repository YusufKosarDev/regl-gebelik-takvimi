import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

/**
 * The reveal is attached to the thing that appears, never to a wrapper.
 *
 * ## The defect this exists for
 *
 * `useRevealInView` fires from its target's `onLayout` and reveals once per
 * mount. So the target has to be an element that exists only while the panel
 * is open. Attached to something always mounted, it lays out once when the
 * screen first appears, the reveal is spent, and the panel opening later is
 * never seen.
 *
 * That shipped. `AccountDeletionPanel` and `PeriodActionCard` are always
 * rendered - they draw the open button when `isConfirming` is false - and
 * both were wrapped from outside in `<View {...targetProps}>`. The suite was
 * green and the account panel still opened off the bottom of the screen on a
 * device, exactly as before the fix.
 *
 * The two panels that worked were the two rendered only while open, which is
 * the whole difference and now the rule: `targetProps` goes on the element
 * whose existence is the event.
 *
 * ## Why a scan
 *
 * There is nothing to call. Whether a wrapper is always mounted is a fact
 * about the surrounding JSX, and the failure is invisible to rendering tests
 * because the tree is correct either way - only the scroll position differs,
 * and Jest has no scroll position.
 */

const ROOT = join(__dirname, '..', '..');

function filesUnder(directory: string): string[] {
  const found: string[] = [];

  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);

    if (statSync(path).isDirectory()) {
      if (entry === '__tests__') continue;
      found.push(...filesUnder(path));
      continue;
    }

    if (entry.endsWith('.tsx')) found.push(path);
  }

  return found;
}

type Use = { readonly file: string; readonly line: number; readonly context: string };

function targetPropsUses(): readonly Use[] {
  const found: Use[] = [];

  for (const file of filesUnder(ROOT)) {
    const source = readFileSync(file, 'utf8');
    const uses = /\{\.\.\.(\w+\.targetProps|revealProps)\}/g;
    let match: RegExpExecArray | null;

    while ((match = uses.exec(source)) !== null) {
      const before = source.slice(0, match.index).split('\n');

      found.push({
        file: file.slice(ROOT.length + 1),
        line: before.length,
        // The six lines ending at the use, with comments dropped. Three was
        // too few: `period-action-card` explains itself in a three-line note
        // between `return isConfirming ? (` and the element, and the window
        // saw only the note.
        context: before
          .slice(Math.max(0, before.length - 8))
          .filter((row) => !/^\s*(\/\/|\*|\/\*)/.test(row))
          .join('\n'),
      });
    }
  }

  return found;
}

describe('where the reveal attaches', () => {
  it('is used somewhere, or this proves nothing', () => {
    expect(targetPropsUses().length).toBeGreaterThanOrEqual(4);
  });

  it('is always inside something conditional on the panel being open', () => {
    // `{isConfirming && (`, `{x ? (`, or the component's own
    // `return isConfirming ? (` - any of which means the element carrying the
    // reveal is created when the panel opens rather than when the screen does.
    const conditional = /\?\s*\(|&&\s*\(|\?\s*$|&&\s*$/;

    const unconditional = targetPropsUses()
      .filter((use) => !conditional.test(use.context))
      .map((use) => `${use.file}:${use.line}`);

    expect(unconditional).toEqual([]);
  });

  it.each([
    ['features/deletion/components/account-deletion-panel.tsx', 'AccountDeletionPanel'],
    ['features/cycle/components/period-action-card.tsx', 'PeriodActionCard'],
  ])('%s owns its own reveal, because it draws its own open button', (path, name) => {
    // These two are the ones that shipped broken. Both are rendered whether or
    // not their panel is open - they draw the button when it is closed - so a
    // screen cannot wrap them in anything that appears when the panel does.
    // They take `revealProps` and put it on their own conditional branch.
    //
    // Wrapping is not banned in general: inside a conditional branch a `View`
    // is often the only place a ref can go, since `Surface` and the date
    // editors are components too. The rule is the one above - the element
    // carrying the reveal has to be conditional - and this pins the two cases
    // where only the component itself can satisfy it.
    const source = readFileSync(join(ROOT, path), 'utf8');

    expect([name, /readonly revealProps\?/.test(source)]).toEqual([name, true]);
    expect([name, /\{\.\.\.revealProps\}/.test(source)]).toEqual([name, true]);
  });
});
