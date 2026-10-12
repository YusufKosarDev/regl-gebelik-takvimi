import { render } from '@testing-library/react-native';
import { PixelRatio, StyleSheet } from 'react-native';

import { Sky } from '@/constants/sky';
import { Colors } from '@/constants/theme';
import { OnSkyProvider } from '@/features/cycle/components/on-sky';

import {
  TAB_BAR_HEIGHT,
  TAB_BAR_MAX_FONT_SCALE,
  TabBar,
  TabBarButton,
  tabBarInsetFor,
} from '../tab-bar';

/**
 * The one control that is on every screen.
 *
 * Two things are worth pinning here and they are both rules this app has
 * already paid for once:
 *
 *  - **colour is never the only channel.** Which tab is selected is said by a
 *    rule under the word, not by the word changing colour. The assertion is
 *    the strict one: the label is drawn in the *same* ink either way, so a
 *    later "let's just tint the active tab" cannot pass by adding a colour
 *    and leaving the rule off.
 *  - **one ink.** A tab bar sits on the field, so its words are the field's
 *    ink - not `textSecondary`, which measured 1.97:1 on a light sky and is
 *    the exact mistake `constants/sky.ts` was written about.
 */

/** Every background colour drawn anywhere in a tree. */
function backgroundColours(node: unknown): string[] {
  const found: string[] = [];

  const walk = (current: any) => {
    if (Array.isArray(current)) {
      current.forEach(walk);
      return;
    }

    if (current === null || typeof current !== 'object') return;

    const flat = StyleSheet.flatten(current.props?.style);
    const colour = flat?.backgroundColor;

    if (typeof colour === 'string') found.push(colour);

    walk(current.children);
  };

  walk(node);

  return found;
}

/** Every text colour drawn anywhere in a tree. */
function textColours(node: unknown): string[] {
  const found: string[] = [];

  const walk = (current: any) => {
    if (Array.isArray(current)) {
      current.forEach(walk);
      return;
    }

    if (current === null || typeof current !== 'object') return;

    if (current.type === 'Text') {
      const flat = StyleSheet.flatten(current.props?.style);

      if (typeof flat?.color === 'string') found.push(flat.color);
    }

    walk(current.children);
  };

  walk(node);

  return found;
}

async function renderButton(props: { readonly label: string; readonly isFocused: boolean }) {
  // Awaited, like every other render in this suite: under React 19 the result
  // is not readable until the first act scope has closed.
  return render(
    <OnSkyProvider value>
      <TabBarButton label={props.label} isFocused={props.isFocused} onPress={() => {}} />
    </OnSkyProvider>
  );
}

describe('a tab in the bar', () => {
  it('is a tab to a screen reader, and says whether it is the one you are on', async () => {
    const { getByRole } = await renderButton({ label: 'Döngü', isFocused: true });

    const tab = getByRole('tab', { name: 'Döngü' });

    expect(tab.props.accessibilityState).toEqual({ selected: true });
  });

  it('says when it is not the one you are on', async () => {
    const { getByRole } = await renderButton({ label: 'Takvim', isFocused: false });

    expect(getByRole('tab', { name: 'Takvim' }).props.accessibilityState).toEqual({
      selected: false,
    });
  });

  it('is not selected when nothing says it is', async () => {
    // `isFocused` arrives by injection from `TabTrigger`, so the one state
    // nobody writes by hand is the one where it is missing. Undefined is not
    // a value a screen reader can read out.
    const { getByRole } = await render(
      <OnSkyProvider value>
        <TabBarButton label="Profil" onPress={() => {}} />
      </OnSkyProvider>
    );

    expect(getByRole('tab', { name: 'Profil' }).props.accessibilityState).toEqual({
      selected: false,
    });
  });

  it('is big enough to hit, and says how much room it takes', async () => {
    // The bar is the one control on every screen; it does not get to be the
    // one that is 32 points tall. The constant is asserted against the style
    // rather than written twice, because the screens underneath pad by it to
    // keep their last row out from under the bar - and a constant that drifts
    // from the real height hides a row instead of clearing it.
    const { getByRole } = await renderButton({ label: 'Geçmiş', isFocused: false });

    const flat = StyleSheet.flatten(getByRole('tab', { name: 'Geçmiş' }).props.style);

    expect(flat?.minHeight).toBeGreaterThanOrEqual(48);
    // Scaled: this suite runs at a font scale of its own, so the box is
    // whatever the inset says rather than the bare constant.
    expect(flat?.minHeight).toBe(tabBarInsetFor(PixelRatio.getFontScale()));
  });

  it('keeps its share of the bar even when the trigger passes a style', async () => {
    // `TabTrigger` injects props, a style among them. Spread after this
    // component's own style it replaced it, and the four tabs lost `flex: 1`:
    // on a device the first word held a quarter of the bar and the other
    // three crowded into the middle with no space between them.
    const { getByRole } = await render(
      <OnSkyProvider value>
        <TabBarButton
          label="Döngü"
          isFocused
          onPress={() => {}}
          style={{ padding: 0 } as never}
        />
      </OnSkyProvider>
    );

    expect(StyleSheet.flatten(getByRole('tab', { name: 'Döngü' }).props.style)?.flex).toBe(1);
  });

  it('draws the selected tab a rule rather than a colour', async () => {
    const selected = await renderButton({ label: 'Döngü', isFocused: true });
    const unselected = await renderButton({ label: 'Döngü', isFocused: false });

    expect(backgroundColours(selected.toJSON())).toContain(Sky.light.inkLine);
    expect(backgroundColours(unselected.toJSON())).not.toContain(Sky.light.inkLine);
  });

  it('writes the word in the same ink whether or not it is selected', async () => {
    // The whole rule in one assertion: if the only difference between the two
    // states were the colour of the word, this is what would fail.
    const selected = await renderButton({ label: 'Döngü', isFocused: true });
    const unselected = await renderButton({ label: 'Döngü', isFocused: false });

    expect(textColours(selected.toJSON())).toEqual([Sky.light.ink]);
    expect(textColours(unselected.toJSON())).toEqual([Sky.light.ink]);
  });

  it('is a tab in a list of them, to a screen reader', async () => {
    const { getByTestId } = await render(
      <OnSkyProvider value>
        <TabBar>
          <TabBarButton label="Döngü" isFocused onPress={() => {}} />
        </TabBar>
      </OnSkyProvider>
    );

    expect(getByTestId('tab-bar').props.accessibilityRole).toBe('tablist');
  });

  it('is made of the field it sits on', async () => {
    // `surface.tsx`: a page colour laid on a field reads as a hole punched in
    // the sky. The bar is the largest thing that would be punching one.
    const { getByTestId } = await render(
      <OnSkyProvider value>
        <TabBar>
          <TabBarButton label="Döngü" isFocused onPress={() => {}} />
        </TabBar>
      </OnSkyProvider>
    );

    const flat = StyleSheet.flatten(getByTestId('tab-bar').props.style);

    expect(flat?.backgroundColor).toBe(Sky.light.glass);
    expect(flat?.borderTopColor).toBe(Sky.light.glassEdge);
  });

  it('falls back to a card colour on the screens that are still pages', async () => {
    // Three of the four tabs open white pages until the later stages rework
    // them. Glass over white is a grey smear with no edge, so off a field the
    // bar takes the card colour - the same split `Surface` already makes.
    const { getByTestId } = await render(
      <TabBar>
        <TabBarButton label="Döngü" isFocused onPress={() => {}} />
      </TabBar>
    );

    expect(StyleSheet.flatten(getByTestId('tab-bar').props.style)?.backgroundColor).toBe(
      Colors.light.backgroundElement
    );
  });

  it('never reaches for a page colour or the accent', async () => {
    // A bar on a field drawn in `backgroundElement` reads as a hole punched in
    // the sky, and the accent on a field reads as a button from another app -
    // both are written up in `surface.tsx` and `sky.ts` respectively.
    const tab = await renderButton({ label: 'Döngü', isFocused: true });

    const drawn = [...backgroundColours(tab.toJSON()), ...textColours(tab.toJSON())];

    expect(drawn).not.toContain(Colors.light.backgroundElement);
    expect(drawn).not.toContain(Colors.light.primary);
    expect(drawn).not.toContain(Colors.light.textSecondary);
  });
});

/**
 * The bar at a large font setting.
 *
 * Found on a device at 200%: "Calendar" broke mid-word into "Calenda / r", and
 * the arc on the home screen came down over the bar because the room the
 * screens reserve for it is a constant and the bar had grown.
 *
 * Both halves are fixed together on purpose. `themed-text.tsx` already caps
 * the two display sizes at 1.4 and says why - at Android's largest a 48dp
 * title becomes 96dp, "correct and unusable" - and it warns against the other
 * half of this: capping the box while the letters keep growing. So the label
 * and the box are capped at the same number.
 *
 * The calendar's own cells are deliberately not capped, and that difference is
 * the point: the grid is content somebody turned the setting up to read, and
 * the bar is a control they aim at.
 */
describe('the bar at a large font setting', () => {
  it('caps the label so a word cannot break in half', async () => {
    const { getByText } = await renderButton({ label: 'Takvim', isFocused: false });

    expect(getByText('Takvim').props.maxFontSizeMultiplier).toBe(TAB_BAR_MAX_FONT_SCALE);
  });

  it('reserves room in step with the cap, not with the setting', () => {
    // The screens pad by this. Uncapped it would reserve twice what the bar
    // takes at 200%; unscaled it reserves half.
    expect(tabBarInsetFor(1)).toBe(TAB_BAR_HEIGHT);
    expect(tabBarInsetFor(1.2)).toBeCloseTo(TAB_BAR_HEIGHT * 1.2, 5);
    expect(tabBarInsetFor(2)).toBeCloseTo(TAB_BAR_HEIGHT * TAB_BAR_MAX_FONT_SCALE, 5);
  });

  it('reserves exactly what the bar takes, at whatever scale', async () => {
    // The same number, not merely close: the screens pad by the inset and the
    // bar is as tall as its tabs. The two are read from opposite ends here -
    // the style the component renders, and the function the screens call - so
    // a change to either one alone fails this.
    const { getByRole } = await renderButton({ label: 'Geçmiş', isFocused: false });

    const flat = StyleSheet.flatten(getByRole('tab', { name: 'Geçmiş' }).props.style);

    expect(flat?.minHeight).toBe(tabBarInsetFor(PixelRatio.getFontScale()));
  });
});
