export type EffectQuality = 'low' | 'balanced' | 'high';
export const EFFECT_BUDGET = {
  low: { shards: 1, cap: 16 }, balanced: { shards: 3, cap: 48 }, high: { shards: 6, cap: 96 },
} as const;
const tiers: EffectQuality[] = ['low', 'balanced', 'high'];
/** Foreground windows only. Quality affects new decoration, never combat or flying cells. */
export class EffectQualityController {
  quality: EffectQuality = 'balanced';
  override: EffectQuality | null = null;
  private elapsed = 0;
  private frames = 0;
  private slow = 0;
  private bad = 0;
  private good = 0;
  get current() { return this.override ?? this.quality; }
  resetWindow() { this.elapsed = this.frames = this.slow = this.bad = this.good = 0; }
  frame(ms: number, active = true) {
    if (!active) { this.resetWindow(); return; }
    if (ms <= 0) return;
    this.elapsed += ms; this.frames++; if (ms > 25) this.slow++;
    if (this.elapsed < 1000) return;
    this.window(this.frames, this.slow);
    this.elapsed = this.frames = this.slow = 0;
  }
  window(frames: number, slow: number) {
    if (!frames) return;
    const ratio = slow / frames;
    this.bad = ratio > .1 ? this.bad + 1 : 0;
    this.good = ratio < .02 ? this.good + 1 : 0;
    let index = tiers.indexOf(this.quality);
    if (this.bad >= 2) { index--; this.bad = this.good = 0; }
    if (this.good >= 5) { index++; this.bad = this.good = 0; }
    this.quality = tiers[Math.max(0, Math.min(2, index))];
  }
}
