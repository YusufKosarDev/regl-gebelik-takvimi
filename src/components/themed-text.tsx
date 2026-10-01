import { StyleSheet, Text, type TextProps } from 'react-native';

import { ThemeColor } from '@/constants/theme';
import { TEXT_SCALE, type TextType } from '@/constants/typography';
import { useFontScale } from '@/hooks/use-font-scale';
import { useTheme } from '@/hooks/use-theme';

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
  const fontScale = useFontScale();

  const scale = TEXT_SCALE[type];

  const flattened = StyleSheet.flatten([
    { color: type === 'linkPrimary' ? '#3c87f7' : theme[themeColor ?? 'text'] },
    {
      fontSize: scale.fontSize,
      fontWeight: scale.fontWeight,
      fontFamily: scale.fontFamily,
      lineHeight: scale.lineHeight,
    },
    style,
  ]);

  return (
    <Text
      maxFontSizeMultiplier={maxFontSizeMultiplier ?? scale.maxFontSizeMultiplier}
      style={
        flattened.lineHeight === undefined
          ? flattened
          : { ...flattened, lineHeight: flattened.lineHeight * fontScale }
      }
      {...rest}
    />
  );
}
