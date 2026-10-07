import { createContext, useContext } from 'react';
import { createHttpApi } from './http';
import { createMockApi, type MockThemeOptions } from './mock';
import type { IleadApi } from './types';

export type { IleadApi, InteractionSubmission, SessionSnapshot } from './types';
export { ApiError } from './types';
export { createMockApi } from './mock';
export { createHttpApi } from './http';

/** Uses the HTTP adapter when `VITE_ILEAD_API_URL` is set, otherwise the mock. */
/** `name` is the participant's display name from the launch link, for the mock; the server knows it from the launch. */
/** `theme` picks the mock's client theme (`?client=halden`, `?themeUrl=/path.json`); the server knows the launch's theme. */
export function createDefaultApi(participant = 'local', name: string | null = null, theme: MockThemeOptions & { exit?: string | null } = {}): IleadApi {
  const url = import.meta.env.VITE_ILEAD_API_URL as string | undefined;
  return url ? createHttpApi(url) : createMockApi({ participant, name, ...theme });
}

export const ApiContext = createContext<IleadApi>(createMockApi());

export function useApi(): IleadApi {
  return useContext(ApiContext);
}
