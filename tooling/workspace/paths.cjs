const path = require('node:path');
const fs = require('node:fs');

function workspaceRoot(start) {
  let current = path.resolve(start);
  while (true) {
    const file = path.join(current, 'package.json');
    if (fs.existsSync(file) && JSON.parse(fs.readFileSync(file, 'utf8')).workspaces) return current;
    const parent = path.dirname(current);
    if (parent === current) throw new Error(`No npm workspace above ${start}`);
    current = parent;
  }
}

module.exports = { workspaceRoot };
