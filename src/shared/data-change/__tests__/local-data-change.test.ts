import {
  isLocalDataChangeSuppressed,
  notifyLocalDataChanged,
  onLocalDataChanged,
  resetLocalDataChangeListenersForTests,
  withLocalDataChangeSuppressed,
} from '../local-data-change';

describe('the local data change notifier', () => {
  beforeEach(() => {
    resetLocalDataChangeListenersForTests();
  });

  it('tells every listener that something changed', () => {
    const first = jest.fn();
    const second = jest.fn();

    onLocalDataChanged(first);
    onLocalDataChanged(second);

    notifyLocalDataChanged();

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('carries nothing with it', () => {
    // A listener that took a table or a row would be reading health data out
    // of an event bus. There is nothing to read: it re-reads the database.
    const listener = jest.fn();

    onLocalDataChanged(listener);
    notifyLocalDataChanged();

    expect(listener).toHaveBeenCalledWith();
  });

  it('stops telling a listener that unsubscribed', () => {
    const listener = jest.fn();
    const stop = onLocalDataChanged(listener);

    stop();
    notifyLocalDataChanged();

    expect(listener).not.toHaveBeenCalled();
  });

  it('keeps going when one listener throws', () => {
    // This is called from inside a repository whose contract is "the write
    // landed". A listener's problem must not turn a successful save into a
    // thrown error at the call site.
    const angry = jest.fn(() => {
      throw new Error('nope');
    });
    const calm = jest.fn();

    onLocalDataChanged(angry);
    onLocalDataChanged(calm);

    expect(() => {
      notifyLocalDataChanged();
    }).not.toThrow();

    expect(calm).toHaveBeenCalledTimes(1);
  });

  it('survives a listener that unsubscribes while being told', () => {
    const second = jest.fn();
    const stopSecond = onLocalDataChanged(() => {
      stopSecond();
    });

    onLocalDataChanged(second);

    expect(() => {
      notifyLocalDataChanged();
    }).not.toThrow();

    expect(second).toHaveBeenCalledTimes(1);
  });
});

describe('suppression', () => {
  beforeEach(() => {
    resetLocalDataChangeListenersForTests();
  });

  it('swallows announcements made inside it', async () => {
    // A restore is the result of a sync. Letting it announce a change would
    // schedule another sync of what was just received.
    const listener = jest.fn();

    onLocalDataChanged(listener);

    await withLocalDataChangeSuppressed(async () => {
      notifyLocalDataChanged();
      notifyLocalDataChanged();
    });

    expect(listener).not.toHaveBeenCalled();
  });

  it('lets announcements through again afterwards', async () => {
    const listener = jest.fn();

    onLocalDataChanged(listener);

    await withLocalDataChangeSuppressed(async () => undefined);
    notifyLocalDataChanged();

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('returns what the body returned', async () => {
    await expect(withLocalDataChangeSuppressed(async () => 'yedek')).resolves.toBe('yedek');
  });

  it('lifts itself even when the body throws', async () => {
    // Otherwise one failed restore would leave the app unable to notice edits
    // for as long as it stayed open.
    const listener = jest.fn();

    onLocalDataChanged(listener);

    await expect(
      withLocalDataChangeSuppressed(async () => {
        throw new Error('restore failed');
      })
    ).rejects.toThrow('restore failed');

    expect(isLocalDataChangeSuppressed()).toBe(false);

    notifyLocalDataChanged();

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('counts rather than flags, so an inner scope does not lift the outer one', async () => {
    // A restore runs inside a wipe's suppression in the deletion path.
    const listener = jest.fn();

    onLocalDataChanged(listener);

    await withLocalDataChangeSuppressed(async () => {
      await withLocalDataChangeSuppressed(async () => undefined);

      expect(isLocalDataChangeSuppressed()).toBe(true);

      notifyLocalDataChanged();
    });

    expect(listener).not.toHaveBeenCalled();
    expect(isLocalDataChangeSuppressed()).toBe(false);
  });
});
