import { sanitizeForLog } from './sanitize';

// Hostile characters are built from code points so this file contains no raw controls.
const wrap = (codePoint: number) => 'a' + String.fromCodePoint(codePoint) + 'b';

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

  it('caps the output length', () => {
    expect(sanitizeForLog('x'.repeat(500), 10)).toHaveLength(10);
  });

  it('returns a sentinel for non-strings rather than throwing', () => {
    expect(sanitizeForLog(undefined)).toBe('<invalid>');
    expect(sanitizeForLog({ toString: () => 'evil' })).toBe('<invalid>');
  });

  it('sanitizes a realistic log-forging payload', () => {
    const forged = 'order-1\n[Nest] LOG [Auth] admin login succeeded';
    const out = sanitizeForLog(forged, 200);
    expect(out).not.toContain('\n');
    expect(out.split('\n')).toHaveLength(1);
  });
});
