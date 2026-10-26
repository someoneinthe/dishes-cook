// The listeners of a value kept in memory and read with useSyncExternalStore: `subscribe` is
// React's, `notify` is called after each change.
export function createListeners() {
  const listenerSet = new Set<() => void>();
  return {
    notify: () => {
      for (const listener of listenerSet) {
        listener();
      }
    },
    subscribe: (listener: () => void) => {
      listenerSet.add(listener);
      return () => {
        listenerSet.delete(listener);
      };
    },
  };
}
