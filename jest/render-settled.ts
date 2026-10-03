import { act, render, type RenderOptions, type RenderResult } from '@testing-library/react-native';
import type { ReactElement } from 'react';

/**
 * Renders, then lets the effects that render started finish.
 *
 * ## The warning this exists to remove
 *
 * Several screens read storage in an effect: the render returns, a promise is
 * in flight, and when it settles the screen calls `setState`. A test that
 * asserts straight after `render` has already moved on, so that `setState`
 * lands outside `act` and React prints "An update to X inside a test was not
 * wrapped in act(...)" — nine times across five screens.
 *
 * Nothing was wrong with the screens. Every one of those effects has an
 * `isActive` guard and drops its result when the screen has gone. The tests
 * were simply asserting before the screen had finished arriving.
 *
 * ## Why it is worth removing rather than tolerating
 *
 * The warning is printed by React through `console.error`. Nine expected ones
 * in the output are nine reasons not to look at the tenth, and the tenth is the
 * one that means a real update escaped — a screen that writes state after
 * unmount, which is the bug class the `isActive` guards are there to prevent.
 * A quiet run is what makes that visible.
 *
 * ## What it does not do
 *
 * It does not wait for anything in particular. A test that needs a specific
 * thing to appear still says so with `waitFor`; this only drains what is
 * already queued, so a screen that deliberately shows a loading state still
 * shows it when its promise has not resolved.
 */
/**
 * The drain on its own, for a screen that settles something after it rendered.
 *
 * A test that signs somebody in half way through starts the same storage reads
 * again, and the `setState` at the end of them lands after the last assertion.
 * Awaiting this between the change and the assertion puts them back inside
 * `act` without changing what the test checks.
 */
export async function settle(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => {
      setImmediate(resolve);
    });
  });
}

export async function renderSettled(
  element: ReactElement,
  options?: RenderOptions
): Promise<RenderResult> {
  const screen = await render(element, options);

  // Drained to the end of the microtask queue, inside `act`, which is where
  // the pending reads land.
  //
  // `setImmediate` rather than `await Promise.resolve()`: these effects chain
  // a `Promise.all` into a `.then`, so a single turn settles the reads and
  // leaves the `setState` that follows them still queued - which is the
  // warning, one tick later. A macrotask runs after everything the microtask
  // queue holds, however deep the chain.
  await settle();

  return screen;
}
