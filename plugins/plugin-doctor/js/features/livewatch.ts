type AnyRecord = Record<string, any>;

type StoreListener = (name: string, state: unknown) => void;

const listeners = new Set<StoreListener>();

const subscriptions = new Map<
  string,
  {
    store: AnyRecord;
    handler: (...args: any[]) => void;
  }
>();

function getRuntime(): AnyRecord {
  return globalThis as unknown as AnyRecord;
}

function getFluxRegistry(): AnyRecord | null {
  const g = getRuntime();

  const candidates = [
    g.valenced?.discord?.flux?.Stores,
    g.__valenced?.discord?.flux?.Stores,
    g.__valenced?.stores,
    g.__valenced?.flux?._stores,
    g.__valenced?.flux?.stores,
    g.Flux?._stores,
    g.Flux?.stores,
    g.__flux?._stores,
    g.__flux?.stores,
  ];

  for (const candidate of candidates) {
    if (
      candidate &&
      typeof candidate === "object" &&
      !Array.isArray(candidate)
    ) {
      return candidate;
    }
  }

  return null;
}

export function getAllStoreNames(): string[] {
  const registry = getFluxRegistry();

  if (!registry) {
    return [];
  }

  return Object.keys(registry).sort();
}

export function getStore(name: string): AnyRecord | null {
  const registry = getFluxRegistry();

  if (!registry || !name) {
    return null;
  }

  const store = registry[name];

  if (!store || typeof store !== "object") {
    return null;
  }

  return store;
}

function redact(
  value: unknown,
  depth = 0,
  seen = new WeakSet<object>(),
): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "string") {
    return value.length > 2000
      ? `${value.slice(0, 2000)}… [truncated]`
      : value;
  }

  if (
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (typeof value === "function") {
    return `[Function ${value.name || "anonymous"}]`;
  }

  if (typeof value !== "object") {
    return String(value);
  }

  if (depth >= 5) {
    return "[Max depth reached]";
  }

  if (seen.has(value)) {
    return "[Circular]";
  }

  seen.add(value);

  if (Array.isArray(value)) {
    return value
      .slice(0, 100)
      .map((item) => redact(item, depth + 1, seen));
  }

  const output: AnyRecord = {};

  for (const key of Object.keys(value as AnyRecord).slice(0, 100)) {
    if (
      /token|password|credential|secret|authorization|cookie|session.?id|fingerprint|private.?key/i.test(
        key,
      )
    ) {
      output[key] = "[REDACTED]";
      continue;
    }

    try {
      output[key] = redact(
        (value as AnyRecord)[key],
        depth + 1,
        seen,
      );
    } catch {
      output[key] = "[Unreadable]";
    }
  }

  return output;
}

export function snapshotStore(name: string): unknown {
  const store = getStore(name);

  if (!store) {
    return {
      error: `Store "${name}" was not found.`,
    };
  }

  try {
    if (typeof store.getState === "function") {
      return redact(store.getState());
    }

    const snapshot: AnyRecord = {};

    for (const key of Object.keys(store).slice(0, 100)) {
      if (
        /token|password|credential|secret|authorization|cookie|session.?id|fingerprint|private.?key/i.test(
          key,
        )
      ) {
        snapshot[key] = "[REDACTED]";
        continue;
      }

      try {
        const value = store[key];

        if (typeof value !== "function") {
          snapshot[key] = value;
        }
      } catch {
        snapshot[key] = "[Unreadable]";
      }
    }

    return redact(snapshot);
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : String(error),
    };
  }
}

export function getStoreSnapshot(name: string): unknown {
  return snapshotStore(name);
}

export function watchStore(name: string): boolean {
  if (subscriptions.has(name)) {
    return true;
  }

  const store = getStore(name);

  if (!store) {
    return false;
  }

  const addListener = store.addChangeListener;
  const removeListener = store.removeChangeListener;

  if (
    typeof addListener !== "function" ||
    typeof removeListener !== "function"
  ) {
    return false;
  }

  const handler = () => {
    const snapshot = snapshotStore(name);

    for (const listener of listeners) {
      try {
        listener(name, snapshot);
      } catch (error) {
        console.error("[Plugin Doctor] Store listener failed:", error);
      }
    }
  };

  try {
    addListener.call(store, handler);

    subscriptions.set(name, {
      store,
      handler,
    });

    // Emit an initial snapshot so the UI doesn't have to wait
    // for the next store update.
    handler();

    return true;
  } catch (error) {
    console.error(
      `[Plugin Doctor] Failed to watch store "${name}":`,
      error,
    );

    return false;
  }
}

export function unwatchStore(name: string): void {
  const subscription = subscriptions.get(name);

  if (!subscription) {
    return;
  }

  try {
    const removeListener =
      subscription.store.removeChangeListener;

    if (typeof removeListener === "function") {
      removeListener.call(
        subscription.store,
        subscription.handler,
      );
    }
  } catch (error) {
    console.error(
      `[Plugin Doctor] Failed to unwatch store "${name}":`,
      error,
    );
  } finally {
    subscriptions.delete(name);
  }
}

export function getWatchedStores(): string[] {
  return [...subscriptions.keys()];
}

export function clearAllWatches(): void {
  for (const name of [...subscriptions.keys()]) {
    unwatchStore(name);
  }
}

export function subscribeToStoreChanges(
  listener: StoreListener,
): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}