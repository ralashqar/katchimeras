import { useState } from 'react';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { UpgradeDock, useUpgradeDockMotion } from '@/components/katchadeck/upgrade/upgrade-dock';
import { UpgradeActionRow, UpgradeHero, UpgradeSection } from '@/components/katchadeck/upgrade/upgrade-rows';
import { HEATS_PER_DAY, heatFor, heatPars } from '@/features/time-trial/ladder';
import { dayChestFor, heatGlow, heatsCleared, nextHeatIndex, timeTrialFor, type HeatOutcome } from '@/features/time-trial/trial-world';
import type { UpgradeStageLayout } from '@/features/upgrade-stage/upgrade-stage-layout';
import type { MergeWorldState } from '@/types/merge-world';
import { formatHeatClock } from './wisp-rush-dock';

const MEDAL_NAME = { gold: 'Gold', silver: 'Silver', bronze: 'Bronze' } as const;
export type WispRushResult = { index: number; score: number; outcome: HeatOutcome };
const wisps = (count: number) => `${count} ${count === 1 ? 'wisp' : 'wisps'}`;

/**
 * Wisp Rush between heats, on the shared upgrade stage: Dashkit's tile framed above, today's ladder docked under it.
 * Every heat is the same dare, how many wisps before the clock runs out, asked harder. One button runs the next heat;
 * every cleared heat can be run again for a better score; the day's chest waits at the end. Starting a heat puts this away and docks the board in its place.
 */
export function WispRushSheet({ world, dayId, hostName, layout, bottomInset, result, notice, storyLabel, onPlay, onOpenChest, onStory, onClose }: {
  world: MergeWorldState; dayId: string; hostName: string; layout: UpgradeStageLayout; bottomInset: number;
  /** The heat just run, said in the hero row until the next one starts. */
  result: WispRushResult | null;
  notice: string | null;
  /** The friend's own story still has chapters: a way back to it from here. */
  storyLabel?: string | null;
  onPlay: (index: number) => void; onOpenChest: () => Promise<unknown>; onStory?: () => void; onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const motion = useUpgradeDockMotion({ busy, onClose });
  const trial = timeTrialFor(world);
  const day = trial.days[dayId];
  const cleared = heatsCleared(day);
  const next = nextHeatIndex(day);
  const dayDone = cleared >= HEATS_PER_DAY;
  const chest = dayChestFor(world, dayId);
  const openChest = async () => { setBusy(true); try { await onOpenChest(); } finally { setBusy(false); } };
  const said = notice ?? (result
    ? result.outcome.cleared
      ? `Heat ${result.index + 1}: ${wisps(result.score)}${result.outcome.medal ? `, ${MEDAL_NAME[result.outcome.medal]}` : ''}${result.outcome.newRecord ? ', a new best' : ''}${result.outcome.glow ? `. +${result.outcome.glow} Glow` : ''}`
      : `Heat ${result.index + 1}: ${wisps(result.score)}. ${result.outcome.short} short of Bronze, run it again.`
    : dayDone ? 'Every heat cleared today. Run any again for a better score.' : `How many wisps before the clock runs out? Streak ${trial.records.streak}${trial.records.bestDay ? `, best day ${wisps(trial.records.bestDay)}` : ''}.`);

  return <UpgradeDock motion={motion} title={`${hostName}’s Wisp Rush`} progressLabel={`${cleared} / ${HEATS_PER_DAY}`} progressFraction={cleared / HEATS_PER_DAY}
    height={layout.panelHeight} width={layout.panelWidth} bottomInset={bottomInset} closeLabel="Close Wisp Rush"
    hero={<UpgradeHero caption={said}
      action={chest
        ? <KatchaButton fullWidth size="compact" loading={busy} disabled={busy || motion.closing} label={chest.kind === 'gift-rare' ? 'Open the day’s chest · Rare inside' : 'Open the day’s chest'} onPress={() => { void openChest(); }} />
        : <KatchaButton fullWidth size="compact" disabled={motion.closing} label={dayDone ? `Run heat ${HEATS_PER_DAY} again` : `Start heat ${next + 1}`}
            accessibilityLabel={dayDone ? `Run heat ${HEATS_PER_DAY} again` : `Start heat ${next + 1} of ${HEATS_PER_DAY}`} onPress={() => motion.leave(() => onPlay(next))} />} />}>
    <UpgradeSection label="Today" aside="A new ladder every day">
      {Array.from({ length: HEATS_PER_DAY }, (_, index) => {
        const heat = day?.heats[index];
        const open = index <= cleared;
        const spec = open ? heatFor(dayId, index) : null;
        const pars = spec ? heatPars(spec) : null;
        return <UpgradeActionRow key={index} icon="timer" done={Boolean(heat)} dimmed={!open}
          label={`Heat ${index + 1}${heat?.medal ? ` · ${MEDAL_NAME[heat.medal]}` : ''}`}
          detail={spec && pars
            ? `${heat ? `Best ${heat.best} · ` : ''}${formatHeatClock(spec.durationMs)} · Bronze ${pars.bronze} · Silver ${pars.silver} · Gold ${pars.gold}${heat ? '' : ` · +${heatGlow(index)} Glow`}`
            : 'Clear the heat before it'}
          action={open ? { label: heat ? 'Again' : 'Run', primary: !heat, disabled: motion.closing, accessibilityLabel: `${heat ? 'Run again' : 'Run'} heat ${index + 1}`, onPress: () => motion.leave(() => onPlay(index)) } : undefined} />;
      })}
    </UpgradeSection>
    {storyLabel && onStory ? <UpgradeSection label="Story">
      <UpgradeActionRow icon="book.fill" label={storyLabel} action={{ label: 'Open', disabled: motion.closing, onPress: () => motion.leave(onStory) }} />
    </UpgradeSection> : null}
  </UpgradeDock>;
}
