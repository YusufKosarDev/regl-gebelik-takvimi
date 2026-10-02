import { render } from '@testing-library/react-native';

import type { CycleRingDot } from '../../application/build-cycle-day-ring';
import { CycleDayRing } from '../cycle-day-ring';

/**
 * The ring draws what `build-cycle-day-ring.ts` worked out, so the arithmetic
 * is tested there and not here. What is tested here is the two things about
 * this component that other tests depend on without naming it: that it adds no
 * button, and that it is readable to a screen reader without reading out sixty
 * dots on the way.
 */

function dotsOf(count: number, elapsed: number): CycleRingDot[] {
  return Array.from({ length: count }, (_, index) => ({
    day: index + 1,
    phase: index < elapsed ? 'luteal' : null,
    isElapsed: index < elapsed,
    isToday: index === elapsed - 1,
  }));
}

function renderRing() {
  return render(
    <CycleDayRing
      dots={dotsOf(28, 17)}
      phase="luteal"
      dayLabel="Döngü günü"
      dayValue="17. gün"
      dayAccessibilityLabel="Döngü günü: 17. gün"
      phaseLabel="Döngü evresi"
      phaseValue="Luteal"
      phaseAccessibilityLabel="Döngü evresi: Luteal"
    />
  );
}

describe('what the ring says', () => {
  it('shows each fact exactly once', async () => {
    // Once matters as much as at all. These four strings are looked for with
    // `getByText` across the home screen tests, which fails on a second copy,
    // and the rows this replaced showed them once.
    const { getAllByText } = await renderRing();

    for (const text of ['Döngü günü', '17. gün', 'Döngü evresi', 'Luteal']) {
      expect([text, (await getAllByText(text)).length]).toEqual([text, 1]);
    }
  });

  it('reads each fact as one sentence', async () => {
    // A label and a value are one thing to the eye and should be one stop to a
    // screen reader, rather than two that have to be assembled by the listener.
    const { getByLabelText } = await renderRing();

    expect(getByLabelText('Döngü günü: 17. gün')).toBeTruthy();
    expect(getByLabelText('Döngü evresi: Luteal')).toBeTruthy();
  });
});

describe('what the ring must not do', () => {
  it('adds no control', async () => {
    // Load-bearing. Five tests pin the exact ordered list of every button on a
    // screen by mapping `queryAllByRole('button')`, and the home screen's list
    // is nine long. A ring that gained a role would enter that list and break
    // all five at once. There is nothing to press here: it reports.
    const { queryAllByRole } = await renderRing();

    expect(queryAllByRole('button')).toHaveLength(0);
  });

  it('keeps the facts out of the hidden decoration', async () => {
    // The dots are hidden from assistive technology, and the first version of
    // this component wrapped the whole ring in that hiding - which took the
    // two sentences with it. Thirty-eight home screen tests failed on it,
    // because a hidden subtree is hidden from text queries too. This is the
    // assertion that says why the hiding sits where it does.
    const { getByText } = await renderRing();

    expect(getByText('17. gün')).toBeTruthy();
  });
});

describe('a cycle nobody has recorded yet', () => {
  it('draws the ring anyway', async () => {
    // `phase` is null before the first record, and a null phase must not take
    // the colour prop down with it.
    const { getByText } = await render(
      <CycleDayRing
        dots={dotsOf(28, 0)}
        phase={null}
        dayLabel="Döngü günü"
        dayValue="Henüz başlamadı"
        dayAccessibilityLabel="Döngü günü: Henüz başlamadı"
        phaseLabel="Döngü evresi"
        phaseValue="Bilinmiyor"
        phaseAccessibilityLabel="Döngü evresi: Bilinmiyor"
      />
    );

    expect(getByText('Henüz başlamadı')).toBeTruthy();
    expect(getByText('Bilinmiyor')).toBeTruthy();
  });
});
