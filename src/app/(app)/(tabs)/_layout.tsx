import { TabList, TabSlot, TabTrigger, Tabs } from 'expo-router/ui';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TabBar, TabBarButton } from '@/components/tab-bar';
import { useMessages } from '@/i18n';
import { tabMessages } from '@/shared/presentation/tab-messages';
import { TABS } from '@/shared/presentation/tabs';

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

  return (
    <Tabs>
      <TabSlot />

      {/* Declares the routes. Hidden, because the bar underneath draws them. */}
      <TabList style={styles.declarationOnly}>
        {TABS.map((tab) => (
          <TabTrigger key={tab.name} name={tab.name} href={tab.href} />
        ))}
      </TabList>

      {/* The bottom edge only: the screens inside the slot handle their own
          top inset, and taking it here would inset them twice. */}
      <SafeAreaView edges={['bottom']}>
        <TabBar>
          {TABS.map((tab) => (
            <TabTrigger key={tab.name} name={tab.name} asChild>
              <TabBarButton label={labels[tab.label]} />
            </TabTrigger>
          ))}
        </TabBar>
      </SafeAreaView>
    </Tabs>
  );
}

const styles = { declarationOnly: { display: 'none' } } as const;
