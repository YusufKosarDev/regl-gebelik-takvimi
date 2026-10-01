import { render } from '@testing-library/react-native';
import React from 'react';
import { PixelRatio, StyleSheet } from 'react-native';

import { ThemedText } from '../themed-text';

import { MAX_DISPLAY_FONT_SCALE, TEXT_SCALE } from '@/constants/typography';

/**
 * What happens to text when somebody turns the system font size up.
 *
 * ## The defect this pins
 *
 * React Native scales `fontSize` by the device's font scale and leaves
 * `lineHeight` exactly as written. Every size in this app set both, so at
 * Android's largest setting a 48dp title was being drawn into a 52dp line box:
 * letters clipped, lines overlapped. Nothing in the app read the font scale at
 * all, and nothing could have caught it - no test in the repository asserted a
 * `fontSize` or a `lineHeight` before this one.
 *
 * `PixelRatio.getFontScale()` reports 1 under Jest, so the scale is mocked to
 * act out a device whose owner has changed the setting.
 */

const getFontScale = jest.spyOn(PixelRatio, 'getFontScale');

/** The style the `Text` actually received, flattened. */
function styleOf(element: { props: { style?: unknown } }) {
  return StyleSheet.flatten(element.props.style as never) as {
    fontSize?: number;
    lineHeight?: number;
  };
}

afterEach(() => {
  getFontScale.mockReset();
});

describe('at the default setting', () => {
  it('draws every size exactly as it was written', async () => {
    // The guarantee that made this change safe to make: at scale 1 nothing
    // moves, which is why 6,000 existing assertions were unaffected.
    getFontScale.mockReturnValue(1);

    for (const type of ['title', 'subtitle', 'default', 'small', 'smallBold'] as const) {
      const screen = await render(<ThemedText type={type}>text</ThemedText>);
      const style = styleOf(screen.getByText('text'));

      expect(style.fontSize).toBe(TEXT_SCALE[type].fontSize);
      expect(style.lineHeight).toBe(TEXT_SCALE[type].lineHeight);
    }
  });
});

describe('at a larger setting', () => {
  it('grows the line box with the letters', async () => {
    getFontScale.mockReturnValue(2);

    const screen = await render(<ThemedText type="title">text</ThemedText>);
    const style = styleOf(screen.getByText('text'));

    // `fontSize` is left alone: React Native scales it on the way to the
    // platform. The line height is what this component has to grow.
    expect(style.fontSize).toBe(48);
    expect(style.lineHeight).toBe(104);
  });

  it('grows a line height a screen set for itself', async () => {
    // The half that matters most. Thirty files carry their own size pairs in
    // screen stylesheets, and those arrive after anything this component
    // composes - so scaling only the catalogue entry would have fixed the sizes
    // nobody overrode and left every override clipping exactly as before.
    getFontScale.mockReturnValue(2);

    const screen = await render(
      <ThemedText type="subtitle" style={{ fontSize: 30, lineHeight: 38 }}>
        text
      </ThemedText>
    );
    const style = styleOf(screen.getByText('text'));

    expect(style.fontSize).toBe(30);
    expect(style.lineHeight).toBe(76);
  });

  it('leaves a size with no line height alone', async () => {
    // `code` has never had one, and inventing one here would change how it
    // looks at the default setting.
    getFontScale.mockReturnValue(2);

    const screen = await render(<ThemedText type="code">text</ThemedText>);

    expect(styleOf(screen.getByText('text')).lineHeight).toBeUndefined();
  });
});

describe('the cap on display text', () => {
  it('caps the two display sizes', async () => {
    getFontScale.mockReturnValue(1);

    for (const type of ['title', 'subtitle'] as const) {
      const screen = await render(<ThemedText type={type}>text</ThemedText>);

      expect(screen.getByText('text').props.maxFontSizeMultiplier).toBe(MAX_DISPLAY_FONT_SCALE);
    }
  });

  it('leaves body text uncapped', async () => {
    // Deliberate: this is the text somebody turned the setting up in order to
    // read. A headline at 96dp is correct and unusable; a paragraph at twice
    // the size is the feature working.
    getFontScale.mockReturnValue(1);

    for (const type of ['default', 'small', 'smallBold'] as const) {
      const screen = await render(<ThemedText type={type}>text</ThemedText>);

      expect(screen.getByText('text').props.maxFontSizeMultiplier).toBeUndefined();
    }
  });

  it('lets a caller override the cap', async () => {
    getFontScale.mockReturnValue(1);

    const screen = await render(
      <ThemedText type="title" maxFontSizeMultiplier={1}>
        text
      </ThemedText>
    );

    expect(screen.getByText('text').props.maxFontSizeMultiplier).toBe(1);
  });
});
