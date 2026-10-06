type Getter = () => Promise<unknown>;
type GetterKeys<T> = { [K in keyof T]: T[K] extends Getter ? K : never }[keyof T];

/**
 * Starts some of a client's argument free reads now, while the app's code is still evaluating, and
 * hands each answer to the first caller (D78: on a slow phone network the first screen waited for
 * requests that only left after the first render). Later calls go to the client as usual. A failed
 * early read is not cached: the first caller gets the failure, as it would have.
 */
export function prefetch<T extends object>(client: T, keys: Array<GetterKeys<T>>): T {
  const early = new Map<PropertyKey, Promise<unknown>>();
  for (const k of keys) {
    const p = (client[k] as Getter).call(client);
    p.catch(() => undefined);
    early.set(k, p);
  }
  const out = { ...client };
  for (const k of keys) {
    (out as Record<PropertyKey, unknown>)[k] = () => {
      const p = early.get(k);
      early.delete(k);
      return p ?? (client[k] as Getter).call(client);
    };
  }
  return out;
}
