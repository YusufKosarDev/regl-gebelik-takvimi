import { fireEvent, render } from '@testing-library/react-native';

import NotFoundScreen from '@/app/+not-found';
import {
  NOT_FOUND_BODY,
  NOT_FOUND_HOME_LABEL,
  NOT_FOUND_TITLE,
} from '@/shared/presentation/app-messages';

/**
 * Where a link that matches nothing lands.
 *
 * The router is mocked the same way every other screen test in this repository
 * mocks it, so that pressing the way out records where it would have gone
 * without needing a navigation tree.
 */

jest.mock('expo-router', () => require('../../../jest/expo-router-mock'));

const router = jest.requireMock('expo-router');

const replace = jest.fn();

beforeEach(() => {
  replace.mockClear();
  router.useRouter.mockReturnValue({ replace });
});

describe('NotFoundScreen', () => {
  it('says the link goes nowhere and that the records are fine', async () => {
    const screen = await render(<NotFoundScreen />);

    expect(screen.getByText(NOT_FOUND_TITLE)).toBeTruthy();
    expect(screen.getByText(NOT_FOUND_BODY)).toBeTruthy();
  });

  it('offers a way back to the home screen', async () => {
    const screen = await render(<NotFoundScreen />);

    fireEvent.press(screen.getByLabelText(NOT_FOUND_HOME_LABEL));

    expect(replace).toHaveBeenCalledWith('/');
  });

  it('replaces rather than going back', async () => {
    // A deep link that arrived while the app was closed has nothing behind it,
    // so `back()` would be a button that does nothing.
    const screen = await render(<NotFoundScreen />);

    fireEvent.press(screen.getByLabelText(NOT_FOUND_HOME_LABEL));

    expect(replace).toHaveBeenCalledTimes(1);
  });

  it('gives the title a heading role, so it is reachable by a screen reader', async () => {
    const screen = await render(<NotFoundScreen />);

    expect(screen.getByRole('header')).toBeTruthy();
  });
});
