import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useMessages } from '@/i18n';
import type { LanguagePreference } from '@/i18n/language';
import { LANGUAGE_PREFERENCES } from '@/i18n/language';
import { appMessages } from '@/shared/presentation/app-messages';
import { useAppStore } from '@/store/app-store';

/**
 * Choosing the language.
 *
 * ## Why the two languages are not translated
 *
 * The row says "Türkçe" and "English", whichever language the app is currently
 * in. Somebody looking for their own language should find it written the way
 * they write it — and the person most likely to open this setting is somebody
 * who has landed in a language they cannot read, for whom a translated list
 * would be a list of words they cannot match to anything.
 *
 * Only "follow the phone" is translated, because it is a sentence rather than a
 * name.
 *
 * ## Why `'system'` is offered at all
 *
 * It is a different answer from either language, not a default that resolves to
 * one. "Follow the phone" and "Turkish" produce the same interface on a Turkish
 * phone and different ones on the next, and somebody who picked the first did
 * not pick the second.
 *
 * ## Radios, not a switch
 *
 * Three options, one of which is chosen. `accessibilityRole="radio"` with
 * `accessibilityState.selected` is what a screen reader needs to say "two of
 * three, selected"; three buttons would say nothing about which is in force.
 *
 * It owns no state. The store holds the preference and this reports a press,
 * for the same reason every other control in this app does: the screen is what
 * knows whether the write reached storage.
 */
export function LanguagePicker({
  preference,
  onChange,
}: {
  readonly preference: LanguagePreference;
  readonly onChange: (next: LanguagePreference) => void;
}) {
  const theme = useTheme();
  const common = useMessages(appMessages);

  /** The two languages name themselves; only 'system' is a translated phrase. */
  const labelFor = (value: LanguagePreference) => {
    if (value === 'tr') return common.languageNameTurkish;
    if (value === 'en') return common.languageNameEnglish;

    return common.languageSystemLabel;
  };

  return (
    <View style={styles.fields}>
      <ThemedText accessibilityRole="header" type="smallBold">
        {common.languageSectionTitle}
      </ThemedText>

      <ThemedText type="small" themeColor="textSecondary">
        {common.languageSectionDescription}
      </ThemedText>

      <View accessibilityRole="radiogroup" style={styles.options}>
        {LANGUAGE_PREFERENCES.map((value) => {
          const isSelected = value === preference;

          return (
            <Pressable
              key={value}
              accessibilityRole="radio"
              accessibilityLabel={labelFor(value)}
              accessibilityState={{ selected: isSelected }}
              onPress={() => onChange(value)}
              style={({ pressed }) => [
                styles.option,
                {
                  backgroundColor: isSelected ? theme.primary : theme.backgroundElement,
                  borderColor: isSelected ? theme.primary : 'transparent',
                },
                pressed && styles.pressed,
              ]}
            >
              <ThemedText
                type="smallBold"
                style={isSelected ? { color: theme.onPrimary } : undefined}
              >
                {labelFor(value)}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fields: {
    gap: Spacing.four,
  },
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  option: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.three,
    borderWidth: 1,
  },
  pressed: {
    opacity: 0.85,
  },
});

/**
 * The picker wired to the store, which is what the settings screen renders.
 *
 * Separate from the component above so the component stays testable without a
 * store, and so the screen does not grow a fourth piece of state for a setting
 * that has nowhere else to live.
 *
 * A failed write leaves the shown choice alone: `setLanguagePreference` writes
 * before it updates memory, so the row keeps showing what is actually stored.
 */
export function ConnectedLanguagePicker() {
  const preference = useAppStore((state) => state.languagePreference);
  const setLanguagePreference = useAppStore((state) => state.setLanguagePreference);

  return (
    <LanguagePicker
      preference={preference}
      onChange={(next) => {
        void setLanguagePreference(next).catch(() => undefined);
      }}
    />
  );
}
