/** Bounded diagnostics: no logging or growing frame history in the animation loop. */
export class CombatPerformance {
  private intervals = new Float32Array(18000);
  private cursor = 0;
  private count = 0;
  commits = 0;
  simulationMaxMs = 0;
  simulationTotalMs = 0;
  ticks = 0;
  activeCells = 0;
  peakCells = 0;
  uiFrames = 0;
  uiSlow = 0;
  uiMaxMs = 0;
  uiWindow(frames: number, slow: number, max: number) {
    this.uiFrames += frames; this.uiSlow += slow; this.uiMaxMs = Math.max(this.uiMaxMs, max);
  }
  frame(ms: number) {
    if (ms <= 0) return;
    this.intervals[this.cursor++ % this.intervals.length] = ms;
    this.count = Math.min(this.count + 1, this.intervals.length);
  }
  simulation(ms: number) { this.ticks++; this.simulationTotalMs += ms; this.simulationMaxMs = Math.max(ms, this.simulationMaxMs); }
  cells(count: number) { this.activeCells = count; this.peakCells = Math.max(count, this.peakCells); }
  report() {
    const frames = Array.from(this.intervals.subarray(0, this.count)).sort((a, b) => a - b);
    return { frames: frames.length, p95FrameMs: frames[Math.floor(frames.length * .95)] ?? 0,
      over25Percent: frames.length ? 100 * frames.filter(v => v > 25).length / frames.length : 0,
      over50: frames.filter(v => v > 50).length, battleCommits: this.commits,
      simulationMeanMs: this.simulationTotalMs / Math.max(1, this.ticks), simulationMaxMs: this.simulationMaxMs,
      activeCells: this.activeCells, peakCells: this.peakCells,
      uiOver25Percent: 100 * this.uiSlow / Math.max(1, this.uiFrames), uiMaxMs: this.uiMaxMs };
  }
}
