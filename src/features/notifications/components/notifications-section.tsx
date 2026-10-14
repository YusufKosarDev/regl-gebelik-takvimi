import { Pressable, StyleSheet, View } from 'react-native';

import { ButtonLabel, ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useMessages } from '@/i18n';
import type { BlockedReminderChannels } from '../infrastructure/blocked-reminder-channels';
import type { NotificationPreferences } from '../domain/notification-preferences';
import type { NotificationPermissionStatus } from '../infrastructure/notification-permission';
import { ReminderToggle } from './reminder-toggle';
import { reminderMessages } from '../presentation/reminder-messages';
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
  askingPermission,
  blockedChannels,
  settingsLinkNotice,
  onReminderChange,
  onDiscreetChange,
  onAskPermission,
  onOpenSystemSettings,
}: {
  readonly reminders: NotificationPreferences;
  readonly reminderField: keyof NotificationPreferences | null;
  readonly reminderNotice: string | null;
  readonly discreet: boolean;
  readonly discreetBusy: boolean;
  readonly permission: NotificationPermissionStatus | null;
  readonly askingPermission: boolean;
  readonly blockedChannels: BlockedReminderChannels;
  readonly settingsLinkNotice: string | null;
  readonly onReminderChange: (field: keyof NotificationPreferences, next: boolean) => void;
  readonly onDiscreetChange: (next: boolean) => void;
  readonly onAskPermission: () => void;
  readonly onOpenSystemSettings: () => void;
}) {
  const theme = useTheme();
  const reminderStrings = useMessages(reminderMessages);
  const cycleSettings = useMessages(settingsMessages);

  /**
   * Whether somebody is waiting for a reminder that cannot arrive.
   *
   * Keyed off the stored preference rather than off `permission` alone, which
   * looks like the wrong signal until you know why: 'undetermined' covers a
   * permission nobody has been asked for, a refusal Android is still willing to
   * re-ask, and a grant the person has since taken away - and the platform will
   * not tell those apart. The long note on `toStatus` has the reason. So the
   * status cannot say whether anybody is waiting. The switch can.
   *
   * Without this the three ways in were all silent: a grant revoked in system
   * settings, notifications switched off for the whole app, and an account
   * restored onto a phone that was never asked. In each one the switch read on,
   * the queue held nothing, and the screen said nothing - and the last of those
   * is the part only this can fix.
   */
  const waitingOnPermission =
    permission !== 'granted' &&
    (reminders.periodReminderEnabled || reminders.pregnancyWeeklyReminderEnabled);

  /**
   * Whether to offer the dialog rather than a trip through system settings.
   *
   * 'denied' is the one state where Android has stopped offering it, so every
   * other one can ask. Two taps against leaving the app - and for somebody who
   * restored their account it is the difference between being asked a question
   * and being sent to find a switch they never touched.
   */
  const canAskPermission = waitingOnPermission && permission !== 'denied';

  /**
   * A reminder whose own channel the person has silenced.
   *
   * Paired with the switch rather than asked on its own: a blocked channel
   * under a switch that is off is not a problem, it is somebody who turned the
   * reminder off and then turned it off again somewhere else.
   */
  const periodChannelSilenced =
    reminders.periodReminderEnabled && blockedChannels.periodReminder;
  const pregnancyChannelSilenced =
    reminders.pregnancyWeeklyReminderEnabled && blockedChannels.pregnancyWeeklyReminder;
  const anyChannelSilenced = periodChannelSilenced || pregnancyChannelSilenced;

  /*
   * The standing notice keeps exactly the case it was written for: nothing
   * switched on, and notifications blocked outright. 'undetermined' with every
   * switch off is still the ordinary starting point and would be a warning
   * about nothing.
   */
  const showPermissionPanel =
    waitingOnPermission || anyChannelSilenced || permission === 'denied';

  let permissionMessage = reminderStrings.notificationsBlockedNotice;

  if (waitingOnPermission) {
    permissionMessage = canAskPermission
      ? reminderStrings.reminderPermissionMissingNotice
      : reminderStrings.reminderUnreachableNotice;
  } else if (anyChannelSilenced) {
    /*
     * After the permission, deliberately. When nothing is being delivered at
     * all, which channel is silenced is beside the point and saying so would
     * send somebody to fix the smaller of two problems.
     */
    permissionMessage = reminderStrings.reminderChannelBlockedNotice;
  }

  return (
    <View style={styles.fields}>
        <ThemedText accessibilityRole="header" type="smallBold">
          {cycleSettings.notificationsSectionTitle}
        </ThemedText>

        <ThemedText type="small" themeColor="textSecondary">
          {reminderStrings.remindersIntro}
        </ThemedText>

        {/* Standing, not transient: while this is true every switch in
            this section is a promise the phone will not keep, and that
            is worth saying before somebody flips one rather than after.
            One panel and never two, because the states overlap — a
            reminder switched on while notifications are blocked is both
            of them at once, and it only wants telling once. */}
        {showPermissionPanel && (
          <View style={[styles.blockedPanel, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText accessibilityRole="alert" type="small" themeColor="textSecondary">
              {permissionMessage}
            </ThemedText>

            {canAskPermission ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={reminderStrings.grantNotificationPermissionLabel}
                accessibilityState={{ disabled: askingPermission, busy: askingPermission }}
                disabled={askingPermission}
                onPress={() => {
                  onAskPermission();
                }}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  { borderColor: theme.backgroundSelected },
                  (pressed || askingPermission) && styles.pressed,
                ]}>
                <ThemedText type="smallBold" style={ButtonLabel}>{reminderStrings.grantNotificationPermissionLabel}</ThemedText>
              </Pressable>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={reminderStrings.openSystemSettingsLabel}
                onPress={() => {
                  onOpenSystemSettings();
                }}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  { borderColor: theme.backgroundSelected },
                  pressed && styles.pressed,
                ]}>
                <ThemedText type="smallBold" style={ButtonLabel}>{reminderStrings.openSystemSettingsLabel}</ThemedText>
              </Pressable>
            )}

            {settingsLinkNotice !== null && (
              <ThemedText accessibilityRole="alert" type="small" themeColor="textSecondary">
                {settingsLinkNotice}
              </ThemedText>
            )}
          </View>
        )}

        <ReminderToggle
          label={reminderStrings.periodReminderToggleLabel}
          value={reminders.periodReminderEnabled}
          busy={reminderField === 'periodReminderEnabled'}
          disabled={reminderField !== null}
          onChange={(next) => onReminderChange('periodReminderEnabled', next)}
        />

        {/* Directly under the row it contradicts, which is the whole reason
            this is per switch and not one sentence in the panel: the two
            channels are independent, and somebody needs to know which of
            their reminders stopped without going looking. */}
        {periodChannelSilenced && (
          <ThemedText accessibilityRole="alert" type="small" themeColor="textSecondary">
            {reminderStrings.reminderChannelOffNote}
          </ThemedText>
        )}

        <ReminderToggle
          label={reminderStrings.pregnancyWeeklyReminderToggleLabel}
          value={reminders.pregnancyWeeklyReminderEnabled}
          busy={reminderField === 'pregnancyWeeklyReminderEnabled'}
          disabled={reminderField !== null}
          onChange={(next) => onReminderChange('pregnancyWeeklyReminderEnabled', next)}
        />

        {pregnancyChannelSilenced && (
          <ThemedText accessibilityRole="alert" type="small" themeColor="textSecondary">
            {reminderStrings.reminderChannelOffNote}
          </ThemedText>
        )}

        {/* Below the two reminders, because it is about what they say
            and reads as nonsense above them. Its description sits
            under the switch rather than above: the label is the thing
            being decided, and the reason it exists is what somebody
            reads next. */}
        <ReminderToggle
          label={reminderStrings.discreetNotificationsToggleLabel}
          value={discreet}
          busy={discreetBusy}
          disabled={discreetBusy}
          onChange={onDiscreetChange}
        />

        <ThemedText type="small" themeColor="textSecondary">
          {reminderStrings.discreetNotificationsDescription}
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
