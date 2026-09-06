#!/usr/bin/env node
/* global __dirname */

// Use the installed EAS Git implementation, not a second interpretation of
// ignore patterns. No credentials, provisioning, or build submission is needed.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { Ignore } = require('eas-cli/build/vcs/local');
const GitClient = require('eas-cli/build/vcs/clients/git').default;

const projectRoot = path.resolve(__dirname, '..');
const repositoryRoot = path.resolve(projectRoot, '..');
const limit = 1024 * 1024 * 1024; // Leave ample headroom below EAS's 2 GB limit.

async function main() {
  if (!fs.existsSync(path.join(repositoryRoot, '.easignore'))) {
    throw new Error('Missing repository-root .easignore; nested app exclusions are not sufficient.');
  }
  const ignore = await Ignore.createForCheckingAsync(repositoryRoot);
  if (!ignore.ignores('.git')) {
    throw new Error('Root .easignore must exclude the literal .git path (without trailing slash), otherwise EAS uploads Git object packs.');
  }
  const requiredPath = path.join(projectRoot, 'dist/asset-audit/required-assets.json');
  if (!fs.existsSync(requiredPath)) throw new Error('Run npm run assets:audit:write before checking the archive.');
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'katchimeras-eas-archive-'));
  try {
    const stage = path.join(work, 'project');
    console.log('Preparing archive through EAS Git clone and working-tree copy...');
    const vcs = new GitClient({ requireCommit: false, maybeCwdOverride: projectRoot });
    await vcs.makeShallowCopyAsync(stage);
    if (fs.existsSync(path.join(stage, '.git'))) throw new Error('Git database leaked into EAS archive.');
    const required = JSON.parse(fs.readFileSync(requiredPath, 'utf8'));
    for (const asset of required) {
      if (!fs.existsSync(path.join(stage, 'katchimeras', asset))) {
        throw new Error(`Archive excludes a required runtime/native asset: ${asset}`);
      }
    }
    const files = [];
    function walk(directory) {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) walk(file);
        else if (entry.isFile()) files.push({ path: path.relative(stage, file), bytes: fs.statSync(file).size });
      }
    }
    walk(stage);
    // Directory-only ignore rules may leave empty directories in EAS's copy.
    // Reject leaked contents rather than harmless empty directory entries.
    for (const forbidden of ['design', '.tmp-steppling-baseline', 'katchimeras/design', 'katchimeras/artifacts', 'katchimeras/node_modules', 'katchimeras/dist']) {
      if (files.some((file) => file.path.split(path.sep).join('/').startsWith(`${forbidden}/`))) {
        throw new Error(`Development-only files leaked into archive: ${forbidden}`);
      }
    }
    const archive = path.join(work, 'project.tar.gz');
    const result = spawnSync('tar', ['-czf', archive, '-C', stage, '.'], { stdio: 'inherit' });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error('Could not package archive for size verification.');
    const size = fs.statSync(archive).size;
    console.log(`Archive: ${(size / 1048576).toFixed(1)} MiB compressed; ${files.length} files; ${required.length} required assets verified.`);
    console.log('Largest included files:');
    for (const file of files.sort((a, b) => b.bytes - a.bytes).slice(0, 10)) console.log(`  ${(file.bytes / 1048576).toFixed(1)} MiB  ${file.path}`);
    if (size > limit) throw new Error('Archive exceeds the 1 GiB project budget. Refresh exclusions or optimize the largest runtime assets.');
  } finally {
    // Delete only the unique directory created above, after checking its parent.
    if (path.dirname(work) !== path.resolve(os.tmpdir()) || !path.basename(work).startsWith('katchimeras-eas-archive-')) throw new Error('Invalid archive scratch directory.');
    fs.rmSync(work, { recursive: true, force: true });
  }
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
