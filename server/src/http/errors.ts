import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { ZodError } from 'zod';
import { IntentError } from '../../../src/engine/sim/engine';
import { ReplayError } from '../engine/recorder';
import { RunError } from '../engine/runs';
import { StorylineError } from '../engine/storylines';
import { PdfError } from '../report/pdf';
import type { AppEnv } from './types';

/**
 * Errors as the app's adapters read them: a non 2xx answer with `{ message, code }` (HANDOFF section 2).
 * `code` is stable and the UI words it; 5xx means retryable. Internal details never reach the client.
 */
export class HttpError extends Error {
  constructor(readonly status: ContentfulStatusCode, readonly code: string, message: string, readonly extra?: Record<string, unknown>) { super(message); }
}

export const badRequest = (message: string, extra?: Record<string, unknown>) => new HttpError(400, 'badRequest', message, extra);
export const unauthorized = (message = 'Sign in through your learning platform to continue.') => new HttpError(401, 'unauthorized', message);
export const forbidden = (message = 'You do not have access to this.') => new HttpError(403, 'forbidden', message);
export const notFound = (message = 'Not found', code = 'notFound') => new HttpError(404, code, message);

export function toResponse(err: unknown, c: Context<AppEnv>) {
  const log = c.get('log');
  if (err instanceof HttpError) return c.json({ message: err.message, code: err.code, ...err.extra }, err.status);
  if (err instanceof IntentError) return c.json({ message: err.message, code: err.code }, 409);
  if (err instanceof RunError) return c.json({ message: err.message, code: err.code }, err.status as ContentfulStatusCode);
  if (err instanceof StorylineError) return c.json({ message: err.message, code: err.code }, err.code === 'unknownStoryline' ? 404 : 400);
  if (err instanceof ZodError) return c.json({ message: 'The request is not valid', code: 'badRequest', issues: err.issues.map(i => ({ path: i.path.join('.'), message: i.message })) }, 400);
  if (err instanceof PdfError) {
    log?.error('pdf failed', { err });
    return c.json({ message: 'The PDF could not be made. Try again, or print the report from your browser.', code: 'pdfFailed' }, 502);
  }
  if (err instanceof ReplayError) {
    log?.error('replay failed', { err });
    return c.json({ message: 'This run could not be restored. Support has the details.', code: 'replayFailed' }, 500);
  }
  if (err instanceof Error && 'status' in err && (err as { status: number }).status === 413) return c.json({ message: 'The request is too large', code: 'tooLarge' }, 413);
  log?.error('unhandled error', { err });
  return c.json({ message: 'Something went wrong. Try again.', code: 'internal' }, 500);
}
