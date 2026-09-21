import { fireEvent, render } from '@testing-library/react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import LastPeriodScreen from '@/app/(onboarding)/last-period';
import type { ISODate } from '@/types/iso-date';
import { getTodayLocalISODate } from '@/utils/today';

jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
  useLocalSearchParams: jest.fn(),
}));

// The clock is the one non-deterministic input; pin it per test.
jest.mock('@/utils/today', () => ({
  getTodayLocalISODate: jest.fn(),
}));

// Guards: this step must not reach any of these layers yet.
jest.mock('@/storage/app-state-storage', () => ({
  loadAppState: jest.fn(),
  saveAppState: jest.fn(),
  clearAppState: jest.fn(),
}));

jest.mock('@/storage/db', () => ({
  openAppDatabase: jest.fn(),
  DATABASE_NAME: 'regl-gebelik.db',
}));

jest.mock('@/features/cycle/data/cycle-repository', () => ({
  saveCycleProfile: jest.fn(),
  loadCycleProfile: jest.fn(),
}));

jest.mock('@/features/cycle/application/complete-cycle-onboarding', () => ({
  completeCycleOnboarding: jest.fn(),
}));

const useRouterMock = useRouter as unknown as jest.Mock;
const useLocalSearchParamsMock = useLocalSearchParams as unknown as jest.Mock;
const getTodayMock = getTodayLocalISODate as unknown as jest.Mock;
const appStateStorage = jest.requireMock('@/storage/app-state-storage');
const db = jest.requireMock('@/storage/db');
const repository = jest.requireMock('@/features/cycle/data/cycle-repository');
const useCase = jest.requireMock('@/features/cycle/application/complete-cycle-onboarding');

let push: jest.Mock;

/** Counts host nodes of a given type in a rendered tree. */
function countHostNodes(node: unknown, type: string): number {
  if (node === null || typeof node !== 'object') {
    return 0;
  }

  if (Array.isArray(node)) {
    return node.reduce<number>((total, child) => total + countHostNodes(child, type), 0);
  }

  const element = node as { type?: string; children?: unknown };
  const self = element.type === type ? 1 : 0;

  return self + countHostNodes(element.children, type);
}

beforeEach(() => {
  push = jest.fn();
  useRouterMock.mockReset();
  useRouterMock.mockReturnValue({ push, replace: jest.fn(), back: jest.fn() });
  useLocalSearchParamsMock.mockReset();
  useLocalSearchParamsMock.mockReturnValue({ cycleLength: '28', periodLength: '5' });
  getTodayMock.mockReset();
  getTodayMock.mockReturnValue('2026-09-17' as ISODate);

  for (const fn of [
    appStateStorage.loadAppState,
    appStateStorage.saveAppState,
    appStateStorage.clearAppState,
    db.openAppDatabase,
    repository.saveCycleProfile,
    repository.loadCycleProfile,
    useCase.completeCycleOnboarding,
  ]) {
    (fn as jest.Mock).mockReset();
  }
});

type ScreenOptions = {
  today?: string;
  cycleLength?: unknown;
  periodLength?: unknown;
};

async function renderScreen(options: ScreenOptions = {}) {
  const { today = '2026-09-17', cycleLength = '28', periodLength = '5' } = options;

  getTodayMock.mockReturnValue(today as ISODate);
  useLocalSearchParamsMock.mockReturnValue({ cycleLength, periodLength });

  const screen = await render(<LastPeriodScreen />);

  return {
    ...screen,
    previous: () => screen.getByRole('button', { name: 'Önceki günü seç' }),
    next: () => screen.getByRole('button', { name: 'Sonraki günü seç' }),
    submit: () => screen.getByRole('button', { name: 'Devam' }),
  };
}

/** Presses a button n times, re-querying so the latest state is used each time. */
async function pressTimes(getButton: () => unknown, times: number): Promise<void> {
  for (let i = 0; i < times; i += 1) {
    await fireEvent.press(getButton() as never);
  }
}

describe('LastPeriodScreen content', () => {
  it('renders the question', async () => {
    const { getByText } = await renderScreen();

    expect(getByText('Son regl dönemin ne zaman başladı?')).toBeTruthy();
  });

  it('renders the explanation', async () => {
    const { getByText } = await renderScreen();

    expect(getByText('Kanamanın başladığı ilk günü seç.')).toBeTruthy();
  });

  it('starts on today', async () => {
    const { getByText } = await renderScreen({ today: '2026-09-17' });

    expect(getByText('17 Eylül 2026')).toBeTruthy();
  });

  it('reads today from the clock helper exactly once', async () => {
    await renderScreen();

    expect(getTodayMock).toHaveBeenCalledTimes(1);
  });
});

describe('LastPeriodScreen date selection', () => {
  it('steps back one day', async () => {
    const { previous, getByText } = await renderScreen({ today: '2026-09-17' });

    await fireEvent.press(previous());

    expect(getByText('16 Eylül 2026')).toBeTruthy();
  });

  it('keeps stepping back', async () => {
    const { previous, getByText } = await renderScreen({ today: '2026-09-17' });

    await pressTimes(previous, 5);

    expect(getByText('12 Eylül 2026')).toBeTruthy();
  });

  it('steps forward again', async () => {
    const { previous, next, getByText } = await renderScreen({ today: '2026-09-17' });

    await pressTimes(previous, 3);
    await fireEvent.press(next());

    expect(getByText('15 Eylül 2026')).toBeTruthy();
  });

  it('disables the next day on today', async () => {
    const { next } = await renderScreen({ today: '2026-09-17' });

    expect(next().props.accessibilityState.disabled).toBe(true);
  });

  it('enables the next day once in the past', async () => {
    const { previous, next } = await renderScreen({ today: '2026-09-17' });

    await fireEvent.press(previous());

    expect(next().props.accessibilityState.disabled).toBe(false);
  });

  it('never moves past today', async () => {
    const { previous, next, getByText } = await renderScreen({ today: '2026-09-17' });

    await fireEvent.press(previous());
    await pressTimes(next, 5);

    expect(getByText('17 Eylül 2026')).toBeTruthy();
  });

  it('keeps the previous day always available', async () => {
    const { previous } = await renderScreen({ today: '2026-09-17' });

    expect(previous().props.accessibilityState.disabled).toBe(false);

    await pressTimes(previous, 40);

    expect(previous().props.accessibilityState.disabled).toBe(false);
  });

  it('exposes the selected date to assistive technology', async () => {
    const { getByLabelText, previous } = await renderScreen({ today: '2026-09-17' });

    expect(getByLabelText('Seçili tarih: 17 Eylül 2026')).toBeTruthy();

    await fireEvent.press(previous());

    expect(getByLabelText('Seçili tarih: 16 Eylül 2026')).toBeTruthy();
  });
});

describe('LastPeriodScreen date boundaries', () => {
  it('crosses a month boundary', async () => {
    const { previous, getByText } = await renderScreen({ today: '2026-03-01' });

    await fireEvent.press(previous());

    expect(getByText('28 Şubat 2026')).toBeTruthy();
  });

  it('crosses a year boundary', async () => {
    const { previous, getByText } = await renderScreen({ today: '2026-01-01' });

    await fireEvent.press(previous());

    expect(getByText('31 Aralık 2025')).toBeTruthy();
  });

  it('lands on a leap day', async () => {
    const { previous, getByText } = await renderScreen({ today: '2024-03-01' });

    await fireEvent.press(previous());

    expect(getByText('29 Şubat 2024')).toBeTruthy();
  });

  it('steps back across a leap day and forward again', async () => {
    const { previous, next, getByText } = await renderScreen({ today: '2024-03-01' });

    await pressTimes(previous, 2);
    expect(getByText('28 Şubat 2024')).toBeTruthy();

    await fireEvent.press(next());
    expect(getByText('29 Şubat 2024')).toBeTruthy();
  });
});

describe('LastPeriodScreen navigation', () => {
  it('forwards all three values', async () => {
    const { submit } = await renderScreen({ today: '2026-09-17' });

    await fireEvent.press(submit());

    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith({
      pathname: '/(onboarding)/review',
      params: {
        cycleLength: '28',
        periodLength: '5',
        lastPeriodStartDate: '2026-09-17',
      },
    });
  });

  it('forwards the selected past date', async () => {
    const { previous, submit } = await renderScreen({ today: '2026-09-17' });

    await pressTimes(previous, 7);
    await fireEvent.press(submit());

    expect(push).toHaveBeenCalledWith({
      pathname: '/(onboarding)/review',
      params: {
        cycleLength: '28',
        periodLength: '5',
        lastPeriodStartDate: '2026-09-10',
      },
    });
  });

  it('keeps the incoming values untouched', async () => {
    const { submit } = await renderScreen({
      today: '2026-09-17',
      cycleLength: '35',
      periodLength: '7',
    });

    await fireEvent.press(submit());

    expect(push).toHaveBeenCalledWith({
      pathname: '/(onboarding)/review',
      params: {
        cycleLength: '35',
        periodLength: '7',
        lastPeriodStartDate: '2026-09-17',
      },
    });
  });

  it('navigates only when the primary action is pressed', async () => {
    const { previous } = await renderScreen();

    await fireEvent.press(previous());

    expect(push).not.toHaveBeenCalled();
  });
});

describe('LastPeriodScreen with unusable params', () => {
  it.each<[string, unknown, unknown]>([
    ['a missing cycle length', undefined, '5'],
    ['a non-numeric cycle length', 'abc', '5'],
    ['a cycle length below the minimum', '14', '5'],
    ['a cycle length above the maximum', '91', '5'],
    ['an array cycle length', ['28'], '5'],
    ['a missing period length', '28', undefined],
    ['a non-numeric period length', '28', 'abc'],
    ['a zero period length', '28', '0'],
    ['a period length above the maximum', '28', '21'],
    ['a non-integer period length', '28', '5.5'],
    ['an array period length', '28', ['5']],
    ['a period longer than the cycle', '15', '16'],
  ])('shows the error screen for %s', async (_label, cycleLength, periodLength) => {
    useLocalSearchParamsMock.mockReturnValue({ cycleLength, periodLength });

    const { getByText } = await render(<LastPeriodScreen />);

    expect(getByText('Geçersiz döngü bilgisi.')).toBeTruthy();
  });

  it('offers no controls', async () => {
    useLocalSearchParamsMock.mockReturnValue({ cycleLength: 'abc', periodLength: '5' });

    const { queryAllByRole, queryByText } = await render(<LastPeriodScreen />);

    expect(queryAllByRole('button')).toHaveLength(0);
    expect(queryByText('Devam')).toBeNull();
    expect(queryByText('Önceki gün')).toBeNull();
    expect(queryByText('Sonraki gün')).toBeNull();
  });

  it('does not navigate or touch any other layer', async () => {
    useLocalSearchParamsMock.mockReturnValue({ cycleLength: '28', periodLength: '21' });

    await render(<LastPeriodScreen />);

    expect(push).not.toHaveBeenCalled();
    expect(appStateStorage.saveAppState).not.toHaveBeenCalled();
    expect(db.openAppDatabase).not.toHaveBeenCalled();
    expect(repository.saveCycleProfile).not.toHaveBeenCalled();
    expect(useCase.completeCycleOnboarding).not.toHaveBeenCalled();
  });
});

describe('LastPeriodScreen scope', () => {
  it('uses no text inputs', async () => {
    const { toJSON } = await renderScreen();

    expect(countHostNodes(toJSON(), 'TextInput')).toBe(0);
  });

  it('touches no storage, repository or use case', async () => {
    const { previous, next, submit } = await renderScreen();

    await fireEvent.press(previous());
    await fireEvent.press(next());
    await fireEvent.press(submit());

    expect(appStateStorage.saveAppState).not.toHaveBeenCalled();
    expect(appStateStorage.loadAppState).not.toHaveBeenCalled();
    expect(appStateStorage.clearAppState).not.toHaveBeenCalled();
    expect(db.openAppDatabase).not.toHaveBeenCalled();
    expect(repository.saveCycleProfile).not.toHaveBeenCalled();
    expect(repository.loadCycleProfile).not.toHaveBeenCalled();
    expect(useCase.completeCycleOnboarding).not.toHaveBeenCalled();
  });
});

