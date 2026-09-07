/** Pure placement metadata; safe for save migrations and content tooling. */
export const MOSSPROUT_LAYOUT = {
  layout: { width: 490, projectionTilt: .7, lipWidthRatio: .0975, layoutProfiles: { neighborhood: { horizontalSpacing: 1.02, verticalSpacing: 1.02 } } },
  home: { coord: { q: 0, r: 1 } },
  garden: { coord: { q: 0, r: 2 } },
  gate: { coord: { q: 0, r: 0 } },
} as const;
