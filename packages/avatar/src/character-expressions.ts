import { useEffect, useMemo, useState } from 'react';
import { useEggExpressionPlayer } from './expressions';
export type CharacterExpression = 'neutral' | 'half-blink' | 'closed-blink' | 'determined' | 'attack' | 'hurt' | 'surprised' | 'happy' | 'defeated' | 'talking';
export function characterExpressionPriority({defeated, hurt, attacking, talking, base}: {defeated?: boolean; hurt?: boolean; attacking?: boolean; talking?: boolean; base: CharacterExpression}): CharacterExpression {
  return defeated ? 'defeated' : hurt ? 'hurt' : attacking ? 'attack' : talking ? 'talking' : base;
}
/** One owner for event reactions and idle blinking; no frame loop or grid timers. */
export function useCharacterExpression({base = 'neutral', defeated = false, hurt = false, attackKey = 0, hitKey = 0, talking = false, paused = false, reduced = false, enabled = true}: {
  base?: CharacterExpression; defeated?: boolean; hurt?: boolean; attackKey?: number; hitKey?: number; talking?: boolean; paused?: boolean; reduced?: boolean; enabled?: boolean;
}) {
  const [attack, setAttack] = useState(false), [hit, setHit] = useState(false), [blink, setBlink] = useState(0);
  useEffect(() => {
    if (!enabled || paused || !attackKey) {setAttack(false); return;}
    setAttack(true); const timer = setTimeout(() => setAttack(false), 260); return () => clearTimeout(timer);
  }, [attackKey, enabled, paused]);
  useEffect(() => {
    if (!enabled || paused || !hitKey) {setHit(false); return;}
    setHit(true); const timer = setTimeout(() => setHit(false), 420); return () => clearTimeout(timer);
  }, [hitKey, enabled, paused]);
  const face = characterExpressionPriority({defeated, hurt: hurt || hit, attacking: attack, talking, base});
  const idle = enabled && !paused && !reduced && face === 'neutral';
  useEffect(() => {
    if (!idle) return;
    const timer = setInterval(() => setBlink(value => value + 1), 4200);
    return () => clearInterval(timer);
  }, [idle]);
  const sequence = useMemo(() => idle && blink ? [
    {faceId: 'half-blink', atMs: 0, durationMs: 0},
    {faceId: 'closed-blink', atMs: 55, durationMs: 0},
    {faceId: 'half-blink', atMs: 125, durationMs: 0},
    {faceId: 'neutral', atMs: 180, durationMs: 0},
  ] : undefined, [idle, blink]);
  const result = useEggExpressionPlayer({baseFaceId: face, baseTransitionMs: reduced ? 0 : 65, sequence, sequenceKey: blink, paused: paused || !enabled});
  return !enabled || paused ? {faceId: face, transitionMs: 0} : result;
}
