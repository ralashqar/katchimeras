import assert from 'node:assert/strict';
import {test} from 'node:test';
import {footprintContours} from './footprint-contour';

test('L footprint has one closed silhouette including its inward corner, with no internal edges', () => {
  assert.deepEqual(footprintContours([0, 3, 4], 3), [[
    {x:0,y:0},{x:1,y:0},{x:1,y:1},{x:2,y:1},{x:2,y:2},{x:0,y:2},
  ]]);
});
test('a long side is merged rather than rounded at every cell seam', () => {
  assert.deepEqual(footprintContours([0, 1, 2], 3), [[{x:0,y:0},{x:3,y:0},{x:3,y:1},{x:0,y:1}]]);
});
test('diagonal and row-wrapped cells remain separate silhouettes', () => {
  assert.equal(footprintContours([0, 4], 3).length, 2);
  assert.equal(footprintContours([4, 0], 3).length, 2);
  assert.equal(footprintContours([2, 3], 3).length, 2);
});
test('cell ordering does not change the enclosed area or leave edges unjoined', () => {
  for (const cells of [[0,3,4], [4,0,3], [3,4,0]]) {
    const [points] = footprintContours(cells, 3);
    const area = points.reduce((a,p,i) => {const q=points[(i+1)%points.length]; return a+p.x*q.y-q.x*p.y;},0)/2;
    assert.equal(area, 3);
    assert.equal(points.length, 6);
  }
});
