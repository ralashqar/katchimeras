const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const DATA_DIR = path.join(ROOT, 'data');
const WORLD_ASSET_DIR = path.join(ROOT, 'assets', 'images', 'katchimeras', 'world');
const ENVIRONMENT_DATA_DIR = path.join(DATA_DIR, 'local-environments');
const ENVIRONMENT_ASSET_DIR = path.join(ROOT, 'assets', 'images', 'katchimeras', 'environments');
const CATALOG_PATH = path.join(DATA_DIR, 'world-object-design-catalog.json');
const LAYOUT_PATH = path.join(DATA_DIR, 'world-structure-layout.json');
const BACKUP_DIR = path.join(ROOT, 'tools', 'world-editor', 'backups');
const TMP_DIR = path.join(ROOT, 'tools', 'world-editor', 'tmp');

function toPosix(relativePath) {
  return relativePath.split(path.sep).join('/');
}

function repoRelative(absPath) {
  return toPosix(path.relative(ROOT, absPath));
}

function resolveRepoPath(relativePath) {
  return path.resolve(ROOT, relativePath);
}

function assertInside(child, parent) {
  const resolvedChild = path.resolve(child);
  const resolvedParent = path.resolve(parent);
  const rel = path.relative(resolvedParent, resolvedChild);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(`Path escapes allowed directory: ${repoRelative(resolvedChild)}`);
  }
  return resolvedChild;
}

module.exports = {
  ROOT,
  DATA_DIR,
  WORLD_ASSET_DIR,
  ENVIRONMENT_DATA_DIR,
  ENVIRONMENT_ASSET_DIR,
  CATALOG_PATH,
  LAYOUT_PATH,
  BACKUP_DIR,
  TMP_DIR,
  assertInside,
  repoRelative,
  resolveRepoPath,
  toPosix,
};
