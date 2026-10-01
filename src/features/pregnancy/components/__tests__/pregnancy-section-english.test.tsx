import { render } from '@testing-library/react-native';
import React from 'react';

import type { PregnancyDashboard } from '../../application/get-pregnancy-dashboard';
import type { PregnancyWeeklyContent } from '../../domain/types';
import { pregnancyLabels } from '../../presentation/pregnancy-labels';
import { PregnancySection } from '../pregnancy-section';

import { toISODate } from '@/utils/date';

/**
 * The week stepper, on an English phone.
 *
 * ## Why this file exists
 *
 * It was written after an English phone was seen showing "9. hafta" on this
 * stepper, under an English heading, beside an English due date. The week was
 * built in the component as the JSX text `{shownWeek}. hafta` instead of coming
 * from the catalogue.
 *
 * Nothing in the repository could have caught that. The compiler cannot - JSX
 * text is valid JSX. The parity tests cannot - the string was never in a
 * catalogue for them to compare. `no-turkish-outside-catalogues` reads JSX text
 * and still missed it, because it matches Turkish-specific letters and "hafta"
 * has none; the rule states that blind spot and accepts it rather than
 * drowning in false positives on English prose.
 *
 * So the only thing that can catch a Turkish word spelled in plain ASCII is an
 * assertion that renders the component in English and looks. That is this file,
 * and it is the reason it asserts the absence as well as the presence: a
 * regression here would put the Turkish back without removing the English.
 *
 * The device is overridden here rather than globally, the same escape hatch
 * `jest/expo-localization-mock.js` documents for the other English files.
 */

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageTag: 'en-GB', languageCode: 'en' }],
  getCalendars: () => [{ calendar: 'gregory', uses24hourClock: true, firstWeekday: 2 }],
}));

jest.mock('expo-router', () => require('../../../../../jest/expo-router-mock'));

const content: PregnancyWeeklyContent = {
  week: 9,
  size: { label: 'about 22 mm', comparison: 'a strawberry' },
  developmentSummary: 'The face becomes more familiar.',
  developingFeatures: ['The features of the face sharpen'],
  sources: [{ name: 'NHS', url: 'https://www.nhs.uk/' }],
};

const dashboard: PregnancyDashboard = {
  today: toISODate('2026-10-01'),
  pregnancyDay: 4,
  pregnancyWeek: { week: 9, day: 4 },
  estimatedDueDate: toISODate('2027-05-10'),
  dueDateSource: 'lmp',
  weeklyContent: content,
};

async function renderSection(shownWeek: number) {
  return await render(
    <PregnancySection
      pregnancy={dashboard}
      shownWeek={shownWeek}
      shownContent={content}
      currentWeek={9}
      stepWeek={jest.fn()}
      openSource={jest.fn(async () => undefined)}
      hasSourceError={false}
      setPreviewWeek={jest.fn()}
      setHasSourceError={jest.fn()}
    />
  );
}

describe('past the fortieth week', () => {
  /** The same pregnancy, counted far enough forward to run out of content. */
  const pastDue: PregnancyDashboard = {
    ...dashboard,
    pregnancyDay: 295,
    pregnancyWeek: { week: 43, day: 1 },
    weeklyContent: null,
  };

  function renderPastDue() {
    return render(
      <PregnancySection
        pregnancy={pastDue}
        shownWeek={null}
        shownContent={null}
        currentWeek={null}
        stepWeek={jest.fn()}
        openSource={jest.fn(async () => undefined)}
        hasSourceError={false}
        setPreviewWeek={jest.fn()}
        setHasSourceError={jest.fn()}
      />
    );
  }

  it('says there is nothing further written, in English', async () => {
    // Before this, the section simply ended after the due date: no content, no
    // explanation, no way to tell whether the app had broken.
    const screen = await renderPastDue();

    expect(screen.getByText(pregnancyLabels.en.pastDueTitle)).toBeTruthy();
    expect(screen.getByText(pregnancyLabels.en.pastDueBody)).toBeTruthy();
  });

  it('offers the way back without taking it', async () => {
    // The link goes to the settings screen, where stopping is behind its own
    // confirmation. Nothing here calls `stopPregnancyTracking`: that function
    // deletes the record and throws when there is nothing to delete, so firing
    // it on a date boundary would destroy somebody's pregnancy record silently.
    const screen = await renderPastDue();

    expect(screen.getByLabelText(pregnancyLabels.en.pastDueReturnLabel)).toBeTruthy();
  });

  it('says nothing about a birth, a completion or a congratulation', async () => {
    // The app does not know whether a birth happened, whether the pregnancy
    // ended earlier, or how. Asserted rather than left to the wording, because
    // the wording is the only thing stopping it.
    const screen = await renderPastDue();
    const text = JSON.stringify(screen.toJSON());

    for (const word of ['congratulat', 'born', 'birth', 'complete', 'finished']) {
      expect(text.toLowerCase()).not.toContain(word);
    }
  });

  it('is absent while the pregnancy is still inside the weeks it has content for', async () => {
    const screen = await renderSection(9);

    expect(screen.queryByText(pregnancyLabels.en.pastDueTitle)).toBeNull();
  });
});

describe('the week stepper on an English phone', () => {
  it('names the shown week in English', async () => {
    const screen = await renderSection(9);

    expect(screen.getByText(pregnancyLabels.en.shownWeekTitle(9))).toBeTruthy();
  });

  it('does not show the Turkish form of the same week', async () => {
    // The actual regression. Written out rather than taken from the catalogue
    // so that renaming the Turkish entry cannot quietly make this pass.
    const screen = await renderSection(9);

    expect(screen.queryByText('9. hafta')).toBeNull();
  });

  it('follows the week it is given rather than the week the pregnancy is in', async () => {
    // The stepper's whole purpose: reading ahead without moving the pregnancy.
    const screen = await renderSection(12);

    expect(screen.getByText(pregnancyLabels.en.shownWeekTitle(12))).toBeTruthy();
    expect(screen.queryByText(pregnancyLabels.en.shownWeekTitle(9))).toBeNull();
  });
});
