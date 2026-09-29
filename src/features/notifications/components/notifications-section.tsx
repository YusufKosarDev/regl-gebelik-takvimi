import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useMessages } from '@/i18n';
import type { NotificationPreferences } from '../domain/notification-preferences';
import type { NotificationPermissionStatus } from '../infrastructure/notification-permission';
import { ReminderToggle } from './reminder-toggle';
import {
  DISCREET_NOTIFICATIONS_DESCRIPTION,
  DISCREET_NOTIFICATIONS_TOGGLE_LABEL,
  NOTIFICATIONS_BLOCKED_NOTICE,
  OPEN_SYSTEM_SETTINGS_LABEL,
  PERIOD_REMINDER_TOGGLE_LABEL,
  PREGNANCY_WEEKLY_REMINDER_TOGGLE_LABEL,
  REMINDERS_INTRO,
} from '../presentation/reminder-messages';
import { settingsMessages } from '@/features/cycle/presentation/settings-messages';

/**
 * Which reminders a person has asked for, and how much they may say.
 *
 * Lifted out of the settings screen unchanged, down to the order of the
 * three switches and the panel that appears when Android has blocked
 * notifications outright.
 *
 * None of the state is here. Every switch reports upward and waits to be told
 * what it now shows, because the screen is what knows whether a write reached
 * the database - a toggle that moved itself would be saying something it has
 * not checked.
 */
export function NotificationsSection({
  reminders,
  reminderField,
  reminderNotice,
  discreet,
  discreetBusy,
  permission,
  settingsLinkNotice,
  onReminderChange,
  onDiscreetChange,
  onOpenSystemSettings,
}: {
  readonly reminders: NotificationPreferences;
  readonly reminderField: keyof NotificationPreferences | null;
  readonly reminderNotice: string | null;
  readonly discreet: boolean;
  readonly discreetBusy: boolean;
  readonly permission: NotificationPermissionStatus | null;
  readonly settingsLinkNotice: string | null;
  readonly onReminderChange: (field: keyof NotificationPreferences, next: boolean) => void;
  readonly onDiscreetChange: (next: boolean) => void;
  readonly onOpenSystemSettings: () => void;
}) {
  const theme = useTheme();
  const cycleSettings = useMessages(settingsMessages);

  return (
    <View style={styles.fields}>
        <ThemedText accessibilityRole="header" type="smallBold">
          {cycleSettings.notificationsSectionTitle}
        </ThemedText>

        <ThemedText type="small" themeColor="textSecondary">
          {REMINDERS_INTRO}
        </ThemedText>

        {/* Standing, not transient: while this is true every switch in
            this section is a promise the phone will not keep, and that
            is worth saying before somebody flips one rather than after.
            Only for 'denied' — the one state the app cannot ask its way
            out of. 'undetermined' is the ordinary starting point and
            would be a warning about nothing. */}
        {permission === 'denied' && (
          <View style={[styles.blockedPanel, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText accessibilityRole="alert" type="small" themeColor="textSecondary">
              {NOTIFICATIONS_BLOCKED_NOTICE}
            </ThemedText>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={OPEN_SYSTEM_SETTINGS_LABEL}
              onPress={() => {
                onOpenSystemSettings();
              }}
              style={({ pressed }) => [
                styles.secondaryButton,
                { borderColor: theme.backgroundSelected },
                pressed && styles.pressed,
              ]}>
              <ThemedText type="smallBold">{OPEN_SYSTEM_SETTINGS_LABEL}</ThemedText>
            </Pressable>

            {settingsLinkNotice !== null && (
              <ThemedText accessibilityRole="alert" type="small" themeColor="textSecondary">
                {settingsLinkNotice}
              </ThemedText>
            )}
          </View>
        )}

        <ReminderToggle
          label={PERIOD_REMINDER_TOGGLE_LABEL}
          value={reminders.periodReminderEnabled}
          busy={reminderField === 'periodReminderEnabled'}
          disabled={reminderField !== null}
          onChange={(next) => onReminderChange('periodReminderEnabled', next)}
        />

        <ReminderToggle
          label={PREGNANCY_WEEKLY_REMINDER_TOGGLE_LABEL}
          value={reminders.pregnancyWeeklyReminderEnabled}
          busy={reminderField === 'pregnancyWeeklyReminderEnabled'}
          disabled={reminderField !== null}
          onChange={(next) => onReminderChange('pregnancyWeeklyReminderEnabled', next)}
        />

        {/* Below the two reminders, because it is about what they say
            and reads as nonsense above them. Its description sits
            under the switch rather than above: the label is the thing
            being decided, and the reason it exists is what somebody
            reads next. */}
        <ReminderToggle
          label={DISCREET_NOTIFICATIONS_TOGGLE_LABEL}
          value={discreet}
          busy={discreetBusy}
          disabled={discreetBusy}
          onChange={onDiscreetChange}
        />

        <ThemedText type="small" themeColor="textSecondary">
          {DISCREET_NOTIFICATIONS_DESCRIPTION}
        </ThemedText>

        {reminderNotice !== null && (
          <ThemedText accessibilityRole="alert" type="small" themeColor="textSecondary">
            {reminderNotice}
          </ThemedText>
        )}
    </View>
  );
}

const styles = StyleSheet.create({
  fields: {
    gap: Spacing.four,
  },
  blockedPanel: {
    gap: Spacing.three,
    borderRadius: Spacing.three,
    padding: Spacing.four,
  },
  secondaryButton: {
    minHeight: 52,
    borderRadius: Spacing.three,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  pressed: {
    opacity: 0.85,
  },
});
