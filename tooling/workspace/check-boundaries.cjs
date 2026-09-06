const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const {isBuiltin} = require('node:module');
const {sharedManifests} = require('./manifests.cjs');
const root = path.resolve(__dirname, '../..');
const failures = [];
const manifests = sharedManifests().filter(pkg => !pkg.directory.startsWith(path.join(root, 'art') + path.sep)).map(pkg => pkg.filename);
const graph = new Map();
function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (entry.name === 'node_modules') return [];
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  });
}
for (const manifest of manifests) {
  const pkg = JSON.parse(fs.readFileSync(manifest, 'utf8'));
  const directory = path.dirname(manifest);
  const dependencies = { ...pkg.dependencies, ...pkg.peerDependencies };
  graph.set(pkg.name, Object.keys(pkg.dependencies ?? {}).filter(name => name.startsWith('@incubator/')));
  for (const target of Object.values(pkg.exports ?? {})) {
    if (typeof target === 'string' && !target.includes('*') && !fs.existsSync(path.resolve(directory, target))) failures.push(`${pkg.name}: missing export ${target}`);
  }
  for (const file of walk(directory).filter(file => /\.[cm]?[jt]sx?$/.test(file))) {
    const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    function visit(node) {
      let specifier;
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) specifier = node.moduleSpecifier.text;
      if (ts.isCallExpression(node) && (node.expression.getText(source) === 'require' || node.expression.kind === ts.SyntaxKind.ImportKeyword) && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) specifier = node.arguments[0].text;
      if (specifier) {
        const label = path.relative(root, file);
        if (specifier.startsWith('@/') || specifier.includes('/apps/')) failures.push(`${label}: app import ${specifier}`);
        else if (specifier.startsWith('.')) {
          const resolved = path.resolve(path.dirname(file), specifier);
          if (!resolved.startsWith(directory + path.sep)) failures.push(`${label}: cross-package relative import ${specifier}`);
        } else if (!isBuiltin(specifier) && !(pkg.incubator?.runtime === 'deno' && /^(npm:|jsr:|https:)/.test(specifier))) {
          const name = specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0];
          if (name !== pkg.name && !dependencies[name]) failures.push(`${label}: undeclared dependency ${name}`);
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
}
function checkCycles(name, chain = []) {
  if (chain.includes(name)) { failures.push(`Dependency cycle: ${[...chain, name].join(' -> ')}`); return; }
  for (const child of graph.get(name) ?? []) checkCycles(child, [...chain, name]);
}
for (const name of graph.keys()) checkCycles(name);
if (failures.length) { console.error(failures.join('\n')); process.exitCode = 1; }
else console.log(`Verified exports, dependency declarations and one-way boundaries for ${manifests.length} packages.`);
