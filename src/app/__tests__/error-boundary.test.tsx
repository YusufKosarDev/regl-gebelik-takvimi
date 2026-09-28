import { fireEvent, render } from '@testing-library/react-native';

import { ErrorBoundary } from '@/components/error-boundary';
import {
  ERROR_BODY,
  ERROR_RETRY_LABEL,
  ERROR_TITLE,
} from '@/shared/presentation/app-messages';

/**
 * The screen a person sees when a screen fails to draw.
 *
 * Rendered directly with the props expo-router would hand it, rather than by
 * making a real route throw. The router's own `Try` component is what catches
 * the error and calls this; testing that would be testing expo-router. What is
 * this app's to get right is what the component does with `error` and `retry`,
 * and that is what is checked here.
 *
 * The assertions about what is *not* shown are the point of the file. A
 * boundary that quietly started printing the thrown message would still render,
 * still pass a "shows the title" test, and still put whatever a failing library
 * wrote in front of somebody who did not ask to see it.
 */

function thrown(message: string): Error {
  const error = new Error(message);

  // Stacks quote file paths and, in this app, statements with period dates
  // bound into them. Cleared so a test cannot pass by accident on a build
  // where stacks happen to be empty.
  error.stack = `Error: ${message}\n    at somewhere (src/app/(app)/index.tsx:1:1)`;

  return error;
}

describe('ErrorBoundary', () => {
  it('says what happened and that the records are still there', async () => {
    const screen = await render(
      <ErrorBoundary error={thrown('db locked')} retry={jest.fn().mockResolvedValue(undefined)} />
    );

    expect(screen.getByText(ERROR_TITLE)).toBeTruthy();
    expect(screen.getByText(ERROR_BODY)).toBeTruthy();
  });

  it('offers a way to try again, and calls it', async () => {
    const retry = jest.fn().mockResolvedValue(undefined);
    const screen = await render(<ErrorBoundary error={thrown('db locked')} retry={retry} />);

    fireEvent.press(screen.getByLabelText(ERROR_RETRY_LABEL));

    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('shows neither the message nor the stack of whatever failed', async () => {
    const screen = await render(
      <ErrorBoundary
        error={thrown('SQLITE_ERROR: no such column: start_date')}
        retry={jest.fn().mockResolvedValue(undefined)}
      />
    );

    const tree = JSON.stringify(screen.toJSON());

    expect(tree).not.toContain('SQLITE_ERROR');
    expect(tree).not.toContain('start_date');
    expect(tree).not.toContain('index.tsx');
  });

  it('gives the title a heading role, so it is reachable by a screen reader', async () => {
    const screen = await render(
      <ErrorBoundary error={thrown('db locked')} retry={jest.fn().mockResolvedValue(undefined)} />
    );

    expect(screen.getByRole('header')).toBeTruthy();
  });
});
