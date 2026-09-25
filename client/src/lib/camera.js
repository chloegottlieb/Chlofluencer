/** Pure helpers for the in-app camera (kept separate so they're unit-testable). */

export const MAX_VIDEO_MS = 60_000;
export const HOLD_TO_RECORD_MS = 300;

// Preference order: MP4 plays everywhere (Safari records it natively), then WebM.
const RECORDER_TYPES = ['video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];

export function pickRecorderMimeType(Recorder = globalThis.MediaRecorder) {
  if (!Recorder?.isTypeSupported) return '';
  return RECORDER_TYPES.find((t) => Recorder.isTypeSupported(t)) ?? '';
}

/** "video/webm;codecs=vp9" -> "video/webm" (the server checks the base type). */
export const baseMimeType = (type) => String(type || 'video/webm').split(';')[0].trim();

export const extensionFor = (type) =>
  ({ 'video/mp4': 'mp4', 'video/webm': 'webm', 'image/jpeg': 'jpg', 'image/png': 'png' })[baseMimeType(type)] ?? 'bin';

/** Centre-crop a frame to 9:16 portrait. Returns canvas drawImage source rect. */
export function cropTo916(width, height) {
  const target = 9 / 16;
  if (!width || !height) return { sx: 0, sy: 0, sw: 0, sh: 0 };
  if (width / height > target) {
    const sw = Math.round(height * target);
    return { sx: Math.round((width - sw) / 2), sy: 0, sw, sh: height };
  }
  const sh = Math.round(width / target);
  return { sx: 0, sy: Math.round((height - sh) / 2), sw: width, sh };
}

export function cameraSupported(nav = globalThis.navigator) {
  return !!nav?.mediaDevices?.getUserMedia;
}

/** Friendly explanation for getUserMedia / recording failures. */
export function cameraErrorMessage(err) {
  switch (err?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Camera access is blocked. Allow camera access in your browser settings, or choose from your camera roll.';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return "We couldn't find a camera on this device.";
    case 'NotReadableError':
      return 'Your camera is being used by another app. Close it and try again.';
    case 'Unsupported':
      return 'The in-app camera needs a secure connection (https:// or localhost) and a modern browser.';
    default:
      return 'Something went wrong starting the camera.';
  }
}

export function formatRecordingTime(ms) {
  const s = Math.floor(ms / 1000);
  return `0:${String(s).padStart(2, '0')}`;
}

// --- Hands-free recording ---------------------------------------------------
// Tap once: a countdown gives you time to prop the phone up, then recording
// starts on its own and stops on its own after the chosen length.

export const HANDS_FREE_DELAYS = [0, 3, 10];
export const HANDS_FREE_LENGTHS = [15, 30, 60];
export const DEFAULT_HANDS_FREE = { delaySec: 3, lengthSec: 15 };
const PREFS_KEY = 'storytime_handsfree';

/** Remembered per device; falls back to defaults if missing or invalid. */
export function loadHandsFreePrefs(storage = globalThis.localStorage) {
  try {
    const saved = JSON.parse(storage?.getItem(PREFS_KEY) ?? 'null') ?? {};
    return {
      delaySec: HANDS_FREE_DELAYS.includes(saved.delaySec) ? saved.delaySec : DEFAULT_HANDS_FREE.delaySec,
      lengthSec: HANDS_FREE_LENGTHS.includes(saved.lengthSec) ? saved.lengthSec : DEFAULT_HANDS_FREE.lengthSec,
    };
  } catch {
    return { ...DEFAULT_HANDS_FREE };
  }
}

export function saveHandsFreePrefs(prefs, storage = globalThis.localStorage) {
  try {
    storage?.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* storage unavailable (private mode etc.) — preference just isn't remembered */
  }
}
