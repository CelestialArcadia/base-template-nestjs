const DEL = 0x7f;
const FIRST_PRINTABLE = 0x20;
const C1_START = 0x80;
const C1_END = 0x9f;

/**
 * Unicode characters that are "invisible" but not ASCII controls. They defeat a
 * C0/C1-only filter and are the modern equivalent of CRLF log-forging:
 *  - U+2028/U+2029 split a line in JS and JSON log pipelines.
 *  - U+202A–U+202E, U+2066–U+2069 reverse the rendering of everything after
 *    them, so a hostile value can display as a benign one to whoever triages.
 *  - U+200B–U+200F, U+FEFF are zero-width; they evade string-match alert rules.
 */
const INVISIBLE_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x200b, 0x200f],
  [0x2028, 0x2029],
  [0x202a, 0x202e],
  [0x2066, 0x2069],
  [0xfeff, 0xfeff],
];

/**
 * A lone surrogate is ill-formed UTF-16: `JSON.stringify` will happily embed it
 * and downstream encoders then disagree about what to do with it.
 *
 * One reaches us whenever the input bound below slices through a surrogate pair
 * (it cuts UTF-16 code units, not code points), so the orphaned half arrives
 * here as its own "code point". Reject the whole range — a well-formed pair is
 * never seen as a surrogate, because `Array.from` yields it as one code point
 * above 0xFFFF.
 */
const SURROGATE_START = 0xd800;
const SURROGATE_END = 0xdfff;

/** Worst case a code point costs 2 UTF-16 units; bound work before filtering. */
const INPUT_BOUND_FACTOR = 2;

export const MAX_LOGGED_ID_LENGTH = 64;
export const MAX_LOGGED_ERROR_LENGTH = 600;

function isPrintable(char: string): boolean {
  // codePointAt, not charCodeAt: for an astral character the latter returns a
  // lone surrogate, which would be compared against the wrong ranges.
  const code = char.codePointAt(0);
  if (code === undefined) return false;

  if (code < FIRST_PRINTABLE || code === DEL) return false; // C0 + DEL (ESC is 0x1B, so ANSI dies here)
  if (code >= C1_START && code <= C1_END) return false; // C1, incl. U+0085 NEL
  if (code >= SURROGATE_START && code <= SURROGATE_END) return false; // orphaned half-pair

  return !INVISIBLE_RANGES.some(([start, end]) => code >= start && code <= end);
}

/**
 * Makes an untrusted string safe to interpolate into a log line: drops
 * characters that forge or corrupt log entries, and bounds the length.
 *
 * Apply this to driver error messages too, not just your own fields — Prisma
 * echoes the offending row back inside its error text, so a hostile value
 * reaches the log through the *error* even after the field itself is cleaned.
 */
export function sanitizeForLog(
  value: unknown,
  maxLength: number = MAX_LOGGED_ID_LENGTH,
): string {
  if (typeof value !== 'string') return '<invalid>';

  // Slice the *input* first: the caller's cap is on output, but a hostile
  // payload shouldn't buy an O(n) scan on every failed message. This cuts UTF-16
  // code units, so it can land mid-surrogate-pair — `isPrintable` drops the
  // orphaned half, which is why the output is always well-formed.
  const bounded = value.slice(0, maxLength * INPUT_BOUND_FACTOR);

  // Array.from iterates by code point, so an intact surrogate pair is one
  // element — and slicing the array (not the joined string) can't split one.
  return Array.from(bounded)
    .filter(isPrintable)
    .slice(0, maxLength)
    .join('');
}
