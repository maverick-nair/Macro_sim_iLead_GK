import { css } from '../lib/css';
import { resolveTheme } from '../theme/loader';
import halden from '../theme/samples/halden.json';
import { F, FrameCanvas, type FrameGroup } from './Frames';

/** The Halden sample theme, through the theme loader like any client theme (D72). */
const HALDEN = resolveTheme(halden);

/** Every screen of iLead, each frame the live app opened at that point. Port of `iLead Screens.dc.html`. */
const GROUPS: Array<[string, string, ReturnType<typeof F>[]]> = [
  ['p', 'Clickable prototype, from the start', [F('p1', 'Full prototype. Starts at onboarding. Everything is clickable.', { screen: 'onboarding' })]],
  ['o', 'Screens 1 and 2 · Welcome, briefing and meet your team', [
    F('o1', 'Language and play mode', { screen: 'onboarding', step: 'lang' }),
    F('o2', 'Welcome from the sponsor, three tabs. Next unlocks after the video or 10 seconds', { screen: 'onboarding', step: 'sponsor' }),
    F('o3', 'Consent and data use. Text only stays available', { screen: 'onboarding', step: 'consent' }),
    F('o4', 'Voice setup after a successful test', { screen: 'onboarding', step: 'voice', uiState: 'heard' }),
    F('o5', 'How to play, four cards', { screen: 'onboarding', step: 'how' }),
    F('o6', 'Meet your team. Stats hidden until a profile is read, 3 of 3 unlocks week 1', { screen: 'onboarding', step: 'team', uiState: 'read' })]],
  ['b', 'Screens 3, 4, 6 and 9 · Main board, profile, action drawer, events', [
    F('b1', 'Main board. HUD, metrics strip, stage columns with bottleneck, inbox rail, actions panel. Kent selected', { screen: 'board', uiState: 'select' }),
    F('b2', 'D, G, P, E: hover or focus any letter for the full name and meaning', { screen: 'board', uiState: 'tooltip' }),
    F('b3', '"What do D, G, P and E mean?" opens the style guide', { screen: 'board', uiState: 'legend' }),
    F('b4', 'Action drawer, static: Send for training. Option cards, people picked on the board, Peter dimmed with a reason', { screen: 'board', uiState: 'drawer' }),
    F('b5', 'Action drawer, hybrid: Swap roles with the prerequisite nudge', { screen: 'board', uiState: 'nudge' }),
    F('b6', 'Action drawer, live: Meet Kent face to face, confirm starts the conversation', { screen: 'board', uiState: 'live' }),
    F('b7', 'Full profile in 3 columns: profile, your interactions, take an action', { screen: 'board', uiState: 'profile', outcome: true }),
    F('b8', 'Inbox drawer. Urgent items pinned, replying costs no days', { screen: 'board', uiState: 'inbox' }),
    F('b9', 'Event card, Impact', { screen: 'board', eventType: 'impact' }),
    F('b10', 'Event card, Signal', { screen: 'board', eventType: 'signal' }),
    F('b11', 'Event card, Capacity', { screen: 'board', eventType: 'capacity' }),
    F('b12', 'Event card, Diagnostic', { screen: 'board', eventType: 'diagnostic' }),
    F('b13', 'Incoming sponsor call', { screen: 'board', uiState: 'call' }),
    F('b14', 'Light theme', { screen: 'board', uiState: 'select', theme: 'light' }),
    F('b15', 'Halden Group client theme at 1280. Brand color maps to accent tokens only', { screen: 'board', clientTheme: HALDEN, w: '1280px' })]],
  ['s', 'Screen 5 · Weekly style setting', [
    F('s1', 'Card view with definitions on top, last week tags, optional reasons. Tooltip on hover', { screen: 'style' }),
    F('s2', 'List view, faster for keyboard and screen readers', { screen: 'style', step: 'list' }),
    F('s3', 'Summary and confirm', { screen: 'style', step: 'summary' })]],
  ['l', 'Screen 7 · Live interaction shell, four variants', [
    F('l1', '1:1 AI RolePlay by voice. Transcript ready to edit before sending', { screen: 'live', variant: 'roleplay', uiState: 'review' }),
    F('l2', '1:1, NPC streaming with captions. Speaking interrupts', { screen: 'live', variant: 'roleplay', uiState: 'speaking' }),
    F('l3', '1:1 in text mode', { screen: 'live', variant: 'roleplay', uiState: 'text' }),
    F('l4', 'Email composer with recipient chips and dictation per field', { screen: 'live', variant: 'email' }),
    F('l5', 'Team meeting. Active speaker, raised hand, call on by name', { screen: 'live', variant: 'meeting' }),
    F('l6', 'Sponsor briefing. Three points first, funnel pinned', { screen: 'live', variant: 'sponsor' })]],
  ['r', 'Screen 8 · Reacting, then the outcome panel', [
    F('r1', '"The team is reacting", 3 seconds while evaluation runs', { screen: 'reacting' }),
    F('r2', 'Outcome panel with why expanded: cause, rule, your words. Tap faces for reactions, chips for numbers', { screen: 'board', outcome: true, uiState: 'why' })]],
  ['w', 'Screen 10 · Week end sequence', [
    F('w1', 'End of week banner', { screen: 'weekend', step: 'banner' }),
    F('w2', 'Weekly report: funnel vs ideal, KPI start and end, stars, streak, sponsor, Team Pulse', { screen: 'weekend', step: 'report' }),
    F('w3', 'Badge earned, skippable', { screen: 'weekend', step: 'badge' }),
    F('w4', 'Unlock offer, choose one reward', { screen: 'weekend', step: 'unlock' }),
    F('w5', 'Next week news bulletin', { screen: 'weekend', step: 'news' })]],
  ['e', 'Screens 11 and 12 · Reflection and development report', [
    F('e1', 'End of simulation reflection', { screen: 'end' }),
    F('e2', 'Development report, web view', { screen: 'report' }),
    F('e3', 'Development report, print layout, two letter pages', { screen: 'report', print: true })]],
  ['x', 'Screens 13 and 14 · Settings, pause, resume and session expiry', [
    F('x1', 'Settings and accessibility', { screen: 'board', overlay: 'settings' }),
    F('x2', 'Paused', { screen: 'board', overlay: 'paused' }),
    F('x3', 'Resume recap', { screen: 'board', overlay: 'resume' }),
    F('x4', 'Session timed out', { screen: 'board', overlay: 'expired' })]]
];

const groups: FrameGroup[] = GROUPS.map(([id, title, frames]) => ({ id: 'g-' + id, title, frames }));

export function ScreensGallery() {
  return (
    <FrameCanvas
      groups={groups}
      intro={
        <section className="dv-turn" id="intro" style={{ paddingBottom: 8 }}>
          <div style={css('max-width:1100px; display:flex; flex-direction:column; gap:12px; color:#1a1a1a')}>
            <h1 style={css('margin:0; font-size:36px; font-weight:700; letter-spacing:-0.03em')}>iLead, a Business Simulation · Every screen</h1>
            <p style={css('margin:0; font-size:15px; line-height:1.6; color:rgba(0,0,0,.65)')}>
              Every frame below is the live prototype, opened at that point. Start at <a href="#p1">p1</a> to play straight through. Edge states (offline, mic denied, slow AI, errors, loading) are in <a href="/states">iLead States</a>. To play full screen, open <a href="/">the app</a>.
            </p>
            <p style={css('margin:0; font-size:13px; line-height:1.6; color:rgba(0,0,0,.55)')}>
              Flows to try in <a href="#p1">p1</a>: a) Week 1 loop: onboarding to style setting to the board, spend days, then End week. b) 1:1 by voice: select Kent, Meet face to face, Confirm, press the mic, send, End. c) Email: open the Inbox, Ruth's leave email, Reply now. d) End to report: on the week end screen use the prototype shortcut, then View my report.
            </p>
          </div>
        </section>
      }
    />
  );
}
