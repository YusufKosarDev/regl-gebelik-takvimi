import { fireEvent, render } from '@testing-library/react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import PeriodLengthScreen from '@/app/(onboarding)/period-length';

jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
  useLocalSearchParams: jest.fn(),
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
  useLocalSearchParamsMock.mockReturnValue({ cycleLength: '28' });

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

async function renderScreen(cycleLength: unknown = '28') {
  useLocalSearchParamsMock.mockReturnValue({ cycleLength });
  const screen = await render(<PeriodLengthScreen />);

  return {
    ...screen,
    decrease: () => screen.getByRole('button', { name: 'Regl süresini azalt' }),
    increase: () => screen.getByRole('button', { name: 'Regl süresini artır' }),
    submit: () => screen.getByRole('button', { name: 'Devam' }),
  };
}

/** Presses a button n times, re-querying so the latest state is used each time. */
async function pressTimes(getButton: () => unknown, times: number): Promise<void> {
  for (let i = 0; i < times; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await fireEvent.press(getButton() as never);
  }
}

describe('PeriodLengthScreen content', () => {
  it('renders the question', async () => {
    const { getByText } = await renderScreen();

    expect(getByText('Regl dönemin ortalama kaç gün sürüyor?')).toBeTruthy();
  });

  it('renders the explanation', async () => {
    const { getByText } = await renderScreen();

    expect(
      getByText(
        'Kanamanın başladığı ilk günden tamamen bittiği güne kadar geçen ortalama süre.'
      )
    ).toBeTruthy();
  });

  it('starts at 5 days', async () => {
    const { getByText } = await renderScreen();

    expect(getByText('5')).toBeTruthy();
    expect(getByText('gün')).toBeTruthy();
  });
});

describe('PeriodLengthScreen stepper', () => {
  it('increases by one day', async () => {
    const { increase, getByText } = await renderScreen();

    await fireEvent.press(increase());

    expect(getByText('6')).toBeTruthy();
  });

  it('decreases by one day', async () => {
    const { decrease, getByText } = await renderScreen();

    await fireEvent.press(decrease());

    expect(getByText('4')).toBeTruthy();
  });

  it('does not go below 1', async () => {
    const { decrease, getByText } = await renderScreen();

    await pressTimes(decrease, 10);

    expect(getByText('1')).toBeTruthy();
  });

  it('stops at 20 for a 28 day cycle', async () => {
    const { increase, getByText } = await renderScreen('28');

    await pressTimes(increase, 30);

    expect(getByText('20')).toBeTruthy();
  });

  it('stops at 15 for a 15 day cycle', async () => {
    const { increase, getByText } = await renderScreen('15');

    await pressTimes(increase, 30);

    expect(getByText('15')).toBeTruthy();
  });

  it('stops at 18 for an 18 day cycle', async () => {
    const { increase, getByText } = await renderScreen('18');

    await pressTimes(increase, 30);

    expect(getByText('18')).toBeTruthy();
  });

  it('disables decrease at the minimum', async () => {
    const { decrease } = await renderScreen();

    await pressTimes(decrease, 4);

    expect(decrease().props.accessibilityState.disabled).toBe(true);
  });

  it('disables increase at the computed maximum', async () => {
    const { increase } = await renderScreen('15');

    await pressTimes(increase, 10);

    expect(increase().props.accessibilityState.disabled).toBe(true);
  });

  it('keeps both controls enabled in the middle of the range', async () => {
    const { decrease, increase } = await renderScreen();

    expect(decrease().props.accessibilityState.disabled).toBe(false);
    expect(increase().props.accessibilityState.disabled).toBe(false);
  });

  it('exposes the current value to assistive technology', async () => {
    const { getByLabelText, increase } = await renderScreen();

    expect(getByLabelText('Ortalama regl süresi: 5 gün')).toBeTruthy();

    await fireEvent.press(increase());

    expect(getByLabelText('Ortalama regl süresi: 6 gün')).toBeTruthy();
  });
});

describe('PeriodLengthScreen navigation', () => {
  it('forwards both values', async () => {
    const { submit } = await renderScreen('28');

    await fireEvent.press(submit());

    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith({
      pathname: '/(onboarding)/last-period',
      params: { cycleLength: '28', periodLength: '5' },
    });
  });

  it('forwards the adjusted period length', async () => {
    const { increase, submit } = await renderScreen('28');

    await pressTimes(increase, 3);
    await fireEvent.press(submit());

    expect(push).toHaveBeenCalledWith({
      pathname: '/(onboarding)/last-period',
      params: { cycleLength: '28', periodLength: '8' },
    });
  });

  it('keeps the incoming cycle length untouched', async () => {
    const { increase, submit } = await renderScreen('35');

    await fireEvent.press(increase());
    await fireEvent.press(submit());

    expect(push).toHaveBeenCalledWith({
      pathname: '/(onboarding)/last-period',
      params: { cycleLength: '35', periodLength: '6' },
    });
  });

  it('navigates only when the primary action is pressed', async () => {
    const { increase } = await renderScreen();

    await fireEvent.press(increase());

    expect(push).not.toHaveBeenCalled();
  });
});

describe('PeriodLengthScreen with an unusable cycle length', () => {
  it.each<[string, unknown]>([
    ['a missing param', undefined],
    ['a non-numeric param', 'abc'],
    ['a value below the minimum', '14'],
    ['a value above the maximum', '91'],
    ['a non-integer value', '28.5'],
    ['an array of values', ['28']],
  ])('shows the error screen for %s', async (_label, cycleLength) => {
    useLocalSearchParamsMock.mockReturnValue({ cycleLength });

    const { getByText } = await render(<PeriodLengthScreen />);

    expect(getByText('Geçersiz döngü bilgisi.')).toBeTruthy();
  });

  it('offers no controls', async () => {
    useLocalSearchParamsMock.mockReturnValue({ cycleLength: 'abc' });

    const { queryAllByRole, queryByText } = await render(<PeriodLengthScreen />);

    expect(queryAllByRole('button')).toHaveLength(0);
    expect(queryByText('Devam')).toBeNull();
    expect(queryByText('gün')).toBeNull();
  });

  it('does not fall back to a default value', async () => {
    useLocalSearchParamsMock.mockReturnValue({ cycleLength: '14' });

    const { queryByText } = await render(<PeriodLengthScreen />);

    expect(queryByText('5')).toBeNull();
    expect(queryByText('28')).toBeNull();
  });

  it('touches no storage, repository or use case', async () => {
    useLocalSearchParamsMock.mockReturnValue({ cycleLength: undefined });

    await render(<PeriodLengthScreen />);

    expect(appStateStorage.saveAppState).not.toHaveBeenCalled();
    expect(db.openAppDatabase).not.toHaveBeenCalled();
    expect(repository.saveCycleProfile).not.toHaveBeenCalled();
    expect(useCase.completeCycleOnboarding).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });
});

describe('PeriodLengthScreen scope', () => {
  it('uses no text inputs', async () => {
    const { toJSON } = await renderScreen();

    expect(countHostNodes(toJSON(), 'TextInput')).toBe(0);
  });

  it('touches no storage, repository or use case', async () => {
    const { increase, decrease, submit } = await renderScreen();

    await fireEvent.press(increase());
    await fireEvent.press(decrease());
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

