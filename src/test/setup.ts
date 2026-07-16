import { beforeEach } from 'vitest';

/**
 * Some Node versions ship a built-in global `localStorage` that jsdom won't
 * override, and it's non-functional without `--localstorage-file` pointed at
 * a real path (that's the "--localstorage-file was provided without a valid
 * path" warning this produces). Rather than depend on whichever
 * implementation the runtime happens to pick, install a real in-memory
 * Storage for every jsdom test file, project-wide, before each test.
 *
 * No-ops under the default `node` test environment (no `window`), so this is
 * safe to run as a global setup file regardless of a test file's
 * `// @vitest-environment` pragma.
 */
function installMemoryStorage() {
  if (typeof window === 'undefined') return;

  const store = new Map<string, string>();
  const storage: Storage = {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  };

  Object.defineProperty(window, 'localStorage', {
    value: storage,
    configurable: true,
    writable: true,
  });
}

/**
 * jsdom doesn't implement `Element.prototype.scrollIntoView` at all (a
 * long-standing, well-known gap) — any component that calls it (e.g. an
 * auto-scroll-to-latest-message effect) throws "scrollIntoView is not a
 * function" the moment it runs against a real jsdom node. A no-op stub is
 * all tests need; nothing here asserts on scroll behavior.
 */
function installScrollIntoViewStub() {
  if (typeof window === 'undefined') return;
  if (typeof window.Element.prototype.scrollIntoView === 'function') return;
  window.Element.prototype.scrollIntoView = () => {};
}

beforeEach(() => {
  installMemoryStorage();
  installScrollIntoViewStub();
});
