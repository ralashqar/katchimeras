const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const swiftPath = path.join(root, 'modules', 'katchimera-foundation', 'ios', 'KatchimeraFoundationModule.swift');
const easPath = path.join(root, 'eas.json');
const swift = fs.readFileSync(swiftPath, 'utf8');
const lines = swift.split(/\r?\n/);

let failures = 0;
function check(label, condition, detail = '') {
  if (condition) {
    console.log(`  ok  ${label}`);
  } else {
    failures += 1;
    console.error(`FAIL  ${label}${detail ? ` -- ${detail}` : ''}`);
  }
}

function sourceForFoundationAvailability(enabled) {
  const stack = [];
  let active = true;
  const kept = [];
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (trimmed === '#if canImport(FoundationModels)') {
      stack.push({ active, line: index + 1 });
      active = active && enabled;
      return;
    }
    if (trimmed === '#endif') {
      if (stack.length === 0) throw new Error(`Unmatched #endif at line ${index + 1}`);
      active = stack.pop().active;
      return;
    }
    if (active) kept.push(line);
  });
  if (stack.length > 0) throw new Error(`Unclosed #if from line ${stack.at(-1).line}`);
  return kept.join('\n');
}

function stripStringsAndComments(source) {
  return source
    .replace(/"""[\s\S]*?"""/g, '')
    .replace(/"(?:\\.|[^"\\])*"/g, '')
    .replace(/\/\/.*$/gm, '');
}

function braceAudit(source) {
  const clean = stripStringsAndComments(source);
  let depth = 0;
  let minimum = 0;
  for (const character of clean) {
    if (character === '{') depth += 1;
    if (character === '}') depth -= 1;
    minimum = Math.min(minimum, depth);
  }
  return { depth, minimum };
}

let withoutFoundation = '';
let withFoundation = '';
try {
  withoutFoundation = sourceForFoundationAvailability(false);
  withFoundation = sourceForFoundationAvailability(true);
  check('conditional compilation directives are balanced', true);
} catch (error) {
  check('conditional compilation directives are balanced', false, error.message);
}

for (const [name, source] of [['without FoundationModels', withoutFoundation], ['with FoundationModels', withFoundation]]) {
  const result = braceAudit(source);
  check(`${name} braces are balanced`, result.depth === 0 && result.minimum === 0, JSON.stringify(result));
}

const forbiddenXcode26Tokens = [
  ['Attachment(', 'direct image attachments require a newer SDK'],
  ['samplingMode:', 'Xcode 26 expects the older GenerationOptions API'],
  ['@available(iOS 27', 'iOS 27-only source must not be compiled by the Xcode 26 profile'],
  ['readMemoryImageAsync', 'the removed image API must not remain registered natively'],
];
for (const [token, reason] of forbiddenXcode26Tokens) {
  check(`Xcode 26 source excludes ${token}`, !swift.includes(token), reason);
}

const requiredExports = [
  'isAvailable',
  'availabilityInfo',
  'suggestMeaningsAsync',
  'interpretNoteAsync',
  'readMemoryAsync',
  'readSceneAsync',
  'classifySceneAsync',
];
for (const name of requiredExports) {
  check(`native export ${name} is registered`, swift.includes(`("${name}")`));
}

const requiredTypes = ['MemoryRead', 'MeaningOptionList', 'NoteRead', 'SceneDeepRead', 'SceneClassification'];
for (const name of requiredTypes) {
  check(`generated type ${name} exists`, new RegExp(`(?:struct|class)\\s+${name}\\b`).test(swift));
}

const staticDeclarations = [...withFoundation.matchAll(/private static func\s+(\w+)/g)];
check('all expected private methods remain inside the module source', staticDeclarations.length === 6, staticDeclarations.map((match) => match[1]).join(', '));

const eas = JSON.parse(fs.readFileSync(easPath, 'utf8'));
check(
  'development builds pin the Xcode 26 image',
  eas?.build?.development?.ios?.image === 'macos-sequoia-15.6-xcode-26.0',
  String(eas?.build?.development?.ios?.image)
);

if (failures > 0) {
  console.error(`\n${failures} Foundation native preflight check(s) failed.`);
  process.exit(1);
}
console.log('\nFoundation native preflight checks passed.');
