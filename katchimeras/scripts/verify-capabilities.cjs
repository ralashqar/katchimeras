const fs = require('fs');
const path = require('path');
const os = require('os');
const ts = require('typescript');

const projectRoot = path.join(__dirname, '..');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'katchimera-capabilities-'));

function transpile(relativeSourcePath, outName) {
  const source = fs.readFileSync(path.join(projectRoot, relativeSourcePath), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const outPath = path.join(tempDir, outName);
  fs.writeFileSync(outPath, output);
  return outPath;
}

const caps = require(transpile('utils/capabilities/quest-capabilities.ts', 'quest-capabilities.js'));

let failures = 0;
function check(label, condition, detail) {
  if (condition) console.log(`  ok  ${label}`);
  else {
    failures += 1;
    console.log(`FAIL  ${label}${detail ? ` -- ${detail}` : ''}`);
  }
}

const defaults = caps.defaultQuestCapabilities();
check('default map includes every capability id', caps.QUEST_CAPABILITY_IDS.every((id) => defaults[id]), Object.keys(defaults).join(','));
check('camera is available by default', defaults['camera.capture'].status === 'available');
check('photos can prompt by default', caps.capabilityCanBePrompted(defaults['photos.read']));

const stateCaps = caps.questCapabilitiesFromState({
  locationPermission: 'granted',
  activityPermission: 'denied',
  healthPermission: 'unavailable',
});
check('location permission maps to granted', stateCaps['location.foreground'].status === 'granted');
check('activity denial blocks movement quests', caps.capabilityBlocksQuest(stateCaps['health.steps']));
check('health unavailable maps to route + sleep unavailable', stateCaps['health.routes'].status === 'unavailable' && stateCaps['health.sleep'].status === 'unavailable');

const grantedMic = caps.questCapabilitiesWithMicrophone(defaults, { granted: true, status: 'granted' });
check('recording permission granted maps microphone to granted', grantedMic.microphone.status === 'granted', grantedMic.microphone.status);
check('recording permission granted makes transcription available', grantedMic['speech.transcription'].status === 'available', grantedMic['speech.transcription'].status);

const promptableMic = caps.questCapabilitiesWithMicrophone(defaults, { granted: false, status: 'denied', canAskAgain: true });
check('promptable denied microphone maps to unknown', promptableMic.microphone.status === 'unknown', promptableMic.microphone.status);

const deniedMic = caps.questCapabilitiesWithMicrophone(defaults, { granted: false, status: 'denied', canAskAgain: false });
check('non-promptable denied microphone maps to denied', deniedMic.microphone.status === 'denied', deniedMic.microphone.status);

console.log(failures === 0 ? '\nAll capability checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
