/**
 * User settings schema. Each leaf describes the allowed values and default.
 * Settings are grouped the way they appear in the Settings screen.
 */
export const SETTINGS_SCHEMA = {
  privacy: {
    privateAccount: { type: 'boolean', default: false },
    storyReplies: { type: 'enum', values: ['everyone', 'following', 'off'], default: 'everyone' },
    showActivityStatus: { type: 'boolean', default: true },
    showViewCounts: { type: 'boolean', default: true },
  },
  discovery: {
    // Continue into strangers' stories after you finish your friends'.
    showDiscover: { type: 'boolean', default: true },
    // Allow your public stories to be recommended to people who don't follow you.
    appearInDiscover: { type: 'boolean', default: true },
    hideSensitive: { type: 'boolean', default: true },
    // Rank discovery by the interests you declared and how you watch.
    personalized: { type: 'boolean', default: true },
  },
  stories: {
    defaultAudience: { type: 'enum', values: ['public', 'followers'], default: 'public' },
    saveToArchive: { type: 'boolean', default: true },
    allowLikes: { type: 'boolean', default: true },
  },
  playback: {
    autoAdvance: { type: 'boolean', default: true },
    imageDurationSec: { type: 'number', min: 3, max: 15, default: 5 },
    muteByDefault: { type: 'boolean', default: false },
    dataSaver: { type: 'boolean', default: false },
  },
  notifications: {
    likes: { type: 'boolean', default: true },
    replies: { type: 'boolean', default: true },
    follows: { type: 'boolean', default: true },
    followRequests: { type: 'boolean', default: true },
    pauseAll: { type: 'boolean', default: false },
  },
  appearance: {
    theme: { type: 'enum', values: ['dark', 'light', 'system'], default: 'dark' },
    reduceMotion: { type: 'boolean', default: false },
  },
};

export function defaultSettings() {
  const out = {};
  for (const [group, fields] of Object.entries(SETTINGS_SCHEMA)) {
    out[group] = {};
    for (const [key, spec] of Object.entries(fields)) out[group][key] = spec.default;
  }
  return out;
}

function validateLeaf(spec, value) {
  switch (spec.type) {
    case 'boolean':
      return typeof value === 'boolean';
    case 'enum':
      return spec.values.includes(value);
    case 'number':
      return typeof value === 'number' && Number.isFinite(value) && value >= spec.min && value <= spec.max;
    default:
      return false;
  }
}

/**
 * Merge a partial patch into existing settings. Unknown groups/keys and
 * invalid values produce errors; nothing is applied if any error exists.
 */
export function mergeSettings(current, patch) {
  const errors = [];
  const next = structuredClone(current ?? defaultSettings());
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    return { settings: next, errors: ['Settings patch must be an object'] };
  }
  for (const [group, values] of Object.entries(patch)) {
    const groupSchema = SETTINGS_SCHEMA[group];
    if (!groupSchema) {
      errors.push(`Unknown settings group "${group}"`);
      continue;
    }
    if (!values || typeof values !== 'object') {
      errors.push(`Settings group "${group}" must be an object`);
      continue;
    }
    for (const [key, value] of Object.entries(values)) {
      const spec = groupSchema[key];
      if (!spec) errors.push(`Unknown setting "${group}.${key}"`);
      else if (!validateLeaf(spec, value)) errors.push(`Invalid value for "${group}.${key}"`);
      else next[group][key] = value;
    }
  }
  return { settings: errors.length ? structuredClone(current) : next, errors };
}

/** Fills any settings missing from a stored object with defaults. */
export function withDefaults(stored) {
  const base = defaultSettings();
  if (!stored) return base;
  for (const group of Object.keys(base)) {
    base[group] = { ...base[group], ...(stored[group] ?? {}) };
  }
  return base;
}
