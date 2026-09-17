import React from 'react';

export function LocalEventEditor({ event, update }) {
  const nodes = event.encounters ?? [];
  const change = (index, patch) => update({ encounters: nodes.map((n, i) => i === index ? { ...n, ...patch } : n) });
  return <section>
    <h2>Offline world event</h2>
    <p>Local rewards stay on this device. Gems and premium rewards use the separate verified service.</p>
    <label className="field"><span>Available in exported pack</span><input type="checkbox" checked={event.enabled} onChange={e => update({ enabled: e.target.checked })} /></label>
    <label className="field"><span>Requires restored Mossprout garden</span><input type="checkbox" checked={event.requiresRestoredGarden} onChange={e => update({ requiresRestoredGarden: e.target.checked })} /></label>
    <h3>World encounters in order</h3><p>Opening and resolution play on the companion’s tile. The action card stays available between them. Supplies use normal Merge orders; clearing uses the existing docked mission board. Companion and tile IDs must match installed content. Export with content schema 4.</p>
    {nodes.map((node, i) => <fieldset key={i}><legend>{i + 1}. {node.title}</legend>
      {['id', 'title', 'actionTitle', 'companionId', 'opening', 'resolution', 'seedItemId'].map(key => <label className="field" key={key}><span>{key}</span>{key === 'opening' || key === 'resolution' ? <textarea value={node[key] ?? ''} onChange={e => change(i, { [key]: e.target.value })} /> : <input value={node[key] ?? ''} onChange={e => change(i, { [key]: e.target.value })} />}</label>)}
      <label className="field"><span>World tile</span><input value={node.hexId} onChange={e => change(i, { hexId: e.target.value })} /></label>
      <label className="field"><span>Merges to clear (1–7)</span><input type="number" min="1" max="7" value={node.merges} onChange={e => change(i, { merges: Number(e.target.value) })} /></label>
      <label className="field"><span>Action tags (comma separated)</span><input value={(node.tags ?? []).join(',')} onChange={e => change(i, { tags: e.target.value.split(',').map(v => v.trim()).filter(Boolean) })} /></label>
      {node.requirements.map((r, j) => <div className="two" key={j}><label className="field"><span>Required item</span><input value={r.definitionId} onChange={e => change(i, { requirements: node.requirements.map((v, k) => k === j ? { ...v, definitionId: e.target.value } : v) })} /></label><label className="field"><span>Quantity</span><input type="number" min="1" value={r.quantity} onChange={e => change(i, { requirements: node.requirements.map((v, k) => k === j ? { ...v, quantity: Number(e.target.value) } : v) })} /></label></div>)}
      <button onClick={() => change(i, { requirements: [...node.requirements, { definitionId: 'nature:garden:2', quantity: 1 }] })}>Add requirement</button>
      <button disabled={i === 0} onClick={() => { const reordered = [...nodes]; [reordered[i - 1], reordered[i]] = [reordered[i], reordered[i - 1]]; update({ encounters: reordered }); }}>Move earlier</button>
      <button onClick={() => update({ encounters: nodes.length > 1 ? nodes.filter((_, k) => k !== i) : undefined })}>Remove encounter</button>
      <details><summary>Preview encounter flow</summary><p>{node.opening}</p><p>Make {node.requirements.map(r => `${r.quantity} × ${r.definitionId}`).join(', ')} → serve the order → clear {node.merges} merges on the in-world mission board → return to the companion.</p><p>{node.resolution}</p></details>
    </fieldset>)}
    <button onClick={() => update({ encounters: [...nodes, { id: `node-${nodes.length + 1}`, hexId: 'mossprout-garden', title: 'A little returning Mist', companionId: 'mossprout', actionTitle: 'Investigate the Mist', opening: 'Mossprout has found something among the leaves.', resolution: 'The garden is clear again.', requirements: [{ definitionId: 'nature:garden:2', quantity: 1 }], seedItemId: 'nature:garden:1', merges: 3, tags: [] }] })}>Add encounter</button>
    <h3>Permanent keepsakes</h3>
    {(event.keepsakes ?? []).map((k, i) => <fieldset key={i}><legend>{k.title}</legend>{['id', 'title', 'description'].map(key => <label className="field" key={key}><span>{key}</span><input value={k[key]} onChange={e => update({ keepsakes: event.keepsakes.map((v, j) => i === j ? { ...v, [key]: e.target.value } : v) })} /></label>)}<label className="field"><span>Decoration</span><select value={k.symbol} onChange={e => update({ keepsakes: event.keepsakes.map((v, j) => i === j ? { ...v, symbol: e.target.value } : v) })}><option value="moon">Moon lantern</option><option value="flower">Grove blossom</option></select></label></fieldset>)}
    <button onClick={() => update({ keepsakes: [...(event.keepsakes ?? []), { id: `keepsake-${(event.keepsakes?.length ?? 0) + 1}`, title: 'A garden memory', description: 'A keepsake from this visit.', symbol: 'moon', hexId: 'mossprout-garden' }] })}>Add keepsake</button>
    <label className="field"><span>Guaranteed encounter completion keepsake</span><select value={event.completionKeepsakeId ?? ''} onChange={e => update({ completionKeepsakeId: e.target.value || undefined })}><option value="">None</option>{(event.keepsakes ?? []).map(k => <option key={k.id} value={k.id}>{k.title}</option>)}</select></label>
  </section>;
}
