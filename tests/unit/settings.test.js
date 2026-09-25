import { describe, expect, it } from 'vitest';
import { SETTINGS_SCHEMA, defaultSettings, mergeSettings, withDefaults } from '../../server/lib/settings.js';

describe('defaultSettings', () => {
  it('has a default for every schema field', () => {
    const d = defaultSettings();
    for (const [group, fields] of Object.entries(SETTINGS_SCHEMA)) {
      for (const [key, spec] of Object.entries(fields)) expect(d[group][key]).toEqual(spec.default);
    }
  });
  it('discovers strangers after friends by default', () => {
    expect(defaultSettings().discovery.showDiscover).toBe(true);
    expect(defaultSettings().privacy.privateAccount).toBe(false);
  });
});

describe('mergeSettings', () => {
  it('applies valid partial patches', () => {
    const { settings, errors } = mergeSettings(defaultSettings(), {
      privacy: { privateAccount: true, storyReplies: 'off' },
      playback: { imageDurationSec: 10 },
    });
    expect(errors).toEqual([]);
    expect(settings.privacy.privateAccount).toBe(true);
    expect(settings.privacy.storyReplies).toBe('off');
    expect(settings.playback.imageDurationSec).toBe(10);
    expect(settings.discovery.showDiscover).toBe(true);
  });

  it('does not mutate the input', () => {
    const current = defaultSettings();
    mergeSettings(current, { privacy: { privateAccount: true } });
    expect(current.privacy.privateAccount).toBe(false);
  });

  it.each([
    [{ bogus: { a: 1 } }, /Unknown settings group/],
    [{ privacy: { bogus: true } }, /Unknown setting "privacy.bogus"/],
    [{ privacy: { privateAccount: 'yes' } }, /Invalid value/],
    [{ privacy: { storyReplies: 'nobody' } }, /Invalid value/],
    [{ playback: { imageDurationSec: 100 } }, /Invalid value/],
    [{ playback: { imageDurationSec: NaN } }, /Invalid value/],
    [{ privacy: 'nope' }, /must be an object/],
  ])('rejects %j', (patch, msg) => {
    const { errors } = mergeSettings(defaultSettings(), patch);
    expect(errors.join(' ')).toMatch(msg);
  });

  it('applies nothing if any field is invalid', () => {
    const { settings } = mergeSettings(defaultSettings(), {
      privacy: { privateAccount: true, storyReplies: 'bad' },
    });
    expect(settings.privacy.privateAccount).toBe(false);
  });

  it('rejects non-object patches', () => {
    expect(mergeSettings(defaultSettings(), null).errors).toHaveLength(1);
    expect(mergeSettings(defaultSettings(), [1]).errors).toHaveLength(1);
  });
});

describe('withDefaults', () => {
  it('fills missing groups and keys', () => {
    const s = withDefaults({ privacy: { privateAccount: true } });
    expect(s.privacy.privateAccount).toBe(true);
    expect(s.privacy.storyReplies).toBe('everyone');
    expect(s.appearance.theme).toBe('dark');
  });
  it('returns defaults for missing input', () => {
    expect(withDefaults(undefined)).toEqual(defaultSettings());
  });
});
