const fs = require('fs');
const os = require('os');
const path = require('path');
const ts = require('typescript');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'utils/safe-navigation.ts'), 'utf8');
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'katchimera-safe-navigation-'));
const target = path.join(temp, 'safe-navigation.js');
fs.writeFileSync(target, output);
const { safeGoBack } = require(target);

let failures = 0;
function check(label, condition, detail) {
  if (condition) console.log(`  ok  ${label}`);
  else { failures += 1; console.log(`FAIL  ${label}${detail ? ` -- ${detail}` : ''}`); }
}

const historyCalls = [];
safeGoBack({ canGoBack: () => true, back: () => historyCalls.push('back'), replace: (href) => historyCalls.push(`replace:${href}`) });
check('uses back when navigator history exists', historyCalls.join(',') === 'back', historyCalls.join(','));

const rootCalls = [];
safeGoBack({ canGoBack: () => false, back: () => rootCalls.push('back'), replace: (href) => rootCalls.push(`replace:${href}`) });
check('replaces with tabs when route is the navigation root', rootCalls.join(',') === 'replace:/(tabs)', rootCalls.join(','));

const customCalls = [];
safeGoBack({ canGoBack: () => false, back: () => customCalls.push('back'), replace: (href) => customCalls.push(`replace:${href}`) }, '/onboarding');
check('supports an explicit safe fallback', customCalls.join(',') === 'replace:/onboarding', customCalls.join(','));

const routeFiles = [];
function collect(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) collect(file);
    else if (/\.(ts|tsx)$/.test(entry.name)) routeFiles.push(file);
  }
}
collect(path.join(root, 'app'));
const unsafe = routeFiles.filter((file) => /router\.back\(\)|navigation\.goBack\(\)/.test(fs.readFileSync(file, 'utf8')));
check('app routes contain no unguarded back actions', unsafe.length === 0, unsafe.map((file) => path.relative(root, file)).join(','));

console.log(failures ? `\n${failures} safe-navigation check(s) FAILED.` : '\nAll safe-navigation checks passed.');
process.exit(failures ? 1 : 0);
