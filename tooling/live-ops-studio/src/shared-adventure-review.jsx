import React, { useEffect, useState } from 'react';

export function SharedAdventureReview() {
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
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
    <main><section className="editor"><h1>{report?.adventure.title ?? 'Shared adventure'}</h1>
      {error ? <p role="alert">{error}</p> : null}
      {report ? <><p>{report.adventure.destination}</p><p>{report.rollout}</p>
        <p>{report.issues.length ? report.issues.join('; ') : 'Validation passed: all four mission boards reach their final delivery.'}</p>
        <a href="/api/shared-adventure-review" download="first-answer-review.json">Export review JSON</a>
        {report.adventure.beats.map(beat => <article key={beat.id}><h2>{beat.title}</h2><p>{beat.speaker}</p>{beat.lines.map((line, index) => <p key={index}>{line}</p>)}</article>)}
        <h2>Garden requests</h2>{report.orders.map(order => <p key={order.id}>{order.title}: {order.requirements.map(item => `${item.quantity} × ${item.definitionId}`).join(', ')} · {order.reward.coins} Glow</p>)}
        <h2>Lantern Routes</h2><p>{report.economy}</p>{report.routes.map(route => <p key={route.id}>{route.title}: {route.required} merges → {route.finalItem} · {route.solvable ? 'Solvable' : 'Needs repair'}</p>)}
      </> : !error ? <p>Loading bundled content…</p> : null}
    </section></main></>;
}
