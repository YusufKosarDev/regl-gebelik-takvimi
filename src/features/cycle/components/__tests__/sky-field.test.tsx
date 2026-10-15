import { Text } from 'react-native';
import { cancelAnimation, withRepeat } from 'react-native-reanimated';

import { Sky } from '@/constants/sky';
import { SkyField } from '../sky-field';

import { renderSettled, settle } from '../../../../../jest/render-settled';

/**
 * That the field actually stops.
 *
 * ## Why this is not covered by the hook's own tests
 *
 * `use-motion-allowed` is tested thoroughly, and all it proves is that the
 * answer is correct. Nothing there says the field does anything with it, and
 * under Jest a field that ignored the answer would look identical to one that
 * obeyed it - the Reanimated mock never animates, so there is no movement to
 * miss.
 *
 * The device cannot settle it either. Android's "Remove animations" sets the
 * global animation scales to zero, so a run on a phone shows the field holding
 * still whether that is this component or the system. Here the system is not
 * involved: the only thing that changed is the prop.
 */

const asMock = (fn: unknown) => fn as jest.Mock;

function render(motionAllowed: boolean) {
  return renderSettled(
    <SkyField
      colors={Sky.light.fields.follicular}
      bloomKey={0}
      driftColor={Sky.light.drift}
      bloomColor={Sky.light.bloom}
      motionAllowed={motionAllowed}
      testID="sky">
      <Text>day</Text>
    </SkyField>
  );
}

beforeEach(() => {
  asMock(withRepeat).mockClear();
  asMock(cancelAnimation).mockClear();
});

describe('when motion is allowed', () => {
  it('sets both sheets drifting', async () => {
    await render(true);

    // Two sheets, and they are the only repeating animations here.
    expect(asMock(withRepeat)).toHaveBeenCalledTimes(2);
    expect(asMock(cancelAnimation)).not.toHaveBeenCalled();
  });
});

describe('when motion is not allowed', () => {
  it('never starts the drift', async () => {
    await render(false);

    expect(asMock(withRepeat)).not.toHaveBeenCalled();
  });

  it('cancels both sheets rather than leaving them queued', async () => {
    await render(false);

    // Cancelled where they stand: a field that reset to a starting position
    // would be one last movement on the way to holding still.
    expect(asMock(cancelAnimation)).toHaveBeenCalledTimes(2);
  });

  it('still renders the day underneath', async () => {
    // Nothing is lost except the motion. A field that stopped by rendering
    // nothing would pass a test that only looked at the animation calls.
    const view = await render(false);

    expect(view.getByText('day')).toBeTruthy();
    expect(view.getByTestId('sky')).toBeTruthy();
  });
});

describe('turning the setting on while the screen is open', () => {
  it('stops a drift that had already started', async () => {
    const view = await render(true);
    expect(asMock(withRepeat)).toHaveBeenCalledTimes(2);

    // Awaited like every other render here: unawaited, its act scope stays
    // open and swallows the effects of whatever test runs next.
    await view.rerender(
      <SkyField
        colors={Sky.light.fields.follicular}
        bloomKey={0}
        driftColor={Sky.light.drift}
        bloomColor={Sky.light.bloom}
        motionAllowed={false}
        testID="sky">
        <Text>day</Text>
      </SkyField>
    );
    // Same reason `renderSettled` exists: the renderer is concurrent, so the
    // effect this re-render schedules has not run when `rerender` returns.
    await settle();

    expect(asMock(cancelAnimation)).toHaveBeenCalledTimes(2);
  });
});

/**
 * The bloom marks a recorded period, and nothing else.
 *
 * `useMotionAllowed` re-answers on every return to the foreground, so the
 * effect that fires the bloom re-runs then too. It used to flare on each of
 * those - every pocket-and-back replayed the one celebratory moment until it
 * meant nothing. Only the key moving is a period being recorded.
 */
describe('the bloom', () => {
  const { withSequence } = jest.requireMock('react-native-reanimated') as {
    withSequence: jest.Mock;
  };

  function field(motionAllowed: boolean, bloomKey: number) {
    return (
      <SkyField
        colors={Sky.light.fields.follicular}
        bloomKey={bloomKey}
        driftColor={Sky.light.drift}
        bloomColor={Sky.light.bloom}
        motionAllowed={motionAllowed}
        testID="sky">
        <Text>day</Text>
      </SkyField>
    );
  }

  beforeEach(() => {
    withSequence.mockClear();
  });

  it('does not replay when motion merely comes back', async () => {
    const view = await render(true);

    await view.rerender(field(false, 0));
    await settle();
    await view.rerender(field(true, 0));
    await settle();

    expect(withSequence).not.toHaveBeenCalled();
  });

  it('plays when the key moves', async () => {
    const view = await render(true);

    await view.rerender(field(true, 1));
    await settle();

    expect(withSequence).toHaveBeenCalledTimes(1);
  });

  it('does not play for the mount itself', async () => {
    await render(true);

    expect(withSequence).not.toHaveBeenCalled();
  });
});
