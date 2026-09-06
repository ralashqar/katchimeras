const {contentPath, assetSpecifier, readVerificationSource} = require('@incubator/art-pipeline/context');
// React Native treats literal JSX whitespace between native container children
// as text. This catches same-line closing-tag gaps that can trigger:
// "Text strings must be rendered within a <Text> component."
const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const roots = ['app', 'components', 'features'];
const pattern = /<\/(?:View|ScrollView|Pressable|Animated\.View|MotiView)>\s+<\/(?:View|ScrollView|Pressable|Animated\.View|MotiView)>/;

let failures = 0;

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }
    if (!entry.isFile() || !/\.(tsx|jsx)$/.test(entry.name)) {
      continue;
    }
    const source = readVerificationSource(fullPath, 'utf8');
    source.split(/\r?\n/).forEach((line, index) => {
      if (pattern.test(line)) {
        failures += 1;
        console.log(`FAIL  ${path.relative(projectRoot, fullPath)}:${index + 1} has native JSX closing-tag whitespace`);
      }
    });
  }
}

for (const root of roots) {
  walk(contentPath(projectRoot, root));
}

if (failures === 0) {
  console.log('All React Native JSX whitespace checks passed.');
} else {
  console.log(`\n${failures} React Native JSX whitespace check(s) FAILED.`);
}

process.exit(failures === 0 ? 0 : 1);
