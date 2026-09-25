import { LEGAL, isPlaceholder } from './config.js';

/** Renders a legal config value, highlighting anything not filled in yet. */
export function L({ k }) {
  const value = LEGAL[k];
  return isPlaceholder(value) ? <mark className="legal-placeholder">{value}</mark> : <>{value}</>;
}

export function Email({ k }) {
  const value = LEGAL[k];
  if (isPlaceholder(value)) return <L k={k} />;
  return <a href={`mailto:${value}`}>{value}</a>;
}
