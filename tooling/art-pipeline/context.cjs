const fs = require('node:fs');
const path = require('node:path');

function readProfile(root) {
  const filename = path.join(root, 'incubator.json');
  if (!fs.existsSync(filename)) throw new Error(`Missing content profile: ${filename}`);
  return JSON.parse(fs.readFileSync(filename, 'utf8'));
}
function contentPath(root, ...parts) {
  const absolute = path.resolve(root, ...parts);
  const relative = path.relative(root, absolute).split(path.sep).join('/');
  const profile = readProfile(root);
  for (const [logical, physical] of Object.entries(profile.contentRoots)) {
    if (relative === logical || relative.startsWith(`${logical}/`)) {
      return path.resolve(root, physical, relative.slice(logical.length).replace(/^\//, ''));
    }
  }
  return absolute;
}
function assetSpecifier(root, logical) {
  const absolute = contentPath(root, logical);
  let directory = path.dirname(absolute);
  while (directory !== path.dirname(directory)) {
    const filename = path.join(directory, 'package.json');
    if (fs.existsSync(filename)) {
      const pkg = JSON.parse(fs.readFileSync(filename, 'utf8'));
      if (pkg.name?.startsWith('@incubator/art-')) {
        return `${pkg.name}/${path.relative(directory, absolute).split(path.sep).join('/')}`;
      }
    }
    directory = path.dirname(directory);
  }
  return path.relative(path.join(root, 'constants'), absolute).split(path.sep).join('/');
}
// Structural regression checks follow extracted implementations as well as the
// game adapter. Runtime loading always uses the real module resolver instead.
function readVerificationSource(filename, encoding) {
  const root = process.env.INCUBATOR_GAME_ROOT || process.cwd();
  const physical = contentPath(root, path.relative(root, filename));
  const source = fs.readFileSync(physical, encoding);
  if (encoding !== 'utf8' && encoding !== 'utf-8') return source;
  const relative = path.relative(root, physical).split(path.sep).join('/');
  const selected = readProfile(root).verificationSources?.[relative] ?? [];
  const extra = selected.map(specifier => fs.readFileSync(require.resolve(specifier, {paths:[root]}), encoding));
  if (relative.startsWith('scripts/') && relative.endsWith('.py') && source.includes('runpy.run_path')) {
    extra.push(fs.readFileSync(path.join(__dirname, 'scripts', path.basename(physical)), encoding));
  }
  if (relative.startsWith('supabase/functions/') && source.includes('../../../../../packages/art-service/')) {
    const target = source.match(/from ['"]([^'"]+)['"]/);
    if (target) extra.push(fs.readFileSync(path.resolve(path.dirname(physical), target[1]), encoding));
  }
  return [source, ...extra].join('\n');
}
module.exports = { readProfile, contentPath, assetSpecifier, readVerificationSource };
