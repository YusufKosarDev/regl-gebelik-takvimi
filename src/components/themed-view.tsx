import { StyleSheet, View, type ViewProps } from 'react-native';

import { ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
  type?: ThemeColor;
};

export function ThemedView({ style, lightColor, darkColor, type, ...otherProps }: ThemedViewProps) {
  const theme = useTheme();

  const themedColour = theme[type ?? 'background'];

  // `?? themedColour` rather than taking the flattened value as it comes, for
  // the reason written up in `themed-text.tsx`: the themed colour is first in
  // this array and the caller's `style` is last, so a caller wins by naming
  // its own - but `StyleSheet.flatten` keeps a key whose value is `undefined`,
  // so a caller that computes a colour and gets nothing overwrites the theme
  // with nothing rather than falling through to it.
  //
  // That is what drew the calendar legend's predicted mark black on a dark
  // page. This is the same shape on a View, and nothing in the app triggers it
  // today - the scanner in `__tests__/undefined-colour-class.test.ts` says so
  // on every run. It is closed anyway, because an inventory that lists a known
  // instance as acceptable stops being an inventory.
  //
  // Louder here than on text, if it ever happened: an undefined
  // `backgroundColor` is transparent, and `borderColor` defaults to black.
  const flattened = StyleSheet.flatten([{ backgroundColor: themedColour }, style]);

  return (
    <View
      style={{ ...flattened, backgroundColor: flattened.backgroundColor ?? themedColour }}
      {...otherProps}
    />
  );
}
