import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';

// Component tests run in jsdom; unmount between tests and reset globals.
if (typeof document !== 'undefined') {
  const { cleanup } = await import('@testing-library/react');
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });
}
