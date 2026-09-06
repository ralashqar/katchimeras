import type { HomeDayRecord, LocalCreatureRecord } from '@/types/home';

// The 4-panel day comic — the Plus flagship share artifact. This pure module
// structures the day into a tiny four-beat arc (ordinary → what happened → the
// rare/bonded twist → the meaning) and chooses which curated photo backs each
// panel. The visual is composed in components/.../day-comic.tsx and captured to
// an image; this is just the story logic, so it's fully harness-verifiable.

export type ComicPanelKind = 'open' | 'scene' | 'turn' | 'close';

export type ComicPanel = {
  kind: ComicPanelKind;
  caption: string;
  photoUri: string | null;
  showCreature: boolean;
};

export type ComicStrip = {
  title: string;
  subtitle: string;
  accentColor: string;
  panels: ComicPanel[];
};

const MAX_CAPTION = 96;

// `beats` is the optional LLM-written panel captions (open, scene, turn, close).
// Each panel falls back to the local templated beat when its LLM line is
// missing, so the comic always renders even offline / before the edge function
// is deployed.
export type ComicBeats = (string | null | undefined)[];

export function buildComicStrip(day: HomeDayRecord, beats?: ComicBeats | null): ComicStrip | null {
  const creature = day.creature;
  if (!creature) {
    return null;
  }

  const photos = collectComicPhotos(day);

  const panels: ComicPanel[] = [
    { kind: 'open', caption: beatOr(beats, 0, () => openBeat(day)), photoUri: null, showCreature: true },
    { kind: 'scene', caption: beatOr(beats, 1, () => sceneBeat(day, creature)), photoUri: photos[0] ?? null, showCreature: photos.length === 0 },
    { kind: 'turn', caption: beatOr(beats, 2, () => turnBeat(creature)), photoUri: photos[1] ?? null, showCreature: photos.length <= 1 },
    { kind: 'close', caption: beatOr(beats, 3, () => closeBeat(creature)), photoUri: photos[2] ?? null, showCreature: true },
  ];

  return {
    title: creature.name,
    subtitle: buildSubtitle(creature),
    accentColor: creature.accentColor,
    panels,
  };
}

// Up to three curated keepers from the day's place clusters, in day order —
// the same source the Day Card uses, so the comic stays composed of keepers.
function collectComicPhotos(day: HomeDayRecord): string[] {
  const uris: string[] = [];
  const seen = new Set<string>();
  for (const node of day.dayMap?.nodes ?? []) {
    for (const photo of node.photos ?? []) {
      if (seen.has(photo.thumbnailUri)) {
        continue;
      }
      seen.add(photo.thumbnailUri);
      uris.push(photo.thumbnailUri);
      if (uris.length >= 3) {
        return uris;
      }
    }
  }
  return uris;
}

function beatOr(beats: ComicBeats | null | undefined, index: number, fallback: () => string): string {
  const beat = beats?.[index];
  if (typeof beat === 'string' && beat.trim()) {
    return trimCaption(beat);
  }
  return fallback();
}

function openBeat(day: HomeDayRecord): string {
  return `${day.dayLabel} started like any other.`;
}

function sceneBeat(day: HomeDayRecord, creature: LocalCreatureRecord): string {
  return trimCaption(day.highlight ?? creature.highlight);
}

function turnBeat(creature: LocalCreatureRecord): string {
  if (creature.rarity !== 'common' && creature.rarityReason) {
    return trimCaption(`But it was ${creature.rarity} — only from ${creature.rarityReason}.`);
  }
  const visitCount = creature.bondVisitCount ?? creature.repeatDepth + 1;
  if (visitCount > 1) {
    return trimCaption(`${creature.name} again — the ${formatOrdinal(visitCount)} time now.`);
  }
  return trimCaption(`And ${creature.name} was there for all of it.`);
}

function closeBeat(creature: LocalCreatureRecord): string {
  return trimCaption(creature.reflection);
}

function buildSubtitle(creature: LocalCreatureRecord): string {
  const cue = creature.encounterProfileId ? creature.motifTags[0] ?? null : null;
  const visitCount = creature.bondVisitCount ?? creature.repeatDepth + 1;
  if (creature.rarity !== 'common') {
    return cue ? `${cue} · ${creature.rarity}` : creature.rarity;
  }
  if (visitCount > 1) {
    return cue ? `${cue} · ${formatOrdinal(visitCount)} visit` : `${formatOrdinal(visitCount)} visit`;
  }
  return cue ?? 'A day, kept';
}

function trimCaption(text: string): string {
  const clean = text.trim();
  if (clean.length <= MAX_CAPTION) {
    return clean;
  }
  const slice = clean.slice(0, MAX_CAPTION);
  const lastSpace = slice.lastIndexOf(' ');
  return `${slice.slice(0, lastSpace > 40 ? lastSpace : MAX_CAPTION).trimEnd()}…`;
}

function formatOrdinal(value: number): string {
  const tens = value % 100;
  const ones = value % 10;
  if (tens >= 11 && tens <= 13) return `${value}th`;
  if (ones === 1) return `${value}st`;
  if (ones === 2) return `${value}nd`;
  if (ones === 3) return `${value}rd`;
  return `${value}th`;
}
