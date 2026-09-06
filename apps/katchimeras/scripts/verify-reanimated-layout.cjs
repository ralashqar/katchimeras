const {contentPath, assetSpecifier, readVerificationSource} = require('@incubator/art-pipeline/context');
/* global __dirname */

const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.join(__dirname, '..');
const sourceRoots = ['app', 'components'];
const issues = [];

function collectTsxFiles(directory) {
  if (!fs.existsSync(directory)) {
    return [];
  }

  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return collectTsxFiles(entryPath);
    }

    return entry.isFile() && entry.name.endsWith('.tsx') ? [entryPath] : [];
  });
}

for (const sourceRoot of sourceRoots) {
  const files = collectTsxFiles(contentPath(projectRoot, sourceRoot));

  for (const file of files) {
    const source = readVerificationSource(file, 'utf8');
    const animatedOpeningTag = /<Animated\.[A-Za-z]+\b[\s\S]*?>/g;

    for (const match of source.matchAll(animatedOpeningTag)) {
      const tag = match[0];

      if (!/\blayout\s*=/.test(tag) || !/\bentering\s*=/.test(tag)) {
        continue;
      }

      const line = source.slice(0, match.index).split(/\r?\n/).length;
      issues.push(`${path.relative(projectRoot, file)}:${line}`);
    }
  }
}

if (issues.length > 0) {
  console.error(
    'Animated components must not own both layout and entering animations. ' +
      'Put the layout animation on an outer Animated wrapper and the entering animation on an inner one.',
  );
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }
  process.exit(1);
}

console.log('Reanimated layout and entering animation ownership verified.');
