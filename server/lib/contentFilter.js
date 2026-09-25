import { BLOCKED_TERMS } from './blocklist.js';
import { HttpError } from '../auth.js';

// Common character swaps people use to get around filters.
const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', '@': 'a', $: 's', '!': 'i', '|': 'i', '€': 'e' };

/** Lowercase, undo leetspeak, strip accents, squash repeats ("niiiice" -> "niice"). */
export function normalizeForFilter(text) {
  return String(text ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[0134578@$!|€]/g, (c) => LEET[c])
    .replace(/(.)\1{2,}/g, '$1$1');
}

/** Separators removed, to also catch "f.a.g" or "k-y-s". */
const collapseSeparators = (text) => text.replace(/(\p{L})[._*\-~]+(?=\p{L})/gu, '$1');

export function buildMatcher(terms) {
  const escaped = terms
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'));
  if (!escaped.length) return () => null;
  // Whole words (plus plurals) only, so "scunthorpe" or "classic" don't trip it.
  const re = new RegExp(`(?:^|[^\\p{L}])(${escaped.join('|')})(?:e?s|z)?(?=$|[^\\p{L}])`, 'iu');
  return (text) => {
    const normalized = normalizeForFilter(text);
    const hit = normalized.match(re) ?? collapseSeparators(normalized).match(re);
    return hit ? hit[1] : null;
  };
}

let matcher = buildMatcher([...BLOCKED_TERMS, ...String(process.env.BLOCKLIST_EXTRA ?? '').split(',')]);

/** For tests: swap the term list. */
export function setBlockedTerms(terms) {
  matcher = buildMatcher(terms);
}

export const findBlockedTerm = (text) => matcher(text);

export const CONTENT_REJECTED = "That contains language that isn't allowed on Storytime. Please review our Community Guidelines.";

/** Throw a 400 if any of the given values contain blocked language. */
export function assertClean(fields) {
  for (const [field, value] of Object.entries(fields)) {
    const values = Array.isArray(value) ? value : [value];
    if (values.some((v) => v && findBlockedTerm(v))) throw new HttpError(400, CONTENT_REJECTED, { field });
  }
}
