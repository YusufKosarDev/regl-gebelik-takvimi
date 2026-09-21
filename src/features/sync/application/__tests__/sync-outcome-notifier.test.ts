import type { CloudSyncOutcome } from '../run-cloud-sync';
import {
  announceSyncOutcome,
  onSyncOutcome,
  resetSyncOutcomeListenersForTests,
} from '../sync-outcome-notifier';

const PUSHED = { kind: 'pushed', revision: 5 } as CloudSyncOutcome;

beforeEach(() => {
  resetSyncOutcomeListenersForTests();
});

describe('who hears about a finished sync', () => {
  it('tells everyone watching', () => {
    const first = jest.fn();
    const second = jest.fn();

    onSyncOutcome(first);
    onSyncOutcome(second);

    announceSyncOutcome(PUSHED);

    expect(first).toHaveBeenCalledWith(PUSHED);
    expect(second).toHaveBeenCalledWith(PUSHED);
  });

  it('stops telling one that unsubscribed', () => {
    const listener = jest.fn();
    const stop = onSyncOutcome(listener);

    stop();
    announceSyncOutcome(PUSHED);

    expect(listener).not.toHaveBeenCalled();
  });

  it('tells nobody when nobody is watching', () => {
    expect(() => {
      announceSyncOutcome(PUSHED);
    }).not.toThrow();
  });
});

describe('when a listener misbehaves', () => {
  it('keeps going, and never fails the sync that earned it', () => {
    // This is called at the end of a sync whose data has already moved. A
    // screen that has gone away is not a reason to report a failed sync.
    const calm = jest.fn();

    onSyncOutcome(() => {
      throw new Error('screen went away');
    });
    onSyncOutcome(calm);

    expect(() => {
      announceSyncOutcome(PUSHED);
    }).not.toThrow();

    expect(calm).toHaveBeenCalledTimes(1);
  });

  it('survives one that unsubscribes while being told', () => {
    const second = jest.fn();
    const stopFirst = onSyncOutcome(() => {
      stopFirst();
    });

    onSyncOutcome(second);

    expect(() => {
      announceSyncOutcome(PUSHED);
    }).not.toThrow();

    expect(second).toHaveBeenCalledTimes(1);
  });
});
