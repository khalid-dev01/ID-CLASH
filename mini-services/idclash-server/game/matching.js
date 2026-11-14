/**
 * ID Clash — smart string matching.
 * Normalization (Arabic-aware) + Levenshtein similarity.
 * Pure functions, framework free — safe to reuse on any JS runtime.
 */

/** Diacritics (tashkeel), small alef variants and quranic annotation marks. */
const DIACRITICS_RE = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g;
/** Arabic-Indic digits ٠-٩ -> 0-9. */
const AR_DIGITS_RE = /[\u0660-\u0669]/g;
/** Anything that is not a letter or a number (punctuation, symbols, whitespace...). */
const NOISE_RE = /[^\p{L}\p{N}]/gu;

/**
 * Normalize a character name for comparison:
 * - lowercase
 * - strip diacritics
 * - unify alef forms (أ إ آ ٱ -> ا)
 * - ta marbuta -> ha (ة -> ه)
 * - alef maksura -> ya (ى -> ي)
 * - hamza seats (ؤ -> و, ئ -> ي)
 * - strip tatweel (ـ), arabic-indic digits and all whitespace/punctuation
 */
export function normalizeName(raw) {
  if (typeof raw !== 'string') return '';
  let s = raw.toLowerCase();
  s = s.replace(DIACRITICS_RE, '');
  s = s.replace(/[\u0623\u0625\u0622\u0671]/g, '\u0627');
  s = s.replace(/\u0629/g, '\u0647');
  s = s.replace(/\u0649/g, '\u064A');
  s = s.replace(/\u0624/g, '\u0648');
  s = s.replace(/\u0626/g, '\u064A');
  s = s.replace(/\u0640/g, '');
  s = s.replace(AR_DIGITS_RE, (d) => String(d.charCodeAt(0) - 0x0660));
  s = s.replace(NOISE_RE, '');
  return s;
}

/** Classic dynamic-programming Levenshtein distance (O(n*m), rolling row). */
export function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let prev = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    const cur = new Array(b.length + 1);
    cur[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = cur;
  }
  return prev[b.length];
}

/**
 * Similarity percentage between two names (0-100).
 * 100 = identical after normalization.
 */
export function similarityPercent(guess, target) {
  const a = normalizeName(guess);
  const b = normalizeName(target);
  if (!a.length || !b.length) return 0;
  if (a === b) return 100;
  const maxLen = Math.max(a.length, b.length);
  const dist = levenshtein(a, b);
  return Math.round(((maxLen - dist) / maxLen) * 100);
}

/** A guess is correct when similarity >= threshold (default 75%). */
export function isGuessCorrect(guess, target, threshold = 75) {
  return similarityPercent(guess, target) >= threshold;
}
