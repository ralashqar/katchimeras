/** Shared discovery choreography for both companion Eggs. */
export const HATCH_PHASE_DELAYS_MS = {
  shaking: 80, cracking: 500, crossfadingSubject: 1050, subjectSettling: 1550,
  postReveal: 1750, formCard: 2050, assembleDeck: 2650, awaitClaim: 3300,
} as const;
export const REDUCED_HATCH_PHASE_DELAYS_MS = {
  shaking: 20, cracking: 70, crossfadingSubject: 150, subjectSettling: 360,
  postReveal: 500, formCard: 580, assembleDeck: 680, awaitClaim: 760,
} as const;
