import { Pressable } from 'react-native';
import { DayActionCardSurface, DayActionIcon } from '@/components/katchadeck/ui/day-action-card';
import { companionSceneModel } from '@/game/katchimeras/companion-scene-model';
import { CompanionSceneCards } from './companion-scene-cards';
import { CompanionMeditationStage } from './companion-meditation-stage';

/** Introduce the normal layout while the discovery handoff still owns navigation. */
export function CompanionFirstRestCards({ availableAt, startedAt, settledMs, now, onExplore }: {
  availableAt: number; startedAt: number; settledMs?: number; now: number; onExplore: () => void;
}) {
  const model = companionSceneModel({ familyId: 'mossprout', episodeId: 'quiet-patch:first-flower',
    dayNumber: 1, chapterTitle: 'A Little Place to Begin', episodeTitle: 'Mossprout is resting', phase: 'meditating', nextTitle: 'The Pond Knocked Twice' });
  model.journey.subtitle = 'Journey Days follow our story, at your pace. The Garden is still open.';
  return <CompanionSceneCards model={model}
    timer={<CompanionMeditationStage title={model.journey.eyebrow} availableAt={availableAt} startedAt={startedAt} settledMs={settledMs} now={now} companionName="Mossprout" />}
    garden={<Pressable accessibilityRole="button" accessibilityLabel="Explore the mist" onPress={onExplore}>
      <DayActionCardSurface artwork={<DayActionIcon icon="sparkles" />}
        title="Explore the mist" subtitle="Complete two garden requests to earn the Glow we need." />
    </Pressable>} />;
}
