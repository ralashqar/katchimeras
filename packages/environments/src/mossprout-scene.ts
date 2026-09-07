import { mossproutLayerGeometry, mossproutSceneEnvelope, MOSSPROUT_LAYOUT } from './mossprout-layout';
import { sharedResidentAnchor } from './resident-presentation';
import type { ImageSourcePropType } from 'react-native';
export const MOSSPROUT_ART = {
  home: { bounds: { left: 43, top: 35, right: 980, bottom: 952 }, source: require('@incubator/art-world/hex/mossprout_focused_v1_main_hex_tile_512.webp'), full: require('@incubator/art-world/hex/mossprout_focused_v1_main_hex_tile.webp'), thumb: require('@incubator/art-world/hex/mossprout_focused_v1_main_hex_tile_256.webp') },
  mist: { bounds: { left: 22, top: 114, right: 1002, bottom: 972 }, source: require('@incubator/art-world/hex/dream_mist_locked_hex_tile_v4_512.webp'), full: require('@incubator/art-world/hex/dream_mist_locked_hex_tile_v4.webp'), thumb: require('@incubator/art-world/hex/dream_mist_locked_hex_tile_v4_256.webp') },
  gate: { bounds: { left: 43, top: 36, right: 980, bottom: 952 }, source: require('@incubator/art-world/hex/shared_world_steppling_trailhead_hex_tile_v1_512.webp'), full: require('@incubator/art-world/hex/shared_world_steppling_trailhead_hex_tile_v1.webp'), thumb: require('@incubator/art-world/hex/shared_world_steppling_trailhead_hex_tile_v1_256.webp') },
  broken: { bounds: { left: 44, top: 128, right: 981, bottom: 949 }, source: require('@incubator/art-world/hex/floating_neighborhood_v2_mossprout_haven_stage_0_hex_tile_512.webp'), full: require('@incubator/art-world/hex/floating_neighborhood_v2_mossprout_haven_stage_0_hex_tile.webp'), thumb: require('@incubator/art-world/hex/floating_neighborhood_v2_mossprout_haven_stage_0_hex_tile_256.webp') },
  grown: { bounds: { left: 45, top: 126, right: 981, bottom: 950 }, source: require('@incubator/art-world/hex/floating_neighborhood_v2_mossprout_haven_stage_2_hex_tile_512.webp'), full: require('@incubator/art-world/hex/floating_neighborhood_v2_mossprout_haven_stage_2_hex_tile.webp'), thumb: require('@incubator/art-world/hex/floating_neighborhood_v2_mossprout_haven_stage_2_hex_tile_256.webp') },
  east: { bounds: { left: 30, top: 30, right: 994, bottom: 993 }, source: require('@incubator/art-world/hex/mossprout_focused_v1_bloom_garden_hex_tile_512.webp'), full: require('@incubator/art-world/hex/mossprout_focused_v1_bloom_garden_hex_tile.webp'), thumb: require('@incubator/art-world/hex/mossprout_focused_v1_bloom_garden_hex_tile_256.webp') },
} as const;
export const MOSSPROUT_SLOTS = [
  { id: 'home', coord: MOSSPROUT_LAYOUT.home.coord },
  { id: 'east', coord: { q: 1, r: 1 } }, { id: 'northeast', coord: { q: 1, r: 0 } },
  { id: 'gate', coord: MOSSPROUT_LAYOUT.gate.coord }, { id: 'west', coord: { q: -1, r: 1 } },
  { id: 'southwest', coord: { q: -1, r: 2 } }, { id: 'south', coord: { q: 0, r: 2 } },
] as const;
export type MossproutSlotId = (typeof MOSSPROUT_SLOTS)[number]['id'];
export type MossproutArtId = keyof typeof MOSSPROUT_ART;
export type MossproutLayer = ReturnType<typeof buildMossproutCampaignScene>['layers'][number];
export function buildMossproutCampaignScene(art: Partial<Record<MossproutSlotId, MossproutArtId>>) {
  const envelopes = MOSSPROUT_SLOTS.flatMap(slot => Object.values(MOSSPROUT_ART).map(asset => mossproutLayerGeometry(slot.coord, asset.bounds).frame));
  const envelope = mossproutSceneEnvelope(envelopes);
  const layers = MOSSPROUT_SLOTS.map(slot => {
    const asset = MOSSPROUT_ART[art[slot.id] ?? 'mist'];
    const geometry = mossproutLayerGeometry(slot.coord, asset.bounds);
    const shift = (f: typeof geometry.frame) => ({ ...f, left: f.left + envelope.dx, top: f.top + envelope.dy });
    const frame = shift(geometry.frame);
    return { id: slot.id, frame, interactionFrame: shift(geometry.interactionFrame), residentAnchor: sharedResidentAnchor(frame),
      source: asset.source as ImageSourcePropType, full: asset.full as ImageSourcePropType, thumb: asset.thumb as ImageSourcePropType };
  }).sort((a, b) => a.interactionFrame.top - b.interactionFrame.top);
  return { width: envelope.width, height: envelope.height, layers };
}
