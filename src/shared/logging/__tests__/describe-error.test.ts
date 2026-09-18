import { describeError } from '../describe-error';

class WriteFailedError extends Error {
  readonly code = 'ERR_WIDGET_SNAPSHOT_WRITE_FAILED';

  constructor() {
    super('Could not store the widget snapshot.');
    this.name = 'WriteFailedError';
  }
}

describe('describeError', () => {
  it('gives the class name', () => {
    expect(describeError(new Error('anything'))).toBe('Error');
  });

  it('gives a platform code alongside it', () => {
    expect(describeError(new WriteFailedError())).toBe(
      'WriteFailedError ERR_WIDGET_SNAPSHOT_WRITE_FAILED'
    );
  });

  it('gives the code on its own when the name is not one', () => {
    expect(describeError({ name: 'a period on 2026-09-17', code: 'ERR_SQLITE' })).toBe(
      'ERR_SQLITE'
    );
  });

  it.each([
    ['a thrown string', '2026-09-17'],
    ['a thrown number', 7],
    ['nothing', null],
    ['undefined', undefined],
    ['a thrown profile', { lastMenstrualPeriodStartDate: '2026-09-02' }],
  ])('says nothing about %s', (_label, thrown) => {
    expect(describeError(thrown)).toBeNull();
  });
});

describe('what describeError never gives away', () => {
  it('drops the message, which is where the data is', () => {
    const error = new Error('addPeriodStart found a period already recorded on 2026-09-02.');

    expect(describeError(error)).toBe('Error');
  });

  it('drops the stack', () => {
    const described = describeError(new Error('2026-09-02'));

    expect(described).not.toMatch(/at |\.ts|\.tsx/);
  });

  it('drops a name that was built out of user data', () => {
    const error = new Error('x');
    error.name = '2026-09-02';

    expect(describeError(error)).toBeNull();
  });

  it('drops a code that is not a shouted constant', () => {
    expect(describeError({ name: 'Error', code: 'period 2026-09-02' })).toBe('Error');
  });

  it('drops a cause, however it was attached', () => {
    const error = new Error('outer', { cause: new Error('due date 2027-06-09') });

    expect(describeError(error)).toBe('Error');
  });
});
