import { useState } from 'react';
import { UpgradeDock, useUpgradeDockMotion } from '@/components/katchadeck/upgrade/upgrade-dock';
import { DIFFICULTY_LABELS, UpgradeLoadoutRow, type EncounterLoadoutChoice } from '@/components/katchadeck/upgrade/upgrade-mission-rows';
import { UpgradeActionRow, UpgradeHero, UpgradeSection } from '@/components/katchadeck/upgrade/upgrade-rows';
import { DAILY_MIST_GLOW } from '@/constants/daily-mist-templates';
import { PLAYABLE_KATCHIMERAS } from '@/constants/katchimera-progression';
import { gradeLabel } from '@/features/encounter/encounter-copy';
import { dailyMistDay, dailyMistMissions } from '@/features/encounters/daily-mist';
import type { UpgradeStageLayout } from '@/features/upgrade-stage/upgrade-stage-layout';
import type { MergeCharacterId, MergeWorldState } from '@/types/merge-world';

/**
 * The Daily Mist on the upgrade stage: the day's three patches (calm, thick,
 * dark), each cleared once for its Glow and playable again after, and what
 * the player brings in. The same rows a friend's ladder uses.
 */
export function DailyMistSheet({ world, dayId, layout, bottomInset, ownedWispIds, onEnter, onClose }: {
  world: MergeWorldState; dayId: string; layout: UpgradeStageLayout; bottomInset: number;
  ownedWispIds: readonly string[];
  onEnter: (slot: 0 | 1 | 2, loadout: EncounterLoadoutChoice) => void;
  onClose: () => void;
}) {
  const motion = useUpgradeDockMotion({ busy: false, onClose });
  const missions = dailyMistMissions(dayId, world);
  const day = dailyMistDay(world, dayId);
  const cleared = day.filter((entry) => entry.cleared).length;
  const playable = PLAYABLE_KATCHIMERAS.filter((id) => id === 'mossprout' || world.unlockedCharacters.includes(id));
  const remembered = world.encounters?.loadout;
  const [loadout, setLoadout] = useState<EncounterLoadoutChoice>({ katchimeraId: (remembered && playable.includes(remembered.katchimeraId) ? remembered.katchimeraId : 'mossprout') as MergeCharacterId, helperWispId: remembered?.helperWispId ?? null });
  const said = cleared >= 3 ? 'Every patch cleared today. Play any again for a little more.' : 'The Mist moved in the night. Three patches, cleared once each for the day’s Glow.';
  return <UpgradeDock motion={motion} title="Daily Mist" progressLabel={`${cleared} / 3`} progressFraction={cleared / 3}
    height={layout.panelHeight} width={layout.panelWidth} bottomInset={bottomInset} closeLabel="Close Daily Mist"
    hero={<UpgradeHero caption={said} />}>
    <UpgradeSection label="Today" aside="New patches every day">
      {missions.map((mission, index) => {
        const slot = index as 0 | 1 | 2;
        const entry = day[slot]?.cleared ?? null;
        return <UpgradeActionRow key={mission.id} icon="leaf.fill" done={Boolean(entry)}
          label={`${mission.title} · ${DIFFICULTY_LABELS[mission.difficulty]}`}
          detail={entry ? `${gradeLabel(entry.grade)} · play again for a little more` : `${mission.encounter.resolve ?? '∞'} Resolve · +${DAILY_MIST_GLOW[slot]} Glow`}
          action={{ label: entry ? 'Again' : 'Enter', primary: !entry, disabled: motion.closing, accessibilityLabel: `${entry ? 'Enter again' : 'Enter'} ${mission.title}`, onPress: () => motion.leave(() => onEnter(slot, loadout)) }} />;
      })}
    </UpgradeSection>
    <UpgradeSection label="Bring">
      <UpgradeLoadoutRow world={world} playable={playable} ownedWispIds={ownedWispIds} value={loadout} disabled={motion.closing} onChange={setLoadout} />
    </UpgradeSection>
  </UpgradeDock>;
}
