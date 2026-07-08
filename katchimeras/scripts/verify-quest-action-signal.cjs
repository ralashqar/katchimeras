const fs = require('fs');
const path = require('path');
const os = require('os');
const ts = require('typescript');

const projectRoot = path.join(__dirname, '..');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'katchimera-quest-action-'));

const source = fs.readFileSync(path.join(projectRoot, 'utils/quest-action-signal.ts'), 'utf8');
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const outPath = path.join(tempDir, 'quest-action-signal.js');
fs.writeFileSync(outPath, output);

const signal = require(outPath);

let failures = 0;
function check(label, condition, detail) {
  if (condition) console.log(`  ok  ${label}`);
  else {
    failures += 1;
    console.log(`FAIL  ${label}${detail ? ` -- ${detail}` : ''}`);
  }
}

check('empty queue consumes null', signal.consumeQuestActionIntent() === null);

signal.requestQuestActionIntent({ action: 'confirm_place', questId: 'quest-new-park' });
const first = signal.consumeQuestActionIntent();
check('queued action is consumed', first?.action === 'confirm_place');
check('queued quest id is preserved', first?.questId === 'quest-new-park');
check('intent is one-shot', signal.consumeQuestActionIntent() === null);

signal.requestQuestActionIntent({ action: 'add_note' });
signal.requestQuestActionIntent({ action: 'open_health' });
check('latest request wins', signal.consumeQuestActionIntent()?.action === 'open_health');

console.log(failures === 0 ? '\nAll quest action signal checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
