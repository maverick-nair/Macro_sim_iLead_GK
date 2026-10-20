import type { Intent } from '../engine/contract';
import type { LmsState } from './tracker';

/**
 * Connected mode (D206): at each checkpoint the package posts its run to the iLead service, best effort.
 * What it sends is what the server needs to rebuild the run and its full report: the package id (the server
 * knows the storyline and version behind it), the seed, the intent log and what the LMS was told. No secret
 * travels; the server decides what a package id may do. A failed post never stops play: the next checkpoint
 * sends the whole log again.
 */
export interface RunPost {
  packageId: string;
  hash: string;
  seed: number;
  learner: { id: string; name: string } | null;
  state: LmsState;
  log: readonly Intent[];
}

/** `POST {service}/api/packages/{packageId}/runs`, the route the server side of connected mode serves. */
export function runsUrl(service: { url: string; packageId: string }) {
  return `${service.url}/api/packages/${encodeURIComponent(service.packageId)}/runs`;
}

export function postRun(service: { url: string; packageId: string }, body: RunPost, fetchImpl: typeof fetch = (...a) => fetch(...a)): Promise<boolean> {
  return fetchImpl(runsUrl(service), {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    // The last checkpoint may go out as the page closes.
    keepalive: JSON.stringify(body).length < 60000, credentials: 'omit', mode: 'cors'
  }).then(r => r.ok, () => false);
}
