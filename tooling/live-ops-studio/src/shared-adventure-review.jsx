import React, { useEffect, useState } from 'react';

export function SharedAdventureReview() {
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [openingScene, setOpeningScene] = useState('introduction');
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/shared-adventure-review', { signal: controller.signal }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Review could not load');
      setReport(data);
    }).catch(e => { if (e.name !== 'AbortError') setError(e.message); });
    return () => controller.abort();
  }, []);
  return <><header><a className="brand" href="/">Katchimeras<span>Shared adventure review</span></a></header>
    <main style={{ display: 'block', maxWidth: 1000 }}><section className="editor" style={{ lineHeight: 1.6 }}><h1>{report?.adventure.title ?? 'Shared adventure'}</h1>
      {error ? <p role="alert">{error}</p> : null}
      {report ? <><p>{report.adventure.destination}</p><p>{report.rollout}</p>
        <p>{report.issues.length ? report.issues.join('; ') : 'Validation passed: all four mission boards reach their final delivery.'}</p>
        <a href="/api/shared-adventure-review" download="first-answer-review.json">Export review JSON</a>
        {report.opening ? <section aria-label="Opening storyboard">
          <h2>The opening, before the first seed</h2>
          <p>Storyboard using bundled game copy and art. This is a content preview, not a recorded gameplay session.</p>
          <p>{report.opening.copy.opening}</p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {Object.entries(report.opening.scenes).map(([id, scene]) => <button key={id} aria-pressed={openingScene === id} onClick={() => setOpeningScene(id)}>{scene.title}</button>)}
          </div>
          <article style={{ maxWidth: 390, padding: 20, background: '#FFF2D3', color: '#254939', borderRadius: 24 }}>
            <div style={{ position: 'relative', aspectRatio: '1', overflow: 'hidden', borderRadius: 20 }}>
              <img alt="Heartwood recovering at the center of our world" style={{ width: '100%' }} src={report.opening.art[openingScene === 'signal' ? 'stirring' : 'dormant']} />
            </div>
            <h3>{report.opening.scenes[openingScene].title}</h3>
            <p>{report.opening.scenes[openingScene].text}</p><p>{report.opening.scenes[openingScene].detail}</p>
            <strong>{report.opening.scenes[openingScene].action}</strong>
          </article>
          <h3>First meeting · all paths establish Heartwood</h3>
          {report.opening.greetings.map(option => <p key={option.id}><strong>{option.label}</strong><br />{option.reply}</p>)}
          <h3>{report.opening.bond.prompt}</h3>
          {report.opening.bond.choices.map(option => <p key={option.id}><strong>{option.label}</strong><br />{option.reply}</p>)}
          <h3>Handoff to Steppling</h3><p>{report.opening.copy.farewell}</p>
        </section> : null}
        {report.adventure.beats.map(beat => <article key={beat.id}><h2>{beat.title}</h2><p>{beat.speaker}</p>{beat.lines.map((line, index) => <p key={index}>{line}</p>)}</article>)}
        <h2>Garden requests</h2>{report.orders.map(order => <p key={order.id}>{order.title}: {order.requirements.map(item => `${item.quantity} × ${item.definitionId}`).join(', ')} · {order.reward.coins} Glow</p>)}
        <h2>Lantern Routes</h2><p>{report.economy}</p>{report.routes.map(route => <p key={route.id}>{route.title}: {route.required} merges → {route.finalItem} · {route.solvable ? 'Solvable' : 'Needs repair'}</p>)}
      </> : !error ? <p>Loading bundled content…</p> : null}
    </section></main></>;
}
