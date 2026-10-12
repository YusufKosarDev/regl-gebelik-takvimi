import { readFileSync } from 'fs';
import { join } from 'path';

import { render } from '@testing-library/react-native';
import React from 'react';

import WelcomeScreen from '@/app/(onboarding)/index';
import { onboardingMessages } from '../presentation/onboarding-messages';

/**
 * The first screen, on an English phone.
 *
 * ## Why this screen and not all seven
 *
 * The chain from a device reporting English to a rendered English string is the
 * same for every screen in the flow, and it is already proved end to end by
 * `daily-entry-screen-english.test.tsx`. What is worth proving again here is
 * narrower: that this screen reads its words through the catalogue rather than
 * holding any of its own, and that it is a screen nobody can escape from.
 *
 * Somebody on an English phone reaches this before there is any way to change
 * the language - the picker is in settings, which is behind finishing
 * onboarding. If this screen were half-translated there would be no way out of
 * it, which is why it gets the assertion the other six do not.
 *
 * The device is overridden here rather than globally.
 * `jest/expo-localization-mock.js` pins the suite to a Turkish phone; this file
 * says otherwise for itself, which is the escape hatch that mock documents.
 */

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageTag: 'en-GB', languageCode: 'en' }],
  getCalendars: () => [{ calendar: 'gregory', uses24hourClock: true, firstWeekday: 2 }],
}));

jest.mock('expo-router', () => require('../../../../jest/expo-router-mock'));

describe('the welcome screen in English', () => {
  it('shows the title and the description in English', async () => {
    const screen = await render(<WelcomeScreen />);

    expect(screen.getByText(onboardingMessages.en.welcomeTitle)).toBeTruthy();
    expect(screen.getByText(onboardingMessages.en.welcomeDescription)).toBeTruthy();
  });

  it('offers the way forward in English', async () => {
    const screen = await render(<WelcomeScreen />);

    expect(screen.getByLabelText(onboardingMessages.en.welcomeStartLabel)).toBeTruthy();
  });

  it('still says predictions are not medical advice', async () => {
    // The one sentence on this screen that is not navigation.
    const screen = await render(<WelcomeScreen />);

    expect(screen.getByText(onboardingMessages.en.welcomeNote)).toBeTruthy();
  });

  it('shows no Turkish anywhere', async () => {
    // Including the back label and anything else it does not own. There is no
    // way to change the language from here, so there is nothing to leave until
    // later.
    const screen = await render(<WelcomeScreen />);

    expect(JSON.stringify(screen.toJSON())).not.toMatch(/[ğüşıöçĞÜŞİÖÇ]/);
  });
});

/**
 * The first screen does not push its text to the bottom.
 *
 * `scrollContent` was `justifyContent: 'flex-end'`, and the button lives in
 * its own footer outside the scroll view, so the only thing that alignment
 * moved was the words. On a device the headline, the description and the note
 * sat just above the footer with roughly half the screen empty above them.
 *
 * No rationale was written for it, in a file that explains its other choices -
 * the text alignment and the button's colour both have notes. So it is read as
 * an oversight rather than a decision, and centring is the smaller change: the
 * reading order is untouched and the action stays where it was.
 *
 * Asserted on the style rather than on a screenshot, because nothing in Jest
 * has a screen height. Whether it looks right is a device check.
 */
describe('where the welcome text sits', () => {
  const source = readFileSync(
    join(__dirname, '..', '..', '..', 'app', '(onboarding)', 'index.tsx'),
    'utf8'
  );

  it('does not pin the text to the foot of the screen', () => {
    const block = /scrollContent:\s*\{[^}]*\}/s.exec(source)?.[0] ?? '';

    expect(block).not.toBe('');
    expect(block.replace(/\/\/[^\n]*/g, '')).not.toMatch(/justifyContent:\s*'flex-end'/);
  });

  it('keeps the action in a footer of its own, where it already was', () => {
    // The fix must not have moved the button: it is outside the scroll view
    // and the alignment never applied to it.
    expect(source).toMatch(/<View style={styles\.footer}>/);
    expect(/footer:\s*\{[^}]*\}/s.exec(source)?.[0] ?? '').not.toMatch(/justifyContent/);
  });
});
