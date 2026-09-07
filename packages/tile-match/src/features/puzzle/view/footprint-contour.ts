export type ContourPoint = {x: number; y: number};
type Edge = {a: ContourPoint; b: ContourPoint; used: boolean};

/** Clockwise, continuous boundaries in grid coordinates, with shared edges removed. */
export function footprintContours(cells: readonly number[], cols: number): ContourPoint[][] {
  const members = new Set(cells);
  const edges: Edge[] = [];
  const add = (x: number, y: number, x2: number, y2: number) => edges.push({a: {x,y}, b: {x:x2,y:y2}, used:false});
  for (const index of members) {
    const x = index % cols, y = Math.floor(index / cols);
    if (!members.has(index-cols)) add(x,y,x+1,y);
    if (x === cols-1 || !members.has(index+1)) add(x+1,y,x+1,y+1);
    if (!members.has(index+cols)) add(x+1,y+1,x,y+1);
    if (x === 0 || !members.has(index-1)) add(x,y+1,x,y);
  }
  const loops: ContourPoint[][] = [];
  for (const first of edges) {
    if (first.used) continue;
    const loop: ContourPoint[] = [];
    let edge: Edge | undefined = first;
    while (edge && !edge.used) {
      edge.used = true;
      loop.push(edge.a);
      if (edge.b.x === first.a.x && edge.b.y === first.a.y) break;
      const previous: Edge = edge;
      const candidates: Edge[] = edges.filter(e => !e.used && e.a.x === previous.b.x && e.a.y === previous.b.y);
      // At diagonal contacts, turn right to keep the two boundaries separate.
      edge = candidates.find(e => (previous.b.x-previous.a.x)*(e.b.y-e.a.y)-(previous.b.y-previous.a.y)*(e.b.x-e.a.x) > 0) ?? candidates[0];
    }
    loops.push(loop.filter((p,i) => {
      const a=loop[(i+loop.length-1)%loop.length], b=loop[(i+1)%loop.length];
      return (p.x-a.x)*(b.y-p.y) !== (p.y-a.y)*(b.x-p.x);
    }));
  }
  return loops;
}
