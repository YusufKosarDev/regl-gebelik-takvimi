import {
  DEFAULT_APP_STATE,
  isAppMode,
  validateAppState,
  type AppMode,
  type AppState,
} from '../app-state';

describe('isAppMode', () => {
  it.each(['cycle', 'pregnancy'])('accepts "%s"', (value) => {
    expect(isAppMode(value)).toBe(true);
  });

  it('rejects an unknown value', () => {
    expect(isAppMode('unknown')).toBe(false);
    expect(isAppMode('cycles')).toBe(false);
    expect(isAppMode('pregnant')).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(isAppMode('')).toBe(false);
  });

  it('rejects different capitalisation', () => {
    expect(isAppMode('Cycle')).toBe(false);
    expect(isAppMode('PREGNANCY')).toBe(false);
  });

  it('rejects surrounding whitespace', () => {
    expect(isAppMode(' cycle')).toBe(false);
    expect(isAppMode('cycle ')).toBe(false);
  });

  it('narrows the type when it returns true', () => {
    const value: string = 'pregnancy';

    if (isAppMode(value)) {
      const mode: AppMode = value;
      expect(mode).toBe('pregnancy');
    } else {
      throw new Error('expected "pregnancy" to be an app mode');
    }
  });
});

describe('DEFAULT_APP_STATE', () => {
  it('starts in cycle mode', () => {
    expect(DEFAULT_APP_STATE.mode).toBe('cycle');
  });

  it('starts with onboarding incomplete', () => {
    expect(DEFAULT_APP_STATE.onboardingCompleted).toBe(false);
  });

  it('carries no other fields', () => {
    expect(Object.keys(DEFAULT_APP_STATE).sort()).toEqual(['mode', 'onboardingCompleted']);
  });

  it('is itself valid', () => {
    expect(() => validateAppState(DEFAULT_APP_STATE)).not.toThrow();
  });
});

describe('validateAppState', () => {
  it('accepts a cycle state', () => {
    expect(() => validateAppState({ mode: 'cycle', onboardingCompleted: false })).not.toThrow();
  });

  it('accepts a pregnancy state', () => {
    expect(() =>
      validateAppState({ mode: 'pregnancy', onboardingCompleted: true })
    ).not.toThrow();
  });

  it.each<[string, unknown]>([
    ['an unknown mode', 'sleep'],
    ['an empty mode', ''],
    ['a miscased mode', 'Cycle'],
    ['a non-string mode', 42],
    ['a null mode', null],
    ['an undefined mode', undefined],
  ])('rejects %s', (_label, mode) => {
    const corrupt = { mode, onboardingCompleted: false } as unknown as AppState;

    expect(() => validateAppState(corrupt)).toThrow(/Invalid AppState mode/);
  });

  it.each<[string, unknown]>([
    ['a string', 'true'],
    ['a number', 1],
    ['null', null],
    ['undefined', undefined],
  ])('rejects onboardingCompleted given as %s', (_label, onboardingCompleted) => {
    const corrupt = { mode: 'cycle', onboardingCompleted } as unknown as AppState;

    expect(() => validateAppState(corrupt)).toThrow(
      /onboardingCompleted must be a boolean/
    );
  });

  it('says what kind of value it refused, not the value', () => {
    const corrupt = { mode: 'sleep', onboardingCompleted: false } as unknown as AppState;

    expect(() => validateAppState(corrupt)).toThrow('Invalid AppState mode: text.');
  });

  it('does not mutate the state it is given', () => {
    const state: AppState = { mode: 'pregnancy', onboardingCompleted: true };
    const snapshot = JSON.parse(JSON.stringify(state));

    validateAppState(state);

    expect(JSON.parse(JSON.stringify(state))).toEqual(snapshot);
    expect(Object.keys(state).sort()).toEqual(['mode', 'onboardingCompleted']);
  });
});
