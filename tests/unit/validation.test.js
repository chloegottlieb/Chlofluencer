import { describe, expect, it } from 'vitest';
import {
  ValidationError,
  assertValid,
  isSafeBackground,
  normalizeTags,
  normalizeUsername,
  validateBio,
  validateEmail,
  validatePassword,
  validateUsername,
  validateWebsite,
} from '../../server/lib/validation.js';

describe('validateUsername', () => {
  it.each(['maya', 'maya.travels', 'leo_lifts', 'abc', 'a'.repeat(30), 'MiXeD'])('accepts %s', (u) => {
    expect(validateUsername(u)).toBeNull();
  });
  it.each([
    ['ab', /3-30/],
    ['a'.repeat(31), /3-30/],
    ['has space', /letters, numbers/],
    ['emoji😀', /letters, numbers/],
    ['.start', /period/],
    ['end.', /period/],
    ['dou..ble', /period/],
    [undefined, /3-30/],
  ])('rejects %s', (u, msg) => {
    expect(validateUsername(u)).toMatch(msg);
  });
  it('normalizes case and whitespace', () => {
    expect(normalizeUsername('  Maya.Travels ')).toBe('maya.travels');
    expect(normalizeUsername(null)).toBe('');
  });
});

describe('validateEmail', () => {
  it('accepts valid addresses', () => expect(validateEmail('a@b.co')).toBeNull());
  it.each(['', 'nope', 'a@b', 'a b@c.com', null])('rejects %s', (e) => expect(validateEmail(e)).toBeTruthy());
});

describe('validatePassword', () => {
  it('accepts letters+numbers of 8+', () => expect(validatePassword('password1')).toBeNull());
  it('rejects short passwords', () => expect(validatePassword('pass1')).toMatch(/at least 8/));
  it('requires a letter and a number', () => {
    expect(validatePassword('password')).toMatch(/letter and one number/);
    expect(validatePassword('12345678')).toMatch(/letter and one number/);
  });
});

describe('validateBio / validateWebsite', () => {
  it('limits bio to 150 characters', () => {
    expect(validateBio('x'.repeat(150))).toBeNull();
    expect(validateBio('x'.repeat(151))).toMatch(/150/);
    expect(validateBio(undefined)).toBeNull();
  });
  it('accepts empty or http(s) websites only', () => {
    expect(validateWebsite('')).toBeNull();
    expect(validateWebsite('https://example.com')).toBeNull();
    expect(validateWebsite('javascript:alert(1)')).toMatch(/http/);
    expect(validateWebsite('not a url')).toMatch(/http/);
  });
});

describe('normalizeTags', () => {
  it('parses space/comma separated strings and strips #', () => {
    expect(normalizeTags('#Travel, #food  vlog')).toEqual(['travel', 'food', 'vlog']);
  });
  it('parses JSON arrays', () => {
    expect(normalizeTags('["a","b"]')).toEqual(['a', 'b']);
  });
  it('dedupes, removes junk characters and caps the count', () => {
    expect(normalizeTags(['A', 'a', 'b-c', '', null])).toEqual(['a', 'bc']);
    expect(normalizeTags(Array.from({ length: 20 }, (_, i) => `t${i}`))).toHaveLength(10);
    expect(normalizeTags(['a', 'b', 'c'], 2)).toEqual(['a', 'b']);
  });
  it('drops over-long tags and non-array input', () => {
    expect(normalizeTags(['x'.repeat(31)])).toEqual([]);
    expect(normalizeTags(42)).toEqual([]);
  });
});

describe('isSafeBackground', () => {
  it.each(['#fff', '#112233', 'linear-gradient(135deg, #833ab4, #fd1d1d)'])('accepts %s', (b) =>
    expect(isSafeBackground(b)).toBe(true),
  );
  it.each(['red; background:url(x)', 'url(http://evil)', 'linear-gradient(red);}', '', undefined])('rejects %s', (b) =>
    expect(isSafeBackground(b)).toBe(false),
  );
});

describe('assertValid', () => {
  it('throws a 400 ValidationError with the field', () => {
    try {
      assertValid('bad', 'username');
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
      expect(e.status).toBe(400);
      expect(e.field).toBe('username');
    }
  });
  it('does nothing for null', () => expect(() => assertValid(null)).not.toThrow());
});
