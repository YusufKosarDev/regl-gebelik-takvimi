import { usePathname } from 'expo-router';
import { TabList, TabSlot, TabTrigger, Tabs } from 'expo-router/ui';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TabBar, TabBarButton } from '@/components/tab-bar';
import { OnSkyProvider } from '@/features/cycle/components/on-sky';
import { useMessages } from '@/i18n';
import { tabMessages } from '@/shared/presentation/tab-messages';
import { TABS, activeTab } from '@/shared/presentation/tabs';

/**
 * The four tabs.
 *
 * ## Why the headless API
 *
 * `Tabs` from `expo-router` draws its own bar, and everything this bar has to
 * do - glass over the field, one ink, a rule under the selected word rather
 * than a tint - would have been fought for through `tabBarStyle`,
 * `tabBarBackground` and a `tabBarButton` override. The headless components in
 * `expo-router/ui` give the routing and none of the chrome, which is the half
 * we want.
 *
 * `TabList` is hidden rather than absent: it is what declares the routes, and
 * the visible bar below it is made of triggers that name those routes without
 * repeating their hrefs.
 *
 * ## The order lives in `shared/presentation/tabs.ts`
 *
 * Both loops map over the same list, so the bar cannot end up in a different
 * order from the routes, and neither can drift from the test that pins them.
 *
 * ## Everything else is pushed on top
 *
 * The other ten screens stay in the stack outside this group, so opening one
 * covers the bar and gives back the back button. A screen that is reached from
 * exactly one place does not need a permanent seat at the bottom of every
 * other screen.
 */
export default function TabsLayout() {
  const labels = useMessages(tabMessages);

  // What the bar is made of depends on what is under it, and the screen under
  // it cannot say: `useOnSky` reads down the tree and the screen is beside
  // this, not above it. The tab list carries the answer instead.
  const onSky = activeTab(usePathname()).field;

  return (
    <Tabs>
      <TabSlot />

      {/* Declares the routes. Hidden, because the bar underneath draws them. */}
      <TabList style={styles.declarationOnly}>
        {TABS.map((tab) => (
          <TabTrigger key={tab.name} name={tab.name} href={tab.href} />
        ))}
      </TabList>

      {/* Floating, not stacked under the slot. A bar in the flow has the
          layout's own background behind it, so on a sky screen glass would be
          six percent of ink over nothing and the bar would read as a slab laid
          across the field - which is what it did until this changed. Over the
          slot, the field is behind it and the sky shows through.

          The bottom edge only: the screens inside the slot handle their own
          top inset, and taking it here would inset them twice. */}
      <SafeAreaView edges={['bottom']} style={styles.floating}>
        <OnSkyProvider value={onSky}>
          <TabBar>
            {TABS.map((tab) => (
              <TabTrigger key={tab.name} name={tab.name} asChild>
                <TabBarButton label={labels[tab.label]} />
              </TabTrigger>
            ))}
          </TabBar>
        </OnSkyProvider>
      </SafeAreaView>
    </Tabs>
  );
}

const styles = StyleSheet.create({
  declarationOnly: { display: 'none' },
  floating: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
});
