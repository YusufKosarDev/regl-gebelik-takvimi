import { render } from '@testing-library/react-native';

import AppHomeScreen from '@/app/(app)/index';

describe('AppHomeScreen', () => {
  it('renders the home placeholder', async () => {
    const { getByText } = await render(<AppHomeScreen />);

    expect(getByText('Home')).toBeTruthy();
    expect(getByText('Cycle dashboard')).toBeTruthy();
  });
});
