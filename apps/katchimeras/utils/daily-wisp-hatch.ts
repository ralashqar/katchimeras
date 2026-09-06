import { READY_WISPS, wispDefinition } from '@/constants/wisps';
import { CINEMATIC_SCENE_CANDIDATES } from '@/constants/scenes';
import type {
  CardTrait,
  DailyCreatureCard,
  DailyWispHatch,
  DayThemeId,
  HomeRarityTier,
  HomeScoreKey,
  LocalCreatureRecord,
  StoredHomeDayRecord,
} from '@/types/home';
import type { WispDayCandidate, WispId, WispRarity } from '@/types/wisp';
import { buildDailyCreatureCard } from '@/utils/daily-card';
import { resolveDailyCardAtmosphere } from '@/utils/daily-card-scene';
import { dayInputSignature } from '@/game/days/shape';
import { stableHash } from '@/game/days/hash';
import { resolveWispCandidates } from '@/utils/wisp-engine';

const SCORE_THEME: Record<HomeScoreKey, DayThemeId> = {
  energy: 'movement',
  calm: 'reflection',
  social: 'social',
  exploration: 'exploration',
  focus: 'focus',
};

const FAMILY_THEME: Record<string, DayThemeId> = {
  weather: 'reflection',
  'nature-place': 'nature',
  'nature-subject': 'nature',
  'cozy-place': 'cozy',
  memory: 'reflection',
  rhythm: 'rest',
  studio: 'creativity',
  travel: 'exploration',
  connection: 'social',
  food: 'cozy',
  movement: 'movement',
  achievement: 'achievement',
  celebration: 'celebration',
};

export function finalizeDailyWispHatch(input: {
  day: StoredHomeDayRecord;
  now: Date;
  pastDays: readonly StoredHomeDayRecord[];
  provenance: DailyWispHatch['provenance'];
  preferredWispId?: WispId | null;
  revealed?: boolean;
}): { hatch: DailyWispHatch; card: DailyCreatureCard } {
  const { day, now, pastDays, provenance } = input;
  const scores = dailyThemeScores(day);
  const orderedScores = (Object.keys(scores) as HomeScoreKey[])
    .sort((left, right) => scores[right] - scores[left]);
  const candidates = dailyCandidates(day, pastDays);
  const primaryWispId = input.preferredWispId && isDailyWisp(input.preferredWispId)
    ? input.preferredWispId
    : selectDailyWisp(day, candidates, pastDays);
  const definition = wispDefinition(primaryWispId);
  const primaryTheme = FAMILY_THEME[definition.featureFamily] ?? SCORE_THEME[orderedScores[0] ?? 'calm'];
  const scoreTheme = SCORE_THEME[orderedScores.find((key) => SCORE_THEME[key] !== primaryTheme) ?? 'calm'];
  const secondaryTheme = scoreTheme === primaryTheme ? null : scoreTheme;
  const traits = buildTraits(primaryTheme, secondaryTheme, candidates);
  const atmosphere = resolveDailyCardAtmosphere(day);
  const sceneCandidates = CINEMATIC_SCENE_CANDIDATES[atmosphere.sceneId];
  const sceneVariantId = sceneCandidates[
    stableHash(`${day.isoDate}|${dayInputSignature(day)}|scene`) % sceneCandidates.length
  ];
  const sealedAt = day.shareReadyAt ?? now.toISOString();
  const hatch: DailyWispHatch = {
    schemaVersion: 1,
    primaryWispId,
    sceneVariantId,
    primaryTheme,
    secondaryTheme,
    traits,
    evidence: candidates.slice(0, 4).flatMap((candidate) => candidate.evidence.slice(0, 2).map((label) => ({
      source: candidate.confidence,
      label,
      weight: candidate.score,
    }))),
    sealedInputSignature: dayInputSignature(day),
    sealedAt,
    revealedAt: input.revealed === false ? null : sealedAt,
    claimedAt: input.revealed === false ? null : sealedAt,
    provenance,
  };
  const creature = cardAdapterCreature(day, primaryWispId, primaryTheme, secondaryTheme);
  const built = buildDailyCreatureCard({ ...day, creature }, creature, {
    mode: provenance === 'legacy_conversion' ? 'legacy_backfill' : 'live_hatch',
    sealedAt,
    pastDays,
    scores,
  });
  const card: DailyCreatureCard = {
    ...built,
    creatureName: definition.name,
    primaryWispId,
    sceneVariantId,
    dayLine: dayLine(definition.name, primaryTheme),
    storyLine: dayLine(definition.name, primaryTheme),
    epithet: definition.subtitle,
    traits,
    featuredWisps: [{ wispId: primaryWispId, score: 1, confidence: 'confirmed', evidence: ['daily-primary'] }],
    scene: built.scene,
  };
  return { hatch, card };
}

export function isDailyWisp(id: WispId) {
  const definition = wispDefinition(id);
  return definition.availability === 'ready' && definition.primaryAcquisition === 'experience' && definition.dayRule != null;
}

function dailyCandidates(day: StoredHomeDayRecord, pastDays: readonly StoredHomeDayRecord[]) {
  return resolveWispCandidates(day, pastDays).filter((candidate) => isDailyWisp(candidate.wispId));
}

function selectDailyWisp(
  day: StoredHomeDayRecord,
  candidates: readonly WispDayCandidate[],
  pastDays: readonly StoredHomeDayRecord[],
): WispId {
  const fallback = READY_WISPS.filter((item) => isDailyWisp(item.id));
  const pool = candidates.length
    ? candidates.slice(0, 6)
    : fallback.slice(0, 12).map((item) => ({ wispId: item.id, score: 0.5, confidence: 'inferred' as const, evidence: ['captured-context'] }));
  const previous = [...pastDays]
    .filter((candidate) => candidate.isoDate < day.isoDate && candidate.dailyHatch)
    .sort((left, right) => right.isoDate.localeCompare(left.isoDate))[0]?.dailyHatch?.primaryWispId;
  const weighted = pool.map((candidate) => ({
    id: candidate.wispId,
    weight: Math.max(0.08, candidate.score * (candidate.wispId === previous ? 0.38 : 1)),
  }));
  const total = weighted.reduce((sum, item) => sum + item.weight, 0);
  let roll = (stableHash(`${day.isoDate}|${dayInputSignature(day)}|${day.storedNonce ?? ''}|wisp`) % 1_000_000) / 1_000_000 * total;
  for (const item of weighted) {
    roll -= item.weight;
    if (roll <= 0) return item.id;
  }
  return weighted[0]?.id ?? 'sunbeam';
}

function buildTraits(primary: DayThemeId, secondary: DayThemeId | null, candidates: readonly WispDayCandidate[]): CardTrait[] {
  return [primary, secondary].filter((value): value is DayThemeId => Boolean(value)).slice(0, 3).map((theme, index) => ({
    id: `day-theme:${theme}`,
    family: themeFamily(theme),
    label: themeLabel(theme),
    strength: index === 0 ? 1 : 0.72,
    confidence: candidates[index]?.confidence ?? 'inferred',
    evidence: candidates[index]?.evidence ?? [],
  }));
}

function themeFamily(theme: DayThemeId): CardTrait['family'] {
  if (theme === 'social' || theme === 'celebration') return 'connection';
  if (theme === 'movement' || theme === 'adventure' || theme === 'exploration') return 'movement';
  if (theme === 'rest' || theme === 'cozy') return 'recovery';
  if (theme === 'reflection' || theme === 'focus' || theme === 'creativity') return 'mind';
  return 'place_weather';
}

function themeLabel(theme: DayThemeId) {
  const labels: Record<DayThemeId, string> = {
    nature: 'Nature', social: 'Together', adventure: 'Adventurous', cozy: 'Cozy', creativity: 'Creative',
    achievement: 'Achieving', reflection: 'Reflective', exploration: 'Exploring', rest: 'Restful',
    celebration: 'Celebrating', focus: 'Focused', movement: 'Active',
  };
  return labels[theme];
}

function cardAdapterCreature(
  day: StoredHomeDayRecord,
  wispId: WispId,
  primary: DayThemeId,
  secondary: DayThemeId | null,
): LocalCreatureRecord {
  const definition = wispDefinition(wispId);
  return {
    id: `wisp-day-${day.isoDate}-${wispId}`,
    name: definition.name,
    primaryTrait: scoreKey(primary),
    secondaryTrait: scoreKey(secondary ?? 'reflection'),
    rarity: cardRarity(definition.rarity),
    visualKey: 'mossprout',
    accentColor: definition.palette[0] ?? '#FFD98A',
    highlightMomentId: null,
    highlight: dayLine(definition.name, primary),
    reflection: dayLine(definition.name, primary),
    motifTags: [themeLabel(primary), ...(secondary ? [themeLabel(secondary)] : [])],
    encounterProfileId: null,
    repeatDepth: 0,
  };
}

function scoreKey(theme: DayThemeId): HomeScoreKey {
  if (theme === 'social' || theme === 'celebration') return 'social';
  if (theme === 'movement' || theme === 'achievement') return 'energy';
  if (theme === 'exploration' || theme === 'adventure' || theme === 'nature') return 'exploration';
  if (theme === 'focus' || theme === 'creativity') return 'focus';
  return 'calm';
}

function cardRarity(rarity: WispRarity): HomeRarityTier {
  return rarity === 'legendary' ? 'legendary' : rarity === 'epic' ? 'epic' : rarity === 'rare' ? 'rare' : 'common';
}

function dayLine(name: string, theme: DayThemeId) {
  const lines: Partial<Record<DayThemeId, string>> = {
    nature: 'A day that found a little room to grow.',
    social: 'A day made warmer by sharing it.',
    exploration: 'A day with somewhere new to wander.',
    cozy: 'A day that kept its softer corners.',
    creativity: 'A day that left a bright idea glowing.',
    achievement: 'A day that carried something through.',
    reflection: 'A quieter day that still left a light behind.',
    rest: 'A day that knew when to settle.',
    movement: 'A day with a little forward pull.',
  };
  return lines[theme] ?? `${name} kept the clearest little piece of the day.`;
}

/**
 * The daily collectible selector deliberately stays independent from the
 * Katchimera encounter catalog (whose module also owns native image assets).
 * Wisp rules provide the rich classification; these compact scores only break
 * ties and give the compatibility card builder its five familiar axes.
 */
function dailyThemeScores(day: StoredHomeDayRecord): Record<HomeScoreKey, number> {
  const captured = day.capturedEnergy ?? {};
  const clamp = (value: number) => Math.max(0, Math.min(1, Number(value.toFixed(3))));
  const promptCount = day.promptAnswers.filter((answer) => !answer.dismissed).length;
  const journalCount = (day.journalRecords?.length ?? 0) + (day.manualJournalEntries?.length ?? 0);
  return {
    energy: clamp((captured.energy ?? 0) + Math.min(day.stepsCount / 12_000, 0.45)),
    calm: clamp((captured.calm ?? 0) + (day.sleep ? 0.18 : 0) + Math.min(journalCount * 0.08, 0.3)),
    social: clamp((captured.social ?? 0) + Math.min(day.visitedPlaceCount * 0.08, 0.28)),
    exploration: clamp((captured.exploration ?? 0) + Math.min(day.newPlaceCount * 0.18 + day.locations.length * 0.04, 0.5)),
    focus: clamp((captured.focus ?? 0) + Math.min(promptCount * 0.09 + journalCount * 0.08, 0.42)),
  };
}
