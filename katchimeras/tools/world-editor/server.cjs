const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const express = require('express');

const {
  ROOT,
  CATALOG_PATH,
  LAYOUT_PATH,
  WORLD_ASSET_DIR,
  BACKUP_DIR,
  TMP_DIR,
  assertInside,
  repoRelative,
  resolveRepoPath,
} = require('./lib/paths.cjs');
const { discoverWorldObjectAssets } = require('./lib/asset-registry.cjs');
const { readJson, validateDesignData } = require('./lib/validation.cjs');

const PORT = Number(process.env.WORLD_EDITOR_PORT || 5177);
const PYTHON = process.env.PYTHON || 'python';

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function backupFile(absPath, reason) {
  if (!fs.existsSync(absPath)) return null;
  assertInside(absPath, WORLD_ASSET_DIR);
  const rel = repoRelative(absPath);
  const backupPath = path.join(BACKUP_DIR, reason, stamp(), rel);
  ensureDir(path.dirname(backupPath));
  fs.copyFileSync(absPath, backupPath);
  return repoRelative(backupPath);
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: ROOT, shell: false, ...options });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${command} ${args.join(' ')} failed (${code})\n${stderr || stdout}`));
    });
  });
}

function findFamily(catalog, familyId) {
  return catalog.families.find((family) => family.id === familyId);
}

function findAsset(family, assetKey) {
  return family.assets.find((asset) => asset.assetKey === assetKey);
}

function saveCatalog(nextCatalog) {
  const layout = readJson(LAYOUT_PATH);
  const validation = validateDesignData(nextCatalog, layout);
  if (!validation.ok) {
    const error = new Error('Catalog validation failed.');
    error.validation = validation;
    throw error;
  }
  ensureDir(BACKUP_DIR);
  const backupPath = path.join(BACKUP_DIR, 'catalog', `world-object-design-catalog-${stamp()}.json`);
  ensureDir(path.dirname(backupPath));
  fs.copyFileSync(CATALOG_PATH, backupPath);
  fs.writeFileSync(CATALOG_PATH, `${JSON.stringify(nextCatalog, null, 2)}\n`);
  return { validation, backup: repoRelative(backupPath) };
}

function slug(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
}

function uniqueAssetKey(family, sourcePath) {
  const keys = new Set((family.assets ?? []).map((asset) => asset.assetKey));
  const baseName = slug(path.basename(sourcePath, path.extname(sourcePath))) || 'variant';
  const familyName = slug(family.generator?.name ?? family.id ?? 'asset');
  let candidate = `${familyName}_${baseName}`;
  let index = 2;
  while (keys.has(candidate)) {
    candidate = `${familyName}_${baseName}_${index}`;
    index += 1;
  }
  return candidate;
}

function copySelectedArtIntoSlot(asset, sourcePath) {
  const sourceAbs = assertInside(resolveRepoPath(sourcePath), WORLD_ASSET_DIR);
  const targetAbs = assertInside(resolveRepoPath(asset.path), WORLD_ASSET_DIR);
  if (!fs.existsSync(sourceAbs)) throw new Error(`Source asset does not exist: ${sourcePath}`);
  if (!fs.existsSync(targetAbs)) throw new Error(`Target asset does not exist: ${asset.path}`);
  const backup = backupFile(targetAbs, asset.assetKey);
  if (path.resolve(sourceAbs) !== path.resolve(targetAbs)) {
    fs.copyFileSync(sourceAbs, targetAbs);
  }
  return backup ? [backup] : [];
}

function familyAssetPaths(family) {
  return [...new Set((family.assets ?? []).map((asset) => asset.path).filter(Boolean))];
}

async function regenerateFamily(family, prompt) {
  if (family.generator?.type !== 'grid') {
    throw new Error(`Family ${family.id} does not have a grid generator.`);
  }
  const backups = [];
  for (const rel of familyAssetPaths(family)) {
    const abs = assertInside(resolveRepoPath(rel), WORLD_ASSET_DIR);
    const backup = backupFile(abs, family.id);
    if (backup) backups.push(backup);
  }
  const generator = family.generator;
  const args = [
    'scripts/generate-world-object-grid.py',
    '--name',
    generator.name,
    '--subject',
    prompt || family.prompt,
    '--ref',
    generator.ref || 'base_env2',
    '--mode',
    generator.mode || 'variants',
    '--frame',
    generator.frame || 'iso',
    '--style',
    generator.style || 'collectible',
    '--force',
  ];
  const output = await run(PYTHON, args);
  return { backups, output };
}

async function regenerateSelected(asset, prompt) {
  if (!prompt || !prompt.trim()) throw new Error('Selected-asset regeneration needs a prompt.');
  const outPath = assertInside(resolveRepoPath(asset.path), WORLD_ASSET_DIR);
  const backup = backupFile(outPath, asset.assetKey);
  ensureDir(TMP_DIR);
  const rawPath = path.join(TMP_DIR, `${asset.assetKey}-${Date.now()}-raw.png`);
  const safeName = asset.assetKey.replace(/_/g, '-').toLowerCase();
  const generated = await run(PYTHON, [
    'scripts/asset-pipeline.py',
    'generate',
    '--id',
    `world-editor-${asset.assetKey}`,
    '--prompt',
    prompt,
    '--out',
    rawPath,
  ]);
  const matted = await run(PYTHON, [
    'scripts/asset-pipeline.py',
    'matte',
    '--name',
    safeName,
    '--in',
    rawPath,
    '--out',
    outPath,
  ]);
  return { backups: backup ? [backup] : [], output: { stdout: `${generated.stdout}\n${matted.stdout}`, stderr: `${generated.stderr}\n${matted.stderr}` } };
}

async function main() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));
  app.use('/assets', express.static(path.join(ROOT, 'assets'), { etag: false, maxAge: 0 }));

  app.get('/api/catalog', (_req, res) => {
    const catalog = readJson(CATALOG_PATH);
    const layout = readJson(LAYOUT_PATH);
    res.json({
      catalog,
      layout,
      discoveredAssets: discoverWorldObjectAssets(),
      validation: validateDesignData(catalog, layout),
    });
  });

  app.get('/api/layout', (_req, res) => {
    res.json(readJson(LAYOUT_PATH));
  });

  app.post('/api/catalog', (req, res) => {
    try {
      const nextCatalog = req.body;
      const result = saveCatalog(nextCatalog);
      return res.json({ ok: true, catalog: nextCatalog, ...result });
    } catch (error) {
      return res.status(400).json({ ok: false, error: error.message, validation: error.validation });
    }
  });

  app.post('/api/layout', (req, res) => {
    const catalog = readJson(CATALOG_PATH);
    const nextLayout = req.body;
    const validation = validateDesignData(catalog, nextLayout);
    if (!validation.ok) return res.status(400).json(validation);
    ensureDir(BACKUP_DIR);
    const backupPath = path.join(BACKUP_DIR, 'layout', `world-structure-layout-${stamp()}.json`);
    ensureDir(path.dirname(backupPath));
    fs.copyFileSync(LAYOUT_PATH, backupPath);
    fs.writeFileSync(LAYOUT_PATH, `${JSON.stringify(nextLayout, null, 2)}\n`);
    return res.json({ ok: true, validation, backup: repoRelative(backupPath), layout: nextLayout });
  });

  app.post('/api/validate', (req, res) => {
    const catalog = req.body?.catalog ?? readJson(CATALOG_PATH);
    const layout = req.body?.layout ?? readJson(LAYOUT_PATH);
    res.json(validateDesignData(catalog, layout));
  });

  app.post('/api/asset-slot', (req, res) => {
    try {
      const catalog = readJson(CATALOG_PATH);
      const family = findFamily(catalog, req.body?.familyId);
      if (!family) return res.status(404).json({ ok: false, error: 'Unknown family.' });
      const sourcePath = String(req.body?.sourcePath ?? '');
      assertInside(resolveRepoPath(sourcePath), WORLD_ASSET_DIR);
      if (req.body?.mode === 'variant') {
        const variantNumber = (family.assets ?? []).length + 1;
        const variant = {
          assetKey: uniqueAssetKey(family, sourcePath),
          label: `Variant ${variantNumber}`,
          state: `variant-${variantNumber}`,
          path: repoRelative(resolveRepoPath(sourcePath)),
        };
        family.assets = [...(family.assets ?? []), variant];
        const saved = saveCatalog(catalog);
        return res.json({
          ok: true,
          mode: 'variant',
          newAsset: variant,
          catalog,
          discoveredAssets: discoverWorldObjectAssets(),
          cacheBust: Date.now(),
          ...saved,
        });
      }
      const asset = findAsset(family, req.body?.assetKey);
      if (!asset) return res.status(404).json({ ok: false, error: 'Unknown asset.' });
      const backups = copySelectedArtIntoSlot(asset, sourcePath);
      return res.json({
        ok: true,
        mode: 'replace',
        backups,
        catalog,
        discoveredAssets: discoverWorldObjectAssets(),
        cacheBust: Date.now(),
      });
    } catch (error) {
      return res.status(400).json({ ok: false, error: error.message, validation: error.validation });
    }
  });

  app.post('/api/regenerate', async (req, res) => {
    try {
      const catalog = readJson(CATALOG_PATH);
      const family = findFamily(catalog, req.body?.familyId);
      if (!family) return res.status(404).json({ ok: false, error: 'Unknown family.' });
      const scope = req.body?.scope === 'family' ? 'family' : 'selected';
      const prompt = String(req.body?.prompt ?? family.prompt ?? '').trim();
      let result;
      if (scope === 'family') {
        result = await regenerateFamily(family, prompt);
      } else {
        const asset = findAsset(family, req.body?.assetKey);
        if (!asset) return res.status(404).json({ ok: false, error: 'Unknown asset.' });
        result = await regenerateSelected(asset, prompt);
      }
      res.json({
        ok: true,
        backups: result.backups,
        stdout: result.output.stdout,
        stderr: result.output.stderr,
        cacheBust: Date.now(),
        assets: discoverWorldObjectAssets().map((asset) => ({ ...asset, url: `${asset.url}?v=${Date.now()}` })),
      });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    root: path.join(ROOT, 'tools', 'world-editor'),
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);

  app.listen(PORT, () => {
    console.log(`World editor: http://localhost:${PORT}`);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
