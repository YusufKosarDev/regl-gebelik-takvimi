import { render } from '@testing-library/react-native';

import { MostLoggedList } from '../most-logged-list';
import { dailyLogCatalogueLabels } from '../../presentation/daily-log-catalogues';
import { dailyLogMessages } from '../../presentation/daily-log-messages';

/**
 * The answer, before any chart.
 *
 * Cycles opens its insights tab with rows like "Stressed 11 x" rather than
 * with a graph, and that order is the part worth taking: somebody opening this
 * screen has a question, and a chart makes them do the work of answering it.
 *
 * The number is days, and the wording says days. It is how often something was
 * written down - not how often it happened, which this app cannot know and
 * must not imply.
 */
describe('MostLoggedList', () => {
  it('shows each thing with the number of days it was written on', async () => {
    const { getByText } = await render(
      <MostLoggedList flows={[]} symptoms={[{ id: 'cramps', count: 11 }]} moods={[]} />
    );

    expect(getByText('Kramp')).toBeTruthy();
    expect(getByText('11 gün')).toBeTruthy();
  });

  it('reads as one sentence to a screen reader rather than two stops', async () => {
    // A label and a number read as two separate stops is a row somebody has
    // to assemble in their head.
    const { getByLabelText } = await render(
      <MostLoggedList flows={[]} symptoms={[{ id: 'cramps', count: 11 }]} moods={[]} />
    );

    expect(getByLabelText('Kramp: 11 gün')).toBeTruthy();
  });

  it('shows moods alongside symptoms', async () => {
    const { getByText } = await render(
      <MostLoggedList flows={[]} symptoms={[]} moods={[{ id: 'bad', count: 4 }]} />
    );

    expect(getByText('4 gün')).toBeTruthy();
  });

  it('says there is nothing yet rather than drawing an empty block', async () => {
    // A blank panel reads as the screen having failed. The same rule
    // `PhaseCorrelationSummary` already keeps.
    const { getByText } = await render(<MostLoggedList flows={[]} symptoms={[]} moods={[]} />);

    expect(getByText('Henüz kayıt yok.')).toBeTruthy();
  });

  it('skips a thing this language has no word for', async () => {
    // A retired catalogue entry that a stored day still names. The day is
    // real; there is nothing to call it, so the row is left out rather than
    // drawn as a raw id.
    const { queryByText } = await render(
      <MostLoggedList flows={[]} symptoms={[{ id: 'retired-nonsense', count: 9 }]} moods={[]} />
    );

    expect(queryByText('9 gün')).toBeNull();
  });

  /**
   * The three groups are named, and named with the editor's own words.
   *
   * The list used to concatenate symptoms and moods, so "Kramp" and "İyi" sat
   * in one column with nothing saying that one is something that happened and
   * the other is how the day felt. What the headings are matters as much as
   * that they exist: somebody filled in sections called Akış, Belirtiler and
   * Ruh hali, and a count of what they wrote should use those same words.
   */
  it('names each group with the word the editor uses for it', async () => {
    const { getByText } = await render(
      <MostLoggedList
        flows={[{ id: 'medium', count: 11 }]}
        symptoms={[{ id: 'cramps', count: 9 }]}
        moods={[{ id: 'good', count: 4 }]}
      />
    );

    expect(getByText(dailyLogMessages.tr.flowSectionTitle)).toBeTruthy();
    expect(getByText(dailyLogMessages.tr.symptomsSectionTitle)).toBeTruthy();
    expect(getByText(dailyLogMessages.tr.moodSectionTitle)).toBeTruthy();
  });

  /**
   * Flow is counted at all.
   *
   * It was the one of the three kinds of thing a day holds that never reached
   * this screen: `history.tsx` passed `symptomIds` and `moodId` and nothing
   * else, so somebody who recorded a period every month saw no sign of it in
   * what they log most.
   */
  it('counts flow, with the word for that flow', async () => {
    const { getByText, getByLabelText } = await render(
      <MostLoggedList flows={[{ id: 'medium', count: 11 }]} symptoms={[]} moods={[]} />
    );

    expect(getByText(dailyLogCatalogueLabels.tr.flows.medium)).toBeTruthy();
    expect(
      getByLabelText(`${dailyLogCatalogueLabels.tr.flows.medium}: 11 gün`)
    ).toBeTruthy();
  });

  /**
   * A group with nothing in it is absent, not an empty heading.
   *
   * "Akış" over no rows says less than no heading at all, and on a screen
   * whose job is to answer a question it reads as a block that failed to
   * load.
   */
  it('leaves out a group that has nothing in it', async () => {
    const { queryByText } = await render(
      <MostLoggedList flows={[]} symptoms={[{ id: 'cramps', count: 9 }]} moods={[]} />
    );

    expect(queryByText(dailyLogMessages.tr.flowSectionTitle)).toBeNull();
    expect(queryByText(dailyLogMessages.tr.moodSectionTitle)).toBeNull();
    expect(queryByText(dailyLogMessages.tr.symptomsSectionTitle)).toBeTruthy();
  });

  /**
   * Each group reads its own catalogue.
   *
   * The merged version looked an id up in the symptoms and fell through to the
   * moods, which works only while no two catalogues share an id. A mood id
   * handed in as a symptom came out labelled rather than dropped - and a
   * shared id would have come out as the wrong word entirely.
   */
  it('does not label a symptom from the mood catalogue', async () => {
    const { queryByText } = await render(
      <MostLoggedList flows={[]} symptoms={[{ id: 'good', count: 7 }]} moods={[]} />
    );

    expect(queryByText(dailyLogCatalogueLabels.tr.moods.good)).toBeNull();
    expect(queryByText('7 gün')).toBeNull();
  });
});
