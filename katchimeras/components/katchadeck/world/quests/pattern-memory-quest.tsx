import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { Lantern } from '@/constants/theme';
import {
  createPattern,
  patternComplete,
  patternMatches,
} from '@/utils/quests/experiences/pattern-memory';
import type { QuestResult } from '@/utils/quests/experiences/types';

import {
  ExperienceAction,
  ExperienceResult,
  QuestExperiencePreview,
  experienceStyles,
  useQuestAppActive,
} from './quest-experience-ui';

type Config = {
  rounds: number;
  targetRounds: number;
  startLength: number;
  maxLength: number;
  playbackMs: number;
  tier: number;
};

type Props = {
  config: Config;
  seed: string;
  onAttemptStart: (config: Record<string, unknown>) => string;
  onAttemptCancel: (id: string) => void;
  onComplete: (id: string, result: QuestResult) => void;
  onRunningChange: (running: boolean, id?: string | null) => void;
};

const PAD_COLORS = [
  Lantern.ember300,
  Lantern.auroraTeal,
  Lantern.auroraViolet,
  Lantern.auroraRose,
];
const PAD_ICONS: IconSymbolName[] = ['circle.fill', 'triangle.fill', 'square.fill', 'sparkles'];

export function PatternMemoryQuest({
  config,
  seed,
  onAttemptStart,
  onAttemptCancel,
  onComplete,
  onRunningChange,
}: Props) {
  const [started, setStarted] = useState(false);
  const [round, setRound] = useState(0);
  const [won, setWon] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [input, setInput] = useState<number[]>([]);
  const [active, setActive] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const attempt = useRef<string | null>(null);
  const startedAt = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const length = Math.min(config.maxLength, config.startLength + round);
  const pattern = useMemo(() => createPattern(`${seed}:${round}`, length), [length, round, seed]);
  const complete = round >= config.rounds;
  const appActive = useQuestAppActive();

  const play = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setPlaying(true);
    pattern.forEach((pad, index) => {
      timers.current.push(
        setTimeout(() => {
          setActive(pad);
          if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
        }, index * config.playbackMs),
      );
      timers.current.push(
        setTimeout(() => setActive(null), index * config.playbackMs + config.playbackMs * 0.62),
      );
    });
    timers.current.push(setTimeout(() => setPlaying(false), pattern.length * config.playbackMs));
  }, [config.playbackMs, pattern]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEffect(() => {
    if (!appActive) {
      timers.current.forEach(clearTimeout);
      timers.current = [];
      setPlaying(false);
      setActive(null);
      return;
    }
    if (started && !complete) play();
  }, [appActive, complete, round, started]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = () => {
    attempt.current = onAttemptStart(config);
    startedAt.current = Date.now();
    setStarted(true);
    onRunningChange(true, attempt.current);
  };

  const reset = () => {
    if (attempt.current) onAttemptCancel(attempt.current);
    onRunningChange(false);
    setStarted(false);
    setRound(0);
    setWon(0);
    setMistakes(0);
    setInput([]);
  };

  const press = (pad: number) => {
    if (playing || complete) return;
    const next = [...input, pad];
    setActive(pad);
    setTimeout(() => setActive(null), 160);
    if (!patternMatches(pattern, next)) {
      setMistakes((value) => value + 1);
      setInput([]);
      setTimeout(() => setRound((value) => value + 1), 420);
      return;
    }
    if (patternComplete(pattern, next)) {
      setWon((value) => value + 1);
      setInput([]);
      setTimeout(() => setRound((value) => value + 1), 420);
    } else {
      setInput(next);
    }
  };

  const success = complete && won >= config.targetRounds;

  if (!started) {
    return (
        <QuestExperiencePreview
          eyebrow="Gatherglow"
          title="Follow Gatherglow’s lights"
          body="Watch the four lights, then repeat their order."
          icon="sparkles"
          actionLabel="Begin pattern"
          onAction={start}
        />
    );
  }

  if (complete && attempt.current) {
    return (
      <ExperienceResult
        success={success}
        title={success ? 'The pattern held' : 'The lights slipped away'}
        body={`${won} of ${config.rounds} patterns remembered.`}
        metric={`${won}/${config.rounds}`}
        onRetry={reset}
        onComplete={() =>
          success
            ? onComplete(attempt.current!, {
                kind: 'pattern_memory',
                success: true,
                completedRounds: won,
                rounds: config.rounds,
                longestSequence: Math.min(
                  config.maxLength,
                  config.startLength + Math.max(0, round - 1),
                ),
                mistakes,
                durationMs: Date.now() - startedAt.current,
              })
            : reset()
        }
      />
    );
  }

  return (
    <View style={experienceStyles.root}>
      <ThemedText style={styles.progress} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
        ROUND {round + 1} OF {config.rounds} · {won} KEPT
      </ThemedText>
      <View accessibilityLabel="Pattern pads" style={styles.grid}>
        {PAD_COLORS.map((color, index) => {
          const selected = active === index;
          return (
            <Pressable
              key={color}
              accessibilityRole="button"
              accessibilityLabel={`Pattern pad ${index + 1}`}
              disabled={playing}
              onPress={() => press(index)}
              style={[
                styles.pad,
                { backgroundColor: selected ? color : `${color}33`, borderColor: color },
                selected && styles.padActive,
              ]}>
              <View pointerEvents="none" style={styles.symbolFrame}>
                <IconSymbol
                  name={PAD_ICONS[index]}
                  size={62}
                  weight="black"
                  color={selected ? Lantern.ink950 : color}
                />
              </View>
            </Pressable>
          );
        })}
      </View>
      <View style={experienceStyles.center}>
        <ThemedText style={styles.status} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
          {playing ? 'Watch…' : `Your turn · ${input.length}/${pattern.length}`}
        </ThemedText>
        {!playing ? <ExperienceAction label="Replay pattern" quiet onPress={play} /> : null}
      </View>
      <ExperienceAction label="Cancel round" quiet onPress={reset} />
    </View>
  );
}

const styles = StyleSheet.create({
  progress: {
    fontSize: 11.5,
    fontWeight: '900',
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  grid: {
    alignSelf: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    maxWidth: 284,
  },
  pad: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 26,
    borderWidth: 2,
    height: 136,
    justifyContent: 'center',
    width: 136,
  },
  padActive: {
    transform: [{ scale: 1.04 }],
  },
  symbolFrame: {
    alignItems: 'center',
    height: 76,
    justifyContent: 'center',
    width: 76,
  },
  status: {
    fontSize: 20,
    fontWeight: '900',
  },
});
