const fs = require('fs');
const path = require('path');
const { ROOT, WORLD_ASSET_DIR, repoRelative, toPosix } = require('./paths.cjs');

function readWorldVisualRegistry() {
  const sourcePath = path.join(ROOT, 'utils', 'world-visuals.ts');
  const source = fs.readFileSync(sourcePath, 'utf8');
  const entries = [];
  const re = /['"]?([\w:-]+)['"]?\s*:\s*require\(['"]([^'"]+)['"]\)/g;
  let match;
  while ((match = re.exec(source))) {
    const assetKey = match[1];
    const requirePath = match[2];
    const absPath = requirePath.startsWith('@incubator/')
      ? require.resolve(requirePath, {paths:[ROOT]})
      : path.resolve(path.dirname(sourcePath), requirePath);
    entries.push({ assetKey, path: repoRelative(absPath), absPath });
  }
  return entries;
}

function walkPngs(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) walkPngs(abs, out);
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.png')) out.push(abs);
  }
  return out;
}

function discoverWorldObjectAssets() {
  const registry = readWorldVisualRegistry();
  const byPath = new Map();
  for (const entry of registry) {
    const key = toPosix(entry.path).toLowerCase();
    const list = byPath.get(key) ?? [];
    list.push(entry.assetKey);
    byPath.set(key, list);
  }

  return walkPngs(path.join(WORLD_ASSET_DIR, 'objects')).map((absPath) => {
    const rel = repoRelative(absPath);
    const assetKeys = byPath.get(toPosix(rel).toLowerCase()) ?? [];
    return {
      path: rel,
      url: `/${rel}`,
      fileName: path.basename(absPath),
      folder: path.basename(path.dirname(absPath)),
      assetKeys,
      wired: assetKeys.length > 0,
    };
  });
}

module.exports = { discoverWorldObjectAssets, readWorldVisualRegistry };
