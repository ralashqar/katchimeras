import React, { useEffect, useState } from 'react';
import './journey.css';

const localKey = 'katchimeras-journey-workspace-v1';
async function api(route, body) {
  const response = await fetch(`/api/journey/${route}`, body === undefined ? undefined : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const value = await response.json();
  if (!response.ok) throw new Error(value.error ?? value.issues?.join('\n') ?? 'Request failed');
  return value;
}
const friendly = (key) => ({ reflectMs: 'Rest after this episode (hours)', ms: 'Waiting period (hours)', count: 'Required count', quantity: 'Required quantity', coins: 'Coin reward', bond: 'Bond reward', level: 'Required level', prompt: 'Question', reply: 'Response', definitionId: 'Merge item' }[key] ?? key[0].toUpperCase() + key.slice(1));
export function JourneyStudio() {
  const [catalog, setCatalog] = useState(null), [draft, setDraft] = useState(null), [selected, setSelected] = useState(0);
  const [message, setMessage] = useState('Loading Mossprout’s arc…'), [issues, setIssues] = useState([]), [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState([]), [loadName, setLoadName] = useState(''), [search, setSearch] = useState('');
  const [walk, setWalk] = useState(null), [nodeId, setNodeId] = useState(null), [reply, setReply] = useState('');
  const [previewJson, setPreviewJson] = useState('');
  useEffect(() => {
    let alive = true;
    Promise.all([api('source'), api('drafts')]).then(([data, files]) => {
      if (!alive) return;
      setCatalog(data); setSaved(files.drafts); setSelected(Math.max(0, data.source.chapter.episodes.findIndex((e) => e.beats)));
      let stored; try { stored = JSON.parse(localStorage.getItem(localKey)); } catch { /* server drafts remain available */ }
      setDraft(stored?.kind === 'journey-draft' ? stored : data.draft);
      setMessage(stored ? 'Restored this browser’s draft. Validate before exporting.' : 'Mossprout · Growing Again is ready to edit.');
    }).catch((error) => alive && setMessage(error.message));
    return () => { alive = false; };
  }, []);
  useEffect(() => { if (draft) { try { localStorage.setItem(localKey, JSON.stringify(draft)); } catch { setMessage('Browser storage is full. Save a versioned draft to keep your edits.'); } } }, [draft]);
  useEffect(() => {
    const warn = (event) => { if (draft && (Object.keys(draft.edits).length || draft.tileArt)) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [draft]);
  async function run(task) { if (busy) return; setBusy(true); try { await task(); } catch (error) { setMessage(error.message); } finally { setBusy(false); } }
  function change(next) { setDraft(next); setIssues([]); setWalk(null); setPreviewJson(''); setMessage('Draft changed · saved in this browser'); }
  function edit(path, value) { change({ ...draft, edits: { ...draft.edits, [path]: value } }); }
  if (!catalog || !draft) return <div className="journey-loading" role="status">{message}</div>;
  const chapter = catalog.source.chapter, episode = chapter.episodes[selected];
  const conversationIndex = catalog.source.conversations.findIndex((entry) => entry.id === episode.conversationId);
  const fields = catalog.fields.filter((field) => field.path.startsWith(`chapter/episodes/${selected}/`) || (conversationIndex >= 0 && field.path.startsWith(`conversations/${conversationIndex}/`)));
  const valueOf = (field) => draft.edits[field.path] ?? field.value;
  function fieldInput(field) {
    const time = field.label === 'ms' || field.label === 'reflectMs';
    const value = valueOf(field);
    return <label className="field" key={field.path}><span>{friendly(field.label)} <small>{field.path.replace(`chapter/episodes/${selected}/`, '').replace(/^conversations\/\d+\//, '')}</small></span>
      {field.options ? <select value={value} onChange={(e) => edit(field.path, e.target.value)}>{field.options.map((option) => <option key={option.id} value={option.id}>{option.name} · {option.id}</option>)}</select>
        : typeof field.value === 'number' ? <input type="number" step={time ? '0.25' : '1'} min={field.min} max={time ? field.max / 3600000 : field.max} value={time ? value / 3600000 : value} onChange={(e) => edit(field.path, e.target.value === '' ? '' : Number(e.target.value) * (time ? 3600000 : 1))}/>
          : <textarea value={value} rows={value.length > 100 ? 3 : 2} maxLength={field.max} onChange={(e) => edit(field.path, e.target.value)}/>}
    </label>;
  }
  const asset = catalog.assets.find((entry) => entry.id === (draft.tileArt ?? catalog.defaultArt));
  const node = walk?.conversation?.nodes.find((entry) => entry.id === nodeId);
  return <div className="journey-studio">
    <header><a className="brand" href="/journeys">Katchimeras<span>Content Studio / Journey draft</span></a><div className="toolbar"><a href="/characters">Characters</a><a href="/">Live events</a><a href="/arcs">New arc</a><button disabled={busy} onClick={() => run(async () => { const result = await api('drafts', draft); setSaved((await api('drafts')).drafts); setMessage(`Saved ${result.saved}`); setIssues(result.issues); })}>Save draft</button><button disabled={busy} onClick={() => run(async () => { const result = await api('validate', draft); setIssues(result.issues); setMessage(result.issues.length ? 'Resolve these issues before previewing.' : 'Valid draft · IDs and progression links preserved'); })}>Validate</button><button className="primary" disabled={busy} onClick={() => run(async () => {
      const preview = await api('preview', draft); const text = JSON.stringify(preview); setPreviewJson(text);
      const url = URL.createObjectURL(new Blob([text], { type: 'application/json' })); const link = document.createElement('a'); link.href = url; link.download = 'mossprout-journey-preview.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage('Preview exported. In the game, open Developer Tools → Content Packs → Journey draft preview and paste the preview JSON.');
    })}>Export game preview</button></div></header>
    <div className="journey-status" role="status">{busy ? 'Working…' : message}{issues.map((issue) => <p className="error" key={issue}>{issue}</p>)}</div>
    <main className="journey-layout"><aside className="journey-outline"><div className="eyebrow">Mossprout / 32 episodes</div><h2>Growing Again</h2><input aria-label="Find episode" placeholder="Find an episode…" value={search} onChange={(e) => setSearch(e.target.value)}/>
      <nav aria-label="Journey episodes">{chapter.episodes.map((entry, index) => ({ entry, index })).filter(({ entry }) => entry.title.toLowerCase().includes(search.toLowerCase())).map(({ entry, index }) => <button disabled={busy} className={index === selected ? 'selected' : ''} key={entry.id} onClick={() => { setSelected(index); setWalk(null); }}><span>{String(index + 1).padStart(2, '0')}</span>{draft.edits[`chapter/episodes/${index}/title`] ?? entry.title}<small>{entry.flavour} {entry.dayOne ? '· first meeting' : ''}</small></button>)}</nav>
      <label className="field"><span>Saved drafts</span><select value={loadName} onChange={(e) => setLoadName(e.target.value)}><option value="">Choose a saved version</option>{saved.map((name) => <option key={name}>{name}</option>)}</select></label>
      <button disabled={busy || !loadName} onClick={() => { if (confirm('Replace this workspace with the saved draft? Current edits are stored in this browser; save a version first if needed.')) run(async () => { change(await api(`drafts/${loadName}`)); }); }}>Load draft</button>
      <button disabled={busy} onClick={() => { if (confirm('Start from the current bundled arc? Save your draft first to keep a version.')) change(catalog.draft); }}>Reset to source</button>
    </aside><section className="journey-editor"><div className="eyebrow">Episode {selected + 1} / {episode.id}</div><h1>{draft.edits[`chapter/episodes/${selected}/title`] ?? episode.title}</h1>
      <p className="intro">Edit copy, unlock thresholds and merge objectives. Existing IDs, episode links and mission mechanics stay fixed in this first slice.</p>
      <fieldset disabled={busy}><details><summary>Chapter settings</summary><label className="field"><span>Draft name</span><input value={draft.name} onChange={(e) => change({ ...draft, name: e.target.value })}/></label>{catalog.fields.filter((field) => ['chapter/title','chapter/purpose','chapter/reflectMs','chapter/lines/foreshadow','chapter/lines/complete'].includes(field.path)).map(fieldInput)}</details>
      <div className="journey-gates"><h2>Progression links</h2>{episode.unlock.map((gate, index) => <p key={index}>{gate.kind.replaceAll('_', ' ')}{gate.episodeId ? ` → ${chapter.episodes.find((entry) => entry.id === gate.episodeId)?.title ?? gate.episodeId}` : gate.tileId ? ` → ${gate.tileId}` : ''}</p>)}</div>
      {fields.map(fieldInput)}</fieldset>
      <button disabled={busy} onClick={() => run(async () => { const result = await api('walkthrough', { draft, index: selected }); setWalk(result); setNodeId(result.conversation?.entryNodeId); setReply(''); setMessage('Dialogue compiled with the game’s Journey compiler. Base copy preview; personalisation is not simulated.'); })}>Walk through dialogue</button>
      {walk && <section className="journey-dialogue"><h2>Mossprout</h2>{reply && <p className="muted">{reply}</p>}<p>{node?.prompt ?? node?.message ?? (walk.conversation ? (nodeId ? 'This node uses a game interaction outside this walkthrough.' : 'Dialogue complete.') : 'This episode uses its existing game flow rather than a conversation.')}</p>{node?.options?.map((option) => <button key={option.id} onClick={() => { setReply(option.reply ?? ''); setNodeId(option.nextNodeId ?? null); }}>{option.label}</button>)}</section>}
    </section><section className="journey-art"><div className="eyebrow">Linked world tile</div><h2>The Old Grove</h2>{asset && <img className="journey-tile" src={asset.url} alt="Assigned Old Grove hex tile"/>}<p className="muted">Hex q 0 · r 3. Revealed by “The Old Garden”; revisited by “The Wisp in the Grove”.</p>
      <fieldset disabled={busy}><label className="field"><span>Tile image</span><select value={draft.tileArt ?? catalog.defaultArt} onChange={(e) => change({ ...draft, tileArt: e.target.value })}>{catalog.assets.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>
      <label className="field"><span>Upload image · PNG / WebP / JPEG, under 1.8 MB</span><input type="file" accept="image/png,image/webp,image/jpeg" onChange={(e) => { const file = e.target.files[0]; if (!file) return; if (file.size > 1800000) { setMessage('Use an image smaller than 1.8 MB'); return; } run(async () => { const data = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); }); const result = await api('upload', { data, name: file.name }); setCatalog({ ...catalog, assets: [...catalog.assets.filter((a) => a.id !== result.asset.id), result.asset] }); change({ ...draft, tileArt: result.asset.id }); }); }}/></label>
      {catalog.fields.filter((field) => field.path.startsWith('tiles/')).map(fieldInput)}</fieldset>
      <p className="preview-note">Draft preview only. Images are embedded in the export so the in-app walkthrough can run offline. This does not publish content or replace a player’s world.</p>
      {previewJson && <><button onClick={() => run(async () => { await navigator.clipboard.writeText(previewJson); setMessage('Preview JSON copied. Paste it into the in-app Journey draft preview.'); })}>Copy preview JSON</button><details><summary>Preview JSON</summary><textarea aria-label="Exported preview JSON" readOnly value={previewJson} rows={5}/></details></>}
    </section></main>
  </div>;
}
