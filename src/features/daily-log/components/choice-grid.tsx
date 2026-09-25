import { Pressable, StyleSheet, View } from 'react-native';

import type { CatalogueEntry } from '../domain/catalogues';
import { offered } from '../domain/catalogues';
import { choiceAccessibilityLabel } from '../presentation/daily-log-messages';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * A catalogue as a row of choices somebody can tap.
 *
 * One component for all three sections, because the only thing that differs is
 * whether a second tap adds to the answer or replaces it.
 *
 * `radio` when one may be chosen and `checkbox` when several may, which is what
 * a screen reader announces and what tells somebody whether tapping a second
 * option will undo the first. Both carry `checked`, so the state is spoken and
 * not only drawn.
 *
 * The row wraps rather than scrolls. At a large text size the options become
 * one per line, which is long but complete; a horizontal scroll would hide half
 * the catalogue behind a gesture nobody is told about.
 *
 * Retired entries are not offered. They stay readable on days that hold them —
 * that is the catalogue rule — but nobody is given a new one.
 */
export function ChoiceGrid({
  section,
  catalogue,
  selectedIds,
  onToggle,
  multiple,
  disabled = false,
}: {
  readonly section: string;
  readonly catalogue: readonly CatalogueEntry[];
  readonly selectedIds: readonly string[];
  readonly onToggle: (id: string) => void;
  readonly multiple: boolean;
  readonly disabled?: boolean;
}) {
  const theme = useTheme();

  return (
    <View
      accessibilityRole={multiple ? undefined : 'radiogroup'}
      style={styles.grid}>
      {offered(catalogue).map((entry) => {
        const selected = selectedIds.includes(entry.id);

        return (
          <Pressable
            key={entry.id}
            accessibilityRole={multiple ? 'checkbox' : 'radio'}
            accessibilityState={{ checked: selected, disabled }}
            accessibilityLabel={choiceAccessibilityLabel(section, entry.label)}
            disabled={disabled}
            onPress={() => onToggle(entry.id)}
            style={({ pressed }) => [
              styles.choice,
              {
                backgroundColor: selected ? theme.primary : theme.backgroundElement,
                borderColor: selected ? theme.primary : theme.backgroundSelected,
              },
              disabled && styles.disabled,
              pressed && !disabled && styles.pressed,
            ]}>
            <ThemedText
              type={selected ? 'smallBold' : 'small'}
              themeColor={selected ? 'onPrimary' : 'text'}>
              {entry.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  choice: {
    minHeight: 48,
    borderRadius: Spacing.three,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  disabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.6,
  },
});
