import { TABS, activeTab } from '../tabs';
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

  it('says which tabs draw a sky field behind them', () => {
    // The bar floats over the screen, so what it is made of depends on what is
    // underneath it: glass over a field, a card colour over a page. Nothing in
    // the tree can tell it - `useOnSky` answers from above, and the screen is
    // below - so the tabs carry the answer themselves.
    //
    // One today. Each later stage that puts a screen on a field flips its
    // entry here, and this line is the record of how far that has got.
    expect(TABS.filter((tab) => tab.field).map((tab) => tab.name)).toEqual(['index']);
  });

  it('knows which tab a path belongs to', () => {
    expect(activeTab('/').name).toBe('index');
    expect(activeTab('/calendar').name).toBe('calendar');
    expect(activeTab('/history').name).toBe('history');
    expect(activeTab('/settings').name).toBe('settings');
  });

  it('treats a path it does not know as the first tab', () => {
    // The bar is drawn before the router has settled on anything, and on a
    // pushed screen the path is none of these. Falling back to the first tab
    // keeps the bar drawn rather than crashing on an undefined.
    expect(activeTab('/account').name).toBe('index');
    expect(activeTab('').name).toBe('index');
  });

  it('gives no two tabs the same label', () => {
    // Two tabs reading the same word is a navigation bar that cannot be used
    // without pressing both to find out which is which.
    const labels = TABS.map((tab) => tabMessages.tr[tab.label]);

    expect(new Set(labels).size).toBe(TABS.length);
  });
});
