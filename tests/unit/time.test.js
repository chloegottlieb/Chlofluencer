import { describe, expect, it } from 'vitest';
import { formatCount, formatDate, timeAgo, timeLeft } from '../../client/src/lib/time.js';

const NOW = 1_800_000_000_000;
const MIN = 60_000;
const HOUR = 60 * MIN;

describe('timeAgo', () => {
  it.each([
    [0, 'now'],
    [30_000, 'now'],
    [5 * MIN, '5m'],
    [3 * HOUR, '3h'],
    [2 * 24 * HOUR, '2d'],
    [15 * 24 * HOUR, '2w'],
    [-5000, 'now'],
  ])('%i ms ago -> %s', (diff, expected) => {
    expect(timeAgo(NOW - diff, NOW)).toBe(expected);
  });
});

describe('timeLeft', () => {
  it('formats remaining time', () => {
    expect(timeLeft(NOW + 23 * HOUR + 5 * MIN, NOW)).toBe('23h left');
    expect(timeLeft(NOW + 30 * MIN, NOW)).toBe('30m left');
    expect(timeLeft(NOW + 1000, NOW)).toBe('1m left');
    expect(timeLeft(NOW - 1, NOW)).toBe('Expired');
  });
});

describe('formatCount', () => {
  it.each([
    [0, '0'],
    [999, '999'],
    [1000, '1K'],
    [1500, '1.5K'],
    [12_345, '12K'],
    [2_000_000, '2M'],
    [2_500_000, '2.5M'],
  ])('%i -> %s', (n, s) => expect(formatCount(n)).toBe(s));
});

describe('formatDate', () => {
  it('returns a readable date string', () => {
    expect(formatDate(NOW)).toMatch(/2027/);
  });
});
