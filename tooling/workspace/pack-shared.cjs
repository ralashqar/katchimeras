const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');
const {spawnSync} = require('node:child_process');
const {root, sharedManifests} = require('./manifests.cjs');
const packages = new Map(sharedManifests().map(pkg => [pkg.name, pkg]));
const requested = process.argv.slice(2);
const names = requested.length ? requested : [...packages.keys()].filter(name => !packages.get(name).directory.startsWith(path.join(root, 'art') + path.sep));
const selected = new Set();
function select(name) {
  if (selected.has(name)) return;
  const pkg = packages.get(name);
  if (!pkg) throw new Error(`Unknown shared package: ${name}`);
  selected.add(name);
  for (const [dependency, version] of Object.entries(pkg.dependencies ?? {})) {
    if (!packages.has(dependency)) continue;
    if (packages.get(dependency).version !== version) throw new Error(`${name} must pin ${dependency} to its release version`);
    select(dependency);
  }
}
names.forEach(select);
const destination = path.join(root, 'dist', 'release');
fs.mkdirSync(destination, {recursive:true});
if (!process.env.npm_execpath) throw new Error('Use npm run release:pack');
const release = [];
for (const name of [...selected].sort()) {
  const pkg = packages.get(name);
  const result = spawnSync(process.execPath, [process.env.npm_execpath, 'pack', '--json', '--ignore-scripts', '--pack-destination', destination], {cwd:pkg.directory, encoding:'utf8', maxBuffer:20*1024*1024});
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  const [packed] = JSON.parse(result.stdout);
  const filename = path.join(destination, packed.filename);
  release.push({name, version:pkg.version, file:packed.filename, sha256:createHash('sha256').update(fs.readFileSync(filename)).digest('hex'), dependencies:pkg.dependencies ?? {}, peerDependencies:pkg.peerDependencies ?? {}});
  console.log(`${name}@${pkg.version}: ${packed.filename}`);
}
fs.writeFileSync(path.join(destination, 'release.json'), JSON.stringify({packages:release}, null, 2) + '\n');
console.log(`Packed ${release.length} packages into ${destination}. No packages were published.`);
