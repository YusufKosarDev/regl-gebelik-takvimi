import { fireEvent, render } from '@testing-library/react-native';
import { useRouter } from 'expo-router';

import OnboardingDisclaimerScreen from '@/app/(onboarding)/disclaimer';
import {
  DISCLAIMER_INTRO,
  DISCLAIMER_POINTS,
  DISCLAIMER_TITLE,
} from '@/features/disclaimer/presentation/disclaimer-messages';

jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
}));

const useRouterMock = useRouter as unknown as jest.Mock;
let push: jest.Mock;

beforeEach(() => {
  push = jest.fn();
  useRouterMock.mockReset();
  useRouterMock.mockReturnValue({ push, back: jest.fn(), replace: jest.fn() });
});

describe('what the disclaimer says', () => {
  it('names itself', async () => {
    const screen = await render(<OnboardingDisclaimerScreen />);

    expect(screen.getByText(DISCLAIMER_TITLE)).toBeTruthy();
  });

  it('says what the app does and that the dates are estimates', async () => {
    const screen = await render(<OnboardingDisclaimerScreen />);

    expect(screen.getByText(DISCLAIMER_INTRO)).toBeTruthy();
  });

  it.each(DISCLAIMER_POINTS.map((point, index) => [index, point]))(
    'makes point %i',
    async (_index, point) => {
      const screen = await render(<OnboardingDisclaimerScreen />);

      expect(screen.getByText(point as string)).toBeTruthy();
    }
  );

  it('says it is not medical advice', async () => {
    const screen = await render(<OnboardingDisclaimerScreen />);

    expect(screen.getByText(/Tıbbi tavsiye, teşhis veya tedavi yerine geçmez/)).toBeTruthy();
  });

  it('says it is not contraception', async () => {
    // The point a wall of text would swallow, and the one with the most at
    // stake if somebody misses it.
    const screen = await render(<OnboardingDisclaimerScreen />);

    expect(screen.getByText(/Doğum kontrol yöntemi olarak/)).toBeTruthy();
  });

  it('gives the emergency number', async () => {
    const screen = await render(<OnboardingDisclaimerScreen />);

    expect(screen.getByText(/112'yi ara/)).toBeTruthy();
  });

  it('marks the title as a heading', async () => {
    const screen = await render(<OnboardingDisclaimerScreen />);

    expect(screen.getByRole('header', { name: DISCLAIMER_TITLE })).toBeTruthy();
  });
});

describe('getting past it', () => {
  it('asks for nothing but a press', async () => {
    // No checkbox and no second button: an acceptance step turns a thing to
    // read into a thing to dismiss, and the fastest way past one is to stop
    // reading.
    const screen = await render(<OnboardingDisclaimerScreen />);

    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    expect(screen.queryAllByRole('switch')).toHaveLength(0);
    expect(screen.queryAllByRole('button')).toHaveLength(1);
  });

  it('goes on to the first screen that collects anything', async () => {
    const screen = await render(<OnboardingDisclaimerScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Devam et' }));

    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith('/(onboarding)/cycle-settings');
  });

  it('collects nothing itself', async () => {
    // It sits before any data entry, so there is nothing here to type into.
    const screen = await render(<OnboardingDisclaimerScreen />);

    expect(screen.queryAllByRole('adjustable')).toHaveLength(0);
    expect(screen.queryAllByRole('text').length).toBeGreaterThan(0);
  });

  it('navigates only when pressed', async () => {
    await render(<OnboardingDisclaimerScreen />);

    expect(push).not.toHaveBeenCalled();
  });
});
