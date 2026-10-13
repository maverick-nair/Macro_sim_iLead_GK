import type { Scorm12Api, Scorm2004Api } from './scorm';

/**
 * Fake LMS API objects for the adapter's tests (D209): an in memory data model with SCORM 1.2's and 2004's
 * limits and vocabularies, and every call recorded. `relaunch` starts a new session on the same data, as an
 * LMS does with suspend data kept.
 */
export interface FakeLms<A> { api: A; data: Record<string, string>; calls: Array<[string, ...string[]]>; commits: number; relaunch(): FakeLms<A> }

const S12 = ['passed', 'completed', 'failed', 'incomplete', 'browsed', 'not attempted'];
const C04 = ['completed', 'incomplete', 'not attempted', 'unknown'];
const P04 = ['passed', 'failed', 'unknown'];

export function fakeScorm12(data: Record<string, string> = {}): FakeLms<Scorm12Api> {
  let last = '0';
  const self: FakeLms<Scorm12Api> = {
    data, calls: [], commits: 0,
    relaunch: () => fakeScorm12(data),
    api: {
      LMSInitialize: () => { self.calls.push(['LMSInitialize']); return 'true'; },
      LMSFinish: () => { self.calls.push(['LMSFinish']); return 'true'; },
      LMSGetValue: k => {
        self.calls.push(['LMSGetValue', k]);
        if (k === 'cmi.core.student_id') return 'p42';
        if (k === 'cmi.core.student_name') return 'Rahman, Aisha';
        return data[k] ?? '';
      },
      LMSSetValue: (k, v) => {
        self.calls.push(['LMSSetValue', k, v]);
        const bad = (k === 'cmi.suspend_data' && v.length > 4096) || (k === 'cmi.core.lesson_status' && !S12.includes(v))
          || (/score\.(raw|min|max)$/.test(k) && !(Number(v) >= 0 && Number(v) <= 100)) || (k === 'cmi.core.session_time' && !/^\d{2,4}:\d{2}:\d{2}(\.\d{1,2})?$/.test(v));
        if (bad) { last = '405'; return 'false'; }
        data[k] = v; last = '0'; return 'true';
      },
      LMSCommit: () => { self.calls.push(['LMSCommit']); self.commits++; return 'true'; },
      LMSGetLastError: () => last
    }
  };
  return self;
}

export function fakeScorm2004(data: Record<string, string> = {}): FakeLms<Scorm2004Api> {
  let last = '0';
  const self: FakeLms<Scorm2004Api> = {
    data, calls: [], commits: 0,
    relaunch: () => fakeScorm2004(data),
    api: {
      Initialize: () => { self.calls.push(['Initialize']); return 'true'; },
      Terminate: () => { self.calls.push(['Terminate']); return 'true'; },
      GetValue: k => {
        self.calls.push(['GetValue', k]);
        if (k === 'cmi.learner_id') return 'p42';
        if (k === 'cmi.learner_name') return 'Rahman, Aisha';
        if (k === 'cmi.objectives._count') return data[k] ?? '0';
        return data[k] ?? '';
      },
      SetValue: (k, v) => {
        self.calls.push(['SetValue', k, v]);
        const m = /^cmi\.objectives\.(\d+)\.(.+)$/.exec(k);
        const count = Number(data['cmi.objectives._count'] ?? 0);
        const bad = (k === 'cmi.suspend_data' && v.length > 64000) || (k === 'cmi.completion_status' && !C04.includes(v)) || (k === 'cmi.success_status' && !P04.includes(v))
          || (/score\.scaled$/.test(k) && !(Number(v) >= -1 && Number(v) <= 1)) || (k === 'cmi.session_time' && !/^PT(\d+H)?(\d+M)?(\d+(\.\d{1,2})?S)?$/.test(v))
          || (m && (Number(m[1]) > count || (m[2] !== 'id' && data[`cmi.objectives.${m[1]}.id`] === undefined)));
        if (bad) { last = '406'; return 'false'; }
        if (m && Number(m[1]) === count) data['cmi.objectives._count'] = String(count + 1);
        data[k] = v; last = '0'; return 'true';
      },
      Commit: () => { self.calls.push(['Commit']); self.commits++; return 'true'; },
      GetLastError: () => last
    }
  };
  return self;
}
