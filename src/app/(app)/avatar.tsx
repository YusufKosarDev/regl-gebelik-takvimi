import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { AvatarPreview } from '@/features/avatar/components/AvatarPreview';
import {
  AVATAR_ACCESSORIES,
  AVATAR_HAIR_COLORS,
  AVATAR_HAIR_STYLES,
  AVATAR_OUTFITS,
  AVATAR_SKIN_TONES,
} from '@/features/avatar/data/avatar-catalog';
import { loadAvatarConfig, saveAvatarConfig } from '@/features/avatar/data/avatar-repository';
import type { AvatarConfig } from '@/features/avatar/domain/avatar-config';
import type { AvatarOption } from '@/features/avatar/domain/avatar-option';
import { useTheme } from '@/hooks/use-theme';
import { openAppDatabase } from '@/storage/db';

const LOAD_ERROR_MESSAGE = 'Avatar yüklenemedi.';
const SAVE_ERROR_MESSAGE = 'Avatar kaydedilemedi.';
const NO_ACCESSORY_LABEL = 'Yok';

/**
 * Where a new avatar starts.
 *
 * The first of each list, and no accessory. These are a starting point on screen
 * and nothing else: nothing is written until the person saves, so opening the
 * editor and going back leaves them with no avatar rather than with this one.
 */
function startingConfig(): AvatarConfig {
  return {
    skinToneId: AVATAR_SKIN_TONES[0].id,
    hairStyleId: AVATAR_HAIR_STYLES[0].id,
    hairColorId: AVATAR_HAIR_COLORS[0].id,
    outfitId: AVATAR_OUTFITS[0].id,
  };
}

/**
 * Building an avatar.
 *
 * Every choice is a tap from a list, so there is nothing to type and nothing the
 * domain could reject: the ids come from the catalogue rather than from input.
 * The preview redraws on each tap from the same config that will be saved, so
 * what is on screen and what is written cannot disagree.
 *
 * An avatar already saved opens with its own choices, including ones this build
 * may no longer offer — those simply show as unselected rather than being
 * silently swapped for something the person did not pick.
 */
export default function AvatarScreen() {
  const router = useRouter();
  const theme = useTheme();

  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const [config, setConfig] = useState<AvatarConfig>(startingConfig);

  const [isSaving, setIsSaving] = useState(false);
  const [hasSaveError, setHasSaveError] = useState(false);

  // A ref as well as the disabled prop: state updates are async, so two quick
  // taps could both read `isSaving` as false before the re-render lands.
  const saveInFlight = useRef(false);

  /** Stable, so the mount effect can depend on it. */
  const readAvatar = useCallback(async () => {
    const db = await openAppDatabase();

    return loadAvatarConfig(db);
  }, []);

  useEffect(() => {
    // Guards against setting state after the screen is gone, e.g. when the
    // person navigates back while the read is still in flight.
    let isActive = true;

    const load = async () => {
      try {
        const stored = await readAvatar();

        if (!isActive) {
          return;
        }

        // Only when there is one: otherwise the starting choices stay, unwritten.
        if (stored !== null) {
          setConfig(stored);
        }
      } catch (error) {
        if (__DEV__) {
          console.error('[avatar] could not load the avatar', error);
        }

        if (!isActive) {
          return;
        }

        setHasError(true);
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      isActive = false;
    };
  }, [readAvatar]);

  /** Replaces one choice, and clears a failure so the retry starts clean. */
  const choose = (change: Partial<AvatarConfig>) => {
    setConfig((current) => ({ ...current, ...change }));
    setHasSaveError(false);
  };

  /** "Yok" is the absence of an accessory, so it drops the key rather than blanking it. */
  const chooseAccessory = (id: string | null) => {
    setConfig((current) => {
      const { accessoryId, ...rest } = current;

      void accessoryId;

      return id === null ? rest : { ...rest, accessoryId: id };
    });
    setHasSaveError(false);
  };

  const handleSave = async () => {
    if (saveInFlight.current) {
      return;
    }

    saveInFlight.current = true;
    setIsSaving(true);
    setHasSaveError(false);

    try {
      const db = await openAppDatabase();

      await saveAvatarConfig(db, config);

      // Home reads again when it regains focus, so going back is enough to show
      // the saved avatar there.
      router.back();
    } catch (error) {
      if (__DEV__) {
        console.error('[avatar] could not save the avatar', error);
      }

      // The screen stays as it is with the error, so the choices that were not
      // written are still there to try again with.
      setHasSaveError(true);
    } finally {
      saveInFlight.current = false;
      setIsSaving(false);
    }
  };

  // The stack hides its header, so back has to be offered here.
  const backButton = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Geri"
      onPress={() => router.back()}
      style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
      <ThemedText type="small" themeColor="textSecondary">
        Geri
      </ThemedText>
    </Pressable>
  );

  if (isLoading) {
    return (
      <ThemedView style={styles.screen}>
        <SafeAreaView style={styles.centeredArea} edges={['top', 'bottom']}>
          <ActivityIndicator testID="avatar-loading" color={theme.text} />
          <ThemedText type="small" themeColor="textSecondary" style={styles.centeredText}>
            Veriler yükleniyor
          </ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            {backButton}

            <View style={styles.header}>
              <ThemedText accessibilityRole="header" type="subtitle" style={styles.title}>
                Avatarım
              </ThemedText>

              <ThemedText themeColor="textSecondary" style={styles.description}>
                Seçtiklerin hemen önizlemede görünür. Kaydedene kadar hiçbir şey yazılmaz.
              </ThemedText>
            </View>

            {hasError ? (
              <ThemedText accessibilityRole="alert" themeColor="textSecondary">
                {LOAD_ERROR_MESSAGE}
              </ThemedText>
            ) : (
              <>
                <AvatarPreview config={config} size="large" testID="avatar-preview" />

                <View style={styles.sections}>
                  <OptionSection
                    title="Ten tonu"
                    options={AVATAR_SKIN_TONES}
                    selectedId={config.skinToneId}
                    onSelect={(id) => choose({ skinToneId: id ?? config.skinToneId })}
                    disabled={isSaving}
                    theme={theme}
                  />

                  <OptionSection
                    title="Saç stili"
                    options={AVATAR_HAIR_STYLES}
                    selectedId={config.hairStyleId}
                    onSelect={(id) => choose({ hairStyleId: id ?? config.hairStyleId })}
                    disabled={isSaving}
                    theme={theme}
                  />

                  <OptionSection
                    title="Saç rengi"
                    options={AVATAR_HAIR_COLORS}
                    selectedId={config.hairColorId}
                    onSelect={(id) => choose({ hairColorId: id ?? config.hairColorId })}
                    disabled={isSaving}
                    theme={theme}
                  />

                  <OptionSection
                    title="Kıyafet"
                    options={AVATAR_OUTFITS}
                    selectedId={config.outfitId}
                    onSelect={(id) => choose({ outfitId: id ?? config.outfitId })}
                    disabled={isSaving}
                    theme={theme}
                  />

                  {/* "Yok" leads rather than trails: wearing nothing is a choice
                      people make, not a way of skipping the question. */}
                  <OptionSection
                    title="Aksesuar"
                    options={AVATAR_ACCESSORIES}
                    selectedId={config.accessoryId ?? null}
                    onSelect={chooseAccessory}
                    disabled={isSaving}
                    theme={theme}
                    noneLabel={NO_ACCESSORY_LABEL}
                  />
                </View>

                {hasSaveError && (
                  <ThemedText accessibilityRole="alert" type="small" themeColor="textSecondary">
                    {SAVE_ERROR_MESSAGE}
                  </ThemedText>
                )}

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Avatarı kaydet"
                  accessibilityState={{ disabled: isSaving }}
                  disabled={isSaving}
                  onPress={handleSave}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    { backgroundColor: theme.text },
                    isSaving && styles.disabled,
                    pressed && !isSaving && styles.pressed,
                  ]}>
                  <ThemedText type="smallBold" style={{ color: theme.background }}>
                    {isSaving ? 'Kaydediliyor...' : 'Kaydet'}
                  </ThemedText>
                </Pressable>
              </>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

/**
 * One category, as a row of choices.
 *
 * `noneLabel` turns the section into one that can be left empty, which only the
 * accessories are. It is passed rather than inferred, so nothing here has to
 * know which category it is drawing.
 */
function OptionSection({
  title,
  options,
  selectedId,
  onSelect,
  disabled,
  theme,
  noneLabel,
}: {
  title: string;
  options: readonly AvatarOption[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  disabled: boolean;
  theme: ReturnType<typeof useTheme>;
  noneLabel?: string;
}) {
  const choices: { key: string; id: string | null; label: string }[] = [
    ...(noneLabel === undefined ? [] : [{ key: 'none', id: null, label: noneLabel }]),
    ...options.map((option) => ({ key: option.id, id: option.id as string | null, label: option.label })),
  ];

  return (
    <View style={styles.section}>
      <ThemedText accessibilityRole="header" type="small" themeColor="textSecondary">
        {title}
      </ThemedText>

      <View style={styles.options}>
        {choices.map((choice) => {
          const isSelected = choice.id === selectedId;

          return (
            <Pressable
              key={choice.key}
              accessibilityRole="radio"
              accessibilityLabel={`${title}: ${choice.label}`}
              accessibilityState={{ selected: isSelected, disabled }}
              disabled={disabled}
              onPress={() => onSelect(choice.id)}
              style={({ pressed }) => [
                styles.option,
                {
                  backgroundColor: isSelected ? theme.backgroundSelected : theme.backgroundElement,
                  borderColor: isSelected ? theme.text : 'transparent',
                },
                disabled && styles.disabled,
                pressed && !disabled && styles.pressed,
              ]}>
              <ThemedText type={isSelected ? 'smallBold' : 'small'}>{choice.label}</ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  centeredArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  centeredText: {
    textAlign: 'center',
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
  sections: {
    gap: Spacing.four,
  },
  section: {
    gap: Spacing.two,
  },
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  option: {
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: Spacing.three,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.85,
  },
});
