import { CompanionDailyQuestionSlot } from './companion-daily-question';
import { CompanionLifeActivityCard } from './companion-life-activity-card';
import { CompanionStepGoal } from './companion-step-goal';
import type { KatchimeraActionOrigin } from '@/types/relationship-progression';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import type { GestureType } from 'react-native-gesture-handler';
import type { DayActionSourceRect } from '@/components/katchadeck/ui/day-action-row';
import type { CompanionBondAwardReceipt } from '@/utils/companion-bond';
import type { HatchableCompanionDefinition } from '@/types/hatchable-companion';
import { type CompanionMergeRequest } from './companion-merge-request-tray';

/**
 * A hatchable friend's daily cards, all from their definition's daily
 * config: a daily goal (Steppling's steps), the life activities (a photo of
 * what they asked for, a small thing noticed, today in a word), the garden
 * request, and the day's question. Nothing here knows which friend it is
 * drawing.
 */
export function CompanionDailyActions({ definition, onReaction, onOpenConversation, requests, onOpenMerge, onSubmenuChange, onBondRewardRequest, externalGesture, active = true }: {
  definition: HatchableCompanionDefinition;
  onReaction?: (text: string | null) => void;
  onOpenConversation?: (definitionId: string, origin: KatchimeraActionOrigin) => void;
  requests: readonly CompanionMergeRequest[]; onOpenMerge: (id?: string) => void;
  onSubmenuChange?: (open: boolean) => void;
  onBondRewardRequest?: (source: DayActionSourceRect, onArrive: () => void, receipt?: CompanionBondAwardReceipt) => void;
  externalGesture?: GestureType;
  /** Whether the cards are on screen (not behind a conversation): reward presentations wait otherwise. */
  active?: boolean;
}) {
  const { companion, daily } = definition;
  // The garden's submenu and a life dialogue each hide the journey card; either open is open.
  const [gardenOpen, setGardenOpen] = useState(false);
  const [lifeOpen, setLifeOpen] = useState(false);
  useEffect(() => { onSubmenuChange?.(gardenOpen || lifeOpen); }, [gardenOpen, lifeOpen, onSubmenuChange]);
  const hasLife = Boolean(daily?.photo || daily?.notice || daily?.water || daily?.moment);
  // The campaign pivot: the Garden card and its Merge requests are gone; the day's cards stand on their own.
  void onOpenMerge; void requests; void setGardenOpen;
  return <View style={{ gap: 7 }}>
      {daily?.goal ? <CompanionStepGoal companion={companion} config={daily.goal} onReaction={onReaction} onBondRewardRequest={onBondRewardRequest} externalGesture={externalGesture} /> : null}
      {daily && hasLife ? <CompanionLifeActivityCard companion={companion} config={daily} onNarration={onReaction} onOpenChange={setLifeOpen}
        onBondRewardRequest={onBondRewardRequest} externalGesture={externalGesture} /> : null}
      {daily ? <CompanionDailyQuestionSlot companion={companion} polls={daily.polls} subtitle={daily.questionSubtitle} active={active}
        onOpenConversation={onOpenConversation} onBondRewardRequest={onBondRewardRequest} externalGesture={externalGesture} /> : null}
  </View>;
}
