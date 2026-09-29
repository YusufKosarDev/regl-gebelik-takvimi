import { describeCatalogueParity } from '../../../../../jest/catalogue-parity';
import type { PregnancyDashboard } from '../../application/get-pregnancy-dashboard';
import type { PregnancyWeeklyContent } from '../../domain/types';
import {
  dueDateSourceLabelIn,
  pregnancyLabels,
  pregnancyProgressLabelIn,
  weeklyHighlightIn,
} from '../pregnancy-labels';

/** What the three pregnancy screens say, in both languages. */

describe('parity', () => {
  describeCatalogueParity(pregnancyLabels, {
    functions: [
      ['progress', [1, 1], [12, 3]],
      ['weeklyHighlightWithSize', ['A lime', 'about 6 cm', 'Fingers are forming.']],
      ['selectedLmpLabel', ['17 September 2026']],
      ['pregnancyWeekRowLabel', ['Week 12, day 3']],
      ['pregnancyDueDateRowLabel', ['23 April 2027', 'From your last period']],
      ['shownWeekLabel', [12]],
      ['thisWeekLabel', ['Fingers are forming.']],
      ['developmentsLabel', [['Fingers', 'Toes']]],
      ['pregnancySourceLabel', ['NHS']],
      ['selectedDueDateLabel', ['23 April 2027']],
    ],
    // Both are a ": " join of values already translated by their callers.
    identical: ['weeklyHighlightWithSize'],
  });
});

describe('counting weeks and days', () => {
  it('puts the number first in Turkish and the noun first in English', () => {
    // Turkish counts with an ordinal suffix and no noun in front; English needs
    // the noun first. Neither is the other with the words swapped.
    expect(pregnancyLabels.tr.progress(12, 3)).toBe('12. hafta 3. gün');
    expect(pregnancyLabels.en.progress(12, 3)).toBe('Week 12, day 3');
  });

  it('says so rather than showing week zero before the pregnancy starts', () => {
    // A stored pregnancy whose last period has not arrived yet has no progress
    // to report, and a negative day would be worse than a sentence.
    const notStarted = { pregnancyWeek: null } as PregnancyDashboard;

    expect(pregnancyProgressLabelIn(pregnancyLabels.en, notStarted)).toBe(
      pregnancyLabels.en.notStartedMessage
    );
    expect(pregnancyProgressLabelIn(pregnancyLabels.en, notStarted)).not.toMatch(/0/);
  });

  it('reports the week once there is one', () => {
    const dashboard = { pregnancyWeek: { week: 12, day: 3 } } as PregnancyDashboard;

    expect(pregnancyProgressLabelIn(pregnancyLabels.en, dashboard)).toBe('Week 12, day 3');
  });
});

describe('where the due date came from', () => {
  it('keeps an adjusted date from reading as a calculated one', () => {
    // Somebody who moved the date should be able to tell that they did.
    for (const labels of [pregnancyLabels.tr, pregnancyLabels.en]) {
      expect(dueDateSourceLabelIn(labels, 'adjusted')).not.toBe(
        dueDateSourceLabelIn(labels, 'lmp')
      );
    }
  });

  it('names the last period as the source in English', () => {
    expect(dueDateSourceLabelIn(pregnancyLabels.en, 'lmp')).toMatch(/last period/i);
  });
});

describe('the week in one line', () => {
  const content = (size?: { label: string; comparison: string }): PregnancyWeeklyContent =>
    ({
      developmentSummary: 'Fingers are forming.',
      size,
    }) as PregnancyWeeklyContent;

  it('leads with the size when there is one', () => {
    // A screen reader would otherwise have to reach the summary to get any
    // sense of it.
    expect(
      weeklyHighlightIn(pregnancyLabels.en, content({ label: 'A lime', comparison: 'about 6 cm' }))
    ).toBe('A lime — about 6 cm. Fingers are forming.');
  });

  it('is just the summary when there is no size', () => {
    expect(weeklyHighlightIn(pregnancyLabels.en, content())).toBe('Fingers are forming.');
  });
});

describe('stopping', () => {
  it('still says what stopping deletes, in both languages', () => {
    expect(pregnancyLabels.en.pregnancyStopConsequence).toMatch(/deleted/i);
    expect(pregnancyLabels.tr.pregnancyStopConsequence).toMatch(/silinecek/);
  });

  it('asks before it says what it costs', () => {
    expect(pregnancyLabels.en.pregnancyStopQuestion).toMatch(/\?$/);
    expect(pregnancyLabels.tr.pregnancyStopQuestion).toMatch(/\?$/);
  });
});
