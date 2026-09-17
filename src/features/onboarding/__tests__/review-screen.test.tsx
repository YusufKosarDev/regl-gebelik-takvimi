import { fireEvent, render } from '@testing-library/react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import FinishScreen from '@/app/(onboarding)/finish';
import ReviewScreen from '@/app/(onboarding)/review';
import type { ISODate } from '@/types/iso-date';
import { getTodayLocalISODate } from '@/utils/today';

jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
  useLocalSearchParams: jest.fn(),
}));

jest.mock('@/utils/today', () => ({
  getTodayLocalISODate: jest.fn(),
}));

// Guards: nothing is persisted until the next step.
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
let back: jest.Mock;

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

function expectNoSideEffects() {
  expect(appStateStorage.saveAppState).not.toHaveBeenCalled();
  expect(appStateStorage.loadAppState).not.toHaveBeenCalled();
  expect(appStateStorage.clearAppState).not.toHaveBeenCalled();
  expect(db.openAppDatabase).not.toHaveBeenCalled();
  expect(repository.saveCycleProfile).not.toHaveBeenCalled();
  expect(repository.loadCycleProfile).not.toHaveBeenCalled();
  expect(useCase.completeCycleOnboarding).not.toHaveBeenCalled();
}

beforeEach(() => {
  push = jest.fn();
  back = jest.fn();
  useRouterMock.mockReset();
  useRouterMock.mockReturnValue({ push, back, replace: jest.fn() });
  useLocalSearchParamsMock.mockReset();
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

type ScreenParams = {
  cycleLength?: unknown;
  periodLength?: unknown;
  lastPeriodStartDate?: unknown;
  today?: string;
};

async function renderScreen(overrides: ScreenParams = {}) {
  // Presence check, not a destructuring default: an explicit `undefined` is a
  // missing param and must stay missing.
  const cycleLength = 'cycleLength' in overrides ? overrides.cycleLength : '28';
  const periodLength = 'periodLength' in overrides ? overrides.periodLength : '5';
  const lastPeriodStartDate =
    'lastPeriodStartDate' in overrides ? overrides.lastPeriodStartDate : '2026-09-17';
  const today = overrides.today ?? '2026-09-17';

  getTodayMock.mockReturnValue(today as ISODate);
  useLocalSearchParamsMock.mockReturnValue({ cycleLength, periodLength, lastPeriodStartDate });

  const screen = await render(<ReviewScreen />);

  return {
    ...screen,
    confirm: () => screen.getByRole('button', { name: 'Bilgiler doğru' }),
    edit: () => screen.getByRole('button', { name: 'Bilgileri düzenle' }),
  };
}

describe('ReviewScreen with valid params', () => {
  it('renders the title', async () => {
    const { getByText } = await renderScreen();

    expect(getByText('Bilgilerini kontrol et')).toBeTruthy();
  });

  it('renders the explanation', async () => {
    const { getByText } = await renderScreen();

    expect(getByText('Devam etmeden önce döngü bilgilerini gözden geçir.')).toBeTruthy();
  });

  it('shows the cycle length', async () => {
    const { getByText } = await renderScreen({ cycleLength: '28' });

    expect(getByText('Döngü uzunluğu')).toBeTruthy();
    expect(getByText('28 gün')).toBeTruthy();
  });

  it('shows the period length', async () => {
    const { getByText } = await renderScreen({ periodLength: '5' });

    expect(getByText('Regl süresi')).toBeTruthy();
    expect(getByText('5 gün')).toBeTruthy();
  });

  it('shows the last period start as a readable date', async () => {
    const { getByText } = await renderScreen({ lastPeriodStartDate: '2026-09-10' });

    expect(getByText('Son regl başlangıcı')).toBeTruthy();
    expect(getByText('10 Eylül 2026')).toBeTruthy();
  });

  it('reflects other valid values', async () => {
    const { getByText } = await renderScreen({
      cycleLength: '35',
      periodLength: '7',
      lastPeriodStartDate: '2026-01-01',
    });

    expect(getByText('35 gün')).toBeTruthy();
    expect(getByText('7 gün')).toBeTruthy();
    expect(getByText('1 Ocak 2026')).toBeTruthy();
  });

  it('exposes each row to assistive technology', async () => {
    const { getByLabelText } = await renderScreen({ lastPeriodStartDate: '2026-09-10' });

    expect(getByLabelText('Döngü uzunluğu: 28 gün')).toBeTruthy();
    expect(getByLabelText('Regl süresi: 5 gün')).toBeTruthy();
    expect(getByLabelText('Son regl başlangıcı: 10 Eylül 2026')).toBeTruthy();
  });
});

describe('ReviewScreen navigation', () => {
  it('forwards all three values', async () => {
    const { confirm } = await renderScreen();

    await fireEvent.press(confirm());

    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith({
      pathname: '/(onboarding)/finish',
      params: {
        cycleLength: '28',
        periodLength: '5',
        lastPeriodStartDate: '2026-09-17',
      },
    });
  });

  it('forwards other valid values unchanged', async () => {
    const { confirm } = await renderScreen({
      cycleLength: '35',
      periodLength: '7',
      lastPeriodStartDate: '2026-01-01',
    });

    await fireEvent.press(confirm());

    expect(push).toHaveBeenCalledWith({
      pathname: '/(onboarding)/finish',
      params: {
        cycleLength: '35',
        periodLength: '7',
        lastPeriodStartDate: '2026-01-01',
      },
    });
  });

  it('goes back when editing', async () => {
    const { edit } = await renderScreen();

    await fireEvent.press(edit());

    expect(back).toHaveBeenCalledTimes(1);
    expect(push).not.toHaveBeenCalled();
  });

  it('navigates nothing on render', async () => {
    await renderScreen();

    expect(push).not.toHaveBeenCalled();
    expect(back).not.toHaveBeenCalled();
  });

  it('writes nothing when confirming', async () => {
    const { confirm } = await renderScreen();

    await fireEvent.press(confirm());

    expectNoSideEffects();
  });
});

describe('ReviewScreen with unusable params', () => {
  it.each<[string, ScreenParams]>([
    ['a missing cycle length', { cycleLength: undefined }],
    ['a non-numeric cycle length', { cycleLength: 'abc' }],
    ['a cycle length below the minimum', { cycleLength: '14' }],
    ['a cycle length above the maximum', { cycleLength: '91' }],
    ['an array cycle length', { cycleLength: ['28'] }],
    ['a missing period length', { periodLength: undefined }],
    ['a non-numeric period length', { periodLength: 'abc' }],
    ['a zero period length', { periodLength: '0' }],
    ['a period length above the maximum', { periodLength: '21' }],
    ['an array period length', { periodLength: ['5'] }],
    ['a period longer than the cycle', { cycleLength: '15', periodLength: '16' }],
    ['a missing start date', { lastPeriodStartDate: undefined }],
    ['a malformed start date', { lastPeriodStartDate: '17-09-2026' }],
    ['an impossible start date', { lastPeriodStartDate: '2026-02-30' }],
    ['a future start date', { lastPeriodStartDate: '2026-09-18' }],
    ['an array start date', { lastPeriodStartDate: ['2026-09-17'] }],
  ])('shows the error screen for %s', async (_label, overrides) => {
    const { getByText } = await renderScreen(overrides);

    expect(getByText('Geçersiz döngü bilgisi.')).toBeTruthy();
  });

  it('offers no actions', async () => {
    const { queryAllByRole, queryByText } = await renderScreen({ cycleLength: 'abc' });

    expect(queryAllByRole('button')).toHaveLength(0);
    expect(queryByText('Bilgiler doğru')).toBeNull();
    expect(queryByText('Bilgileri düzenle')).toBeNull();
    expect(queryByText('Döngü uzunluğu')).toBeNull();
  });

  it('does not navigate or write anything', async () => {
    await renderScreen({ lastPeriodStartDate: '2026-09-18' });

    expect(push).not.toHaveBeenCalled();
    expect(back).not.toHaveBeenCalled();
    expectNoSideEffects();
  });
});

describe('ReviewScreen date boundaries', () => {
  it('accepts today', async () => {
    const { getByText } = await renderScreen({
      today: '2026-09-17',
      lastPeriodStartDate: '2026-09-17',
    });

    expect(getByText('17 Eylül 2026')).toBeTruthy();
  });

  it('accepts a past date', async () => {
    const { getByText } = await renderScreen({
      today: '2026-09-17',
      lastPeriodStartDate: '2026-08-20',
    });

    expect(getByText('20 Ağustos 2026')).toBeTruthy();
  });

  it('rejects tomorrow', async () => {
    const { getByText } = await renderScreen({
      today: '2026-09-17',
      lastPeriodStartDate: '2026-09-18',
    });

    expect(getByText('Geçersiz döngü bilgisi.')).toBeTruthy();
  });

  it('reads the clock once', async () => {
    await renderScreen();

    expect(getTodayMock).toHaveBeenCalledTimes(1);
  });
});

describe('ReviewScreen scope', () => {
  it('uses no text inputs', async () => {
    const { toJSON } = await renderScreen();

    expect(countHostNodes(toJSON(), 'TextInput')).toBe(0);
  });

  it('touches no storage, database, repository or use case', async () => {
    const { confirm, edit } = await renderScreen();

    await fireEvent.press(confirm());
    await fireEvent.press(edit());

    expectNoSideEffects();
  });
});

describe('FinishScreen', () => {
  it('renders the placeholder', async () => {
    const { getByText } = await render(<FinishScreen />);

    expect(getByText('Finish')).toBeTruthy();
  });

  it('contains no form controls yet', async () => {
    const { toJSON, queryAllByRole } = await render(<FinishScreen />);

    expect(countHostNodes(toJSON(), 'TextInput')).toBe(0);
    expect(queryAllByRole('button')).toHaveLength(0);
  });
});
