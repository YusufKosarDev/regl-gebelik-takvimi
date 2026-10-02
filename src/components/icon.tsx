import Feather from '@expo/vector-icons/Feather';

import { useTheme } from '@/hooks/use-theme';
import type { ThemeColor } from '@/constants/theme';

/**
 * The only icons in the app, and the only place the set is named.
 *
 * ## Why so few
 *
 * Icons were the last thing added and the first thing that would have been
 * cut. The app says what it means in words, and a row that already reads
 * "Ayarlar" is not clearer for having a cog beside it - it is just busier. So
 * these are only where an icon does a job a word is bad at: pointing.
 *
 * A chevron at the end of a row says the row goes somewhere, which is the one
 * thing the list of links could not say about itself. A chevron on a month
 * button says which way the month moves. That is the whole set.
 *
 * ## Why a wrapper
 *
 * Three call sites, one import, one set. Without this the set is named three
 * times and the fourth call site picks a different one, which is how an app
 * ends up wearing two icon families at once. \`IconName\` is a closed union for
 * the same reason: adding one is a decision, not an autocomplete.
 *
 * ## It is never a stop for a screen reader
 *
 * Every icon here sits inside a control that already has an
 * \`accessibilityLabel\`, and the icon repeats what that label says. Announced
 * on its own it would be either noise or a duplicate, so it is hidden and the
 * label does the talking.
 */
export type IconName = 'chevron-left' | 'chevron-right';

/**
 * The icon font, for the root layout's loading gate.
 *
 * `@expo/vector-icons` loads this itself on first render, which works and
 * flashes: the chevron is absent for a frame and the row it sits in reflows
 * around it. Joining the gate the typefaces already wait behind costs nothing
 * and means the first paint is the finished one.
 */
export const ICON_FONT = Feather.font;

export function Icon({
  name,
  size = 18,
  themeColor = 'textSecondary',
}: {
  readonly name: IconName;
  readonly size?: number;
  readonly themeColor?: ThemeColor;
}) {
  const theme = useTheme();

  return (
    <Feather
      name={name}
      size={size}
      color={theme[themeColor]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}
