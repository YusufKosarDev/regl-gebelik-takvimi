import { StyleSheet, Text, type TextProps } from 'react-native';

import { ThemeColor } from '@/constants/theme';
import { fontFamilyFor } from '@/constants/fonts';
import { TEXT_SCALE, type TextType } from '@/constants/typography';
import { useFontScale } from '@/hooks/use-font-scale';
import { useOnSky } from '@/features/cycle/components/on-sky';
import { useSky, useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?: TextType;
  themeColor?: ThemeColor;
};

/**
 * Text at one of the app's sizes, in one of the theme's colours.
 *
 * ## The line height is grown with the system font setting
 *
 * React Native scales `fontSize` by the device's font scale and leaves
 * `lineHeight` exactly as written. A style that sets both - which every size in
 * this app did - therefore grows its letters and keeps its line box, so at
 * Android's largest setting the 48dp title was being drawn into a 52dp box.
 * Letters clipped and lines overlapped, and nothing in the app read the font
 * scale at all.
 *
 * The scaling is applied to the **flattened** style rather than to the
 * catalogue entry, and that is the point of doing it here. Thirty files carry
 * their own `fontSize`/`lineHeight` pairs in screen stylesheets, passed in
 * through `style` and therefore applied after anything this component composes.
 * Scaling the entry would have fixed the sizes nobody overrode and left the
 * overridden ones clipping exactly as before. Flattening first means the rule is
 * "whatever line height this text ends up with grows with the setting", which is
 * true of all of them and stays true of ones written later.
 *
 * At the default setting the scale is 1 and every number is what it always was,
 * which is why this moved no existing assertion.
 *
 * `maxFontSizeMultiplier` caps the two display sizes at 1.4. At Android's
 * largest a 48dp title becomes 96dp, which is correct and unusable. Body text is
 * left uncapped, because it is the text somebody turned the setting up to read.
 * The line height is deliberately not capped with it - capping the box while the
 * letters keep growing is the defect this removes.
 */
export function ThemedText({
  style,
  type = 'default',
  themeColor,
  maxFontSizeMultiplier,
  ...rest
}: ThemedTextProps) {
  const theme = useTheme();
  const sky = useSky();
  const onSky = useOnSky();
  const fontScale = useFontScale();

  const scale = TEXT_SCALE[type];

  const flattened = StyleSheet.flatten([
    // `linkPrimary` is the one type that names its own colour, and for a long
    // time that colour was a hardcoded `#3c87f7` - a blue that appears nowhere
    // in the palette, ignores the theme entirely and stayed the same shade in
    // dark mode. It is the accent, which is what every other link-coloured
    // thing in the app already uses and is held to 4.5:1 in both schemes by
    // `theme-contrast.test.ts`.
    // On a field there is one ink and `themeColor` does not apply, because the
    // theme's colours are chosen for a page and there is no page underneath.
    // This is not a convenience: `textSecondary` measured 1.97:1 on light
    // night, and it reached the screen through exactly this line.
    //
    // A caller that names its own `color` in `style` still wins, which is how
    // the hero sets its own and how a filled button keeps a label that is not
    // the ink.
    { color: onSky ? sky.ink : type === 'linkPrimary' ? theme.primary : theme[themeColor ?? 'text'] },
    {
      fontSize: scale.fontSize,
      fontWeight: scale.fontWeight,
      lineHeight: scale.lineHeight,
    },
    style,
  ]);

  // Resolved from the weight the style finally ended up with, not from the
  // table. Android does not synthesise across separately registered font files,
  // and twenty-three screen stylesheets set their own `fontWeight` on top of a
  // type - picking the file before flattening would leave every one of them
  // drawn at the table's weight. A caller that names its own `fontFamily` keeps
  // it; nothing in the app does today, but the override should still win.
  const resolved = {
    ...flattened,
    fontFamily: flattened.fontFamily ?? fontFamilyFor(scale.role, flattened.fontWeight),
  };

  return (
    <Text
      maxFontSizeMultiplier={maxFontSizeMultiplier ?? scale.maxFontSizeMultiplier}
      style={
        resolved.lineHeight === undefined
          ? resolved
          : { ...resolved, lineHeight: resolved.lineHeight * fontScale }
      }
      {...rest}
    />
  );
}

/**
 * The slack a button label needs so a layout pass cannot truncate it.
 *
 * ## The defect this removes
 *
 * A label that is the only child of a `Pressable` with `alignItems: 'center'`
 * is a shrink-to-fit flex child: it is handed exactly the width it measured
 * and not one pixel more. Measured on a device, the export button's node was
 * 324px and the same string drawn as a heading was 323px of ink - so the
 * measurement was right and the box was right.
 *
 * What was drawn in it was `Verilerini dışa` and then nothing: 228px of ink
 * flush to the node's left edge, with the missing 96px exactly the width of
 * " aktar", broken at the space, in a box one line tall.
 *
 * It depends on the **system locale**, not on the app's language setting. The
 * same build, device and string, with the app set to Türkçe throughout:
 *
 *   - system locale `en-US`  ->  228px drawn of a 324px node
 *   - system locale `tr-TR`  ->  323px drawn of a 324px node
 *
 * So it appears for somebody running the app in Turkish on a phone that is
 * not - a tester, or anyone whose device is in another language - and never
 * on a Turkish phone, which is where it would have been looked for.
 *
 * ## Why slack rather than a shorter string
 *
 * The string is incidental. The trigger is a measured width landing on the
 * wrong side of a locale-dependent threshold, so any label can cross it when
 * the copy, the font scale or the device font changes. One pixel of slack is
 * demonstrably not enough - the node already had one.
 *
 * `alignSelf: 'stretch'` takes the label off the content-sized path
 * altogether: it fills the button's inner width, which is hundreds of pixels
 * wider than any label, and `textAlign: 'center'` puts the words back where
 * `alignItems: 'center'` had them. Nothing moves on screen. If a label ever
 * does need two lines it now wraps, which is the right answer for a control
 * somebody has to read.
 *
 * Deliberately not solved by shrinking the text to fit or by capping it at one
 * line with an ellipsis. Both trade a rendering fault for a legibility one,
 * and these are the buttons that export and delete somebody's health records.
 *
 * ## What is not known
 *
 * Whether the engine wraps the run and clips the second line, or drops the
 * tail of the glyph run outright. The break falls at a word boundary, the ink
 * starts at the node's left edge rather than centred, and the box is one line
 * tall, which all point at a wrap - but it was not confirmed inside Android's
 * text layout, and it does not change the fix.
 *
 * `__tests__/button-label-slack.test.ts` holds the rule across the app: no
 * test and no code review can see this one, only pixels.
 */
export const ButtonLabel = StyleSheet.create({
  slack: { alignSelf: 'stretch', textAlign: 'center' },
}).slack;
