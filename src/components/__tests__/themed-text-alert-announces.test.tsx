import { render } from '@testing-library/react-native';

import { ThemedText } from '../themed-text';

/**
 * A text that calls itself an alert is announced.
 *
 * ## The defect this removes
 *
 * Fifty-nine places in this app render a notice as `<ThemedText
 * accessibilityRole="alert">` - a save result, a refusal, a sync failure, the
 * export outcome. Every one of them was silent to TalkBack.
 *
 * `accessibilityRole="alert"` is documented as "Used when an element contains
 * important text to be presented to the user" and nothing more. It is a
 * description of the element, not an instruction to say it. The Android
 * mechanism is `accessibilityLiveRegion`, whose own documented example is a
 * changing `Text` that "TalkBack reads ... because of its
 * `accessibilityLiveRegion="polite"` property".
 *
 * So fifty-nine notices looked like they announced and did not, which is the
 * worst shape a thing like this can have: the intent is written at every call
 * site and the behaviour is at none of them.
 *
 * ## Why it is fixed here and not at the call sites
 *
 * One edit against fifty-nine, and more usefully one rule instead of
 * fifty-nine chances to forget it: if a text says `alert`, it announces. A
 * notice added next month gets it by saying what it is.
 *
 * ## Polite, never assertive
 *
 * `assertive` interrupts whatever TalkBack is currently saying. Nothing in
 * this app earns that - not a save confirmation, not a failed sync. The person
 * is mid-sentence somewhere and the notice can wait for the gap.
 *
 * `AccessibilityInfo.announceForAccessibility` is not used anywhere for the
 * same reason: "By default announcements will interrupt any existing speech",
 * which is `assertive` by another name.
 */

describe('a text whose role is alert', () => {
  it('is a polite live region, so TalkBack says it', async () => {
    const { getByText } = await render(
      <ThemedText accessibilityRole="alert">Kaydedildi</ThemedText>
    );

    expect(getByText('Kaydedildi').props.accessibilityLiveRegion).toBe('polite');
  });

  it('is never assertive, whatever the notice is', async () => {
    const { getByText } = await render(
      <ThemedText accessibilityRole="alert">Dosya paylaşılamadı.</ThemedText>
    );

    expect(getByText('Dosya paylaşılamadı.').props.accessibilityLiveRegion).not.toBe('assertive');
  });

  it('keeps the role, so nothing it already said about itself is lost', async () => {
    const { getByText } = await render(
      <ThemedText accessibilityRole="alert">Kaydedildi</ThemedText>
    );

    expect(getByText('Kaydedildi').props.accessibilityRole).toBe('alert');
  });
});

describe('a text that is not an alert', () => {
  /**
   * Ordinary body text must not be a live region. A screen whose every
   * paragraph announced itself on mount would be unusable, and the rule is
   * about notices rather than about text.
   */
  it('is not a live region', async () => {
    const { getByText } = await render(<ThemedText>Döngü günü</ThemedText>);

    expect(getByText('Döngü günü').props.accessibilityLiveRegion).toBeUndefined();
  });

  it('is not a live region when it is a heading either', async () => {
    const { getByText } = await render(
      <ThemedText accessibilityRole="header">Döngü ayarları</ThemedText>
    );

    expect(getByText('Döngü ayarları').props.accessibilityLiveRegion).toBeUndefined();
  });
});

describe('a caller that says otherwise', () => {
  /**
   * The default is a default, not a lock. A notice that genuinely should not
   * announce - one rendered on arrival rather than in answer to something -
   * can say so, and `cycle-calendar-section.tsx` does not need to today.
   */
  it('can turn the announcement off', async () => {
    const { getByText } = await render(
      <ThemedText accessibilityRole="alert" accessibilityLiveRegion="none">
        Kaydedildi
      </ThemedText>
    );

    expect(getByText('Kaydedildi').props.accessibilityLiveRegion).toBe('none');
  });
});
