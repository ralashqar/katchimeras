const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const game = path.resolve(process.argv[2] || 'apps/katchimeras');
const files = fs.readdirSync(path.join(game,'tests')).filter(name=>/\.test\.tsx?$/.test(name)).sort().map(name=>`tests/${name}`);
const result=spawnSync(process.execPath,[require.resolve('tsx/cli'),'--test','--test-concurrency=2',...files],{cwd:game,stdio:'inherit'});
process.exitCode=result.status ?? 1;
