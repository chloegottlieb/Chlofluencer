import { describe, expect, it } from 'vitest';
import {
  DEFAULT_HANDS_FREE,
  HANDS_FREE_DELAYS,
  HANDS_FREE_LENGTHS,
  baseMimeType,
  cameraErrorMessage,
  cameraSupported,
  cropTo916,
  extensionFor,
  formatRecordingTime,
  loadHandsFreePrefs,
  pickRecorderMimeType,
  rememberCameraGranted,
  saveHandsFreePrefs,
  shouldShowCameraPrimer,
} from '../../client/src/lib/camera.js';

describe('pickRecorderMimeType', () => {
  it('prefers MP4, then WebM', () => {
    expect(pickRecorderMimeType({ isTypeSupported: () => true })).toBe('video/mp4');
    expect(pickRecorderMimeType({ isTypeSupported: (t) => t.startsWith('video/webm') })).toBe('video/webm;codecs=vp9,opus');
    expect(pickRecorderMimeType({ isTypeSupported: (t) => t === 'video/webm' })).toBe('video/webm');
  });
  it('returns "" when nothing is supported or MediaRecorder is missing', () => {
    expect(pickRecorderMimeType({ isTypeSupported: () => false })).toBe('');
    expect(pickRecorderMimeType(undefined)).toBe('');
  });
});

describe('mime helpers', () => {
  it('strips codecs', () => {
    expect(baseMimeType('video/webm;codecs=vp9,opus')).toBe('video/webm');
    expect(baseMimeType('')).toBe('video/webm');
  });
  it('maps extensions', () => {
    expect(extensionFor('video/mp4')).toBe('mp4');
    expect(extensionFor('video/webm;codecs=vp8')).toBe('webm');
    expect(extensionFor('image/jpeg')).toBe('jpg');
    expect(extensionFor('audio/ogg')).toBe('bin');
  });
});

describe('cropTo916', () => {
  it('crops landscape frames to a centred portrait slice', () => {
    expect(cropTo916(1920, 1080)).toEqual({ sx: 656, sy: 0, sw: 608, sh: 1080 });
  });
  it('crops tall frames vertically', () => {
    expect(cropTo916(1080, 2400)).toEqual({ sx: 0, sy: 240, sw: 1080, sh: 1920 });
  });
  it('leaves exact 9:16 alone and handles empty frames', () => {
    expect(cropTo916(1080, 1920)).toEqual({ sx: 0, sy: 0, sw: 1080, sh: 1920 });
    expect(cropTo916(0, 0)).toEqual({ sx: 0, sy: 0, sw: 0, sh: 0 });
  });
});

describe('cameraSupported / cameraErrorMessage', () => {
  it('detects getUserMedia', () => {
    expect(cameraSupported({ mediaDevices: { getUserMedia() {} } })).toBe(true);
    expect(cameraSupported({})).toBe(false);
    expect(cameraSupported(undefined)).toBe(false);
  });
  it.each([
    ['NotAllowedError', /blocked/],
    ['SecurityError', /blocked/],
    ['NotFoundError', /couldn't find a camera/],
    ['NotReadableError', /another app/],
    ['Unsupported', /https/],
    ['Weird', /Something went wrong/],
  ])('%s', (name, msg) => expect(cameraErrorMessage({ name })).toMatch(msg));
});

describe('formatRecordingTime', () => {
  it('formats seconds', () => {
    expect(formatRecordingTime(0)).toBe('0:00');
    expect(formatRecordingTime(9_900)).toBe('0:09');
    expect(formatRecordingTime(60_000)).toBe('0:60');
  });
});

describe('hands-free preferences', () => {
  const memoryStorage = (initial = {}) => {
    const data = { ...initial };
    return { getItem: (k) => data[k] ?? null, setItem: (k, v) => (data[k] = v), data };
  };

  it('defaults to a 3s countdown and 15s length', () => {
    expect(loadHandsFreePrefs(memoryStorage())).toEqual({ delaySec: 3, lengthSec: 15 });
    expect(DEFAULT_HANDS_FREE).toEqual({ delaySec: 3, lengthSec: 15 });
  });

  it('round-trips saved preferences', () => {
    const storage = memoryStorage();
    saveHandsFreePrefs({ delaySec: 10, lengthSec: 60 }, storage);
    expect(loadHandsFreePrefs(storage)).toEqual({ delaySec: 10, lengthSec: 60 });
  });

  it('ignores invalid or corrupt values', () => {
    expect(loadHandsFreePrefs(memoryStorage({ storytime_handsfree: '{"delaySec":7,"lengthSec":999}' }))).toEqual({ delaySec: 3, lengthSec: 15 });
    expect(loadHandsFreePrefs(memoryStorage({ storytime_handsfree: 'not json' }))).toEqual({ delaySec: 3, lengthSec: 15 });
    expect(loadHandsFreePrefs(memoryStorage({ storytime_handsfree: '{"delaySec":0}' }))).toEqual({ delaySec: 0, lengthSec: 15 });
  });

  it('survives storage that throws', () => {
    const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    expect(loadHandsFreePrefs(broken)).toEqual({ delaySec: 3, lengthSec: 15 });
    expect(() => saveHandsFreePrefs({ delaySec: 3, lengthSec: 15 }, broken)).not.toThrow();
  });

  it('offers Off/3s/10s countdowns and 15/30/60s lengths within the 60s cap', () => {
    expect(HANDS_FREE_DELAYS).toEqual([0, 3, 10]);
    expect(HANDS_FREE_LENGTHS).toEqual([15, 30, 60]);
  });
});

describe('camera permission primer', () => {
  const storage = (items = {}) => ({ getItem: (k) => items[k] ?? null, setItem: (k, v) => (items[k] = v), items });
  const nav = (state) => ({
    mediaDevices: { getUserMedia() {} },
    permissions: state ? { query: async () => ({ state }) } : undefined,
  });

  it('shows when permission has not been asked yet', async () => {
    expect(await shouldShowCameraPrimer({ storage: storage(), nav: nav('prompt') })).toBe(true);
  });
  it('shows when the Permissions API cannot tell (iOS WebView)', async () => {
    expect(await shouldShowCameraPrimer({ storage: storage(), nav: nav(null) })).toBe(true);
    const throwing = { mediaDevices: { getUserMedia() {} }, permissions: { query: async () => { throw new TypeError('camera'); } } };
    expect(await shouldShowCameraPrimer({ storage: storage(), nav: throwing })).toBe(true);
  });
  it('skips when already granted, and remembers that', async () => {
    const s = storage();
    expect(await shouldShowCameraPrimer({ storage: s, nav: nav('granted') })).toBe(false);
    expect(s.items.storytime_camera_ok).toBe('1');
  });
  it('skips when blocked or unsupported (the camera explains those itself)', async () => {
    expect(await shouldShowCameraPrimer({ storage: storage(), nav: nav('denied') })).toBe(false);
    expect(await shouldShowCameraPrimer({ storage: storage(), nav: {} })).toBe(false);
  });
  it('skips once the camera has worked on this device', async () => {
    const s = storage();
    rememberCameraGranted(s);
    expect(await shouldShowCameraPrimer({ storage: s, nav: nav('prompt') })).toBe(false);
  });
});
