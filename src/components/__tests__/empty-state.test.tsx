import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { Sky } from '@/constants/sky';
import { OnSkyProvider } from '@/features/cycle/components/on-sky';

import { EmptyState } from '../empty-state';

/**
 * What a screen says when it has nothing to show.
 *
 * Ours. The app already had nine of these and every one of them was a
 * sentence: true, quiet, and offering nothing. The one on the home screen is
 * the one that matters - somebody with no cycle recorded reads "no cycle
 * information found" on a screen with no way to supply any.
 *
 * So the part that is new is the way out. A message with no action is still
 * allowed, and is right where there genuinely is nothing to do - but it has to
 * be a decision rather than the default.
 */
describe('EmptyState', () => {
  it('says what is missing', async () => {
    const { getByText } = await render(<EmptyState message="Döngü bilgisi bulunamadı." />);

    expect(getByText('Döngü bilgisi bulunamadı.')).toBeTruthy();
  });

  it('offers the way out when there is one', async () => {
    const onPress = jest.fn();
    const { getByLabelText } = await render(
      <EmptyState
        message="Döngü bilgisi bulunamadı."
        actionLabel="Son regl tarihimi gir"
        onAction={onPress}
      />
    );

    await fireEvent.press(getByLabelText('Son regl tarihimi gir'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('offers nothing when there is nothing to offer', async () => {
    // Message-only stays available on purpose: an export screen with no
    // records has nothing for a button to do, and inventing one would be
    // worse than the sentence.
    const { queryAllByRole } = await render(<EmptyState message="Dışa aktarılacak kayıt yok." />);

    expect(queryAllByRole('button')).toHaveLength(0);
  });

  it('writes on a field in the field ink', async () => {
    // The home screen's empty state is drawn on the waking sky. A page colour
    // there measures 1.97:1 on the light fields - the mistake `sky.ts` was
    // written about.
    const { getByText } = await render(
      <OnSkyProvider value>
        <EmptyState message="Döngü bilgisi bulunamadı." />
      </OnSkyProvider>
    );

    expect(getByText('Döngü bilgisi bulunamadı.').props.style.color).toBe(Sky.light.ink);
  });

  it('gives the action a target big enough to hit', async () => {
    const { getByLabelText } = await render(
      <EmptyState message="x" actionLabel="Son regl tarihimi gir" onAction={() => {}} />
    );

    const style = StyleSheet.flatten(getByLabelText('Son regl tarihimi gir').props.style);

    expect(style?.minHeight).toBeGreaterThanOrEqual(48);
  });
});
