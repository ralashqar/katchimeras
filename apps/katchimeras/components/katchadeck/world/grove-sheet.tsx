import { useState } from 'react';
import { UpgradeDock, useUpgradeDockMotion } from '@/components/katchadeck/upgrade/upgrade-dock';
import { DIFFICULTY_LABELS, UpgradeLoadoutRow, type EncounterLoadoutChoice } from '@/components/katchadeck/upgrade/upgrade-mission-rows';
import { UpgradeActionRow, UpgradeHero, UpgradeSection } from '@/components/katchadeck/upgrade/upgrade-rows';
import { PLAYABLE_KATCHIMERAS } from '@/constants/katchimera-progression';
import type { RegionMissionDefinition } from '@/constants/island-campaigns/types';
import { gradeLabel } from '@/features/encounter/encounter-copy';
import { groveProgress } from '@/features/encounters/grove-progress';
import type { UpgradeStageLayout } from '@/features/upgrade-stage/upgrade-stage-layout';
import type { MergeCharacterId, MergeWorldState } from '@/types/merge-world';

/**
 * The Sleeping Grove on the upgrade stage: Mossprout's own region, one rung
 * at a time, each docked under his tile. Cleared rungs can be played again.
 * The same rows a friend's island ladder and the Daily Mist use.
 */
export function GroveSheet({ world, ftueComplete, layout, bottomInset, ownedWispIds, onEnter, onClose }: {
  world: MergeWorldState; ftueComplete: boolean; layout: UpgradeStageLayout; bottomInset: number;
  ownedWispIds: readonly string[];
  onEnter: (mission: RegionMissionDefinition, loadout: EncounterLoadoutChoice) => void;
  onClose: () => void;
}) {
  const motion = useUpgradeDockMotion({ busy: false, onClose });
  const rungs = groveProgress(world, { ftueComplete });
  const done = rungs.filter((rung) => rung.state === 'done').length;
  const playable = PLAYABLE_KATCHIMERAS.filter((id) => id === 'mossprout' || world.unlockedCharacters.includes(id));
  const remembered = world.encounters?.loadout;
  const [loadout, setLoadout] = useState<EncounterLoadoutChoice>({ katchimeraId: (remembered && playable.includes(remembered.katchimeraId) ? remembered.katchimeraId : 'mossprout') as MergeCharacterId, helperWispId: remembered?.helperWispId ?? null });
  const next = rungs.find((rung) => rung.state === 'next');
  const said = !next ? 'The Grove is awake. Play any patch again for a little more.' : next.note ?? `Next: ${next.title}.`;
  return <UpgradeDock motion={motion} title="The Sleeping Grove" progressLabel={`${done} / ${rungs.length}`} progressFraction={done / rungs.length}
    height={layout.panelHeight} width={layout.panelWidth} bottomInset={bottomInset} closeLabel="Close the Sleeping Grove"
    hero={<UpgradeHero caption={said} />}>
    <UpgradeSection label="The Grove" aside="Mossprout’s own patch">
      {rungs.map((rung) => {
        const mission = rung.mission;
        const canEnter = Boolean(mission) && rung.state !== 'ahead' && !rung.note && (!mission?.eligible || mission.eligible.includes(loadout.katchimeraId));
        return <UpgradeActionRow key={rung.rung} icon="leaf.fill" done={rung.state === 'done'} dimmed={rung.state === 'ahead'}
          label={`${rung.rung}. ${rung.title}${mission ? ` · ${DIFFICULTY_LABELS[mission.difficulty]}` : ''}`}
          detail={rung.state === 'done' ? rung.bestGrade ? gradeLabel(rung.bestGrade) : 'Done' : rung.note ?? (mission ? `${mission.objective} ${mission.encounter.resolve ?? '∞'} Resolve.` : undefined)}
          action={mission && canEnter ? { label: rung.state === 'done' ? 'Again' : 'Enter', primary: rung.state === 'next', disabled: motion.closing, accessibilityLabel: `${rung.state === 'done' ? 'Enter again' : 'Enter'} ${rung.title}`, onPress: () => motion.leave(() => onEnter(mission, loadout)) } : undefined} />;
      })}
    </UpgradeSection>
    <UpgradeSection label="Bring">
      <UpgradeLoadoutRow world={world} playable={playable} ownedWispIds={ownedWispIds} value={loadout} disabled={motion.closing} onChange={setLoadout} />
    </UpgradeSection>
  </UpgradeDock>;
}
