import type { CombatEvent, CombatState } from './combat';
import { EffectQualityController } from './effect-quality';
import { CombatPerformance } from './performance';

/** Health subscriptions are deliberately independent of the puzzle/scene React tree. */
export class CombatPresentation {
  readonly quality = new EffectQualityController();
  readonly performance = new CombatPerformance();
  private listeners = new Set<() => void>();
  private events = new Set<(events: readonly CombatEvent[]) => void>();
  constructor(public current: CombatState) {}
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  subscribeEvents = (listener: (events: readonly CombatEvent[]) => void) => { this.events.add(listener); return () => { this.events.delete(listener); }; };
  playerHp = () => this.current.playerHp;
  opponentHp = () => this.current.opponentHp;
  commit(next: CombatState) {
    const old = this.current;
    this.current = next;
    const count = next.eventSequence - old.eventSequence;
    if (count > 0) {
      const batch = next.events.slice(-count);
      for (const listener of this.events) listener(batch);
    }
    if (old.playerHp !== next.playerHp || old.opponentHp !== next.opponentHp)
      for (const listener of this.listeners) listener();
  }
}
