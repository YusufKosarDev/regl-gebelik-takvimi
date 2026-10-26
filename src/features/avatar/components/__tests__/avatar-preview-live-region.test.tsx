import { render } from '@testing-library/react-native';

import { AvatarPreview } from '../AvatarPreview';
import type { AvatarConfig } from '@/features/avatar/domain/avatar-config';

/**
 * The changes that happen while the focus stays where it was.
 *
 * ## The line, and why it is here
 *
 * `themed-text.tsx` makes every notice announce, which covers the changes that
 * arrive *as text*: a save result, a refusal, an export outcome. Three changes
 * in this app arrive as something other than text, and they are the ones a
 * screen reader had no way at all to learn about:
 *
 *   - the avatar's picture, after one of its choices is pressed. The focus is
 *     on the choice; the thing that changed is a drawing two inches up whose
 *     description is already written and was never re-read;
 *   - the month, after a month arrow is pressed. Forty-two squares are
 *     replaced and the focus is on the arrow;
 *   - the selected day's card, after a square is pressed. The focus is on the
 *     square and the card below it is now about a different day.
 *
 * All three are a `polite` live region on an element that already exists and
 * already changes, rather than an imperative announcement.
 * `announceForAccessibility` would have done it in one line each and is not
 * used, because it "will interrupt any existing speech" - `assertive` by
 * another name, and nothing here earns that.
 *
 * ## What is deliberately not a live region
 *
 * Every keystroke and every chip. `accessibilityState.checked` is announced
 * when the control is pressed, so a second announcement says the same thing
 * twice. `pin-dots` is the one exception and keeps its live region: there the
 * visual feedback is a count of dots, and the key that was pressed does not
 * say the number.
 *
 * Screen transitions, because the platform reads the new screen. Loading
 * spinners, because what is worth saying is the outcome and not the wait. The
 * sky field and the arc, because they are decorative and already hidden.
 */

/** The defaults a new avatar starts on, which is enough to draw one. */
const avatar: AvatarConfig = {
  skinToneId: 'skin-tone-1',
  hairStyleId: 'short',
  hairColorId: 'black',
  outfitId: 't-shirt',
};

describe('the avatar picture', () => {
  /**
   * Pressing a choice changes a drawing, and the drawing's description is the
   * only place the result exists. Without this, somebody choosing a headscarf
   * colour hears the choice confirm itself and nothing about what it did.
   */
  it('announces its new description when a choice changes it', async () => {
    const { getByTestId } = await render(
      <AvatarPreview config={avatar} size="large" testID="preview" />
    );

    expect(getByTestId('preview').props.accessibilityLiveRegion).toBe('polite');
  });

  it('is not assertive', async () => {
    const { getByTestId } = await render(
      <AvatarPreview config={avatar} size="large" testID="preview" />
    );

    expect(getByTestId('preview').props.accessibilityLiveRegion).not.toBe('assertive');
  });

  it('still describes itself rather than announcing an empty string', async () => {
    const { getByTestId } = await render(
      <AvatarPreview config={avatar} size="large" testID="preview" />
    );

    expect(getByTestId('preview').props.accessibilityLabel).toBeTruthy();
  });
});
