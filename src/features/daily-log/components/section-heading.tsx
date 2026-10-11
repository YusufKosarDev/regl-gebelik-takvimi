import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

/**
 * A section of the log: its name, and what it is for folded up behind it.
 *
 * ## What the explanation is actually for
 *
 * Not decoration, and not a description of the obvious. Each of the three
 * sections takes either one answer or several, and the app says so only to a
 * screen reader - `ChoiceGrid` renders `radio` or `checkbox` and announces the
 * difference, and somebody looking at the screen is told nothing. Three rows
 * of identical-looking chips behave in two different ways, and the first time
 * anybody finds out is when a second tap undoes the first.
 *
 * So the sentence behind the (i) says which it is. That is the job; the rest
 * of the wording is context.
 *
 * ## Why folded
 *
 * Three sentences printed under three headings turns a form somebody fills in
 * daily into a page they scroll past. Cycles folds it behind an (i) and that
 * is the part worth taking.
 *
 * ## Why a chevron and not an (i)
 *
 * `icon.tsx` keeps a closed set of two and says adding one is a decision
 * rather than an autocomplete. This did not earn a third: a chevron already
 * means "there is more this way" everywhere else in the app, and turned down
 * it means the more is below. An (i) would have been a new glyph for a job the
 * existing one does.
 *
 * ## The name stays a heading
 *
 * The obvious build is to make the whole row the button. That would swallow
 * the heading, and headings are how a screen reader moves between the three
 * sections of this form. The button is the chevron and its label names the
 * section, so both work.
 */
export function SectionHeading({
  title,
  explanation,
  toggleLabel,
  isOpen,
  onToggle,
}: {
  readonly title: string;
  readonly explanation: string;
  /** Names the section, because the chevron alone says nothing aloud. */
  readonly toggleLabel: string;
  readonly isOpen: boolean;
  readonly onToggle: () => void;
}) {
  return (
    <View style={styles.heading}>
      <View style={styles.row}>
        <ThemedText accessibilityRole="header" type="smallBold">
          {title}
        </ThemedText>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={toggleLabel}
          accessibilityState={{ expanded: isOpen }}
          onPress={onToggle}
          style={({ pressed }) => [styles.toggle, pressed && styles.pressed]}>
          {/* Pointing down when there is more below it, which is where the
              sentence appears. The set has no down chevron and did not need
              one: this is the same glyph turned a quarter. */}
          <View style={isOpen ? styles.turnedUp : styles.turnedDown}>
            <Icon name="chevron-right" />
          </View>
        </Pressable>
      </View>

      {isOpen && (
        <ThemedText type="small" themeColor="textSecondary">
          {explanation}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  heading: {
    gap: Spacing.one,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  toggle: {
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  turnedDown: {
    transform: [{ rotate: '90deg' }],
  },
  turnedUp: {
    transform: [{ rotate: '-90deg' }],
  },
  pressed: {
    opacity: 0.6,
  },
});
