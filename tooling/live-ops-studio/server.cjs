const express = require('express');
const fs = require('node:fs/promises');
const path = require('node:path');

const project = path.resolve(__dirname, '../../apps/katchimeras');
process.env.TSX_TSCONFIG_PATH = path.join(project, 'tsconfig.json');
require('tsx/cjs/api').register();
const drafts = path.join(__dirname, 'drafts');
const port = Number(process.env.LIVE_OPS_STUDIO_PORT || 5181);
const origin = `http://127.0.0.1:${port}`;
const imported = new Map();
function moduleAt(relative) {
  if (!imported.has(relative)) imported.set(relative, require(path.join(project, relative)));
  return imported.get(relative);
}
const wrap = (handler) => async (req, res) => { try { await handler(req, res); } catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : 'Operation failed' }); } };

async function main() {
  const app = express();
  app.use('/api', (req, res, next) => {
    if (req.headers.host !== `127.0.0.1:${port}`) return res.status(403).json({ error: 'Use the local Studio address' });
    if (req.method !== 'GET' && (req.headers.origin !== origin || !req.is('application/json'))) return res.status(403).json({ error: 'Same-origin JSON requests required' });
    next();
  });
  app.use(express.json({ limit: '3mb' }));
  app.get('/api/heartwood-art/:stage', (req, res) => {
    if (!['dormant', 'stirring', 'rooted'].includes(req.params.stage)) return res.sendStatus(404);
    res.sendFile(path.resolve(__dirname, '../../art/assets/images/katchimeras/world/hex', `heartwood_${req.params.stage}_512.webp`));
  });
  app.get('/api/shared-adventure-review', wrap(async (_, res) => {
    const { sharedAdventureReview } = moduleAt('features/shared-adventure/review.ts');
    res.json(sharedAdventureReview());
  }));
  require('./journey-api.cjs')(app, { moduleAt, wrap, drafts });
  require('./new-companion-api.cjs')(app, { moduleAt, wrap, drafts });
  app.get('/api/drafts', wrap(async (_, res) => {
    await fs.mkdir(drafts, { recursive: true });
    res.json({ drafts: (await fs.readdir(drafts)).filter((name) => /^[a-z0-9-]+\.json$/.test(name)).sort().reverse() });
  }));
  app.get('/api/drafts/:name', wrap(async (req, res) => {
    if (!/^[a-z0-9-]+\.json$/.test(req.params.name)) throw new Error('Invalid draft name');
    res.json(JSON.parse(await fs.readFile(path.join(drafts, req.params.name), 'utf8')));
  }));
  app.get('/api/catalog', wrap(async (_, res) => {
    const { MISSIONS_BUNDLED } = await moduleAt('constants/missions/registry.ts');
    const { STORY_TILES_BUNDLED } = await moduleAt('constants/story-tiles/registry.ts');
    res.json({ missions: MISSIONS_BUNDLED.map((mission) => mission.id), tiles: STORY_TILES_BUNDLED.map((tile) => ({ id: tile.id, name: tile.name })), stagingConfigured: Boolean(process.env.LIVE_OPS_SUPABASE_URL && process.env.LIVE_OPS_SERVICE_ROLE_KEY) });
  }));
  app.post('/api/validate', wrap(async (req, res) => {
    const { normalizeContentRelease } = await moduleAt('features/content-packs/normalize-release.ts');
    res.json(normalizeContentRelease([req.body.pack]));
  }));
  app.post('/api/simulate', wrap(async (req, res) => {
    const { validateLiveEvent } = await moduleAt('features/live-ops/validate.ts');
    const { emptyEventProgress, scoreGameplayEvent } = await moduleAt('features/live-ops/rules.ts');
    const validated = validateLiveEvent(req.body.event);
    if (!validated.definition) return res.status(400).json({ issues: validated.issues });
    const event = { ...validated.definition, enabled: true };
    let progress = emptyEventProgress(event);
    const ids = new Set();
    for (const [index, raw] of (Array.isArray(req.body.actions) ? req.body.actions : []).slice(0, 1000).entries()) {
      if (ids.has(raw.id)) continue;
      ids.add(raw.id);
      progress = scoreGameplayEvent(progress, event, { version: 1, source: 'merge-world', sourceRevision: index, contentRevision: 0, occurredAt: Date.parse(event.startsAt) + 1000, ...raw });
    }
    res.json({ progress, tiers: event.tiers.map((tier) => ({ ...tier, reached: progress.points >= tier.points })) });
  }));
  app.get('/api/local-event-template', wrap(async (req, res) => { const { createLocalEventPilot } = await moduleAt('features/live-ops/local-catalog.ts'); res.json(createLocalEventPilot()); }));
  app.post('/api/drafts', wrap(async (req, res) => {
    const { normalizeContentRelease } = await moduleAt('features/content-packs/normalize-release.ts');
    const checked = normalizeContentRelease([req.body.pack]);
    if (checked.issues.length) return res.status(400).json({ issues: checked.issues });
    const pack = checked.packs[0];
    if (!/^[a-z0-9][a-z0-9-]*$/.test(pack.id)) throw new Error('Draft IDs use lowercase letters, numbers and hyphens');
    await fs.mkdir(drafts, { recursive: true });
    const name = `${pack.id}-${pack.version}-${Date.now()}.json`;
    await fs.writeFile(path.join(drafts, name), JSON.stringify(pack, null, 2) + '\n', { flag: 'wx' });
    res.json({ saved: name });
  }));
  app.post('/api/stage', wrap(async (req, res) => {
    const url = process.env.LIVE_OPS_SUPABASE_URL;
    const key = process.env.LIVE_OPS_SERVICE_ROLE_KEY;
    if (!url || !key) return res.status(409).json({ error: 'Staging deployment is not configured on this workstation' });
    const { normalizeContentRelease } = await moduleAt('features/content-packs/normalize-release.ts');
    const checked = normalizeContentRelease([req.body.pack]);
    if (checked.issues.length) return res.status(400).json({ issues: checked.issues });
    const draft = checked.packs[0];
    if (draft.liveEvents?.some((event) => event.enabled)) return res.status(409).json({ error: 'Stage events disabled until verified claims and native purchase acceptance are complete' });
    // Availability lives on the database rows. Freeze playable definitions now
    // so later enablement does not require changing an installed manifest.
    const pack = { ...draft, ...(draft.liveEvents ? { liveEvents: draft.liveEvents.map((event) => ({ ...event, enabled: true })) } : {}) };
    // Definitions are immutable and disabled. A partial staging failure can be
    // retried safely; no player availability changes before release acceptance.
    for (const definition of (pack.liveEvents ?? []).filter(event => event.authority !== 'local')) {
      const staged = await fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/stage_live_event_definition_v1`, {
        method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_definition: definition }),
      });
      if (!staged.ok) return res.status(409).json({ error: 'Event staging failed. Check the verified-event migration and immutable event IDs. No content pack was published.' });
    }
    const response = await fetch(`${url.replace(/\/$/, '')}/rest/v1/content_packs`, {
      method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ id: pack.id, version: pack.version, content_schema_version: pack.contentSchemaVersion, manifest: pack, min_app_version: pack.minAppVersion ?? null, enabled: false }),
    });
    if (!response.ok) return res.status(409).json({ error: 'Staging rejected the release. Existing versions are immutable; choose a new release ID.' });
    res.json({ staged: `${pack.id}@${pack.version}`, enabled: false });
  }));
  const { createServer } = await import('vite');
  const vite = await createServer({ root: __dirname, server: { middlewareMode: true, allowedHosts: ['127.0.0.1'] }, appType: 'spa' });
  app.use(vite.middlewares);
  app.listen(port, '127.0.0.1', () => console.log(`Live Ops Studio: ${origin}`));
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
