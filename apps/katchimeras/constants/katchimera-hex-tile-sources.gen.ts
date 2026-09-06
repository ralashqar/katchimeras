import type { ImageSourcePropType } from 'react-native';

import type { HomeVisualKey } from '@/types/home';
import { KINGDOM_HEX_TILE_ALPHA_BOUNDS } from '@/constants/kingdom-hex-tile-bounds.gen';
import type { KingdomHexTileAlphaBounds, KingdomHexTileLodSources } from '@/utils/world-visuals';

const tileAlphaBounds = (
  assetName: keyof typeof KINGDOM_HEX_TILE_ALPHA_BOUNDS
): KingdomHexTileAlphaBounds => KINGDOM_HEX_TILE_ALPHA_BOUNDS[assetName];

export type KatchimeraHexTileSource = {
  source: ImageSourcePropType;
  sources?: KingdomHexTileLodSources;
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

const RESIDENT_FEASTLE_HEX_TILE_SOURCES: KingdomHexTileLodSources = {
  thumb: require('@incubator/art-world/hex/resident_feastle_hex_tile_256.webp'),
  medium: require('@incubator/art-world/hex/resident_feastle_hex_tile_512.webp'),
  full: require('@incubator/art-world/hex/resident_feastle_hex_tile.webp'),
};
const RESIDENT_FEASTLE_HEX_TILE_V2_SOURCES: KingdomHexTileLodSources = {
  thumb: require('@incubator/art-world/hex/resident_feastle_hex_tile_v2_256.webp'),
  medium: require('@incubator/art-world/hex/resident_feastle_hex_tile_v2_512.webp'),
  full: require('@incubator/art-world/hex/resident_feastle_hex_tile_v2.webp'),
};
const RESIDENT_FEASTLE_HEX_TILE_V3_SOURCES: KingdomHexTileLodSources = {
  thumb: require('@incubator/art-world/hex/resident_feastle_hex_tile_v3_256.webp'),
  medium: require('@incubator/art-world/hex/resident_feastle_hex_tile_v3_512.webp'),
  full: require('@incubator/art-world/hex/resident_feastle_hex_tile_v3.webp'),
};
const RESIDENT_STEPPLING_HEX_TILE_SOURCES: KingdomHexTileLodSources = {
  thumb: require('@incubator/art-world/hex/resident_steppling_hex_tile_256.webp'),
  medium: require('@incubator/art-world/hex/resident_steppling_hex_tile_512.webp'),
  full: require('@incubator/art-world/hex/resident_steppling_hex_tile.webp'),
};
const RESIDENT_STEPPLING_HEX_TILE_V2_SOURCES: KingdomHexTileLodSources = {
  thumb: require('@incubator/art-world/hex/resident_steppling_hex_tile_v2_256.webp'),
  medium: require('@incubator/art-world/hex/resident_steppling_hex_tile_v2_512.webp'),
  full: require('@incubator/art-world/hex/resident_steppling_hex_tile_v2.webp'),
};
const RESIDENT_STEPPLING_HEX_TILE_V3_SOURCES: KingdomHexTileLodSources = {
  thumb: require('@incubator/art-world/hex/resident_steppling_hex_tile_v3_256.webp'),
  medium: require('@incubator/art-world/hex/resident_steppling_hex_tile_v3_512.webp'),
  full: require('@incubator/art-world/hex/resident_steppling_hex_tile_v3.webp'),
};
const RESIDENT_FLICKERBUN_HEX_TILE_SOURCES: KingdomHexTileLodSources = {
  thumb: require('@incubator/art-world/hex/resident_flickerbun_hex_tile_256.webp'),
  medium: require('@incubator/art-world/hex/resident_flickerbun_hex_tile_512.webp'),
  full: require('@incubator/art-world/hex/resident_flickerbun_hex_tile.webp'),
};
const RESIDENT_FLICKERBUN_HEX_TILE_V2_SOURCES: KingdomHexTileLodSources = {
  thumb: require('@incubator/art-world/hex/resident_flickerbun_hex_tile_v2_256.webp'),
  medium: require('@incubator/art-world/hex/resident_flickerbun_hex_tile_v2_512.webp'),
  full: require('@incubator/art-world/hex/resident_flickerbun_hex_tile_v2.webp'),
};
const RESIDENT_FLICKERBUN_HEX_TILE_V3_SOURCES: KingdomHexTileLodSources = {
  thumb: require('@incubator/art-world/hex/resident_flickerbun_hex_tile_v3_256.webp'),
  medium: require('@incubator/art-world/hex/resident_flickerbun_hex_tile_v3_512.webp'),
  full: require('@incubator/art-world/hex/resident_flickerbun_hex_tile_v3.webp'),
};
const RESIDENT_PAGELET_HEX_TILE_SOURCES: KingdomHexTileLodSources = {
  thumb: require('@incubator/art-world/hex/resident_pagelet_hex_tile_256.webp'),
  medium: require('@incubator/art-world/hex/resident_pagelet_hex_tile_512.webp'),
  full: require('@incubator/art-world/hex/resident_pagelet_hex_tile.webp'),
};
const RESIDENT_CHEERLET_HEX_TILE_SOURCES: KingdomHexTileLodSources = {
  thumb: require('@incubator/art-world/hex/resident_cheerlet_hex_tile_256.webp'),
  medium: require('@incubator/art-world/hex/resident_cheerlet_hex_tile_512.webp'),
  full: require('@incubator/art-world/hex/resident_cheerlet_hex_tile.webp'),
};
const RESIDENT_GATHERGLOW_HEX_TILE_SOURCES: KingdomHexTileLodSources = {
  thumb: require('@incubator/art-world/hex/resident_gatherglow_hex_tile_256.webp'),
  medium: require('@incubator/art-world/hex/resident_gatherglow_hex_tile_512.webp'),
  full: require('@incubator/art-world/hex/resident_gatherglow_hex_tile.webp'),
};
const RESIDENT_MOSSPROUT_HEX_TILE_SOURCES: KingdomHexTileLodSources = {
  thumb: require('@incubator/art-world/hex/resident_mossprout_hex_tile_256.webp'),
  medium: require('@incubator/art-world/hex/resident_mossprout_hex_tile_512.webp'),
  full: require('@incubator/art-world/hex/resident_mossprout_hex_tile.webp'),
};
const RESIDENT_SKYLO_HEX_TILE_SOURCES: KingdomHexTileLodSources = {
  thumb: require('@incubator/art-world/hex/resident_skylo_hex_tile_256.webp'),
  medium: require('@incubator/art-world/hex/resident_skylo_hex_tile_512.webp'),
  full: require('@incubator/art-world/hex/resident_skylo_hex_tile.webp'),
};
const RESIDENT_TASKLET_HEX_TILE_SOURCES: KingdomHexTileLodSources = {
  thumb: require('@incubator/art-world/hex/resident_tasklet_hex_tile_256.webp'),
  medium: require('@incubator/art-world/hex/resident_tasklet_hex_tile_512.webp'),
  full: require('@incubator/art-world/hex/resident_tasklet_hex_tile.webp'),
};
const RESIDENT_VESPERITT_HEX_TILE_SOURCES: KingdomHexTileLodSources = {
  thumb: require('@incubator/art-world/hex/resident_vesperitt_hex_tile_256.webp'),
  medium: require('@incubator/art-world/hex/resident_vesperitt_hex_tile_512.webp'),
  full: require('@incubator/art-world/hex/resident_vesperitt_hex_tile.webp'),
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
        source: require('@incubator/art-world/hex/resident_feastle_hex_tile.webp'),
        sources: RESIDENT_FEASTLE_HEX_TILE_SOURCES,
        alphaBounds: tileAlphaBounds('resident_feastle_hex_tile.webp'),
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
        source: require('@incubator/art-world/hex/resident_feastle_hex_tile_v2.webp'),
        sources: RESIDENT_FEASTLE_HEX_TILE_V2_SOURCES,
        alphaBounds: tileAlphaBounds('resident_feastle_hex_tile_v2.webp'),
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
        source: require('@incubator/art-world/hex/resident_feastle_hex_tile_v3.webp'),
        sources: RESIDENT_FEASTLE_HEX_TILE_V3_SOURCES,
        alphaBounds: tileAlphaBounds('resident_feastle_hex_tile_v3.webp'),
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
        source: require('@incubator/art-world/hex/resident_steppling_hex_tile.webp'),
        sources: RESIDENT_STEPPLING_HEX_TILE_SOURCES,
        alphaBounds: tileAlphaBounds('resident_steppling_hex_tile.webp'),
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
        source: require('@incubator/art-world/hex/resident_steppling_hex_tile_v2.webp'),
        sources: RESIDENT_STEPPLING_HEX_TILE_V2_SOURCES,
        alphaBounds: tileAlphaBounds('resident_steppling_hex_tile_v2.webp'),
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
        source: require('@incubator/art-world/hex/resident_steppling_hex_tile_v3.webp'),
        sources: RESIDENT_STEPPLING_HEX_TILE_V3_SOURCES,
        alphaBounds: tileAlphaBounds('resident_steppling_hex_tile_v3.webp'),
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
        source: require('@incubator/art-world/hex/resident_flickerbun_hex_tile.webp'),
        sources: RESIDENT_FLICKERBUN_HEX_TILE_SOURCES,
        alphaBounds: tileAlphaBounds('resident_flickerbun_hex_tile.webp'),
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
        source: require('@incubator/art-world/hex/resident_flickerbun_hex_tile_v2.webp'),
        sources: RESIDENT_FLICKERBUN_HEX_TILE_V2_SOURCES,
        alphaBounds: tileAlphaBounds('resident_flickerbun_hex_tile_v2.webp'),
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
        source: require('@incubator/art-world/hex/resident_flickerbun_hex_tile_v3.webp'),
        sources: RESIDENT_FLICKERBUN_HEX_TILE_V3_SOURCES,
        alphaBounds: tileAlphaBounds('resident_flickerbun_hex_tile_v3.webp'),
        generatedFrom: {
          candidateId: 'flickerbun-resident-hex-3',
          promptTheme:
            'a velvet-dark story lover with projector-bright eyes; cozy miniature cinema and moonlit story theater habitat',
        },
      },
    ],
  },
  pagelet: {
    visualKey: 'pagelet',
    label: 'Pagelet resident tile',
    selectedVariantId: 'pagelet-bookshop-v1',
    defaultVariantId: 'pagelet-bookshop-v1',
    variants: [
      {
        id: 'pagelet-bookshop-v1',
        label: 'Storybook shop',
        description: 'Open-front Pagelet bookshop with an open-book canopy, curved shelves, reading chair, ribbon-marked books, and a clear resident lawn.',
        generationId: 'pagelet-resident-hex-1',
        source: require('@incubator/art-world/hex/resident_pagelet_hex_tile.webp'),
        sources: RESIDENT_PAGELET_HEX_TILE_SOURCES,
        alphaBounds: tileAlphaBounds('resident_pagelet_hex_tile.webp'),
        generatedFrom: {
          candidateId: 'pagelet-resident-hex-1',
          promptTheme:
            'cozy miniature bookshop and reading garden habitat with cream paper, warm walnut wood, burgundy ribbon accents, and amber lamplight',
        },
      },
    ],
  },
  cheerlet: {
    visualKey: 'cheerlet',
    label: 'Cheerlet resident tile',
    selectedVariantId: 'cheerlet-celebration-patio-v1',
    defaultVariantId: 'cheerlet-celebration-patio-v1',
    variants: [
      {
        id: 'cheerlet-celebration-patio-v1',
        label: 'Celebration patio',
        description: 'Bright Cheerlet celebration patio with bunting, confetti, candle glow, balloons, gifts, and an open resident lawn.',
        generationId: 'cheerlet-resident-hex-1',
        source: require('@incubator/art-world/hex/resident_cheerlet_hex_tile.webp'),
        sources: RESIDENT_CHEERLET_HEX_TILE_SOURCES,
        alphaBounds: tileAlphaBounds('resident_cheerlet_hex_tile.webp'),
        generatedFrom: {
          candidateId: 'cheerlet-resident-hex-1',
          promptTheme:
            'a joyful party sprite who marks genuinely worth-it moments; bright celebration garden and candlelit confetti habitat',
        },
      },
    ],
  },
  gatherglow: {
    visualKey: 'gatherglow',
    label: 'Gatherglow resident tile',
    selectedVariantId: 'gatherglow-hearth-nook-v1',
    defaultVariantId: 'gatherglow-hearth-nook-v1',
    variants: [
      {
        id: 'gatherglow-hearth-nook-v1',
        label: 'Hearth nook',
        description: 'Warm Gatherglow gathering nook with shared table, lanterns, rounded stools, hearth glow, and an open resident rug.',
        generationId: 'gatherglow-resident-hex-1',
        source: require('@incubator/art-world/hex/resident_gatherglow_hex_tile.webp'),
        sources: RESIDENT_GATHERGLOW_HEX_TILE_SOURCES,
        alphaBounds: tileAlphaBounds('resident_gatherglow_hex_tile.webp'),
        generatedFrom: {
          candidateId: 'gatherglow-resident-hex-1',
          promptTheme:
            'a warm hearth spirit who glows brighter in good company; shared-table gathering nook and lantern-lit convivial habitat',
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
        source: require('@incubator/art-world/hex/resident_mossprout_hex_tile.webp'),
        sources: RESIDENT_MOSSPROUT_HEX_TILE_SOURCES,
        alphaBounds: tileAlphaBounds('resident_mossprout_hex_tile.webp'),
        generatedFrom: {
          candidateId: 'mossprout-resident-hex-1',
          promptTheme: 'gentle and grounded, delighted by green detours; lush park garden and mossy nature habitat',
        },
      },
    ],
  },
  skylo: {
    visualKey: 'skylo',
    label: 'Skylo resident tile',
    selectedVariantId: 'skylo-city-plaza-v1',
    defaultVariantId: 'skylo-city-plaza-v1',
    variants: [
      {
        id: 'skylo-city-plaza-v1',
        label: 'City plaza',
        description: 'Bright Skylo city-corner plaza with skyline walls, warm window lights, street trees, lamps, bench, and open standing space.',
        generationId: 'skylo-resident-hex-1',
        source: require('@incubator/art-world/hex/resident_skylo_hex_tile.webp'),
        sources: RESIDENT_SKYLO_HEX_TILE_SOURCES,
        alphaBounds: tileAlphaBounds('resident_skylo_hex_tile.webp'),
        generatedFrom: {
          candidateId: 'skylo-resident-hex-1',
          promptTheme:
            'a city-cool wanderer who carries skyline confidence and warm window-light glow; bright urban plaza and cozy street-corner habitat',
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
        source: require('@incubator/art-world/hex/resident_tasklet_hex_tile.webp'),
        sources: RESIDENT_TASKLET_HEX_TILE_SOURCES,
        alphaBounds: tileAlphaBounds('resident_tasklet_hex_tile.webp'),
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
        source: require('@incubator/art-world/hex/resident_vesperitt_hex_tile.webp'),
        sources: RESIDENT_VESPERITT_HEX_TILE_SOURCES,
        alphaBounds: tileAlphaBounds('resident_vesperitt_hex_tile.webp'),
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
    return selected ? [[visualKey, { source: selected.source, sources: selected.sources, alphaBounds: selected.alphaBounds }]] : [];
  })
) as Partial<Record<HomeVisualKey, KatchimeraHexTileSource>>;
