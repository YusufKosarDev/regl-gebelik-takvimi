import { toCsv } from '../csv';

/**
 * Turning rows into comma-separated text.
 *
 * The whole module is about the values that break a naive join. A file that
 * gets these wrong opens in a spreadsheet looking almost right, which is worse
 * than failing.
 */

describe('plain values', () => {
  it('writes a header and its rows', () => {
    expect(toCsv(['a', 'b'], [['1', '2'], ['3', '4']])).toBe('a,b\r\n1,2\r\n3,4\r\n');
  });

  it('writes a header on its own', () => {
    expect(toCsv(['a', 'b'], [])).toBe('a,b\r\n');
  });

  it('leaves values that need nothing unquoted', () => {
    // So a file of plain words is still readable in a text editor.
    expect(toCsv(['x'], [['cramps']])).toBe('x\r\ncramps\r\n');
  });

  it('keeps an empty value empty rather than writing two quotes', () => {
    expect(toCsv(['a', 'b'], [['', 'x']])).toBe('a,b\r\n,x\r\n');
  });
});

describe('values that would break the format', () => {
  it('quotes a value holding a comma', () => {
    expect(toCsv(['x'], [['a,b']])).toBe('x\r\n"a,b"\r\n');
  });

  it('quotes and doubles a value holding a quote', () => {
    expect(toCsv(['x'], [['say "hi"']])).toBe('x\r\n"say ""hi"""\r\n');
  });

  it('quotes a value holding a newline', () => {
    expect(toCsv(['x'], [['a\nb']])).toBe('x\r\n"a\nb"\r\n');
  });

  it('quotes a value holding a carriage return', () => {
    expect(toCsv(['x'], [['a\rb']])).toBe('x\r\n"a\rb"\r\n');
  });

  it('handles all three at once', () => {
    expect(toCsv(['x'], [['a,"b"\nc']])).toBe('x\r\n"a,""b""\nc"\r\n');
  });

  it('quotes a header that needs it too', () => {
    // Headers go through the same path; a column named with a comma is a bug
    // somewhere else, but it must not produce a broken file here.
    expect(toCsv(['a,b'], [])).toBe('"a,b"\r\n');
  });
});

describe('line endings', () => {
  it('uses CRLF, which is what the format says and what Excel expects', () => {
    const text = toCsv(['a'], [['1']]);

    expect(text.split('\r\n')).toEqual(['a', '1', '']);
  });
});
