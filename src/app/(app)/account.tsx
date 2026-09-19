import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuthState } from '@/features/auth/application/use-auth-state';
import {
  sendPasswordReset,
  signInWithEmail,
  signOut,
  signUpWithEmail,
} from '@/features/auth/data/auth-repository';
import { toAuthError } from '@/features/auth/domain/auth-error';
import {
  EMPTY_EMAIL_MESSAGE,
  EMPTY_PASSWORD_MESSAGE,
  PASSWORD_RESET_SENT_MESSAGE,
  authErrorMessage,
  passwordResetErrorMessage,
} from '@/features/auth/presentation/auth-messages';
import { loadCloudBackup, saveCloudBackup } from '@/features/backup/data/cloud-backup-repository';
import { buildCloudSyncPayloadV1 } from '@/features/privacy/application/build-cloud-sync-payload-v1';
import type { AuthUser } from '@/features/auth/domain/auth-user';
import { useTheme } from '@/hooks/use-theme';
import { openAppDatabase } from '@/storage/db';

const BACKUP_SAVED_MESSAGE = 'Yedek oluşturuldu.';
const BACKUP_FOUND_MESSAGE = 'Yedek bulundu.';
const BACKUP_MISSING_MESSAGE = 'Henüz yedek yok.';

/**
 * The account screen.
 *
 * An account is optional and does nothing yet. Nothing about a cycle, a
 * pregnancy or an avatar is sent anywhere, signed in or not, and every other
 * screen works exactly the same either way — which is why this is a link in the
 * settings rather than a gate in front of the app.
 *
 * The password is held in state while it is being typed and cleared the moment
 * it has been used. It is never written down: not to a log, not into an error,
 * and not into the message a failure shows.
 */
export default function AccountScreen() {
  const router = useRouter();
  const theme = useTheme();
  const auth = useAuthState();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // The reset form is a mode of the signed-out state rather than a screen of
  // its own: it asks for the address that is already typed in, and going back
  // to signing in should not be a navigation.
  const [isResetting, setIsResetting] = useState(false);

  // What the backup buttons last said. Kept apart from `notice`, which belongs
  // to signing in, so a stale sign-in message cannot appear under a backup.
  const [backupNotice, setBackupNotice] = useState<string | null>(null);

  // A ref as well as the disabled prop: two quick taps could both read `isBusy`
  // as false before the re-render lands, and the second would be a second
  // attempt with the same credentials.
  const inFlight = useRef(false);

  const clearForm = () => {
    setEmail('');
    setPassword('');
    setIsResetting(false);
  };

  /**
   * Runs one attempt, whichever button was pressed.
   *
   * The address is trimmed, because a keyboard that capitalises and a paste
   * that brings a space are not the person getting their own address wrong. The
   * password is not: a space in a password is a character in a password.
   */
  const attempt = async (action: (email: string, password: string) => Promise<unknown>) => {
    if (inFlight.current) {
      return;
    }

    const trimmedEmail = email.trim();

    if (trimmedEmail === '') {
      setNotice(EMPTY_EMAIL_MESSAGE);

      return;
    }

    if (password === '') {
      setNotice(EMPTY_PASSWORD_MESSAGE);

      return;
    }

    inFlight.current = true;
    setIsBusy(true);
    setNotice(null);

    try {
      await action(trimmedEmail, password);

      // The state comes from the session rather than from here: the observer
      // reports the new user, and this screen re-renders as signed in.
      clearForm();
    } catch (error) {
      // Only the code crosses. Whatever the SDK wrote is not shown, not kept
      // and not logged.
      setNotice(authErrorMessage(toAuthError(error).code));
      setPassword('');
    } finally {
      inFlight.current = false;
      setIsBusy(false);
    }
  };

  /**
   * Asks for a reset link.
   *
   * The answer is the same sentence whichever way it went, because the
   * repository does not say whether the address had an account and this screen
   * must not appear to know either.
   */
  const handleSendReset = async () => {
    if (inFlight.current) {
      return;
    }

    const trimmedEmail = email.trim();

    if (trimmedEmail === '') {
      setNotice(EMPTY_EMAIL_MESSAGE);

      return;
    }

    inFlight.current = true;
    setIsBusy(true);
    setNotice(null);

    try {
      await sendPasswordReset(trimmedEmail);

      // Back to signing in, with the answer above it: the next thing to do is
      // read the mail and come back.
      setIsResetting(false);
      setNotice(PASSWORD_RESET_SENT_MESSAGE);
    } catch (error) {
      setNotice(passwordResetErrorMessage(toAuthError(error).code));
    } finally {
      inFlight.current = false;
      setIsBusy(false);
    }
  };

  /**
   * Copies what is on the phone into the person's own backup.
   *
   * Nothing happens until this is pressed. The payload is the one the privacy
   * boundary defines — the five things somebody entered, and nothing worked out
   * from them — and it is built here, sent, and not kept.
   */
  const handleCreateBackup = async (user: AuthUser) => {
    if (inFlight.current) {
      return;
    }

    inFlight.current = true;
    setIsBusy(true);
    setBackupNotice(null);

    try {
      const db = await openAppDatabase();

      await saveCloudBackup(user, await buildCloudSyncPayloadV1(db));

      setBackupNotice(BACKUP_SAVED_MESSAGE);
    } catch (error) {
      // The database's own failures and Firestore's arrive here the same way,
      // and neither message is shown.
      setBackupNotice(authErrorMessage(toAuthError(error).code));
    } finally {
      inFlight.current = false;
      setIsBusy(false);
    }
  };

  /**
   * Says whether there is a backup, and nothing else about it.
   *
   * Not what is in it, not when it was made, not how big it is: this is a
   * screen someone may be holding in front of another person, and "there is a
   * backup" is the whole question being asked.
   */
  const handleCheckBackup = async (user: AuthUser) => {
    if (inFlight.current) {
      return;
    }

    inFlight.current = true;
    setIsBusy(true);
    setBackupNotice(null);

    try {
      const backup = await loadCloudBackup(user);

      setBackupNotice(backup === null ? BACKUP_MISSING_MESSAGE : BACKUP_FOUND_MESSAGE);
    } catch (error) {
      setBackupNotice(authErrorMessage(toAuthError(error).code));
    } finally {
      inFlight.current = false;
      setIsBusy(false);
    }
  };

  const handleSignOut = async () => {
    if (inFlight.current) {
      return;
    }

    inFlight.current = true;
    setIsBusy(true);
    setNotice(null);

    try {
      await signOut();
      clearForm();
    } catch (error) {
      setNotice(authErrorMessage(toAuthError(error).code));
    } finally {
      inFlight.current = false;
      setIsBusy(false);
    }
  };

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            {/* The stack hides its header, so back has to be offered here. */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Geri"
              onPress={() => router.back()}
              style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
              <ThemedText type="small" themeColor="textSecondary">
                Geri
              </ThemedText>
            </Pressable>

            <View style={styles.header}>
              <ThemedText accessibilityRole="header" type="subtitle" style={styles.title}>
                Hesap
              </ThemedText>

              <ThemedText themeColor="textSecondary" style={styles.description}>
                Hesap açmak isteğe bağlı. Regl, gebelik ve avatar bilgilerin telefonunda
                kalır; hesabın olsun ya da olmasın hiçbir yere gönderilmez.
              </ThemedText>
            </View>

            {auth.status === 'loading' && (
              <View style={styles.loading}>
                <ActivityIndicator testID="account-loading" />
                <ThemedText type="small" themeColor="textSecondary">
                  Hesap bilgileri yükleniyor
                </ThemedText>
              </View>
            )}

            {auth.status === 'not-configured' && (
              <View style={styles.fields}>
                <ThemedText accessibilityRole="alert" type="small" themeColor="textSecondary">
                  Bulut hesabı şu anda yapılandırılmamış.
                </ThemedText>

                <ThemedText type="small" themeColor="textSecondary">
                  Uygulamanın geri kalanı hesapsız da tam olarak çalışır.
                </ThemedText>
              </View>
            )}

            {auth.status === 'signed-in' && (
              <View style={styles.fields}>
                <View style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Giriş yapıldı
                  </ThemedText>

                  <ThemedText
                    accessibilityLabel={`Giriş yapılan hesap: ${auth.user.email ?? 'e-posta yok'}`}
                    type="smallBold"
                    style={styles.email}>
                    {auth.user.email ?? 'E-posta adresi yok'}
                  </ThemedText>
                </View>

                {notice !== null && (
                  <ThemedText accessibilityRole="alert" type="small" themeColor="textSecondary">
                    {notice}
                  </ThemedText>
                )}

                {/* Only here, and only on a press: an account exists to hold a
                    backup, and a backup happens when someone asks for one. */}
                <View style={styles.fields}>
                  <ThemedText accessibilityRole="header" type="smallBold">
                    Bulut yedekleme
                  </ThemedText>

                  <ThemedText type="small" themeColor="textSecondary">
                    Yedek oluşturduğunda regl kayıtların, gebelik bilgin, avatarın ve
                    hatırlatıcı tercihlerin hesabına kopyalanır. Başka hiçbir şey gönderilmez
                    ve bunun dışında kendiliğinden bir gönderim olmaz.
                  </ThemedText>

                  {backupNotice !== null && (
                    <ThemedText accessibilityRole="alert" type="small" themeColor="textSecondary">
                      {backupNotice}
                    </ThemedText>
                  )}

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Yedek oluştur"
                    accessibilityState={{ disabled: isBusy }}
                    disabled={isBusy}
                    onPress={() => handleCreateBackup(auth.user)}
                    style={({ pressed }) => [
                      styles.secondaryButton,
                      { borderColor: theme.backgroundSelected },
                      isBusy && styles.disabled,
                      pressed && !isBusy && styles.pressed,
                    ]}>
                    <ThemedText type="smallBold">Yedek oluştur</ThemedText>
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Yedeği kontrol et"
                    accessibilityState={{ disabled: isBusy }}
                    disabled={isBusy}
                    onPress={() => handleCheckBackup(auth.user)}
                    style={({ pressed }) => [
                      styles.secondaryButton,
                      { borderColor: theme.backgroundSelected },
                      isBusy && styles.disabled,
                      pressed && !isBusy && styles.pressed,
                    ]}>
                    <ThemedText type="smallBold">Yedeği kontrol et</ThemedText>
                  </Pressable>
                </View>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Çıkış yap"
                  accessibilityState={{ disabled: isBusy }}
                  disabled={isBusy}
                  onPress={handleSignOut}
                  style={({ pressed }) => [
                    styles.secondaryButton,
                    { borderColor: theme.backgroundSelected },
                    isBusy && styles.disabled,
                    pressed && !isBusy && styles.pressed,
                  ]}>
                  <ThemedText type="smallBold">
                    {isBusy ? 'Çıkış yapılıyor...' : 'Çıkış yap'}
                  </ThemedText>
                </Pressable>
              </View>
            )}

            {auth.status === 'signed-out' && (
              <View style={styles.fields}>
                <View style={styles.field}>
                  <ThemedText type="small" themeColor="textSecondary">
                    E-posta
                  </ThemedText>

                  <TextInput
                    accessibilityLabel="E-posta"
                    value={email}
                    onChangeText={(next) => {
                      setEmail(next);
                      setNotice(null);
                    }}
                    editable={!isBusy}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    textContentType="emailAddress"
                    placeholder="ornek@eposta.com"
                    placeholderTextColor={theme.textSecondary}
                    style={[
                      styles.input,
                      { borderColor: theme.backgroundSelected, color: theme.text },
                    ]}
                  />
                </View>

                {!isResetting && (
                  <View style={styles.field}>
                    <ThemedText type="small" themeColor="textSecondary">
                      Şifre
                    </ThemedText>

                    <TextInput
                      accessibilityLabel="Şifre"
                      value={password}
                      onChangeText={(next) => {
                        setPassword(next);
                        setNotice(null);
                      }}
                      editable={!isBusy}
                      autoCapitalize="none"
                      autoCorrect={false}
                      // The field is masked and kept out of the keyboard's own
                      // learning, which is where a typed password otherwise
                      // ends up being remembered.
                      secureTextEntry
                      textContentType="password"
                      placeholder="En az 6 karakter"
                      placeholderTextColor={theme.textSecondary}
                      style={[
                        styles.input,
                        { borderColor: theme.backgroundSelected, color: theme.text },
                      ]}
                    />
                  </View>
                )}

                {isResetting && (
                  <ThemedText type="small" themeColor="textSecondary">
                    Bu adrese şifre sıfırlama bağlantısı gönderelim. Bağlantı, tarayıcıda
                    açılan bir sayfaya götürür.
                  </ThemedText>
                )}

                {notice !== null && (
                  <ThemedText accessibilityRole="alert" type="small" themeColor="textSecondary">
                    {notice}
                  </ThemedText>
                )}

                {isResetting ? (
                  <>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Sıfırlama bağlantısı gönder"
                      accessibilityState={{ disabled: isBusy }}
                      disabled={isBusy}
                      onPress={handleSendReset}
                      style={({ pressed }) => [
                        styles.primaryButton,
                        { backgroundColor: theme.text },
                        isBusy && styles.disabled,
                        pressed && !isBusy && styles.pressed,
                      ]}>
                      <ThemedText type="smallBold" style={{ color: theme.background }}>
                        {isBusy ? 'Gönderiliyor...' : 'Sıfırlama bağlantısı gönder'}
                      </ThemedText>
                    </Pressable>

                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Vazgeç"
                      accessibilityState={{ disabled: isBusy }}
                      disabled={isBusy}
                      onPress={() => {
                        setIsResetting(false);
                        setNotice(null);
                      }}
                      style={({ pressed }) => [
                        styles.secondaryButton,
                        { borderColor: theme.backgroundSelected },
                        isBusy && styles.disabled,
                        pressed && !isBusy && styles.pressed,
                      ]}>
                      <ThemedText type="smallBold">Vazgeç</ThemedText>
                    </Pressable>
                  </>
                ) : (
                  <>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Giriş yap"
                      accessibilityState={{ disabled: isBusy }}
                      disabled={isBusy}
                      onPress={() => attempt(signInWithEmail)}
                      style={({ pressed }) => [
                        styles.primaryButton,
                        { backgroundColor: theme.text },
                        isBusy && styles.disabled,
                        pressed && !isBusy && styles.pressed,
                      ]}>
                      <ThemedText type="smallBold" style={{ color: theme.background }}>
                        {isBusy ? 'Gönderiliyor...' : 'Giriş yap'}
                      </ThemedText>
                    </Pressable>

                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Hesap oluştur"
                      accessibilityState={{ disabled: isBusy }}
                      disabled={isBusy}
                      onPress={() => attempt(signUpWithEmail)}
                      style={({ pressed }) => [
                        styles.secondaryButton,
                        { borderColor: theme.backgroundSelected },
                        isBusy && styles.disabled,
                        pressed && !isBusy && styles.pressed,
                      ]}>
                      <ThemedText type="smallBold">Hesap oluştur</ThemedText>
                    </Pressable>

                    {/* Last, and quiet: it is the way out of a form that did
                        not work, not one of the two things to do here. */}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Şifremi unuttum"
                      accessibilityState={{ disabled: isBusy }}
                      disabled={isBusy}
                      onPress={() => {
                        setIsResetting(true);
                        setNotice(null);
                      }}
                      style={({ pressed }) => [
                        styles.linkButton,
                        isBusy && styles.disabled,
                        pressed && !isBusy && styles.pressed,
                      ]}>
                      <ThemedText type="small" themeColor="textSecondary">
                        Şifremi unuttum
                      </ThemedText>
                    </Pressable>
                  </>
                )}
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.five,
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    gap: Spacing.four,
  },
  backButton: {
    minHeight: 44,
    justifyContent: 'center',
    alignSelf: 'flex-start',
    paddingRight: Spacing.three,
  },
  header: {
    gap: Spacing.two,
  },
  title: {
    fontSize: 30,
    lineHeight: 38,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
  },
  loading: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.five,
  },
  fields: {
    gap: Spacing.three,
  },
  field: {
    gap: Spacing.half,
  },
  input: {
    minHeight: 52,
    borderRadius: Spacing.two,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  row: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.half,
  },
  email: {
    fontSize: 18,
    lineHeight: 26,
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButton: {
    minHeight: 52,
    borderRadius: Spacing.three,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.6,
  },
});
