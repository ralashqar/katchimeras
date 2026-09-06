const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'incubator-consumer-'));
const releases = path.join(root, 'dist', 'packages');
fs.mkdirSync(releases, {recursive:true});
const npm = process.env.npm_execpath;
if (!npm) throw new Error('Run this check through npm run verify:consumer');
function run(args, cwd) {
  const result=spawnSync(process.execPath,[npm,...args],{cwd,encoding:'utf8',maxBuffer:20*1024*1024});
  if(result.status!==0) throw new Error(result.stderr || result.stdout);
  return result.stdout;
}
const directories=['packages/story','packages/environments','packages/avatar','packages/merge','tooling/art-pipeline','art/assets/images/katchimeras/game-hub'];
const archives=directories.map(directory=> {
  const packed=JSON.parse(run(['pack','--json','--ignore-scripts','--pack-destination',releases],path.join(root,directory)));
  return path.join(releases,packed[0].filename);
});
fs.writeFileSync(path.join(work,'package.json'),JSON.stringify({name:'independent-game-consumer',private:true,type:'module'}));
run(['install','--ignore-scripts','--legacy-peer-deps','--no-audit','--no-fund',...archives],work);
fs.writeFileSync(path.join(work,'smoke.ts'),`
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,existsSync} from 'node:fs';
import {createContentFlowCompiler} from '@incubator/story/compiler';
import {createContentFlowRun} from '@incubator/story/interpreter';
import {createHexProjection} from '@incubator/environments/hex';
import {havenUpgradePhaseAt} from '@incubator/environments/upgrade-presentation';
import {composeLayerPresentation} from '@incubator/avatar/layout';
const compiler=createContentFlowCompiler({validateStoryNodeCapability:()=>null,isRegisteredStoryRoute:target=>target.id==='workshop'});
const story=compiler.defineContentFlow({id:'other-game',version:1,entryNodeId:'done',nodes:[{id:'done',kind:'complete'}]});
assert.equal(createContentFlowRun(story,{runId:'other-game-run',now:1}).status,'completed');
assert.equal(createHexProjection({width:100,projectionTilt:0.5,lipWidthRatio:0.1,layoutProfiles:{board:{horizontalSpacing:1,verticalSpacing:1}}},'board').hexRing(1).length,6);
assert.equal(havenUpgradePhaseAt(700,false),'reveal');
assert.equal(composeLayerPresentation({scale:1,offsetX:0,offsetY:0},{scale:0.9,offsetX:0,offsetY:0}).scale,0.9);
const require=createRequire(import.meta.url);
const manifest=JSON.parse(readFileSync(require.resolve('@incubator/art-game-hub/package.json'),'utf8'));
assert.equal(manifest.name,'@incubator/art-game-hub');
assert.ok(existsSync(require.resolve('@incubator/art-pipeline/scripts/asset-pipeline.py')));
assert.equal(typeof require('@incubator/art-pipeline/context').assetSpecifier,'function');
console.log('Independent packed consumer passed: story, avatar, hex, upgrade timeline, authoring toolkit, selected art pack.');
`);
const result=spawnSync(process.execPath,['--import',require('node:url').pathToFileURL(require.resolve('tsx/esm')).href,path.join(work,'smoke.ts')],{cwd:work,encoding:'utf8'});
if(result.status!==0) throw new Error(result.stderr || result.stdout);
console.log(result.stdout.trim());
console.log(`Release archives: ${releases}\nIsolated consumer: ${work}`);
