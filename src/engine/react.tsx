import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useState, type ReactNode } from 'react';
import { LensProvider } from '../components/style/lens';
import { createDefaultClient, type EngineClient } from './client';
import type { EngineView, Intent, IntentResult } from './contract';

/**
 * React bindings for the engine. The view lives in the query cache under one key; every intent
 * replaces it with the view the engine returns. The UI never patches the view itself.
 */
const ClientContext = createContext<EngineClient | null>(null);
export const VIEW_KEY = ['engine', 'view'] as const;

export function EngineProvider({ client, children }: { client?: EngineClient; children: ReactNode }) {
  const [state] = useState(() => {
    const c = client ?? createDefaultClient();
    const queries = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, refetchOnWindowFocus: false, retry: 1 }, mutations: { retry: false } } });
    // Ask for the view now, before the rest of the first render, not once it has mounted (D78: the first
    // screen's largest paint waits for it). The query below picks up the same request.
    void queries.prefetchQuery({ queryKey: VIEW_KEY, queryFn: () => c.view() });
    return { client: c, queries };
  });
  return (
    <QueryClientProvider client={state.queries}>
      <ClientContext.Provider value={state.client}><ViewLens>{children}</ViewLens></ClientContext.Provider>
    </QueryClientProvider>
  );
}

/** Every engine screen renders style names from the storyline's lens (D70), from the view. */
function ViewLens({ children }: { children: ReactNode }) {
  const lens = useEngineView().data?.lens;
  return <LensProvider lens={lens}>{children}</LensProvider>;
}

export function useEngineClient(): EngineClient {
  const c = useContext(ClientContext);
  if (!c) throw new Error('useEngineClient needs an EngineProvider');
  return c;
}

export function useEngineView() {
  const client = useEngineClient();
  return useQuery<EngineView>({ queryKey: VIEW_KEY, queryFn: () => client.view() });
}

/** Sends one intent. On success the cached view becomes the engine's answer. */
export function useIntent() {
  const client = useEngineClient();
  const qc = useQueryClient();
  return useMutation<IntentResult, Error, Intent>({
    mutationFn: intent => client.send(intent),
    onSuccess: result => qc.setQueryData(VIEW_KEY, result.view)
  });
}
