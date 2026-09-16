import { fireEvent, render } from '@testing-library/react-native';
import { useRouter } from 'expo-router';

import CycleSettingsScreen from '@/app/(onboarding)/cycle-settings';
import OnboardingWelcomeScreen from '@/app/(onboarding)/index';

jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
}));

const useRouterMock = useRouter as unknown as jest.Mock;
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

// Guards: this screen must not reach any of these layers yet.
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

const appStateStorage = jest.requireMock('@/storage/app-state-storage');
const db = jest.requireMock('@/storage/db');
const repository = jest.requireMock('@/features/cycle/data/cycle-repository');
const useCase = jest.requireMock('@/features/cycle/application/complete-cycle-onboarding');

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

describe('OnboardingWelcomeScreen content', () => {
  it('renders the title', async () => {
    const { getByText } = await render(<OnboardingWelcomeScreen />);

    expect(getByText('Döngünü birlikte takip edelim')).toBeTruthy();
  });

  it('renders the description', async () => {
    const { getByText } = await render(<OnboardingWelcomeScreen />);

    expect(
      getByText(
        'Regl döngünü anlamana, tahmini dönemlerini takip etmene ve günlük değişimleri daha kolay görmene yardımcı olacağız.'
      )
    ).toBeTruthy();
  });

  it('renders the medical disclaimer', async () => {
    const { getByText } = await render(<OnboardingWelcomeScreen />);

    expect(
      getByText('Tahminler geçmiş döngü bilgilerine dayanır ve tıbbi tavsiye yerine geçmez.')
    ).toBeTruthy();
  });

  it('renders the primary action', async () => {
    const { getByText } = await render(<OnboardingWelcomeScreen />);

    expect(getByText('Başlayalım')).toBeTruthy();
  });
});

describe('OnboardingWelcomeScreen accessibility', () => {
  it('exposes the action as a button', async () => {
    const { getByRole } = await render(<OnboardingWelcomeScreen />);

    expect(getByRole('button', { name: 'Başlayalım' })).toBeTruthy();
  });

  it('describes where the button leads', async () => {
    const { getByRole } = await render(<OnboardingWelcomeScreen />);
    const button = getByRole('button', { name: 'Başlayalım' });

    expect(button.props.accessibilityHint).toBe('Döngü ayarlarını girmeye geçer');
  });
});

describe('OnboardingWelcomeScreen navigation', () => {
  it('goes to cycle settings when the button is pressed', async () => {
    const { getByRole } = await render(<OnboardingWelcomeScreen />);

    fireEvent.press(getByRole('button', { name: 'Başlayalım' }));

    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith('/(onboarding)/cycle-settings');
  });

  it('navigates only when pressed', async () => {
    await render(<OnboardingWelcomeScreen />);

    expect(push).not.toHaveBeenCalled();
  });
});

describe('OnboardingWelcomeScreen scope', () => {
  it('contains no form inputs', async () => {
    const { toJSON } = await render(<OnboardingWelcomeScreen />);

    expect(countHostNodes(toJSON(), 'TextInput')).toBe(0);
  });

  it('exposes a single button and no other controls', async () => {
    const { queryAllByRole } = await render(<OnboardingWelcomeScreen />);

    expect(queryAllByRole('button')).toHaveLength(1);
    expect(queryAllByRole('slider')).toHaveLength(0);
    expect(queryAllByRole('checkbox')).toHaveLength(0);
  });

  it('touches no storage, repository or use case', async () => {
    const { getByRole } = await render(<OnboardingWelcomeScreen />);
    fireEvent.press(getByRole('button', { name: 'Başlayalım' }));

    expect(appStateStorage.loadAppState).not.toHaveBeenCalled();
    expect(appStateStorage.saveAppState).not.toHaveBeenCalled();
    expect(appStateStorage.clearAppState).not.toHaveBeenCalled();
    expect(db.openAppDatabase).not.toHaveBeenCalled();
    expect(repository.saveCycleProfile).not.toHaveBeenCalled();
    expect(repository.loadCycleProfile).not.toHaveBeenCalled();
    expect(useCase.completeCycleOnboarding).not.toHaveBeenCalled();
  });
});

describe('CycleSettingsScreen', () => {
  it('renders the placeholder', async () => {
    const { getByText } = await render(<CycleSettingsScreen />);

    expect(getByText('Cycle settings')).toBeTruthy();
  });

  it('contains no form inputs yet', async () => {
    const { toJSON, queryAllByRole } = await render(<CycleSettingsScreen />);

    expect(countHostNodes(toJSON(), 'TextInput')).toBe(0);
    expect(queryAllByRole('button')).toHaveLength(0);
  });
});
