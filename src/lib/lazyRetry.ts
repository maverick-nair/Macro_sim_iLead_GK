/**
 * A lazy chunk that failed to load: the network dropped, or a deploy replaced the chunk's hashed
 * name. Browsers word it differently; webpack style bundlers name it ChunkLoadError.
 */
const CHUNK = /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|ChunkLoadError|Loading (CSS )?chunk [\w-]+ failed|Unable to preload CSS/i;

export function isChunkError(e: unknown): boolean {
  if (!e) return false;
  const x = e as { name?: unknown; message?: unknown };
  return x.name === 'ChunkLoadError' || CHUNK.test(String(x.message ?? e));
}

/**
 * The failed chunk again, at a fresh address: a browser keeps a module that failed to load as failed
 * for the life of the page, so asking for the same address again fails at once. Null when the error
 * does not name the address (then only a reload helps).
 */
function reimport<T>(e: unknown): Promise<T> | null {
  const url = /(https?:\/\/[^\s'"]+)/.exec(String((e as { message?: unknown }).message ?? ''))?.[1];
  if (!url) return null;
  return import(/* @vite-ignore */ `${url}${url.includes('?') ? '&' : '?'}retry=${Date.now()}`) as Promise<T>;
}

/** Loads a lazy chunk, and tries once more after a moment when it failed to load (D123). */
export function retryImport<T>(load: () => Promise<T>, waitMs = 700): Promise<T> {
  return load().catch((e: unknown) => {
    if (!isChunkError(e)) throw e;
    return new Promise<void>(r => setTimeout(r, waitMs)).then(() => reimport<T>(e) ?? load());
  });
}
