import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { Lantern } from '@/constants/theme';
import { useDisposableTimers } from '@/hooks/use-disposable-timers';
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
  gameId:
    | 'gatherglow-lights'
    | 'vesperitt-moon-signals'
    | 'coffee-ritual-brew-sequence'
    | 'dawnle-first-light'
    | 'quietome-still-signals';
  seed: string;
  onAttemptStart: (config: Record<string, unknown>) => string;
  onAttemptCancel: (id: string) => void;
  onComplete: (id: string, result: QuestResult) => void;
  onRunningChange: (running: boolean, id?: string | null) => void;
};

type PatternExperience = {
  eyebrow: string;
  title: string;
  body: string;
  actionLabel: string;
  icon: IconSymbolName;
  padColors: readonly string[];
  padIcons: readonly IconSymbolName[];
  padAccessibilityLabel: string;
  progressNoun: string;
  keptNoun: string;
  watchLabel: string;
  replayLabel: string;
  successTitle: string;
  failureTitle: string;
  resultNoun: string;
};

const GATHERGLOW_EXPERIENCE: PatternExperience = {
  eyebrow: 'Gatherglow',
  title: 'Follow Gatherglow’s lights',
  body: 'Watch the four lights, then repeat their order.',
  actionLabel: 'Begin pattern',
  icon: 'sparkles',
  padColors: [Lantern.ember300, Lantern.auroraTeal, Lantern.auroraViolet, Lantern.auroraRose],
  padIcons: ['circle.fill', 'triangle.fill', 'square.fill', 'sparkles'],
  padAccessibilityLabel: 'Pattern light',
  progressNoun: 'ROUND',
  keptNoun: 'KEPT',
  watchLabel: 'Watch…',
  replayLabel: 'Replay pattern',
  successTitle: 'The pattern held',
  failureTitle: 'The lights slipped away',
  resultNoun: 'patterns remembered',
};

const VESPERITT_EXPERIENCE: PatternExperience = {
  eyebrow: 'Vesperitt · Moon signals',
  title: 'Trace the quiet constellations',
  body: 'Watch each night signal wake, then echo the same path through the stars.',
  actionLabel: 'Enter the night',
  icon: 'moon.stars.fill',
  padColors: ['#D6DCFF', '#8FA8FF', Lantern.auroraViolet, Lantern.auroraTeal],
  padIcons: ['moon.stars.fill', 'star.fill', 'sparkles', 'diamond.fill'],
  padAccessibilityLabel: 'Moon signal',
  progressNoun: 'SIGNAL',
  keptNoun: 'TRACED',
  watchLabel: 'The night is signalling…',
  replayLabel: 'Replay signals',
  successTitle: 'The night path held',
  failureTitle: 'The signals faded',
  resultNoun: 'night paths traced',
};

const COFFEE_RITUAL_EXPERIENCE: PatternExperience = {
  eyebrow: 'Baristabbit · Brew ritual',
  title: 'Remember the little brew',
  body: 'Watch each ritual cue, then repeat the same sequence.',
  actionLabel: 'Begin brewing',
  icon: 'cup.and.saucer.fill',
  padColors: ['#F4D6A0', '#C98B54', '#8B5E3C', Lantern.ember300],
  padIcons: ['cup.and.saucer.fill', 'circle.fill', 'sparkles', 'diamond.fill'],
  padAccessibilityLabel: 'Brew cue',
  progressNoun: 'POUR',
  keptNoun: 'KEPT',
  watchLabel: 'The ritual is unfolding…',
  replayLabel: 'Replay brew',
  successTitle: 'The ritual held',
  failureTitle: 'The brew lost its rhythm',
  resultNoun: 'brew sequences remembered',
};

const DAWNLE_EXPERIENCE: PatternExperience = {
  eyebrow: 'Dawnle · First light',
  title: 'Wake the morning lights',
  body: 'Watch the first lights rise, then repeat their order.',
  actionLabel: 'Greet the light',
  icon: 'sun.max.fill',
  padColors: ['#FFF1B8', '#FFD47A', '#FFAB73', '#D9C7FF'],
  padIcons: ['sun.max.fill', 'sparkles', 'circle.fill', 'diamond.fill'],
  padAccessibilityLabel: 'Morning light',
  progressNoun: 'DAWN',
  keptNoun: 'WOKEN',
  watchLabel: 'Morning is arriving…',
  replayLabel: 'Replay lights',
  successTitle: 'The morning opened',
  failureTitle: 'The first light faded',
  resultNoun: 'morning paths remembered',
};

const QUIETOME_EXPERIENCE: PatternExperience = {
  eyebrow: 'Quietome · Still signals',
  title: 'Hold the quiet pattern',
  body: 'Watch the still symbols appear, then return them without rushing.',
  actionLabel: 'Enter the quiet',
  icon: 'sparkles',
  padColors: ['#D9D2C3', '#AEB7B0', '#869B92', '#C4B9D8'],
  padIcons: ['circle.fill', 'diamond.fill', 'square.fill', 'sparkles'],
  padAccessibilityLabel: 'Quiet signal',
  progressNoun: 'PAUSE',
  keptNoun: 'HELD',
  watchLabel: 'Stay with the signals…',
  replayLabel: 'Replay signals',
  successTitle: 'The quiet pattern held',
  failureTitle: 'The signals drifted',
  resultNoun: 'quiet patterns held',
};

const PATTERN_EXPERIENCES: Record<Props['gameId'], PatternExperience> = {
  'gatherglow-lights': GATHERGLOW_EXPERIENCE,
  'vesperitt-moon-signals': VESPERITT_EXPERIENCE,
  'coffee-ritual-brew-sequence': COFFEE_RITUAL_EXPERIENCE,
  'dawnle-first-light': DAWNLE_EXPERIENCE,
  'quietome-still-signals': QUIETOME_EXPERIENCE,
};

export function PatternMemoryQuest({
  config,
  gameId,
  seed,
  onAttemptStart,
  onAttemptCancel,
  onComplete,
  onRunningChange,
}: Props) {
  const { height, width } = useWindowDimensions();
  const experience = PATTERN_EXPERIENCES[gameId];
  const [started, setStarted] = useState(false);
  const [round, setRound] = useState(0);
  const [won, setWon] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [input, setInput] = useState<number[]>([]);
  const [active, setActive] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const attempt = useRef<string | null>(null);
  const startedAt = useRef(0);
  const timers = useDisposableTimers('pattern-memory');
  const length = Math.min(config.maxLength, config.startLength + round);
  const pattern = useMemo(() => createPattern(`${seed}:${round}`, length), [length, round, seed]);
  const complete = round >= config.rounds;
  const appActive = useQuestAppActive();
  const padSize = Math.max(104, Math.min(136, (Math.min(width, 360) - 40) / 2, (height - 260) / 2));

  const play = useCallback(() => {
    timers.cancelAll();
    setPlaying(true);
    pattern.forEach((pad, index) => {
      timers.schedule(() => {
          setActive(pad);
          if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
        }, index * config.playbackMs);
      timers.schedule(() => setActive(null), index * config.playbackMs + config.playbackMs * 0.62);
    });
    timers.schedule(() => setPlaying(false), pattern.length * config.playbackMs);
  }, [config.playbackMs, pattern, timers]);

  useEffect(() => {
    if (!appActive) {
      timers.cancelAll();
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
    timers.schedule(() => setActive(null), 160);
    if (!patternMatches(pattern, next)) {
      setMistakes((value) => value + 1);
      setInput([]);
      timers.schedule(() => setRound((value) => value + 1), 420);
      return;
    }
    if (patternComplete(pattern, next)) {
      setWon((value) => value + 1);
      setInput([]);
      timers.schedule(() => setRound((value) => value + 1), 420);
    } else {
      setInput(next);
    }
  };

  const success = complete && won >= config.targetRounds;

  if (!started) {
    return (
        <QuestExperiencePreview
          eyebrow={experience.eyebrow}
          title={experience.title}
          body={experience.body}
          icon={experience.icon}
          actionLabel={experience.actionLabel}
          onAction={start}
        />
    );
  }

  if (complete && attempt.current) {
    return (
      <ExperienceResult
        success={success}
        title={success ? experience.successTitle : experience.failureTitle}
        body={`${won} of ${config.rounds} ${experience.resultNoun}.`}
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
        {experience.progressNoun} {round + 1} OF {config.rounds} · {won} {experience.keptNoun}
      </ThemedText>
      <View accessibilityLabel="Pattern pads" style={[styles.grid, { maxWidth: padSize * 2 + 12 }]}>
        {experience.padColors.map((color, index) => {
          const selected = active === index;
          return (
            <Pressable
              key={color}
              accessibilityRole="button"
              accessibilityLabel={`${experience.padAccessibilityLabel} ${index + 1}`}
              disabled={playing}
              onPress={() => press(index)}
              style={[
                styles.pad,
                {
                  backgroundColor: selected ? color : `${color}33`,
                  borderColor: color,
                  height: padSize,
                  width: padSize,
                },
                selected && styles.padActive,
              ]}>
              <View pointerEvents="none" style={styles.symbolFrame}>
                <IconSymbol
                  name={experience.padIcons[index]!}
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
          {playing ? experience.watchLabel : `Your turn · ${input.length}/${pattern.length}`}
        </ThemedText>
        {!playing ? <ExperienceAction label={experience.replayLabel} quiet onPress={play} /> : null}
      </View>
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
  },
  pad: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 26,
    borderWidth: 2,
    justifyContent: 'center',
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
