import { Pressable, StyleSheet, View } from 'react-native';

import { END_SAVE_ERROR_MESSAGE, SAVE_ERROR_MESSAGE } from '../presentation/home-messages';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { ISODate } from '@/types/iso-date';
import { formatDisplayDate } from '@/utils/format-date';

/**
 * The button that records a period starting or ending, and the confirmation
 * it turns into once pressed.
 *
 * Lifted out of `index.tsx` unchanged: the same two states, the same question,
 * the same pair of buttons and the same labels, which read "başladı" or "bitti"
 * off the same flag as before.
 *
 * The case where there is nothing to offer today stayed on the screen, because
 * that is the screen deciding whether this card exists at all.
 *
 * All of the state is still the screen’s. Saving reaches into the database and
 * reloads everything on the screen; a card that owned that would be deciding
 * for the screen what it shows next.
 */
export function PeriodActionCard({
  today,
  isEnding,
  isConfirming,
  setIsConfirming,
  isSaving,
  hasSaveError,
  setHasSaveError,
  handleSavePeriod,
}: {
  readonly today: ISODate;
  readonly isEnding: boolean;
  readonly isConfirming: boolean;
  readonly setIsConfirming: (confirming: boolean) => void;
  readonly isSaving: boolean;
  readonly hasSaveError: boolean;
  readonly setHasSaveError: (hasError: boolean) => void;
  readonly handleSavePeriod: () => Promise<void>;
}) {
  const theme = useTheme();

  return isConfirming ? (
    <View style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
      <ThemedText type="small" themeColor="textSecondary">
        {isEnding
          ? 'Bugünü regl bitişi olarak kaydetmek istiyor musun?'
          : 'Bugünü regl başlangıcı olarak kaydetmek istiyor musun?'}
      </ThemedText>

      <ThemedText style={styles.rowValue}>
        {formatDisplayDate(today)}
      </ThemedText>

      {hasSaveError && (
        <ThemedText
          accessibilityRole="alert"
          type="small"
          themeColor="textSecondary"
          style={styles.rowNote}>
          {isEnding ? END_SAVE_ERROR_MESSAGE : SAVE_ERROR_MESSAGE}
        </ThemedText>
      )}

      <View style={styles.confirmActions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Vazgeç"
          accessibilityState={{ disabled: isSaving }}
          disabled={isSaving}
          onPress={() => {
            setIsConfirming(false);
            setHasSaveError(false);
          }}
          style={({ pressed }) => [
            styles.secondaryButton,
            isSaving && styles.disabled,
            pressed && !isSaving && styles.pressed,
          ]}>
          <ThemedText type="small" themeColor="textSecondary">
            Vazgeç
          </ThemedText>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Kaydet"
          accessibilityState={{ disabled: isSaving }}
          disabled={isSaving}
          onPress={handleSavePeriod}
          style={({ pressed }) => [
            styles.primaryButton,
            { backgroundColor: theme.primary },
            isSaving && styles.disabled,
            pressed && !isSaving && styles.pressed,
          ]}>
          <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
            {isSaving ? 'Kaydediliyor...' : 'Kaydet'}
          </ThemedText>
        </Pressable>
      </View>
    </View>
  ) : (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={isEnding ? 'Regl bitişini kaydet' : 'Regl başlangıcını kaydet'}
      onPress={() => setIsConfirming(true)}
      style={({ pressed }) => [
        styles.primaryButton,
        { backgroundColor: theme.primary },
        pressed && styles.pressed,
      ]}>
      <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
        {isEnding ? 'Regl bitti' : 'Regl başladı'}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    gap: Spacing.half,
  },
  rowValue: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '600',
  },
  rowNote: {
    marginTop: Spacing.one,
  },
  confirmActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  secondaryButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.6,
  },
});
