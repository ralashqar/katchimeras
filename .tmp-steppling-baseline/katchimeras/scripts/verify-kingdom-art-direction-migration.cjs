#!/usr/bin/env node

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');

const root = path.join(__dirname, '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'katchimera-art-direction-'));
const source = fs.readFileSync(path.join(root, 'utils', 'dev-asset-overrides.ts'), 'utf8');
let output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
output = output
  .split('require("@/utils/app-storage")')
  .join('require("./app-storage")');
fs.writeFileSync(path.join(temp, 'dev-asset-overrides.js'), output);
fs.writeFileSync(
  path.join(temp, 'app-storage.js'),
  `let value = null;
exports.seed = (next) => { value = next; };
exports.read = () => value;
exports.getStoredJson = (_key, fallback) => value === undefined ? fallback : value;
exports.setStoredJson = (_key, next) => { value = next; };
`
);

global.__DEV__ = true;
const storage = require(path.join(temp, 'app-storage.js'));
const modulePath = path.join(temp, 'dev-asset-overrides.js');

function loadWith(storedId) {
  storage.seed(storedId);
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath).getDevKingdomHexArtDirectionSetId();
}

for (const retiredId of [
  'floating_neighborhood_v2_mossprout_edge_proof',
  'floating_neighborhood_v2_mossprout_connected_edge_proof',
]) {
  const migrated = loadWith(retiredId);
  if (migrated !== 'floating_neighborhood_v2' || storage.read() !== 'floating_neighborhood_v2') {
    throw new Error(`Failed to migrate retired art direction ${retiredId}`);
  }
  console.log(`ok  ${retiredId} migrates to floating_neighborhood_v2`);
}

if (loadWith('connected_floating_v1') !== 'connected_floating_v1') {
  throw new Error('A current art direction id was changed by the migration.');
}
console.log('ok  current art direction ids remain unchanged');
