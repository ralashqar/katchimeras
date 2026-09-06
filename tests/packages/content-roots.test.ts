import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import test from 'node:test';

const {contentPath, assetSpecifier} = require('@incubator/art-pipeline/context');

test('JS and Python authoring agree on another game content roots and static art imports', () => {
  const work = mkdtempSync(path.join(tmpdir(), 'incubator-content-test-'));
  try {
    const game = path.join(work, 'game');
    const pack = path.join(work, 'selected-art');
    mkdirSync(game);
    mkdirSync(pack);
    writeFileSync(path.join(game, 'incubator.json'), JSON.stringify({id:'other-game', contentRoots:{assets:'../selected-art', design:'../originals'}}));
    writeFileSync(path.join(pack, 'package.json'), JSON.stringify({name:'@incubator/art-fixture', version:'1.2.3'}));
    writeFileSync(path.join(pack, 'scene.webp'), 'test fixture');
    assert.equal(contentPath(game, 'assets/scene.webp'), path.join(pack, 'scene.webp'));
    assert.equal(assetSpecifier(game, 'assets/scene.webp'), '@incubator/art-fixture/scene.webp');
    const python = spawnSync('python', ['-c', [
      'from incubator_context import game_root, content_path, asset_specifier, logical_path',
      'root = game_root()',
      "assert asset_specifier(root, 'assets/scene.webp') == '@incubator/art-fixture/scene.webp'",
      "assert logical_path(root, content_path(root, 'assets/scene.webp')).as_posix() == 'assets/scene.webp'",
    ].join('\n')], {encoding:'utf8', env:{...process.env, INCUBATOR_GAME_ROOT:game, PYTHONPATH:path.dirname(require.resolve('@incubator/art-pipeline/context'))}});
    assert.equal(python.status, 0, python.stderr || python.error?.message);
  } finally {
    if (path.dirname(work) !== path.resolve(tmpdir()) || !path.basename(work).startsWith('incubator-content-test-')) throw new Error('Invalid test scratch directory');
    rmSync(work, {recursive:true, force:true});
  }
});
