export type CombatEffect = {
  id: number; kind: 'bullet' | 'lightning'; tone: number;
  from: { x: number; y: number }; to: { x: number; y: number };
  size: number; delay: number; duration: number; miss: boolean; start: number; impacted: boolean;
};

/** Visual capacity never limits logical arrivals, including volleys that exceed the atlas buffer. */
export function advanceCombatEffects(events: CombatEffect[], clock: number) {
  'worklet';
  const messages: { id: number; done: boolean }[] = [];
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i]!;
    const age = clock - event.start - event.delay;
    const impactAt = event.kind === 'lightning' ? event.duration * 0.25 : event.duration;
    if (!event.impacted && age >= impactAt) { event.impacted = true; messages.push({ id: event.id, done: false }); }
    if (age >= (event.kind === 'lightning' ? event.duration + 40 : event.duration + 480)) {
      events.splice(i, 1); messages.push({ id: event.id, done: true });
    }
  }
  return messages;
}
