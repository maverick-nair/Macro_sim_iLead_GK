import type { Sessions } from './auth/session';
import type { Config } from './config';
import type { RunService } from './engine/runs';
import type { Storylines } from './engine/storylines';
import type { Routes } from './http/route';
import type { Logger } from './log';
import type { AiPorts } from './ports';
import type { Mailer } from './report/email';
import type { PdfRenderer } from './report/pdf';
import type { Reports } from './reports';
import type { Repository } from './store';

/** Everything a route needs, made once in app.ts. */
export interface ServerContext {
  config: Config;
  log: Logger;
  repo: Repository;
  ai: AiPorts;
  runs: RunService;
  storylines: Storylines;
  reports: Reports;
  sessions: Sessions;
  routes: Routes;
  pdf: PdfRenderer | null;
  mailer: Mailer | null;
}
