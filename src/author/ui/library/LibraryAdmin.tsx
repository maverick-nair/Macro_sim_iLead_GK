import { useState } from 'react';
import { ACTION_TEMPLATES, INTERACTION_TYPES, PLAYS_LABEL, usingType, type InteractionType } from '../../model/library';
import { readMyLibrary } from '../workspace/ActionAdd';
import { Badge, BUTTON, CARD, CardHead, Chip, Field, Scroll, Select, TextInput } from '../kit';
import { navigate } from '../route';

const CONFIG = ['Goal', 'Time limit', 'Characters present', 'Opening line', 'Camera required', 'Hints'];
const IN_NEW = { core: 'Core, always included', on: 'Optional, on by default', off: 'Optional, off by default' } as const;

/**
 * Library admin (docs/design/genie/LibraryAdmin, D108): the interaction types the platform can run and
 * the action templates built on them. A new type is registered with its player component, what authors
 * may configure, how it is scored, its impact model and who may use it. Offline this page keeps new
 * types in memory only; on the server they are versioned, and published simulations keep theirs.
 */
export function LibraryAdmin() {
  const [types, setTypes] = useState<InteractionType[]>(INTERACTION_TYPES);
  const [q, setQ] = useState('');
  const [name, setName] = useState('Video role play');
  const [component, setComponent] = useState('video-roleplay (v0.3)');
  const [config, setConfig] = useState<string[]>(['Goal', 'Time limit', 'Characters present', 'Opening line', 'Hints']);
  const [scored, setScored] = useState('AI evaluator on words');
  const [impact, setImpact] = useState('Style fit from the lens');
  const [who, setWho] = useState('Library admins');
  const [saved, setSaved] = useState<string | null>(null);
  const templates = [...ACTION_TEMPLATES, ...readMyLibrary()].filter(t => !q.trim() || t.name.toLowerCase().includes(q.trim().toLowerCase()));
  const toggle = (v: string) => setConfig(c => (c.includes(v) ? c.filter(x => x !== v) : [...c, v]));
  const typeName = (k: string) => types.find(t => t.key === k)?.name ?? k;
  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <header className="flex min-h-16 flex-none flex-wrap items-center gap-x-4 gap-y-2 border-b border-solid border-author-line bg-author-surface px-6 py-2">
        <span className="text-20 font-800">Genie<span className="text-author-kora">Kreator</span></span>
        <h1 className="m-0 text-17 font-800">Action library</h1>
        <Badge kind="muted">Library admin</Badge>
        <span className="flex-1" />
        <span className="text-13 text-author-muted">Changes reach authors in new drafts; published simulations keep their version</span>
        <button type="button" className={BUTTON.link} onClick={() => navigate({ page: 'workspace', tab: 'actions' })}>Back to the workspace</button>
      </header>
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_27rem] gap-5 p-6 max-[1100px]:grid-cols-1 max-[1100px]:overflow-y-auto">
        <Scroll label="Interaction types and action templates" className="flex flex-col">
          <div className="flex flex-col gap-4">
            <section className={`${CARD} flex flex-col gap-3 p-5`} aria-labelledby="types">
              <CardHead id="types" title="Interaction types"><a href="#register" className={BUTTON.secondary}>Register a new type</a></CardHead>
              <p className="m-0 text-14 text-author-body">The building blocks the platform can run. Each new product feature adds a type here; actions are built on top of them.</p>
              <table className="w-full border-collapse text-14">
                <caption className="sr-only">Interaction types</caption>
                <thead><tr className="text-11 font-800 tracking-[0.08em] text-author-label uppercase"><th scope="col" className="px-2 py-2 text-start">Type</th><th scope="col" className="px-2 py-2 text-start">How it plays</th><th scope="col" className="px-2 py-2 text-start">Scored by</th><th scope="col" className="px-2 py-2 text-start">Actions using it</th><th scope="col" className="px-2 py-2 text-start">Status</th></tr></thead>
                <tbody>{types.map(t => <tr key={t.key} className="border-t border-solid border-author-rule"><th scope="row" className="px-2 py-2 text-start font-800">{t.name}</th><td className="px-2 py-2">{t.how}</td><td className="px-2 py-2">{t.scoredBy}</td><td className="px-2 py-2">{usingType(t.key)}</td><td className="px-2 py-2"><Badge kind={t.status === 'live' ? 'passed' : 'beta'}>{t.status === 'live' ? 'Live' : 'Beta'}</Badge></td></tr>)}</tbody>
              </table>
            </section>
            <section className={`${CARD} flex flex-col gap-3 p-5`} aria-labelledby="templates">
              <CardHead id="templates" title={`Action templates · ${templates.length}`}><TextInput aria-label="Search action templates" placeholder="Search" className="w-52" value={q} onChange={e => setQ(e.target.value)} /></CardHead>
              <table className="w-full border-collapse text-14">
                <caption className="sr-only">Action templates</caption>
                <thead><tr className="text-11 font-800 tracking-[0.08em] text-author-label uppercase"><th scope="col" className="px-2 py-2 text-start">Action</th><th scope="col" className="px-2 py-2 text-start">Type</th><th scope="col" className="px-2 py-2 text-start">In new simulations</th><th scope="col" className="px-2 py-2 text-start">Version</th></tr></thead>
                <tbody>{templates.map(t => <tr key={t.key} className="border-t border-solid border-author-rule"><th scope="row" className="px-2 py-2 text-start font-800">{t.name}</th><td className="px-2 py-2">{typeName(t.type)} <span className="text-author-muted">&middot; {PLAYS_LABEL[t.plays]}</span></td><td className="px-2 py-2">{IN_NEW[t.inNew]}</td><td className="px-2 py-2">v{t.version}</td></tr>)}</tbody>
              </table>
            </section>
          </div>
        </Scroll>
        <form id="register" aria-labelledby="register-title" className={`${CARD} flex min-h-0 flex-col gap-3 border-author-primary p-5`} onSubmit={e => {
          e.preventDefault();
          const key = name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
          setTypes(ts => [...ts.filter(t => t.key !== key), { key, name, how: config.slice(0, 2).join(', ') || 'Custom', scoredBy: scored.replace(' on words', ''), status: 'beta' }]);
          setSaved(name);
        }}>
          <h2 id="register-title" className="m-0 text-20 font-800">Register a new interaction type</h2>
          <Scroll label="New interaction type" className="-mx-1 flex-1 px-1">
            <div className="flex flex-col gap-3">
              <Field label="Name">{id => <TextInput id={id} value={name} onChange={e => setName(e.target.value)} />}</Field>
              <Field label="Player component">{id => <Select id={id} value={component} onChange={e => setComponent(e.target.value)}>{['video-roleplay (v0.3)', 'live-shell (v2.1)', 'written-plan (v1.4)', 'static-decision (v3.0)'].map(o => <option key={o}>{o}</option>)}</Select>}</Field>
              {([['What authors can configure', CONFIG, config, toggle], ['How it is scored', ['AI evaluator on words', 'Rules', 'Both'], [scored], setScored], ['Impact model', ['Style fit from the lens', 'Fixed effects', 'Custom formula'], [impact], setImpact], ['Available to', ['Library admins', 'All authors', 'Selected clients'], [who], setWho]] as const).map(([label, options, value, on]) => (
                <div key={label} className="flex flex-col gap-2">
                  <span id={`l-${label}`} className="text-13 font-700 text-author-label">{label}</span>
                  <div role="group" aria-labelledby={`l-${label}`} className="flex flex-wrap gap-2">{options.map(o => <Chip key={o} pressed={value.includes(o)} onClick={() => on(o)}>{o}</Chip>)}</div>
                </div>
              ))}
            </div>
          </Scroll>
          {saved && <p role="status" className="m-0 text-13 font-700 text-author-gain">{saved} saved as beta. Test it in a sandbox before authors see it.</p>}
          <div className="flex flex-none flex-wrap gap-2">
            <button type="submit" className={BUTTON.big}>Save as beta</button>
            <button type="button" className={`${BUTTON.secondary} min-h-12`} onClick={() => setSaved(`${name}: the sandbox opens on a server`)}>Test in a sandbox</button>
          </div>
        </form>
      </div>
    </div>
  );
}
