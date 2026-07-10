import type { ImageSourcePropType } from 'react-native';

import type { HomeVisualKey } from '@/types/home';
import type { KingdomHexTileAlphaBounds } from '@/utils/world-visuals';

export type KatchimeraHexTileSource = {
  source: ImageSourcePropType;
  alphaBounds: KingdomHexTileAlphaBounds;
};

export type KatchimeraHexTileVariantSource = KatchimeraHexTileSource & {
  id: string;
  label: string;
  description: string;
  generationId: string;
  generatedFrom?: {
    candidateId: string;
    promptTheme: string;
  };
};

export type KatchimeraHexTileCatalogEntry = {
  visualKey: HomeVisualKey;
  label: string;
  selectedVariantId: string;
  defaultVariantId: string;
  variants: KatchimeraHexTileVariantSource[];
};

export const KATCHIMERA_HEX_TILE_CATALOG: Partial<Record<HomeVisualKey, KatchimeraHexTileCatalogEntry>> = {
  feastle: {
    visualKey: 'feastle',
    label: 'Feastle resident tile',
    selectedVariantId: 'feastle-cafe-kitchen-v1',
    defaultVariantId: 'feastle-cafe-kitchen-v1',
    variants: [
      {
        id: 'feastle-cafe-kitchen-v1',
        label: 'Cafe kitchen',
        description: 'Open-roof Feastle cafe kitchen habitat with warm cooking props and an open standing area.',
        generationId: 'feastle-resident-hex-1',
        source: require('../assets/images/katchimeras/world/hex/resident_feastle_hex_tile.webp'),
        alphaBounds: { left: 14, top: 123, right: 1010, bottom: 901 },
        generatedFrom: {
          candidateId: 'feastle-resident-hex-1',
          promptTheme:
            'a hearty food spirit who treats every good meal as a small celebration; cozy feast kitchen and outdoor cafe habitat',
        },
      },
      {
        id: 'feastle-supper-patio-v1',
        label: 'Supper patio',
        description: 'Open Feastle supper patio with low back walls, prep shelves, garden herbs, and cobble path details.',
        generationId: 'feastle-resident-hex-2',
        source: require('../assets/images/katchimeras/world/hex/resident_feastle_hex_tile_v2.webp'),
        alphaBounds: { left: 14, top: 100, right: 1010, bottom: 923 },
        generatedFrom: {
          candidateId: 'feastle-resident-hex-2',
          promptTheme:
            'a hearty food spirit who treats every good meal as a small celebration; cozy feast kitchen and outdoor cafe habitat',
        },
      },
      {
        id: 'feastle-market-nook-v1',
        label: 'Market nook',
        description: 'Small celebratory Feastle food market habitat with produce baskets, warm lights, and an open roof stall.',
        generationId: 'feastle-resident-hex-3',
        source: require('../assets/images/katchimeras/world/hex/resident_feastle_hex_tile_v3.webp'),
        alphaBounds: { left: 14, top: 96, right: 1010, bottom: 928 },
        generatedFrom: {
          candidateId: 'feastle-resident-hex-3',
          promptTheme:
            'a hearty food spirit who treats every good meal as a small celebration; cozy feast kitchen and outdoor cafe habitat',
        },
      },
    ],
  },
  steppling: {
    visualKey: 'steppling',
    label: 'Steppling resident tile',
    selectedVariantId: 'steppling-hiking-lodge-v1',
    defaultVariantId: 'steppling-hiking-lodge-v1',
    variants: [
      {
        id: 'steppling-trailhead-v1',
        label: 'Trailhead rest stop',
        description: 'Sunny Steppling trailhead habitat with stepping stones, route signs, water station, and footprint motifs.',
        generationId: 'steppling-resident-hex-1',
        source: require('../assets/images/katchimeras/world/hex/resident_steppling_hex_tile.webp'),
        alphaBounds: { left: 27, top: 75, right: 996, bottom: 895 },
        generatedFrom: {
          candidateId: 'steppling-resident-hex-1',
          promptTheme:
            'a cheerful walking and hiking spirit who turns long walks, trails, route markers, footprints, and movement milestones into a cozy outdoor habitat',
        },
      },
      {
        id: 'steppling-hiking-lodge-v1',
        label: 'Hiking lodge',
        description: 'Cozy Steppling hiking-lodge porch habitat with path, trail map shapes, pine shrubs, and open standing space.',
        generationId: 'steppling-resident-hex-2',
        source: require('../assets/images/katchimeras/world/hex/resident_steppling_hex_tile_v2.webp'),
        alphaBounds: { left: 14, top: 120, right: 1011, bottom: 901 },
        generatedFrom: {
          candidateId: 'steppling-resident-hex-2',
          promptTheme:
            'a cheerful walking and hiking spirit who turns long walks, trails, route markers, footprints, and movement milestones into a cozy outdoor habitat',
        },
      },
      {
        id: 'steppling-walking-loop-v1',
        label: 'Walking loop',
        description: 'Park walking-loop Steppling habitat with curved path, bench, blank marker stones, lanterns, and picnic pause spot.',
        generationId: 'steppling-resident-hex-3',
        source: require('../assets/images/katchimeras/world/hex/resident_steppling_hex_tile_v3.webp'),
        alphaBounds: { left: 17, top: 47, right: 1009, bottom: 891 },
        generatedFrom: {
          candidateId: 'steppling-resident-hex-3',
          promptTheme:
            'a cheerful walking and hiking spirit who turns long walks, trails, route markers, footprints, and movement milestones into a cozy outdoor habitat',
        },
      },
    ],
  },
  flickerbun: {
    visualKey: 'flickerbun',
    label: 'Flickerbun resident tile',
    selectedVariantId: 'flickerbun-story-cinema-v1',
    defaultVariantId: 'flickerbun-story-cinema-v1',
    variants: [
      {
        id: 'flickerbun-story-cinema-v1',
        label: 'Story cinema',
        description: 'Open-air moonlit story cinema with velvet seats, projector booth, reels, lanterns, and a clear front stage.',
        generationId: 'flickerbun-resident-hex-1',
        source: require('../assets/images/katchimeras/world/hex/resident_flickerbun_hex_tile.webp'),
        alphaBounds: { left: 14, top: 88, right: 1010, bottom: 936 },
        generatedFrom: {
          candidateId: 'flickerbun-resident-hex-1',
          promptTheme:
            'a velvet-dark story lover with projector-bright eyes; cozy miniature cinema and moonlit story theater habitat',
        },
      },
      {
        id: 'flickerbun-theater-nook-v1',
        label: 'Theater nook',
        description: 'Mini outdoor theater nook with low back walls, blank projection screen, starry curtains, and purple lights.',
        generationId: 'flickerbun-resident-hex-2',
        source: require('../assets/images/katchimeras/world/hex/resident_flickerbun_hex_tile_v2.webp'),
        alphaBounds: { left: 14, top: 136, right: 1010, bottom: 887 },
        generatedFrom: {
          candidateId: 'flickerbun-resident-hex-2',
          promptTheme:
            'a velvet-dark story lover with projector-bright eyes; cozy miniature cinema and moonlit story theater habitat',
        },
      },
      {
        id: 'flickerbun-moonlit-patio-v1',
        label: 'Moonlit patio',
        description: 'Dreamy moonlit cinema patio with projector glow, plush seating, snack stand, decorative reels, and warm lamps.',
        generationId: 'flickerbun-resident-hex-3',
        source: require('../assets/images/katchimeras/world/hex/resident_flickerbun_hex_tile_v3.webp'),
        alphaBounds: { left: 14, top: 131, right: 1010, bottom: 892 },
        generatedFrom: {
          candidateId: 'flickerbun-resident-hex-3',
          promptTheme:
            'a velvet-dark story lover with projector-bright eyes; cozy miniature cinema and moonlit story theater habitat',
        },
      },
    ],
  },
  mossprout: {
    visualKey: 'mossprout',
    label: 'Mossprout resident tile',
    selectedVariantId: 'mossprout-park-garden-v1',
    defaultVariantId: 'mossprout-park-garden-v1',
    variants: [
      {
        id: 'mossprout-park-garden-v1',
        label: 'Park garden',
        description: 'Simplified Mossprout toy pocket park with chunky moss mounds, smooth pond, oversized flowers, and clear open grass.',
        generationId: 'mossprout-resident-hex-1',
        source: require('../assets/images/katchimeras/world/hex/resident_mossprout_hex_tile.webp'),
        alphaBounds: { left: 14, top: 107, right: 1010, bottom: 916 },
        generatedFrom: {
          candidateId: 'mossprout-resident-hex-1',
          promptTheme: 'gentle and grounded, delighted by green detours; lush park garden and mossy nature habitat',
        },
      },
    ],
  },
  tasklet: {
    visualKey: 'tasklet',
    label: 'Tasklet resident tile',
    selectedVariantId: 'tasklet-focus-workshop-v1',
    defaultVariantId: 'tasklet-focus-workshop-v1',
    variants: [
      {
        id: 'tasklet-focus-workshop-v1',
        label: 'Focus workshop',
        description: 'Focused Tasklet workshop habitat with blank planning board, tidy bench, supplies, blue lanterns, and open center.',
        generationId: 'tasklet-resident-hex-1',
        source: require('../assets/images/katchimeras/world/hex/resident_tasklet_hex_tile.webp'),
        alphaBounds: { left: 14, top: 82, right: 1010, bottom: 942 },
        generatedFrom: {
          candidateId: 'tasklet-resident-hex-1',
          promptTheme: 'a determined, competent little doer who loves a checked-off list; focused workshop and productivity garden habitat',
        },
      },
    ],
  },
  vesperitt: {
    visualKey: 'vesperitt',
    label: 'Vesperitt resident tile',
    selectedVariantId: 'vesperitt-night-study-v1',
    defaultVariantId: 'vesperitt-night-study-v1',
    variants: [
      {
        id: 'vesperitt-night-study-v1',
        label: 'Night study',
        description: 'Moonlit Vesperitt night owl study habitat with quiet small-hours lighting and an open resident space.',
        generationId: 'vesperitt-resident-hex-1',
        source: require('../assets/images/katchimeras/world/hex/resident_vesperitt_hex_tile.webp'),
        alphaBounds: { left: 14, top: 137, right: 1010, bottom: 887 },
        generatedFrom: {
          candidateId: 'fal-yjZuCe-a4Igg2pptZC3Mj',
          promptTheme:
            'a wide-awake small-hours spirit, calm in the quiet after midnight; moonlit night owl study and stargazing habitat',
        },
      },
    ],
  },
};

export const KATCHIMERA_HEX_TILE_SOURCES: Partial<Record<HomeVisualKey, KatchimeraHexTileSource>> = Object.fromEntries(
  Object.entries(KATCHIMERA_HEX_TILE_CATALOG).flatMap(([visualKey, entry]) => {
    if (!entry) return [];
    const selected =
      entry.variants.find((variant) => variant.id === entry.selectedVariantId) ??
      entry.variants.find((variant) => variant.id === entry.defaultVariantId) ??
      entry.variants[0];
    return selected ? [[visualKey, { source: selected.source, alphaBounds: selected.alphaBounds }]] : [];
  })
) as Partial<Record<HomeVisualKey, KatchimeraHexTileSource>>;
