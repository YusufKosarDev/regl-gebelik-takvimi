import { useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { AvatarPreview } from '@/features/avatar/components/AvatarPreview';
import type { AvatarConfig } from '@/features/avatar/domain/avatar-config';
import type { PregnancyDashboard } from '@/features/pregnancy/application/get-pregnancy-dashboard';

/**
 * The four ways out of the cycle home screen.
 *
 * Lifted out of `index.tsx` unchanged: the same links in the same order with
 * the same labels, and the same two things that vary - the avatar link, which
 * shows a preview and reads differently once there is one, and the pregnancy
 * link, which is only there while there is no pregnancy to track.
 *
 * The condition that hides the lot in the pregnancy view stayed on the screen,
 * where the rest of that split lives.
 */
export function HomeLinks({
  avatar,
  pregnancy,
}: {
  readonly avatar: AvatarConfig | null;
  readonly pregnancy: PregnancyDashboard | null;
}) {
  const router = useRouter();

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Geçmiş regl kayıtlarını görüntüle"
        onPress={() => router.push('/(app)/history')}
        style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
        <ThemedText type="small" themeColor="textSecondary">
          Geçmiş kayıtlar
        </ThemedText>
      </Pressable>

      {/* The preview only once there is an avatar, and the label
          says which of the two errands the link is on. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={avatar === null ? 'Avatar oluştur' : 'Avatarı düzenle'}
        onPress={() => router.push('/(app)/avatar')}
        style={({ pressed }) => [styles.avatarLink, pressed && styles.pressed]}>
        {avatar !== null && (
          <AvatarPreview config={avatar} size="small" testID="home-avatar-preview" />
        )}

        <ThemedText type="small" themeColor="textSecondary">
          {avatar === null ? 'Avatarım' : 'Avatarı düzenle'}
        </ThemedText>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Döngü ayarlarını düzenle"
        onPress={() => router.push('/(app)/settings')}
        style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
        <ThemedText type="small" themeColor="textSecondary">
          Ayarlar
        </ThemedText>
      </Pressable>

      {/* The way in to pregnancy tracking, and the only way to enable
          the view that shows it. */}
      {pregnancy === null && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Gebelik takibini başlat"
          onPress={() => router.push('/(app)/pregnancy-start')}
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed && styles.pressed,
          ]}>
          <ThemedText type="small" themeColor="textSecondary">
            Gebelik takibini başlat
          </ThemedText>
        </Pressable>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  secondaryButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  avatarLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 48,
    paddingHorizontal: Spacing.four,
  },
  pressed: {
    opacity: 0.6,
  },
});
