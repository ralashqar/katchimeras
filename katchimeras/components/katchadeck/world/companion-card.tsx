// Compatibility boundary for existing imports. New code should import the
// creature-led sheet directly.
export {
  CompanionInteractionSheet,
  CompanionInteractionSheet as CompanionCard,
  type CompanionInteractionSheetProps,
} from './companion-interaction-sheet';
export type { CompanionThread } from '@/types/companion-interaction';
