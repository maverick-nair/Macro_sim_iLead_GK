/** An intent the engine refuses, with a stable code the UI words from the catalog. */
export class IntentError extends Error {
  constructor(message: string, readonly code: string) { super(message); this.name = 'IntentError'; }
}
