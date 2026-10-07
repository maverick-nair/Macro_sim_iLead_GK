import type { Logger } from '../log';
import type { Principal } from '../auth/principal';

/** Per request values on the Hono context. */
export type AppEnv = {
  Variables: {
    requestId: string;
    log: Logger;
    /** Who is calling, when signed in (cookie session, bearer launch token or the admin token). */
    principal: Principal | null;
  };
};
