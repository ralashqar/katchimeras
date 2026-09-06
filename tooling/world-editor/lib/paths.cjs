const path = require('path');

const {contentPath, readProfile} = require('@incubator/art-pipeline/context');
const ROOT = process.env.INCUBATOR_GAME_ROOT;
if (!ROOT) throw new Error('Set INCUBATOR_GAME_ROOT to select editor data.');
const DATA_DIR = contentPath(ROOT, 'data');
const WORLD_ASSET_DIR = contentPath(ROOT, 'assets', 'images', 'katchimeras', 'world');
const ENVIRONMENT_DATA_DIR = path.join(DATA_DIR, 'local-environments');
const ENVIRONMENT_ASSET_DIR = contentPath(ROOT, 'assets', 'images', 'katchimeras', 'environments');
const CATALOG_PATH = path.join(DATA_DIR, 'world-object-design-catalog.json');
const LAYOUT_PATH = path.join(DATA_DIR, 'world-structure-layout.json');
const BACKUP_DIR = contentPath(ROOT, 'tools', 'world-editor', 'backups');
const TMP_DIR = contentPath(ROOT, 'tools', 'world-editor', 'tmp');

function toPosix(relativePath) {
  return relativePath.split(path.sep).join('/');
}

function repoRelative(absPath) {
  for (const [logical, physical] of Object.entries(readProfile(ROOT).contentRoots)) {
    const base = path.resolve(ROOT, physical);
    const relative = path.relative(base, absPath);
    if (!relative.startsWith('..') && !path.isAbsolute(relative)) return `${logical}/${toPosix(relative)}`;
  }
  return toPosix(path.relative(ROOT, absPath));
}

function resolveRepoPath(relativePath) {
  return contentPath(ROOT, relativePath);
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
