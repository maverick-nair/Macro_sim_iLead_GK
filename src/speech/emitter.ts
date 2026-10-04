/** Minimal typed event emitter used by speech sessions. Listener errors never break the emitter. */
export class Emitter<E> {
  private listeners = new Map<keyof E, Set<(e: never) => void>>();

  on<K extends keyof E>(type: K, fn: (event: E[K]) => void): () => void {
    let set = this.listeners.get(type);
    if (!set) this.listeners.set(type, (set = new Set()));
    set.add(fn as (e: never) => void);
    return () => void set.delete(fn as (e: never) => void);
  }

  emit<K extends keyof E>(type: K, event: E[K]): void {
    for (const fn of [...(this.listeners.get(type) ?? [])]) {
      try {
        (fn as (e: E[K]) => void)(event);
      } catch (err) {
        queueMicrotask(() => {
          throw err;
        });
      }
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}
