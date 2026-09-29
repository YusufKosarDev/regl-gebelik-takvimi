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
