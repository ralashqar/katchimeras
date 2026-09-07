type Shape = {cells: readonly {row: number; column: number}[]};

/** Fit one common scale for the entire deal, including consumed pieces so survivors never resize. */
export function trayCellSize(pieces: readonly Shape[], cell: number, gap: number, width: number, height: number) {
  const slotWidth = (width - 24) / Math.max(1, pieces.length) - 16;
  const availableHeight = height - 28;
  let size = Math.min(34, cell * .9);
  for (const {cells} of pieces) {
    if (!cells.length) continue;
    const rows = cells.map(c => c.row), cols = cells.map(c => c.column);
    const w = Math.max(...cols) - Math.min(...cols) + 1;
    const h = Math.max(...rows) - Math.min(...rows) + 1;
    size = Math.min(size, slotWidth / (w + (w-1)*gap/cell), availableHeight / (h + (h-1)*gap/cell));
  }
  return Math.max(1, size);
}
