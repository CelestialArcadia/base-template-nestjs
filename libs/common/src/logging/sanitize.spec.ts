import { sanitizeForLog } from './sanitize';

// Hostile characters are built from code points so this file contains no raw controls.
const wrap = (codePoint: number) => 'a' + String.fromCodePoint(codePoint) + 'b';

/**
 * A lone surrogate is ill-formed UTF-16 — the output must never contain one.
 *
 * Spreading iterates by code point, so an intact pair arrives as ONE element of
 * length 2 (whose `charCodeAt(0)` is, misleadingly, a high surrogate). Only a
 * single-unit element in the surrogate range is actually orphaned.
 */
const hasLoneSurrogate = (value: string) =>
  [...value].some((char) => {
    if (char.length !== 1) return false;
    const code = char.charCodeAt(0);
    return code >= 0xd800 && code <= 0xdfff;
  });

describe('sanitizeForLog', () => {
  describe('strips characters that forge or corrupt a log line', () => {
    it.each([
      ['LF', 0x0a],
      ['CR', 0x0d],
      ['NUL', 0x00],
      ['ESC — the ANSI escape introducer', 0x1b],
      ['DEL', 0x7f],
      ['NEL (C1 U+0085) — a line break to many log readers', 0x85],
      ['U+2028 line separator — splits a line in JS/JSON pipelines', 0x2028],
      ['U+2029 paragraph separator', 0x2029],
      ['U+202E right-to-left override — renders a hostile value as benign', 0x202e],
      ['U+200B zero width space — evades string-match alerting', 0x200b],
      ['U+FEFF byte order mark', 0xfeff],
      ['U+2066 bidi isolate', 0x2066],
    ])('removes %s', (_label, codePoint) => {
      expect(sanitizeForLog(wrap(codePoint))).toBe('ab');
    });
  });

  it('keeps legitimate non-ASCII text intact', () => {
    expect(sanitizeForLog('cafe — 日本語')).toBe('cafe — 日本語');
  });

  it('never splits a surrogate pair when truncating', () => {
    const thumb = String.fromCodePoint(0x1f44d);
    expect(sanitizeForLog(thumb.repeat(3), 2)).toBe(thumb.repeat(2));
  });

  // Regression: the pre-filter input bound slices UTF-16 code units, so it can
  // cut through a surrogate pair. Leading filtered characters shift the astral
  // ones across that boundary, and the orphaned half used to survive to output
  // as an ill-formed lone surrogate. Homogeneous input can never expose this,
  // because the bound always lands on a pair boundary by construction.
  it('never emits a lone surrogate when the input bound cuts a pair', () => {
    const zeroWidth = String.fromCodePoint(0x200b);
    const thumb = String.fromCodePoint(0x1f44d);

    const out = sanitizeForLog(zeroWidth.repeat(3) + thumb.repeat(2), 2);

    expect(hasLoneSurrogate(out)).toBe(false);
    expect(JSON.parse(JSON.stringify({ msg: out })).msg).toBe(out);
  });

  it('produces well-formed output for any mix of hostile and astral input', () => {
    const pool = [
      String.fromCodePoint(0x200b), // zero width — filtered
      String.fromCodePoint(0x1f44d), // astral — kept, 2 code units
      String.fromCodePoint(0x202e), // bidi override — filtered
      String.fromCodePoint(0x85), // NEL — filtered
      'a',
      'é',
    ];

    for (let i = 0; i < 300; i++) {
      let input = '';
      for (let j = 0; j <= i % 12; j++) input += pool[(i * 7 + j * 3) % pool.length];

      expect(hasLoneSurrogate(sanitizeForLog(input, 1 + (i % 5)))).toBe(false);
    }
  });

  it('caps the output length', () => {
    expect(sanitizeForLog('x'.repeat(500), 10)).toHaveLength(10);
  });

  it('returns a sentinel for non-strings rather than throwing', () => {
    expect(sanitizeForLog(undefined)).toBe('<invalid>');
  });

  // Never coerce untrusted input: a hostile `toString` could throw, or return a
  // different value each call. The typeof guard must reject before coercion.
  it('never coerces a non-string via toString', () => {
    const toString = jest.fn(() => 'evil');

    expect(sanitizeForLog({ toString })).toBe('<invalid>');
    expect(toString).not.toHaveBeenCalled();
  });

  it('sanitizes a realistic log-forging payload', () => {
    const forged = 'order-1\n[Nest] LOG [Auth] admin login succeeded';

    const out = sanitizeForLog(forged, 200);

    expect(out).not.toContain('\n');
    // The forged text must survive only as an inert suffix of the same line.
    expect(out).toBe('order-1[Nest] LOG [Auth] admin login succeeded');
  });
});
