import type { CloudSyncBase, CloudSyncInput } from '../decide-sync';
import { decideSync } from '../decide-sync';

const H0 = 'aaaaaaaabbbbbbbb';
const H1 = 'ccccccccdddddddd';
const H2 = 'eeeeeeeeffffffff';

function base(overrides: Partial<CloudSyncBase> = {}): CloudSyncBase {
  return { revision: 7, contentHash: H0, ...overrides };
}

function input(overrides: Partial<CloudSyncInput> = {}): CloudSyncInput {
  return {
    base: base(),
    local: { contentHash: H0 },
    remote: { revision: 7, contentHash: H0 },
    ...overrides,
  };
}

describe('the decision table', () => {
  it('does nothing when neither side has changed', () => {
    expect(decideSync(input())).toBe('noop');
  });

  it('pushes when only the phone has changed', () => {
    expect(decideSync(input({ local: { contentHash: H1 } }))).toBe('push');
  });

  it('pulls when only the account has changed', () => {
    expect(decideSync(input({ remote: { revision: 8, contentHash: H1 } }))).toBe('pull');
  });

  it('asks when both have changed', () => {
    expect(
      decideSync(
        input({ local: { contentHash: H1 }, remote: { revision: 8, contentHash: H2 } })
      )
    ).toBe('conflict');
  });

  it.each([
    ['noop', { local: { contentHash: H0 }, remote: { revision: 7, contentHash: H0 } }],
    ['push', { local: { contentHash: H1 }, remote: { revision: 7, contentHash: H0 } }],
    ['pull', { local: { contentHash: H0 }, remote: { revision: 8, contentHash: H1 } }],
    ['conflict', { local: { contentHash: H1 }, remote: { revision: 8, contentHash: H2 } }],
  ] as readonly (readonly [string, Partial<CloudSyncInput>])[])(
    'says %s for the row it belongs to',
    (expected, overrides) => {
      expect(decideSync(input(overrides))).toBe(expected);
    }
  );
});

describe('a remote that moved without saying so', () => {
  it('counts a changed hash as a change even at the same revision', () => {
    // A document edited by hand, or by a build that forgot to bump the number.
    expect(decideSync(input({ remote: { revision: 7, contentHash: H1 } }))).toBe('pull');
  });

  it('counts it as a conflict when the phone changed too', () => {
    expect(
      decideSync(
        input({ local: { contentHash: H1 }, remote: { revision: 7, contentHash: H2 } })
      )
    ).toBe('conflict');
  });

  it('counts a revision that went backwards as a change', () => {
    expect(decideSync(input({ remote: { revision: 3, contentHash: H1 } }))).toBe('pull');
  });

  it('counts a revision that moved with the same contents as no change to carry', () => {
    // Somebody pushed the same data again. There is nothing to fetch.
    expect(decideSync(input({ remote: { revision: 9, contentHash: H0 } }))).toBe('noop');
  });
});

describe('both sides already holding the same thing', () => {
  it('does nothing when the phone and the account agree', () => {
    expect(
      decideSync(input({ local: { contentHash: H1 }, remote: { revision: 9, contentHash: H1 } }))
    ).toBe('noop');
  });

  it('does nothing even when the base remembers something else entirely', () => {
    expect(
      decideSync({
        base: base({ revision: 2, contentHash: H2 }),
        local: { contentHash: H1 },
        remote: { revision: 9, contentHash: H1 },
      })
    ).toBe('noop');
  });

  it('does nothing when there is no base at all', () => {
    expect(
      decideSync({
        base: null,
        local: { contentHash: H1 },
        remote: { revision: 4, contentHash: H1 },
      })
    ).toBe('noop');
  });
});

describe('an account this device has not synced before', () => {
  it('asks when the account holds something else', () => {
    expect(
      decideSync({
        base: null,
        local: { contentHash: H1 },
        remote: { revision: 4, contentHash: H2 },
      })
    ).toBe('conflict');
  });

  it('never pulls without a base, whatever the revision says', () => {
    for (const revision of [0, 1, 99]) {
      expect(
        decideSync({
          base: null,
          local: { contentHash: H1 },
          remote: { revision, contentHash: H2 },
        })
      ).not.toBe('pull');
    }
  });

  it('offers what is on the phone when the account holds nothing', () => {
    expect(decideSync({ base: null, local: { contentHash: H1 }, remote: null })).toBe('push');
  });
});

describe('an account whose backup is gone', () => {
  it('offers the phone copy rather than emptying it', () => {
    expect(decideSync(input({ remote: null }))).toBe('push');
  });

  it('offers it whether or not the phone has changed since', () => {
    expect(decideSync(input({ remote: null, local: { contentHash: H1 } }))).toBe('push');
  });

  it('never answers pull when there is nothing to pull', () => {
    expect(decideSync(input({ remote: null }))).not.toBe('pull');
  });
});

describe('what the decision never does', () => {
  it('never overwrites the phone on a difference it cannot account for', () => {
    // Both sides moved: the only answers allowed are the ones that ask.
    const decision = decideSync(
      input({ local: { contentHash: H1 }, remote: { revision: 8, contentHash: H2 } })
    );

    expect(decision).not.toBe('pull');
    expect(decision).not.toBe('push');
  });

  it('never overwrites the account on a difference it cannot account for', () => {
    const decision = decideSync({
      base: null,
      local: { contentHash: H1 },
      remote: { revision: 1, contentHash: H2 },
    });

    expect(decision).not.toBe('push');
  });

  it('reads nothing but the three facts it was given', () => {
    const untouched: CloudSyncInput = {
      base: base(),
      local: { contentHash: H1 },
      remote: { revision: 8, contentHash: H2 },
    };
    const copy = JSON.parse(JSON.stringify(untouched)) as CloudSyncInput;

    decideSync(untouched);

    expect(untouched).toEqual(copy);
  });

  it('gives the same answer every time it is asked', () => {
    const question = input({ local: { contentHash: H1 } });

    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(decideSync(question)).toBe('push');
    }
  });

  it('writes nothing to the console', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});

    decideSync(input({ local: { contentHash: H1 }, remote: { revision: 8, contentHash: H2 } }));

    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();

    jest.restoreAllMocks();
  });
});
