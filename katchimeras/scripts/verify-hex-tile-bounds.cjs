#!/usr/bin/env node

const { spawnSync } = require('node:child_process');
const { join } = require('node:path');

const root = join(__dirname, '..');
const result = spawnSync('python', [join(__dirname, 'generate-hex-tile-bounds.py'), '--check'], {
  cwd: root,
  encoding: 'utf8',
});

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
process.exit(result.status ?? 1);
