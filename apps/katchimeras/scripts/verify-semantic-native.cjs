const {contentPath, assetSpecifier, readVerificationSource} = require('@incubator/art-pipeline/context');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const swiftPath = contentPath(root, 'modules', 'katchimera-semantic', 'ios', 'KatchimeraSemanticModule.swift');
const configPath = contentPath(root, 'modules', 'katchimera-semantic', 'expo-module.config.json');
const swift = readVerificationSource(swiftPath, 'utf8');
const config = JSON.parse(readVerificationSource(configPath, 'utf8'));

const checks = [
  ['native module is registered', config.apple.modules.includes('KatchimeraSemanticModule')],
  ['NaturalLanguage is imported', swift.includes('import NaturalLanguage')],
  ['availability is exported', swift.includes('Function("availability")')],
  ['label comparison is exported', swift.includes('AsyncFunction("compareLabelsAsync")')],
  ['text comparison is exported', swift.includes('AsyncFunction("compareTextAsync")')],
  ['word embeddings are used', swift.includes('NLEmbedding.wordEmbedding')],
  ['sentence embeddings are used', swift.includes('NLEmbedding.sentenceEmbedding')],
  ['lexical tagging is used', swift.includes('NLTagger(')],
];

let failed = false;
for (const [label, ok] of checks) {
  console.log(`${ok ? '  ok ' : 'FAIL '} ${label}`);
  failed ||= !ok;
}
if (failed) process.exit(1);

const executable = require.resolve('tsx/cli');
const result = spawnSync(process.execPath, [executable, '--test', 'tests/semantic-registry.test.ts'], { cwd: root, stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status ?? 1);
console.log('\nSemantic fallback preflight checks passed.');
