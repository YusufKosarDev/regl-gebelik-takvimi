import { render } from '@testing-library/react-native';

import { MostLoggedList } from '../most-logged-list';

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
      <MostLoggedList symptoms={[{ id: 'cramps', count: 11 }]} moods={[]} />
    );

    expect(getByText('Kramp')).toBeTruthy();
    expect(getByText('11 gün')).toBeTruthy();
  });

  it('reads as one sentence to a screen reader rather than two stops', async () => {
    // A label and a number read as two separate stops is a row somebody has
    // to assemble in their head.
    const { getByLabelText } = await render(
      <MostLoggedList symptoms={[{ id: 'cramps', count: 11 }]} moods={[]} />
    );

    expect(getByLabelText('Kramp: 11 gün')).toBeTruthy();
  });

  it('shows moods alongside symptoms', async () => {
    const { getByText } = await render(
      <MostLoggedList symptoms={[]} moods={[{ id: 'bad', count: 4 }]} />
    );

    expect(getByText('4 gün')).toBeTruthy();
  });

  it('says there is nothing yet rather than drawing an empty block', async () => {
    // A blank panel reads as the screen having failed. The same rule
    // `PhaseCorrelationSummary` already keeps.
    const { getByText } = await render(<MostLoggedList symptoms={[]} moods={[]} />);

    expect(getByText('Henüz kayıt yok.')).toBeTruthy();
  });

  it('skips a thing this language has no word for', async () => {
    // A retired catalogue entry that a stored day still names. The day is
    // real; there is nothing to call it, so the row is left out rather than
    // drawn as a raw id.
    const { queryByText } = await render(
      <MostLoggedList symptoms={[{ id: 'retired-nonsense', count: 9 }]} moods={[]} />
    );

    expect(queryByText('9 gün')).toBeNull();
  });
});
