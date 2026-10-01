import { createContext, useContext } from 'react';
import { createHttpApi } from './http';
import { createMockApi } from './mock';
import type { IleadApi } from './types';

export type { IleadApi, InteractionSubmission, SessionSnapshot } from './types';
export { ApiError } from './types';
export { createMockApi } from './mock';
export { createHttpApi } from './http';

/** Uses the HTTP adapter when `VITE_ILEAD_API_URL` is set, otherwise the mock. */
export function createDefaultApi(): IleadApi {
  const url = import.meta.env.VITE_ILEAD_API_URL as string | undefined;
  return url ? createHttpApi(url) : createMockApi();
}

export const ApiContext = createContext<IleadApi>(createMockApi());

export function useApi(): IleadApi {
  return useContext(ApiContext);
}
