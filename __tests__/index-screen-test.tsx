import { render } from '@testing-library/react-native';

import AppHomeScreen from '@/app/(app)/index';
import OnboardingScreen from '@/app/(onboarding)/index';

describe('AppHomeScreen', () => {
  it('renders the home placeholder', async () => {
    const { getByText } = await render(<AppHomeScreen />);

    expect(getByText('Home')).toBeTruthy();
    expect(getByText('Cycle dashboard')).toBeTruthy();
  });
});

describe('OnboardingScreen', () => {
  it('renders the onboarding placeholder', async () => {
    const { getByText } = await render(<OnboardingScreen />);

    expect(getByText('Onboarding')).toBeTruthy();
    expect(getByText('Cycle setup')).toBeTruthy();
  });
});
