import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { SectionHeading } from '../section-heading';

/**
 * A section's name, with what it is for folded up behind it.
 *
 * Taken from Cycles, which puts an (i) beside every section of its log. What
 * the explanation is actually carrying here is whether the section takes one
 * answer or several - which the app otherwise says only to a screen reader,
 * through `radio` against `checkbox`, and not at all to anybody looking at it.
 *
 * Folded rather than printed: three sections with a sentence each turns a form
 * somebody fills in daily into a page they scroll past.
 */
function renderHeading(onPress = () => {}) {
  return render(
    <SectionHeading
      title="Akış"
      explanation="Kanamanın o günkü yoğunluğu. Tek seçim."
      toggleLabel="Akış hakkında"
      onToggle={onPress}
      isOpen={false}
    />
  );
}

describe('SectionHeading', () => {
  it('shows the section name as a heading', async () => {
    const { getByRole } = await renderHeading();

    expect(getByRole('header', { name: 'Akış' })).toBeTruthy();
  });

  it('keeps the explanation folded up until it is asked for', async () => {
    const { queryByText } = await renderHeading();

    expect(queryByText('Kanamanın o günkü yoğunluğu. Tek seçim.')).toBeNull();
  });

  it('shows the explanation when it is open', async () => {
    const { getByText } = await render(
      <SectionHeading
        title="Akış"
        explanation="Kanamanın o günkü yoğunluğu. Tek seçim."
        toggleLabel="Akış hakkında"
        onToggle={() => {}}
        isOpen
      />
    );

    expect(getByText('Kanamanın o günkü yoğunluğu. Tek seçim.')).toBeTruthy();
  });

  it('asks to be opened when the toggle is pressed', async () => {
    const onToggle = jest.fn();
    const { getByLabelText } = await renderHeading(onToggle);

    await fireEvent.press(getByLabelText('Akış hakkında'));

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('says whether it is open, rather than only looking it', async () => {
    const closed = await renderHeading();

    expect(closed.getByLabelText('Akış hakkında').props.accessibilityState.expanded).toBe(false);

    const open = await render(
      <SectionHeading
        title="Akış"
        explanation="x"
        toggleLabel="Akış hakkında"
        onToggle={() => {}}
        isOpen
      />
    );

    expect(open.getByLabelText('Akış hakkında').props.accessibilityState.expanded).toBe(true);
  });

  it('gives the toggle a target big enough to hit', async () => {
    const { getByLabelText } = await renderHeading();

    expect(
      StyleSheet.flatten(getByLabelText('Akış hakkında').props.style)?.minHeight
    ).toBeGreaterThanOrEqual(44);
  });

  it('keeps the heading out of the button', async () => {
    // The section name stays a heading so a screen reader can jump between
    // sections. Wrapping it in the button would have cost that for the sake of
    // a bigger tap target on something that is not the point of the screen.
    const { getByLabelText } = await renderHeading();

    expect(getByLabelText('Akış hakkında').props.accessibilityLabel).not.toContain('Akış hakkında Akış');
  });
});
