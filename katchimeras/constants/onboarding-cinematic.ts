import type { IconSymbolName } from '@/components/ui/icon-symbol';
import { timelineDemoEntries } from '@/constants/timeline-demo';
import type { ScriptedTimelineState } from '@/types/timeline';

export type OnboardingCinematicStage = 'opening' | 'variety' | 'memory' | 'tomorrow';

export type OpeningSequencePhase =
  | 'scene-1-opening-line'
  | 'scene-2-moments-slow'
  | 'scene-2-moments-fast'
  | 'scene-3-convergence'
  | 'scene-4-egg-buildup'
  | 'scene-5-hatch'
  | 'scene-5-settle';

export type OpeningMomentChip = {
  id: string;
  label: string;
  icon: IconSymbolName;
  accent: string;
  enterFrom: 'left' | 'right';
  zone:
    | 'top-left'
    | 'top-center'
    | 'top-right'
    | 'mid-left'
    | 'mid-right'
    | 'bottom-left'
    | 'bottom-center'
    | 'bottom-right';
  lane: 'rise-right' | 'rise-left' | 'fall-right' | 'fall-left';
  depth: 'near' | 'mid' | 'far';
  appearIn: 'slow' | 'fast';
  emphasis?: 'soft' | 'strong';
  staggerMs: number;
};

export type OpeningBottomCopyCue = {
  text: string;
  tone?: 'soft' | 'locked';
};

export type OpeningScene = {
  id: OpeningSequencePhase;
  headline: string;
  subtext?: string;
  durationMs: number;
  chipBehavior: 'hidden' | 'slow' | 'fast' | 'converge' | 'build' | 'hidden-after-hatch';
  eggState: 'hidden' | 'forming' | 'build' | 'hatch' | 'revealed';
  showEnergyLinks: boolean;
  bottomCopy?: OpeningBottomCopyCue;
  hapticCue?: 'egg-build' | 'hatch';
};

export type OpeningHandoffConfig = {
  revealTargetId: string;
  holdDurationMs: number;
};

export type OpeningSequenceConfig = {
  scenes: readonly OpeningScene[];
  chips: readonly OpeningMomentChip[];
  handoff: OpeningHandoffConfig;
};

export type OnboardingCinematicBeat = {
  id: string;
  headline: string;
  subtext: string;
  durationMs: number;
  stageVisual: OnboardingCinematicStage;
  ctaLabel?: string;
  showCta?: boolean;
  timelineState: ScriptedTimelineState;
  openingSequence?: OpeningSequenceConfig;
};

const [morningWalk, morningCoffee, gymSession, familyDinner, todayCafe] = timelineDemoEntries;

const openingSequence: OpeningSequenceConfig = {
  handoff: {
    revealTargetId: morningWalk.id,
    holdDurationMs: 2100,
  },
  chips: [
    {
      id: 'chip-walk',
      label: 'Morning walk',
      icon: 'figure.walk',
      accent: '#A7D5FF',
      enterFrom: 'left',
      zone: 'top-left',
      lane: 'rise-right',
      depth: 'near',
      appearIn: 'slow',
      emphasis: 'strong',
      staggerMs: 0,
    },
    {
      id: 'chip-cafe',
      label: 'Coffee at your cafe',
      icon: 'cup.and.saucer.fill',
      accent: '#F4BE8D',
      enterFrom: 'right',
      zone: 'top-right',
      lane: 'fall-left',
      depth: 'mid',
      appearIn: 'slow',
      staggerMs: 900,
    },
    {
      id: 'chip-photo',
      label: 'Took a photo',
      icon: 'camera.fill',
      accent: '#D2BEFF',
      enterFrom: 'left',
      zone: 'mid-left',
      lane: 'fall-right',
      depth: 'mid',
      appearIn: 'slow',
      staggerMs: 1800,
    },
    {
      id: 'chip-place',
      label: 'Visited a new place',
      icon: 'mappin.and.ellipse',
      accent: '#F1D2A1',
      enterFrom: 'right',
      zone: 'mid-right',
      lane: 'rise-left',
      depth: 'far',
      appearIn: 'slow',
      staggerMs: 2700,
    },
    {
      id: 'chip-talk',
      label: 'Long conversation',
      icon: 'bubble.left.and.bubble.right.fill',
      accent: '#F5AFC6',
      enterFrom: 'left',
      zone: 'bottom-left',
      lane: 'rise-right',
      depth: 'near',
      appearIn: 'fast',
      staggerMs: 220,
    },
    {
      id: 'chip-quiet',
      label: 'Evening quiet',
      icon: 'moon.stars.fill',
      accent: '#AAB2FF',
      enterFrom: 'right',
      zone: 'bottom-right',
      lane: 'rise-left',
      depth: 'far',
      appearIn: 'fast',
      staggerMs: 520,
    },
    {
      id: 'chip-run',
      label: '5.2 km run',
      icon: 'bolt.fill',
      accent: '#91D8C7',
      enterFrom: 'left',
      zone: 'bottom-center',
      lane: 'rise-right',
      depth: 'mid',
      appearIn: 'fast',
      emphasis: 'strong',
      staggerMs: 820,
    },
  ] as const,
  scenes: [
    {
      id: 'scene-1-opening-line',
      headline: "Your days don't just pass.",
      subtext: "They're made of moments.",
      durationMs: 3400,
      chipBehavior: 'hidden',
      eggState: 'hidden',
      showEnergyLinks: false,
    },
    {
      id: 'scene-2-moments-slow',
      headline: '',
      subtext: '',
      durationMs: 3200,
      chipBehavior: 'slow',
      eggState: 'hidden',
      showEnergyLinks: false,
      bottomCopy: {
        text: 'Moments shape your day.',
        tone: 'soft',
      },
    },
    {
      id: 'scene-2-moments-fast',
      headline: '',
      subtext: '',
      durationMs: 2400,
      chipBehavior: 'fast',
      eggState: 'hidden',
      showEnergyLinks: false,
      bottomCopy: {
        text: 'Every step. Every place. Every memory.',
      },
    },
    {
      id: 'scene-3-convergence',
      headline: 'They come together.',
      subtext: '',
      durationMs: 2100,
      chipBehavior: 'converge',
      eggState: 'forming',
      showEnergyLinks: true,
      bottomCopy: {
        text: 'The day begins to gather itself.',
        tone: 'locked',
      },
    },
    {
      id: 'scene-4-egg-buildup',
      headline: 'Your day takes shape.',
      subtext: '',
      durationMs: 1900,
      chipBehavior: 'build',
      eggState: 'build',
      showEnergyLinks: false,
      hapticCue: 'egg-build',
    },
    {
      id: 'scene-5-hatch',
      headline: '',
      subtext: '',
      durationMs: 900,
      chipBehavior: 'hidden-after-hatch',
      eggState: 'hatch',
      showEnergyLinks: false,
      hapticCue: 'hatch',
    },
    {
      id: 'scene-5-settle',
      headline: 'Today became... Voltstep.',
      subtext: 'A living memory shaped by what the day held.',
      durationMs: 2100,
      chipBehavior: 'hidden-after-hatch',
      eggState: 'revealed',
      showEnergyLinks: false,
    },
  ] as const,
} as const;

export const onboardingCinematicBeats: readonly OnboardingCinematicBeat[] = [
  {
    id: 'opening',
    headline: '',
    subtext: '',
    durationMs: 0,
    stageVisual: 'opening',
    timelineState: {
      timelineShift: 'hidden',
      visibleEntryIds: [],
    },
    openingSequence,
  },
  {
    id: 'variety',
    headline: 'Each day becomes its own creature.',
    subtext: 'Different days leave different shapes behind.',
    durationMs: 2400,
    stageVisual: 'variety',
    timelineState: {
      timelineShift: 'center',
      visibleEntryIds: [morningWalk.id, morningCoffee.id, gymSession.id, familyDinner.id],
      focusedEntryId: familyDinner.id,
      activityCardsVisible: [morningCoffee.id, gymSession.id, familyDinner.id],
      activityCardsEnteringFrom: 'right',
      revealedCreatureId: familyDinner.id,
      highlightedEntryId: familyDinner.id,
    },
  },
  {
    id: 'memory',
    headline: 'Revisit what made the day yours.',
    subtext: 'Highlights, memories, and moments shaped what you caught.',
    durationMs: 2400,
    stageVisual: 'memory',
    timelineState: {
      timelineShift: 'center',
      visibleEntryIds: timelineDemoEntries.map((entry) => entry.id),
      focusedEntryId: todayCafe.id,
      showMemoryCard: true,
      memoryExpanded: true,
      highlightedEntryId: todayCafe.id,
      revealedCreatureId: todayCafe.id,
    },
  },
  {
    id: 'tomorrow',
    headline: 'Tomorrow is already forming.',
    subtext: 'Come back each day to see what your life becomes next.',
    durationMs: 2600,
    stageVisual: 'tomorrow',
    showCta: true,
    ctaLabel: 'See what my day becomes',
    timelineState: {
      timelineShift: 'tomorrow',
      visibleEntryIds: timelineDemoEntries.map((entry) => entry.id),
      focusedEntryId: 'tomorrow',
      showMemoryCard: true,
      showTomorrowEgg: true,
      memoryExpanded: true,
      tomorrowRevealProgress: 1,
    },
  },
] as const;
