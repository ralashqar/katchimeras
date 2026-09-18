import { HeartwoodStoryScene } from './heartwood-story-scene';

/** The existing planting checkpoint now reveals our shared destination. */
export function GardenPlantingHandoff({ onContinue }: { onContinue?: () => unknown }) {
  return <HeartwoodStoryScene scene="introduction" onContinue={() => onContinue?.()} />;
}
