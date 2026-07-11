export const KINGDOM_RENDERING = {
  exitDurationMs: 160,
  lodCrossfadeMs: 100,
  maxConcurrentTileLoads: 3,
  maxConcurrentLodLoads: 3,
  preloadMarginScreenPx: 180,
  residentIntroMs: 260,
  residentLod: {
    mediumDownScreenPoints: 96,
    mediumUpScreenPoints: 120,
  },
  sceneEdgePaddingWorld: 320,
  sceneResidentCapacity: 50,
  tileIntroMs: 220,
  tileLod: {
    fullDownScreenPoints: 700,
    fullUpScreenPoints: 820,
    mediumDownScreenPoints: 320,
    mediumUpScreenPoints: 380,
  },
} as const;
