import { TABS } from '../tabs';
import { tabMessages } from '../tab-messages';

/**
 * The spine of the app, as an assertion.
 *
 * The four tabs are a decision about what the app *is*: four questions, one
 * screen each. Written as data rather than as JSX inside the layout, because a
 * layout cannot be rendered under Jest without a router around it - and the
 * thing worth pinning here is not how the bar looks but that there are four of
 * these and that they are in this order.
 *
 * The layout maps over `TABS`, so it cannot drift from what this says.
 */
describe('the four tabs', () => {
  it('is four of them, in the order the app is read in', () => {
    // Where am I, what is coming, what happened, who am I. A fifth tab is a
    // fifth question, and this is where somebody has to argue for it.
    expect(TABS.map((tab) => tab.name)).toEqual(['index', 'calendar', 'history', 'settings']);
  });

  it('points each one at the route of the same name', () => {
    expect(TABS.map((tab) => tab.href)).toEqual(['/', '/calendar', '/history', '/settings']);
  });

  it('has a label for every tab in both languages', () => {
    // A tab with no Turkish label is a blank button on a Turkish-first app.
    for (const tab of TABS) {
      expect([tab.name, typeof tabMessages.tr[tab.label]]).toEqual([tab.name, 'string']);
      expect([tab.name, typeof tabMessages.en[tab.label]]).toEqual([tab.name, 'string']);
    }
  });

  it('gives no two tabs the same label', () => {
    // Two tabs reading the same word is a navigation bar that cannot be used
    // without pressing both to find out which is which.
    const labels = TABS.map((tab) => tabMessages.tr[tab.label]);

    expect(new Set(labels).size).toBe(TABS.length);
  });
});
