import type { Href } from 'expo-router';

import type { TabMessages } from './tab-messages';

/**
 * The four questions the app answers, and the screen that answers each.
 *
 * ## Why this is a list rather than four `<TabTrigger>`s in the layout
 *
 * The layout maps over this. That is not indirection for its own sake: a
 * layout cannot be rendered under Jest without a router around it, so four
 * tabs written as JSX inside one would be the only structural decision in the
 * app that no test could reach. Written here, the order and the set are
 * ordinary data and `__tests__/tabs.test.ts` pins both.
 *
 * ## The order
 *
 * Where am I, what is coming, what happened, who am I. It runs from now
 * outwards in both directions and ends on the person, which is also the order
 * these get opened in: the first tab is the one the app launches on and the
 * last is the one somebody visits twice a month.
 *
 * ## Four, and what it costs to make it five
 *
 * Every screen that is not one of these is pushed on top of them and keeps its
 * back button. A fifth tab is not a line in this file - it is a fifth question
 * the app claims to answer, and the thing that makes a four-tab bar readable
 * at a glance is that there are four.
 */
export type Tab = {
  /** The route file under `app/(app)/(tabs)`, and the trigger's name. */
  readonly name: string;
  /**
   * Where the trigger points.
   *
   * Typed as the router's own `Href` rather than as a string, so a route
   * that is renamed or misspelt is a compile error here instead of a tab
   * that does nothing when pressed.
   */
  readonly href: Href;
  /** Its word, in `tab-messages`. */
  readonly label: keyof TabMessages;
};

export const TABS: readonly Tab[] = [
  { name: 'index', href: '/', label: 'cycleLabel' },
  { name: 'calendar', href: '/calendar', label: 'calendarLabel' },
  { name: 'history', href: '/history', label: 'historyLabel' },
  { name: 'settings', href: '/settings', label: 'profileLabel' },
];
