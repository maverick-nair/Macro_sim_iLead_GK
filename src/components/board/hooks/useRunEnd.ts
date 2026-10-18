import { useEffect, useState } from 'react';

interface Api { getProfile: () => Promise<{ name: string | null }> }

/** After the run: the end screen, the board read only, or the report, and the participant's name for the report header. */
export function useRunEnd(api: Api) {
  // The participant's name from the launch, for the report header.
  const [profileName, setProfileName] = useState<string | null>(null);
  useEffect(() => { let live = true; void api.getProfile().then(p => { if (live) setProfileName(p.name); }, () => undefined); return () => { live = false; }; }, [api]);
  /** After the run: the end screen, the board read only, or the report (web or print view). */
  const [endView, setEndView] = useState<'end' | 'board' | 'report' | 'print'>('end');
  /** At the end of the run, the last week end (banner, report, badges) comes before the end screen. */
  const [lastWeekSeen, setLastWeekSeen] = useState(false);
  return { profileName, endView, setEndView, lastWeekSeen, setLastWeekSeen };
}
