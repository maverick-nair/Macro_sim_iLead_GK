import { describe, expect, it } from 'vitest';
import { fakeScorm12, fakeScorm2004 } from './fakeLms';
import { connectLms, discover, duration2004, noopAdapter, scorm12Adapter, scorm2004Adapter, timespan12 } from './scorm';

describe('API discovery', () => {
  it('walks up the parents, then the opener and its parents', () => {
    const lms = fakeScorm2004().api;
    const top: Record<string, unknown> = { API_1484_11: lms };
    top.parent = top;
    const middle = { parent: top };
    const sco = { parent: middle };
    expect(discover(sco, 'scorm2004')?.api).toBe(lms);
    const opener: Record<string, unknown> = { API: fakeScorm12().api };
    opener.parent = opener;
    const popup: Record<string, unknown> = { opener };
    popup.parent = popup;
    expect(discover(popup, 'scorm12')?.version).toBe('scorm12');
  });

  it('takes the other version when the LMS only offers that one, and survives another origin\'s frame', () => {
    const top = { API: fakeScorm12().api, parent: null };
    expect(discover({ parent: top }, 'scorm2004')?.version).toBe('scorm12');
    const foreign = new Proxy({}, { get() { throw new Error('cross origin'); } });
    expect(discover({ parent: foreign }, 'scorm2004')).toBeNull();
  });

  it('without an LMS, a no-op adapter that still plays', () => {
    const a = connectLms({ parent: null }, 'scorm12');
    expect(a.version).toBeNull();
    a.setSuspendData('x');
    expect(a.suspendData()).toBe('x');
    expect(() => { a.setScore({ raw: 1, min: 0, max: 100, scaled: 0.01 }); a.commit(); a.terminate(); }).not.toThrow();
    expect(noopAdapter().learner()).toBeNull();
  });
});

describe('time formats', () => {
  it('SCORM 1.2 timespans and SCORM 2004 durations', () => {
    expect(timespan12(0)).toBe('00:00:00.00');
    expect(timespan12(3_723_450)).toBe('01:02:03.45');
    expect(duration2004(0)).toBe('PT0S');
    expect(duration2004(3_723_450)).toBe('PT1H2M3.45S');
    expect(duration2004(120_000)).toBe('PT2M');
  });
});

describe('SCORM 1.2 adapter', () => {
  it('initializes, marks the attempt incomplete, and writes status, score, location and exit', () => {
    const lms = fakeScorm12();
    const a = scorm12Adapter(lms.api);
    expect(a.initialize()).toBe(true);
    expect(lms.data['cmi.core.lesson_status']).toBe('incomplete');
    expect(a.learner()).toEqual({ id: 'p42', name: 'Rahman, Aisha' });
    a.setStatus('completed', 'unknown');
    expect(lms.data['cmi.core.lesson_status']).toBe('completed');
    a.setStatus('completed', 'passed');
    expect(lms.data['cmi.core.lesson_status']).toBe('passed');
    a.setScore({ raw: 73, min: 0, max: 100, scaled: 0.73 });
    expect([lms.data['cmi.core.score.raw'], lms.data['cmi.core.score.min'], lms.data['cmi.core.score.max']]).toEqual(['73', '0', '100']);
    a.setLocation('period:3');
    a.setSessionTime(61_000);
    a.setExit('suspend');
    a.commit();
    a.terminate();
    expect(lms.data['cmi.core.session_time']).toBe('00:01:01.00');
    expect(lms.data['cmi.core.exit']).toBe('suspend');
    expect(lms.commits).toBe(1);
    expect(a.errors).toEqual([]);
    // After LMSFinish nothing more is sent.
    a.setLocation('period:4');
    expect(lms.data['cmi.core.lesson_location']).toBe('period:3');
  });

  it('keeps a completed status on relaunch, and records what the LMS refuses', () => {
    const lms = fakeScorm12({ 'cmi.core.lesson_status': 'completed' });
    const a = scorm12Adapter(lms.api);
    a.initialize();
    expect(lms.data['cmi.core.lesson_status']).toBe('completed');
    a.setSuspendData('x'.repeat(4097));
    expect(a.errors).toEqual(['cmi.suspend_data: 405']);
    expect(a.suspendLimit).toBe(4096);
  });
});

describe('SCORM 2004 adapter', () => {
  it('writes completion and success apart, the scaled score, progress and one objective per skill', () => {
    const lms = fakeScorm2004();
    const a = scorm2004Adapter(lms.api);
    a.initialize();
    expect(lms.data['cmi.completion_status']).toBe('incomplete');
    a.setStatus('completed', 'failed');
    a.setScore({ raw: 64, min: 0, max: 100, scaled: 0.64 });
    a.setProgress(0.5);
    a.setObjectives([
      { id: 'coaching', description: 'Coaching', score: { raw: 70, min: 0, max: 100, scaled: 0.7 }, completion: 'completed', success: 'passed' },
      { id: 'feedback', description: 'Feedback', score: null, completion: 'completed', success: 'unknown' }
    ]);
    a.setSessionTime(5_000);
    a.setExit('suspend');
    a.commit();
    a.terminate();
    expect(lms.data).toMatchObject({
      'cmi.completion_status': 'completed', 'cmi.success_status': 'failed', 'cmi.score.scaled': '0.64', 'cmi.score.raw': '64', 'cmi.progress_measure': '0.5',
      'cmi.objectives._count': '2', 'cmi.objectives.0.id': 'coaching', 'cmi.objectives.0.score.scaled': '0.7', 'cmi.objectives.0.success_status': 'passed',
      'cmi.objectives.1.id': 'feedback', 'cmi.objectives.1.completion_status': 'completed', 'cmi.session_time': 'PT5S', 'cmi.exit': 'suspend'
    });
    expect(lms.data['cmi.objectives.1.score.raw']).toBeUndefined();
    expect(a.errors).toEqual([]);
  });

  it('a resumed attempt keeps its objectives where they are', () => {
    const lms = fakeScorm2004({ 'cmi.objectives._count': '1', 'cmi.objectives.0.id': 'feedback' });
    const a = scorm2004Adapter(lms.api);
    a.initialize();
    a.setObjectives([{ id: 'coaching', description: 'Coaching', score: null, completion: 'incomplete', success: 'unknown' }, { id: 'feedback', description: 'Feedback', score: null, completion: 'incomplete', success: 'unknown' }]);
    expect(lms.data['cmi.objectives._count']).toBe('2');
    expect(lms.data['cmi.objectives.1.id']).toBe('coaching');
    expect(lms.data['cmi.objectives.0.description']).toBe('Feedback');
    expect(a.errors).toEqual([]);
  });
});
