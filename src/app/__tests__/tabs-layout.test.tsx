import { render } from '@testing-library/react-native';
import React from 'react';

import TabsLayout from '@/app/(app)/(tabs)/_layout';
import { TABS } from '@/shared/presentation/tabs';
import { tabMessages } from '@/shared/presentation/tab-messages';

/**
 * The four tabs, and what the bar is made of.
 *
 * ## Why this file exists
 *
 * The layout held **0% coverage**. `tabs.ts` under it is ordinary data and
 * `tabs.test.ts` pins the order and the set — but nothing checked that the
 * layout actually maps over that list, or that it hands the bar the one thing
 * only it can answer.
 *
 * That second part is the real subject. The bar floats over the screen, so what
 * it is made of depends on what is under it: glass where there is a sky field
 * for it to show through, a card colour where there is a page. Nothing in the
 * tree can work that out — `useOnSky` reads from above and the screen is below
 * — so the layout reads the active tab and hands the answer down. Get it wrong
 * and the bar reads as a slab laid across the field, which is what it did
 * before the floating bar landed.
 *
 * ## What is faked
 *
 * `expo-router/ui`, because the headless tab components need a real router
 * around them, and the bar, because its chrome is not the subject. The faked
 * bar reads `useOnSky()` and prints it, which is how the value the layout
 * computes becomes something a test can see at all — it is a context value
 * consumed several levels down in the real tree.
 */

// Prefixed `mock` because a jest.mock factory may not reach any other
// out-of-scope variable, and the pathname has to be settable per test.
const mockRoute = { pathname: '/' };

jest.mock('expo-router', () => ({
  usePathname: () => mockRoute.pathname,
}));

jest.mock('expo-router/ui', () => {
  const { View: MockView } = require('react-native');

  return {
    Tabs: ({ children }: { children: React.ReactNode }) => <MockView>{children}</MockView>,
    TabSlot: () => null,
    TabList: ({ children }: { children: React.ReactNode }) => <MockView>{children}</MockView>,
    TabTrigger: ({
      name,
      href,
      children,
    }: {
      name: string;
      href?: string;
      children?: React.ReactNode;
    }) => (
      <MockView testID={`trigger-${name}`} accessibilityLabel={href === undefined ? '' : href}>
        {children}
      </MockView>
    ),
  };
});

// The bar's own chrome is tested in `components/__tests__/tab-bar.test.tsx`.
// Here it is a window onto the one value the layout decides.
jest.mock('@/components/tab-bar', () => {
  const { Text: MockText, View: MockView } = require('react-native');
  const { useOnSky: readOnSky } = require('@/features/cycle/components/on-sky');

  return {
    TabBar: ({ children }: { children: React.ReactNode }) => (
      <MockView testID="tab-bar">
        <MockText testID="on-sky">{readOnSky() ? 'on-sky' : 'on-page'}</MockText>
        {children}
      </MockView>
    ),
    TabBarButton: ({ label }: { label: string }) => <MockText>{label}</MockText>,
  };
});

// Keeps the test honest about which half of the catalogue it is reading: the
// suite renders as a Turkish phone, so these are the Turkish words.
const labels = tabMessages.tr;

beforeEach(() => {
  mockRoute.pathname = '/';
});

describe('the tab list', () => {
  it('declares one trigger per tab', async () => {
    const view = await render(<TabsLayout />);

    for (const tab of TABS) {
      // Two per tab: one in the hidden list that declares the route, one in the
      // visible bar that names it.
      expect(view.getAllByTestId(`trigger-${tab.name}`)).toHaveLength(2);
    }
  });

  it('shows the four words in the order the list gives them', async () => {
    const view = await render(<TabsLayout />);

    const shown = TABS.map((tab) => view.getByText(labels[tab.label]));

    expect(shown).toHaveLength(TABS.length);
  });

  it('points each declaration at its own route', async () => {
    const view = await render(<TabsLayout />);

    for (const tab of TABS) {
      const [declaration] = view.getAllByTestId(`trigger-${tab.name}`);

      expect(declaration.props.accessibilityLabel).toBe(tab.href);
    }
  });
});

describe('what the bar is made of', () => {
  it('is glass on the tab that paints a field', async () => {
    const onSky = TABS.find((tab) => tab.field);

    expect(onSky).toBeDefined();

    mockRoute.pathname = onSky?.href as string;

    const view = await render(<TabsLayout />);

    expect(view.getByTestId('on-sky').props.children).toBe('on-sky');
  });

  it.each(TABS.filter((tab) => !tab.field).map((tab) => [tab.name, tab.href as string]))(
    'is a card colour on %s, which paints a page',
    async (_name, href) => {
      mockRoute.pathname = href;

      const view = await render(<TabsLayout />);

      expect(view.getByTestId('on-sky').props.children).toBe('on-page');
    }
  );

  it('still draws a bar for a path that is none of the tabs', async () => {
    // Screens pushed on top of the tabs have paths that match nothing, and the
    // bar is drawn underneath them. `activeTab` answers with the first tab
    // rather than with nothing, so this follows whatever that tab is.
    mockRoute.pathname = '/daily-entry';

    const view = await render(<TabsLayout />);

    expect(view.getByTestId('tab-bar')).toBeTruthy();
    expect(view.getByTestId('on-sky').props.children).toBe(
      TABS[0].field ? 'on-sky' : 'on-page'
    );
  });
});
