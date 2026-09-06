const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
function sharedManifests() {
  const workspace = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  return workspace.workspaces.filter(pattern => !pattern.startsWith('apps/')).flatMap(pattern => {
    if (!pattern.endsWith('/*')) return [path.join(root, pattern, 'package.json')];
    const parent = path.join(root, pattern.slice(0, -2));
    return fs.readdirSync(parent, {withFileTypes:true}).filter(entry => entry.isDirectory()).map(entry => path.join(parent, entry.name, 'package.json'));
  }).filter(fs.existsSync).map(filename => ({filename, directory:path.dirname(filename), ...JSON.parse(fs.readFileSync(filename, 'utf8'))}));
}
module.exports = {root, sharedManifests};
