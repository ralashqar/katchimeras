import assert from 'node:assert/strict';
import {test} from 'node:test';
import {trayCellSize} from '../game/tray-layout';

test('tray fits long, tall, and jigsaw shapes at one scale without resizing survivors', () => {
  const shapes = [
    {cells: Array.from({length: 5}, (_, column) => ({row: 0, column}))},
    {cells: Array.from({length: 4}, (_, row) => ({row, column: 0}))},
    {cells: [{row: 0, column: 0}, {row: 0, column: 1}, {row: 1, column: 1}]},
  ];
  for (const width of [282, 340, 406]) for (const count of [1, 2, 3]) {
    const pieces = shapes.slice(0, count);
    const size = trayCellSize(pieces, 32, 3, width, 106);
    const pitch = size * (1 + 3/32);
    for (const p of pieces) {
      const cols = Math.max(...p.cells.map(c => c.column)) + 1;
      const rows = Math.max(...p.cells.map(c => c.row)) + 1;
      assert.ok(cols*pitch - size*3/32 <= (width-24)/count - 16 + .001);
      assert.ok(rows*pitch - size*3/32 <= 78 + .001);
    }
    assert.equal(trayCellSize(pieces.map((p,i) => ({...p,used:i===0})),32,3,width,106), size);
  }
  assert.equal(trayCellSize([shapes[2],shapes[2]],32,3,366,124), 28.8);
});
