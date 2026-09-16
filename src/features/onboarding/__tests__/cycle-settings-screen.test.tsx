import { fireEvent, render } from '@testing-library/react-native';
import { useRouter } from 'expo-router';

import CycleSettingsScreen from '@/app/(onboarding)/cycle-settings';
import PeriodLengthScreen from '@/app/(onboarding)/period-length';

jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
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

async function renderScreen() {
  const screen = await render(<CycleSettingsScreen />);

  return {
    ...screen,
    decrease: () => screen.getByRole('button', { name: 'Döngü uzunluğunu azalt' }),
    increase: () => screen.getByRole('button', { name: 'Döngü uzunluğunu artır' }),
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

describe('CycleSettingsScreen content', () => {
  it('renders the question', async () => {
    const { getByText } = await renderScreen();

    expect(getByText('Döngün ortalama kaç gün sürüyor?')).toBeTruthy();
  });

  it('renders the explanation', async () => {
    const { getByText } = await renderScreen();

    expect(
      getByText(
        'Bir regl döneminin ilk gününden, sonraki regl döneminin ilk gününe kadar geçen süre.'
      )
    ).toBeTruthy();
  });

  it('starts at 28 days', async () => {
    const { getByText } = await renderScreen();

    expect(getByText('28')).toBeTruthy();
    expect(getByText('gün')).toBeTruthy();
  });

  it('renders the primary action', async () => {
    const { submit } = await renderScreen();

    expect(submit()).toBeTruthy();
  });
});

describe('CycleSettingsScreen stepper', () => {
  it('increases by one day', async () => {
    const { increase, getByText } = await renderScreen();

    await fireEvent.press(increase());

    expect(getByText('29')).toBeTruthy();
  });

  it('decreases by one day', async () => {
    const { decrease, getByText } = await renderScreen();

    await fireEvent.press(decrease());

    expect(getByText('27')).toBeTruthy();
  });

  it('does not go below 15', async () => {
    const { decrease, getByText } = await renderScreen();

    await pressTimes(decrease, 20);

    expect(getByText('15')).toBeTruthy();
  });

  it('does not go above 90', async () => {
    const { increase, getByText } = await renderScreen();

    await pressTimes(increase, 70);

    expect(getByText('90')).toBeTruthy();
  });

  it('disables decrease at the minimum', async () => {
    const { decrease } = await renderScreen();

    await pressTimes(decrease, 13);

    expect(decrease().props.accessibilityState.disabled).toBe(true);
  });

  it('disables increase at the maximum', async () => {
    const { increase } = await renderScreen();

    await pressTimes(increase, 62);

    expect(increase().props.accessibilityState.disabled).toBe(true);
  });

  it('keeps both controls enabled in the middle of the range', async () => {
    const { decrease, increase } = await renderScreen();

    expect(decrease().props.accessibilityState.disabled).toBe(false);
    expect(increase().props.accessibilityState.disabled).toBe(false);
  });

  it('exposes the current value to assistive technology', async () => {
    const { getByLabelText, increase } = await renderScreen();

    expect(getByLabelText('Ortalama döngü uzunluğu: 28 gün')).toBeTruthy();

    await fireEvent.press(increase());

    expect(getByLabelText('Ortalama döngü uzunluğu: 29 gün')).toBeTruthy();
  });
});

describe('CycleSettingsScreen navigation', () => {
  it('carries the default value forward', async () => {
    const { submit } = await renderScreen();

    await fireEvent.press(submit());

    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith({
      pathname: '/(onboarding)/period-length',
      params: { cycleLength: '28' },
    });
  });

  it('carries the adjusted value forward', async () => {
    const { increase, decrease, submit } = await renderScreen();

    await pressTimes(increase, 5);
    await fireEvent.press(decrease());
    await fireEvent.press(submit());

    expect(push).toHaveBeenCalledWith({
      pathname: '/(onboarding)/period-length',
      params: { cycleLength: '32' },
    });
  });

  it('sends the clamped minimum forward', async () => {
    const { decrease, submit } = await renderScreen();

    await pressTimes(decrease, 20);
    await fireEvent.press(submit());

    expect(push).toHaveBeenCalledWith({
      pathname: '/(onboarding)/period-length',
      params: { cycleLength: '15' },
    });
  });

  it('navigates only when the primary action is pressed', async () => {
    const { increase } = await renderScreen();

    await fireEvent.press(increase());

    expect(push).not.toHaveBeenCalled();
  });
});

describe('CycleSettingsScreen scope', () => {
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

describe('PeriodLengthScreen', () => {
  it('renders the placeholder', async () => {
    const { getByText } = await render(<PeriodLengthScreen />);

    expect(getByText('Period length')).toBeTruthy();
  });

  it('contains no form controls yet', async () => {
    const { toJSON, queryAllByRole } = await render(<PeriodLengthScreen />);

    expect(countHostNodes(toJSON(), 'TextInput')).toBe(0);
    expect(queryAllByRole('button')).toHaveLength(0);
  });
});
