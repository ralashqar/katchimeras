/**
 * What this build of the game is (`docs/cozy-4x-direction.md`): a cozy hero-driven 4X world-restoration game. The
 * life-companion features (the Today hub, daily check-ins, photos and moment capture, voice notes, steps and health,
 * streaks and reminders, personalised return pushes, reflection) belong to the separate Katchimeras companion
 * product. Their code, components and UI tech stay in the codebase for reuse; this flag is what keeps them out of
 * the game: their routes redirect to the Sanctuary, and their background work does not run.
 */
export const LIFE_INPUT_ENABLED = false;
