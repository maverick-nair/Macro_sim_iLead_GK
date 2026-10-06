import { useEffect } from 'react';
import { SmallScreenGate } from '../../app/SmallScreenGate';
import { AuthorApp } from './AuthorApp';

/**
 * The `/author` route (D74), loaded lazily by main.tsx. `?theme=light` and `?client=halden` theme it
 * like the participant app; below 744 wide the small screen notice covers it (D69).
 */
export default function AuthorPage() {
  const q = new URLSearchParams(location.search);
  const theme = q.get('theme') === 'light' ? 'light' : 'dark';
  const client = q.get('client') === 'halden';
  useEffect(() => { document.title = 'GenieKreator author chat'; }, []);
  return (
    <SmallScreenGate theme={theme} clientTheme={client}>
      {() => <AuthorApp theme={theme} clientTheme={client} />}
    </SmallScreenGate>
  );
}
