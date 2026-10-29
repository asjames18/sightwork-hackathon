/** Minimal browser globals for client modules: localStorage and location.search on a fake window. */
export function fakeWindow(search = "") {
  const store = new Map<string, string>();
  const localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  };
  (globalThis as unknown as { window: unknown }).window = { localStorage, location: { search } };
  return { store, setSearch: (s: string) => (((globalThis as unknown as { window: { location: { search: string } } }).window.location.search = s)) };
}

export function noWindow() {
  delete (globalThis as unknown as { window?: unknown }).window;
}
