const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');

module.exports = function journeyApi(app, { moduleAt, wrap, drafts }) {
  const directory = path.join(drafts, 'journeys');
  const uploads = path.join(directory, 'assets');
  const artRoot = path.dirname(require.resolve('@incubator/art-world/hex/shared_world_mossprout_old_grove_hex_tile_v1_512.webp'));
  const api = () => moduleAt('features/content-authoring/journey-draft.ts');
  const arcApi = () => moduleAt('features/content-authoring/arc-builder.ts');
  const arcAssets = require('./arc-assets.cjs')(app, { drafts, wrap, compile: (draft) => arcApi().compileArcDraft(draft) });
  app.get('/api/arcs/source', wrap(async (_req, res) => res.json({ ...arcApi().arcCatalog(), draft: arcApi().newArcDraft() })));
  app.post('/api/arcs/validate', wrap(async (req, res) => { const { pack, issues } = await arcAssets.prepare(req.body); res.json({ pack, issues }); }));
  app.post('/api/arcs/export', wrap(async (req, res) => {
    const checked = await arcAssets.prepare(req.body);
    if (!checked.pack) return res.status(400).json({ issues: checked.issues });
    res.json(checked.pack);
  }));
  const arcDirectory = path.join(drafts, 'arcs');
  app.get('/api/arcs/drafts', wrap(async (_req, res) => {
    await fs.mkdir(arcDirectory, { recursive: true });
    res.json({ drafts: (await fs.readdir(arcDirectory)).filter((name) => /^arc-[a-z0-9-]+\.json$/.test(name)).sort().reverse() });
  }));
  app.get('/api/arcs/drafts/:name', wrap(async (req, res) => {
    if (!/^arc-[a-z0-9-]+\.json$/.test(req.params.name)) throw new Error('Invalid draft filename');
    res.json(JSON.parse(await fs.readFile(path.join(arcDirectory, req.params.name), 'utf8')));
  }));
  app.post('/api/arcs/drafts', wrap(async (req, res) => {
    if (req.body?.kind !== 'arc-draft' || req.body.version !== 1 || !Array.isArray(req.body.episodes) || !Array.isArray(req.body.tiles)) throw new Error('Invalid arc draft');
    await fs.mkdir(arcDirectory, { recursive: true });
    const name = `arc-${Date.now()}-${randomUUID()}.json`;
    await fs.writeFile(path.join(arcDirectory, name), JSON.stringify(req.body, null, 2), { flag: 'wx' });
    res.json({ saved: name });
  }));
  const valid = (name) => typeof name === 'string' && /^[a-zA-Z0-9_.-]+$/.test(name) && !name.includes('..');
  async function assets() {
    await fs.mkdir(uploads, { recursive: true });
    const bundled = (await fs.readdir(artRoot)).filter((name) => /_512\.webp$/.test(name));
    const uploaded = (await fs.readdir(uploads)).filter((name) => /^upload-[a-f0-9]{64}\.(png|webp|jpeg)$/.test(name));
    return [...bundled, ...uploaded].map((id) => ({ id, name: id.replace(/^shared_world_|_hex_tile|_512\.webp$/g, '').replaceAll('_', ' '), url: `/api/journey/assets/${id}` }));
  }
  async function assetFile(id) {
    if (!valid(id) || !(await assets()).some((asset) => asset.id === id)) throw new Error('Unknown image asset');
    return path.join(id.startsWith('upload-') ? uploads : artRoot, id);
  }
  async function check(draft) {
    const checked = api().validateJourneyDraft(draft);
    if (checked.draft?.tileArt) {
      try { await assetFile(checked.draft.tileArt); } catch { checked.issues.push('Assigned tile image is missing'); checked.draft = null; }
    }
    return checked;
  }
  app.get('/api/journey/source', wrap(async (_req, res) => res.json({ ...api().journeyAuthoringSource(), assets: await assets(), defaultArt: 'shared_world_mossprout_old_grove_hex_tile_v1_512.webp' })));
  app.get('/api/journey/assets/:id', wrap(async (req, res) => res.sendFile(await assetFile(req.params.id))));
  app.post('/api/journey/upload', wrap(async (req, res) => {
    const matched = typeof req.body.data === 'string' && req.body.data.match(/^data:image\/(png|webp|jpeg);base64,([A-Za-z0-9+/=]+)$/);
    if (!matched) throw new Error('Upload a PNG, JPEG or WebP image');
    const buffer = Buffer.from(matched[2], 'base64');
    if (!buffer.length || buffer.length > 1800000) throw new Error('Use an image smaller than 1.8 MB');
    const magic = matched[1] === 'png' ? buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
      : matched[1] === 'jpeg' ? buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255
      : buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
    if (!magic) throw new Error('Image bytes do not match their format');
    const id = `upload-${createHash('sha256').update(buffer).digest('hex')}.${matched[1]}`;
    await fs.mkdir(uploads, { recursive: true });
    try { await fs.writeFile(path.join(uploads, id), buffer, { flag: 'wx' }); } catch (error) { if (error.code !== 'EEXIST') throw error; }
    res.json({ asset: { id, name: req.body.name ?? 'Uploaded tile', url: `/api/journey/assets/${id}` }, bytes: buffer.length });
  }));
  app.post('/api/journey/validate', wrap(async (req, res) => res.json(await check(req.body))));
  app.post('/api/journey/walkthrough', wrap(async (req, res) => {
    const checked = await check(req.body.draft);
    if (!checked.draft) return res.status(400).json({ issues: checked.issues });
    res.json(api().previewJourneyEpisode(checked.draft, req.body.index));
  }));
  app.post('/api/journey/preview', wrap(async (req, res) => {
    const checked = await check(req.body);
    if (!checked.draft) return res.status(400).json({ issues: checked.issues });
    const id = checked.draft.tileArt ?? 'shared_world_mossprout_old_grove_hex_tile_v1_512.webp';
    const image = await fs.readFile(await assetFile(id));
    const format = path.extname(id).slice(1);
    res.json({ kind: 'journey-preview', version: 1, draft: checked.draft, image: `data:image/${format};base64,${image.toString('base64')}` });
  }));
  app.get('/api/journey/drafts', wrap(async (_req, res) => {
    await fs.mkdir(directory, { recursive: true });
    res.json({ drafts: (await fs.readdir(directory)).filter((name) => /^journey-[a-z0-9-]+\.json$/.test(name)).sort().reverse() });
  }));
  app.get('/api/journey/drafts/:name', wrap(async (req, res) => {
    if (!/^journey-[a-z0-9-]+\.json$/.test(req.params.name)) throw new Error('Invalid draft filename');
    res.json(JSON.parse(await fs.readFile(path.join(directory, req.params.name), 'utf8')));
  }));
  app.post('/api/journey/drafts', wrap(async (req, res) => {
    // Incomplete edits may be saved; they cannot be exported until validation passes.
    if (req.body?.kind !== 'journey-draft' || req.body.version !== 1) throw new Error('Invalid draft');
    await fs.mkdir(directory, { recursive: true });
    const name = `journey-${Date.now()}-${randomUUID()}.json`;
    await fs.writeFile(path.join(directory, name), JSON.stringify(req.body, null, 2), { flag: 'wx' });
    res.json({ saved: name, issues: (await check(req.body)).issues });
  }));
};
