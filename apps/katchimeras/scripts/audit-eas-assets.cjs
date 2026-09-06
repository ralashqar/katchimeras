#!/usr/bin/env node
/* global __dirname */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const projectRoot = path.resolve(__dirname, '..');
const {contentPath} = require('@incubator/art-pipeline/context');
const assetsRoot = contentPath(projectRoot, 'assets');
const isAsset = absolute => absolute.startsWith(assetsRoot + path.sep);
const resolveAsset = (filename, specifier) => specifier.startsWith('@') ? require.resolve(specifier, {paths:[path.dirname(filename)]}) : path.resolve(path.dirname(filename), specifier);
const auditRoot = path.join(projectRoot, 'dist', 'asset-audit');
const repositoryRoot = path.resolve(projectRoot, '../..');
const easIgnorePath = path.join(repositoryRoot, '.easignore');
const reportPath = path.join(projectRoot, 'docs', 'eas-asset-audit.md');
const startMarker = '# BEGIN GENERATED UNUSED ASSETS';
const endMarker = '# END GENERATED UNUSED ASSETS';
const writeMode = process.argv.includes('--write');
const checkMode = process.argv.includes('--check');

const slash = (value) => value.split(path.sep).join('/');
const projectRelative = (value) => slash(path.relative(projectRoot, value));
const mib = (bytes) => bytes / 1024 / 1024;
const formatMiB = (bytes) => `${mib(bytes).toFixed(1)} MiB`;

function walkFiles(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(absolute));
    else if (entry.isFile()) files.push(absolute);
  }
  return files;
}

function runExport(platform) {
  console.log(`Exporting ${platform} runtime asset inventory...`);
  const output = path.join(auditRoot, platform);
  fs.rmSync(output, { recursive: true, force: true });
  const expoCli = require.resolve('expo/bin/cli');
  const result = spawnSync(
    process.execPath,
    [expoCli, 'export', '--platform', platform, '--output-dir', output, '--dump-assetmap', '--max-workers', '2'],
    {
      cwd: projectRoot,
      encoding: 'utf8',
      maxBuffer: 50 * 1024 * 1024,
      stdio: ['ignore', 'inherit', 'inherit'],
    },
  );
  if (result.status !== 0) {
    process.stderr.write(result.stdout || '');
    process.stderr.write(result.stderr || '');
    if (result.error) process.stderr.write(`${result.error.stack || result.error}\n`);
    throw new Error(`${platform} Expo export failed with exit code ${result.status}`);
  }
  return path.join(output, 'assetmap.json');
}

function addAssetMapFiles(assetMapPath, required, reasons) {
  const assetMap = JSON.parse(fs.readFileSync(assetMapPath, 'utf8'));
  for (const asset of Object.values(assetMap)) {
    for (const filename of asset.files || []) {
      const absolute = path.resolve(filename);
      const relative = projectRelative(absolute);
      if (isAsset(absolute)) {
        required.add(relative);
        if (!reasons.has(relative)) reasons.set(relative, new Set());
        reasons.get(relative).add(`Metro ${path.basename(path.dirname(assetMapPath))}`);
      }
    }
  }
}

function collectJsonAssetReferences(value, source, required, reasons) {
  if (typeof value === 'string') {
    if (/\.(?:png|jpe?g|webp|gif|svg|ttf|otf|riv)$/i.test(value)) {
      const absolute = path.resolve(projectRoot, value);
      const relative = projectRelative(absolute);
      if (isAsset(absolute)) {
        required.add(relative);
        if (!reasons.has(relative)) reasons.set(relative, new Set());
        reasons.get(relative).add(source);
      }
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectJsonAssetReferences(item, source, required, reasons);
    return;
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) {
      collectJsonAssetReferences(item, source, required, reasons);
    }
  }
}

function collectTargetAssetReferences(required, reasons) {
  const targetsRoot = path.join(projectRoot, 'targets');
  if (!fs.existsSync(targetsRoot)) return;
  for (const filename of walkFiles(targetsRoot).filter((file) => /\.js$/i.test(file))) {
    const text = fs.readFileSync(filename, 'utf8');
    const pattern = /["']((?:\.\.\/)+(?:art\/)?assets\/[^"']+\.(?:png|jpe?g|webp|gif|svg|ttf|otf|riv))["']/gi;
    for (const match of text.matchAll(pattern)) {
      const absolute = resolveAsset(filename, match[1]);
      const relative = projectRelative(absolute);
      required.add(relative);
      if (!reasons.has(relative)) reasons.set(relative, new Set());
      reasons.get(relative).add(projectRelative(filename));
    }
  }
}

function collectStaticAssetReferences(filename, required, reasons) {
  if (!fs.existsSync(filename)) return;
  const text = fs.readFileSync(filename, 'utf8');
  const pattern = /require\(\s*["']([^"']+\.(?:png|jpe?g|webp|gif|svg|ttf|otf|riv))["']\s*\)/gi;
  for (const match of text.matchAll(pattern)) {
    const absolute = resolveAsset(filename, match[1]);
    const relative = projectRelative(absolute);
    if (isAsset(absolute)) {
      if (absolute.startsWith(path.join(assetsRoot, 'images/katchimeras/egg-avatars') + path.sep) && path.extname(relative) === '.png') {
        throw new Error(`Runtime egg-avatar registry imports source master: ${relative}`);
      }
      required.add(relative);
      if (!reasons.has(relative)) reasons.set(relative, new Set());
      reasons.get(relative).add(projectRelative(filename));
    }
  }
}

function collectDeduplicatedAssetAliases(required, reasons) {
  const skippedDirectories = new Set([
    '.expo',
    '.git',
    '.tmp',
    'artifacts',
    'assets',
    'design',
    'dist',
    'docs',
    'node_modules',
    'output',
    'scripts',
    'supabase',
    'tests',
    'tmp',
    'tools',
  ]);
  const sourceFiles = [];
  const walkSourceFiles = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!skippedDirectories.has(entry.name)) walkSourceFiles(absolute);
      } else if (entry.isFile() && /\.[cm]?[jt]sx?$/i.test(entry.name)) {
        sourceFiles.push(absolute);
      }
    }
  };
  const hashFile = (filename) => crypto.createHash('sha256').update(fs.readFileSync(filename)).digest('hex');
  const requiredHashes = new Set(
    [...required]
      .map((relative) => path.join(projectRoot, relative))
      .filter((filename) => fs.existsSync(filename))
      .map(hashFile),
  );

  walkSourceFiles(projectRoot);
  walkSourceFiles(path.join(repositoryRoot, 'packages'));
  for (const filename of sourceFiles) {
    const text = fs.readFileSync(filename, 'utf8');
    const pattern = /require\(\s*["']([^"']+\.(?:png|jpe?g|webp|gif|svg|ttf|otf|riv))["']\s*\)/gi;
    for (const match of text.matchAll(pattern)) {
      const absolute = resolveAsset(filename, match[1]);
      const relative = projectRelative(absolute);
      if (
        required.has(relative) ||
        !isAsset(absolute) ||
        !fs.existsSync(absolute) ||
        !requiredHashes.has(hashFile(absolute))
      ) {
        continue;
      }
      required.add(relative);
      if (!reasons.has(relative)) reasons.set(relative, new Set());
      reasons.get(relative).add(`content alias in ${projectRelative(filename)}`);
    }
  }
}

function collectGeneratedAssetRegistryReferences(required, reasons) {
  const constantsRoot = path.join(projectRoot, 'constants');
  const generatedRegistryPattern = /\.(?:gen|generated)\.[cm]?[jt]sx?$/i;
  for (const filename of walkFiles(constantsRoot).filter((file) => generatedRegistryPattern.test(file))) {
    collectStaticAssetReferences(filename, required, reasons);
  }
}

function groupFor(relative) {
  const parts = relative.split('/');
  if (parts[0] === 'assets' && parts[1] === 'images' && parts[2] === 'katchimeras') {
    return parts.slice(0, Math.min(parts.length - 1, 5)).join('/');
  }
  return parts.slice(0, Math.min(parts.length - 1, 3)).join('/');
}

function buildManagedSection(unused) {
  return [
    startMarker,
    '# Generated from the union of iOS/Android Metro assets plus native config assets.',
    ...unused.map((item) => `/${slash(path.relative(repositoryRoot, item.absolute))}`),
    endMarker,
  ].join('\n');
}

function replaceManagedSection(contents, managed) {
  const start = contents.indexOf(startMarker);
  const end = contents.indexOf(endMarker);
  if (start < 0 || end < start) throw new Error('Managed .easignore markers are missing or invalid');
  return `${contents.slice(0, start)}${managed}${contents.slice(end + endMarker.length)}`;
}

function buildReport(allAssets, requiredAssets, nativeOnly, unused) {
  const groups = new Map();
  for (const item of unused) {
    const group = groupFor(item.relative);
    const current = groups.get(group) || { files: 0, bytes: 0 };
    current.files += 1;
    current.bytes += item.bytes;
    groups.set(group, current);
  }
  const groupRows = [...groups.entries()]
    .sort((a, b) => b[1].bytes - a[1].bytes)
    .slice(0, 30)
    .map(([group, value]) => `| \`${group}\` | ${value.files} | ${formatMiB(value.bytes)} |`);
  const largestRows = unused
    .slice()
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, 30)
    .map((item) => `| \`${item.relative}\` | ${formatMiB(item.bytes)} |`);
  const totalBytes = allAssets.reduce((sum, item) => sum + item.bytes, 0);
  const requiredBytes = requiredAssets.reduce((sum, item) => sum + item.bytes, 0);
  const unusedBytes = unused.reduce((sum, item) => sum + item.bytes, 0);
  const nativeBytes = nativeOnly.reduce((sum, item) => sum + item.bytes, 0);
  return `# EAS asset audit\n\n` +
    `Generated by \`npm run assets:audit:write\`. The complete file-level exclusion inventory is the managed section of the repository-root \`.easignore\`.\n\n` +
    `## Totals\n\n` +
    `| Classification | Files | Size |\n| --- | ---: | ---: |\n` +
    `| All project assets | ${allAssets.length} | ${formatMiB(totalBytes)} |\n` +
    `| Required by Metro or native configuration | ${requiredAssets.length} | ${formatMiB(requiredBytes)} |\n` +
    `| Native-configuration-only | ${nativeOnly.length} | ${formatMiB(nativeBytes)} |\n` +
    `| Excluded from EAS | ${unused.length} | ${formatMiB(unusedBytes)} |\n\n` +
    `## Largest excluded groups\n\n| Group | Files | Size |\n| --- | ---: | ---: |\n${groupRows.join('\n')}\n\n` +
    `## Largest excluded files\n\n| File | Size |\n| --- | ---: |\n${largestRows.join('\n')}\n`;
}

function main() {
  const required = new Set();
  const reasons = new Map();
  for (const platform of ['ios', 'android']) {
    addAssetMapFiles(runExport(platform), required, reasons);
  }
  const appConfig = JSON.parse(fs.readFileSync(path.join(projectRoot, 'app.json'), 'utf8'));
  collectJsonAssetReferences(appConfig, 'app.json', required, reasons);
  collectTargetAssetReferences(required, reasons);
  // Metro's asset map deduplicates byte-identical files. The JS resolver still
  // needs every literal filename while creating an EAS bundle, so generated
  // registries are also scanned directly to retain aliases such as two
  // creatures that currently share the same LOD artwork.
  collectGeneratedAssetRegistryReferences(required, reasons);
  // Metro's dumped asset map also collapses byte-identical assets referenced
  // from ordinary source modules. Preserve every literal production alias so
  // EAS's filtered checkout can still resolve the JavaScript import path.
  collectDeduplicatedAssetAliases(required, reasons);

  const missing = [...required].filter((relative) => !fs.existsSync(path.join(projectRoot, relative)));
  if (missing.length) {
    throw new Error(`Configured assets are missing:\n${missing.map((item) => `- ${item}`).join('\n')}`);
  }

  const allAssets = walkFiles(assetsRoot).filter(file => path.basename(file) !== 'package.json')
    .map((absolute) => ({ absolute, relative: projectRelative(absolute), bytes: fs.statSync(absolute).size }))
    .sort((a, b) => a.relative.localeCompare(b.relative));
  const requiredAssets = allAssets.filter((item) => required.has(item.relative));
  const nativeOnly = requiredAssets.filter((item) => {
    const itemReasons = reasons.get(item.relative) || new Set();
    return ![...itemReasons].some((reason) => reason.startsWith('Metro '));
  });
  const unused = allAssets.filter((item) => !required.has(item.relative));
  fs.mkdirSync(auditRoot, { recursive: true });
  fs.writeFileSync(path.join(auditRoot, 'required-assets.json'), JSON.stringify([...required].sort(), null, 2));
  const managed = buildManagedSection(unused);
  const currentIgnore = fs.readFileSync(easIgnorePath, 'utf8');
  const nextIgnore = replaceManagedSection(currentIgnore, managed);
  const report = buildReport(allAssets, requiredAssets, nativeOnly, unused);

  console.log(`Required: ${requiredAssets.length} files, ${formatMiB(requiredAssets.reduce((s, x) => s + x.bytes, 0))}`);
  console.log(`Excluded: ${unused.length} files, ${formatMiB(unused.reduce((s, x) => s + x.bytes, 0))}`);
  console.log(`Native-only: ${nativeOnly.length} files`);

  if (writeMode) {
    fs.writeFileSync(easIgnorePath, nextIgnore);
    fs.writeFileSync(reportPath, report);
    console.log(`Updated ${projectRelative(easIgnorePath)} and ${projectRelative(reportPath)}`);
    return;
  }
  if (checkMode) {
    const existingReport = fs.existsSync(reportPath) ? fs.readFileSync(reportPath, 'utf8') : '';
    if (currentIgnore !== nextIgnore || existingReport !== report) {
      console.error('Asset audit output is stale. Run `npm run assets:audit:write`.');
      process.exitCode = 1;
    }
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
