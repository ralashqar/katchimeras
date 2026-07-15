import type { ZodiacElement } from '@/types/world-identity';

export type MatchThreePackId = 'zodiac-elements';

export type MatchThreeMotif = {
  id: string;
  label: string;
  accessibilityLabel: string;
  color: string;
  element: ZodiacElement;
  asset: string;
};

export type MatchThreePack = {
  id: MatchThreePackId;
  eyebrow: string;
  title: string;
  introduction: string;
  boardLabel: string;
  accent: string;
  motifs: MatchThreeMotif[];
};

const ZODIAC_MOTIFS: MatchThreeMotif[] = [
  motif('fire-ruby', 'Ruby', 'fire', '#FF654E'),
  motif('fire-sunstone', 'Sunstone', 'fire', '#FFB53D'),
  motif('earth-emerald', 'Emerald', 'earth', '#36C878'),
  motif('earth-jade', 'Jade', 'earth', '#A4C77E'),
  motif('air-opal', 'Opal', 'air', '#D8E9FF'),
  motif('air-celestite', 'Celestite', 'air', '#83C9FF'),
  motif('water-sapphire', 'Sapphire', 'water', '#397BEE'),
  motif('water-aquamarine', 'Aquamarine', 'water', '#54D7D2'),
];

export const ZODIAC_MATCH_THREE_PACK: MatchThreePack = {
  id: 'zodiac-elements',
  eyebrow: 'ELEMENTAL RITUAL',
  title: 'Gather your element',
  introduction: 'Swap neighbouring gems to align three or more. Gather both gems from your element before the last move.',
  boardLabel: 'Elemental gem match board',
  accent: '#D995FF',
  motifs: ZODIAC_MOTIFS,
};

export function matchThreePack(_packId: MatchThreePackId = 'zodiac-elements'): MatchThreePack {
  return ZODIAC_MATCH_THREE_PACK;
}

export function elementalGemMotifs(element: ZodiacElement): MatchThreeMotif[] {
  return ZODIAC_MOTIFS.filter((motifItem) => motifItem.element === element);
}

export function validateMatchThreePack(pack: MatchThreePack): string[] {
  const errors: string[] = [];
  if (pack.motifs.length < 8) errors.push(`${pack.id}: Match 3 packs require at least eight motifs`);
  if (new Set(pack.motifs.map((motifItem) => motifItem.id)).size !== pack.motifs.length) errors.push(`${pack.id}: motif IDs must be unique`);
  for (const motifItem of pack.motifs) if (!motifItem.label || !motifItem.accessibilityLabel || !motifItem.color || !motifItem.asset) errors.push(`${pack.id}: incomplete motif ${motifItem.id}`);
  return errors;
}

function motif(id: string, label: string, element: ZodiacElement, color: string): MatchThreeMotif {
  return { id, label, accessibilityLabel: `${label}, ${element} gem`, color, element, asset: id };
}
