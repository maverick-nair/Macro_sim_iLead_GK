import { useEffect, useMemo } from 'react';
import { createDefaultApi } from '../../api';
import { SmallScreenGate } from '../../app/SmallScreenGate';
import { startTheme, useThemeState } from '../../theme/bootstrap';
import { AuthorApp } from './AuthorApp';

/**
 * The `/author` route (D74), loaded lazily by main.tsx. `?theme=light` and `?client=halden` (or
 * `?themeUrl=`) theme it like the participant app, through the same theme loader (D72); below 744 wide
 * the small screen notice covers it (D69).
 */
export default function AuthorPage() {
  const q = new URLSearchParams(location.search);
  const theme = q.get('theme') === 'light' ? 'light' : 'dark';
  const client = q.get('client');
  const themeUrl = q.get('themeUrl');
  const api = useMemo(() => createDefaultApi('author', null, { client, themeUrl }), [client, themeUrl]);
  useEffect(() => startTheme(() => api.getTheme()), [api]);
  const { theme: applied } = useThemeState();
  useEffect(() => { document.title = 'GenieKreator author chat'; }, []);
  return (
    <SmallScreenGate theme={theme} clientTheme={applied}>
      {() => <AuthorApp theme={theme} clientTheme={applied} client={client} />}
    </SmallScreenGate>
  );
}
