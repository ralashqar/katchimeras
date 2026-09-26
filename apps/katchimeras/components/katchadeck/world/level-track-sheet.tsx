import { heroSlots, withPartner } from '@/features/encounter/team';
import { useState } from 'react';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { UpgradeDock, useUpgradeDockMotion } from '@/components/katchadeck/upgrade/upgrade-dock';
import { DIFFICULTY_LABELS, UpgradeLoadoutRow, type EncounterLoadoutChoice } from '@/components/katchadeck/upgrade/upgrade-mission-rows';
import { UpgradeActionRow, UpgradeHero, UpgradeSection } from '@/components/katchadeck/upgrade/upgrade-rows';
import { playableHeroes } from '@/constants/katchimera-progression';
import type { LevelNode, LevelTrack, TrackPrimary } from '@/features/level-tracks/level-track';
import type { UpgradeStageLayout } from '@/features/upgrade-stage/upgrade-stage-layout';
import type { MergeCharacterId, MergeWorldState } from '@/types/merge-world';

/**
 * A tile's levels on the upgrade stage, the way Wisp Rush lists its heats: the
 * tile framed above, the track docked under it. One button does the next thing
 * (play, hear the story, open a chest); every level is a row with its stars and
 * what it pays; a friend's chapters sit between their levels as story rows; the
 * chests wait at the end; what the player brings sits last. Starting a level
 * puts this away and docks the board in its place.
 */
const PACK_NAMES = { gift: 'a friend pack', 'gift-rare': 'a rare friend pack', finale: 'the finale pack' } as const;

export const starLine = (stars: number) => `${'★'.repeat(stars)}${'☆'.repeat(Math.max(0, 3 - stars))}`;

function levelDetail(node: LevelNode): string | undefined {
  if (node.note && node.state === 'next' && !node.playable) return node.note;
  if (node.state === 'ahead') return node.boss ? 'A boss waits here' : undefined;
  const reward = node.reward ? `+${node.reward.glow} Glow${node.reward.pack ? ' · a friend pack' : ''}` : '';
  const wisps = node.mission?.encounter.mechanic?.kind === 'dark-wisps' ? node.mission.encounter.mechanic.wisps.filter((wisp) => !wisp.hidden).length : 0;
  const resolve = node.mission?.encounter.resolve;
  const budget = node.mission?.encounter.territory ? `${wisps} Dark ${wisps === 1 ? 'Wisp' : 'Wisps'} · ` : resolve != null ? `${resolve} Resolve · ` : '';
  return node.state === 'done' ? `${starLine(node.stars)} · again for ${reward}` : `${budget}${reward}`;
}

export function LevelTrackSheet({ track, world, layout, bottomInset, ownedWispIds, busy = false, notice, onPlay, onStory, onReveal, onChest, onClose }: {
  track: LevelTrack; world: MergeWorldState; layout: UpgradeStageLayout; bottomInset: number;
  ownedWispIds: readonly string[]; busy?: boolean;
  /** A line said in the hero until the next thing happens (a chest's contents, an error). */
  notice?: string | null;
  onPlay: (node: LevelNode, loadout: EncounterLoadoutChoice) => void;
  onStory: (level: number) => void;
  onReveal: () => void;
  onChest: (threshold: number) => void;
  onClose: () => void;
}) {
  const motion = useUpgradeDockMotion({ busy, onClose });
  const playable = playableHeroes(world);
  const remembered = world.encounters?.loadout;
  const [loadout, setLoadout] = useState<EncounterLoadoutChoice>(() => withPartner(world, { katchimeraId: (remembered && playable.includes(remembered.katchimeraId) ? remembered.katchimeraId : 'mossprout') as MergeCharacterId, helperWispId: remembered?.helperWispId ?? null, partnerId: remembered?.partnerId ?? null }, playable));
  const nextNode = track.primary.kind === 'play' ? track.primary.node : null;
  const eligible = nextNode?.mission?.eligible ?? null;
  const loadoutFor = (node: LevelNode): EncounterLoadoutChoice => {
    const allowed = node.mission?.eligible;
    // A level that asks for one friend in particular brings them, whoever was picked.
    if (!allowed || allowed.includes(loadout.katchimeraId)) return loadout;
    const lead = allowed[0] as MergeCharacterId;
    return withPartner(world, { ...loadout, katchimeraId: lead, partnerId: loadout.partnerId === lead ? loadout.katchimeraId : loadout.partnerId }, playable);
  };
  const doPrimary = (primary: TrackPrimary) => {
    if (primary.kind === 'play') motion.leave(() => onPlay(primary.node, loadoutFor(primary.node)));
    else if (primary.kind === 'story') motion.leave(() => onStory(primary.level));
    else if (primary.kind === 'reveal') motion.leave(onReveal);
    else if (primary.kind === 'chest') onChest(primary.threshold);
  };
  const levelRow = (node: LevelNode) => <UpgradeActionRow key={node.key} icon={node.boss ? 'trophy.fill' : 'leaf.fill'} done={node.state === 'done'} dimmed={node.state === 'ahead' || (!node.playable && node.state !== 'done')}
    label={`${node.number}. ${node.title}${node.difficulty ? ` · ${DIFFICULTY_LABELS[node.difficulty]}` : ''}`}
    detail={levelDetail(node)}
    action={node.playable ? {
      label: node.state === 'done' ? 'Again' : 'Play', primary: node.state !== 'done', disabled: busy || motion.closing,
      accessibilityLabel: `${node.state === 'done' ? 'Play again' : 'Play'} level ${node.number}, ${node.title}`,
      onPress: () => motion.leave(() => onPlay(node, loadoutFor(node))),
    } : undefined} />;
  return <UpgradeDock motion={motion} title={track.title} levelLabel={track.maxStars ? `★ ${track.stars} / ${track.maxStars}` : undefined}
    progressLabel={`${track.cleared} / ${track.total}`} progressFraction={track.total ? track.cleared / track.total : 0}
    height={layout.panelHeight} width={layout.panelWidth} bottomInset={bottomInset} closeLabel={`Close ${track.title}`}
    hero={<UpgradeHero caption={notice ?? track.caption}
      action={track.primary.kind === 'none' ? undefined
        : <KatchaButton fullWidth size="compact" loading={busy} disabled={busy || motion.closing} label={track.primary.label} onPress={() => doPrimary(track.primary)} />} />}>
    {track.chapters.map((chapter) => {
      if (!chapter.levels.length && chapter.story === 'none') return null;
      const label = chapter.level === 0 ? track.kind === 'daily' ? 'Today' : track.kind === 'grove' ? 'The Grove' : 'The Mist' : `Chapter ${chapter.level}`;
      const done = chapter.levels.filter((node) => node.state === 'done').length;
      return <UpgradeSection key={chapter.level} label={label} aside={chapter.levels.length ? `${done} / ${chapter.levels.length}` : undefined}>
        {chapter.story !== 'none' ? <UpgradeActionRow icon="book.fill" done={chapter.story === 'told'} dimmed={chapter.story === 'locked'}
          label={chapter.title ?? 'The story'}
          detail={chapter.story === 'told' ? 'Told' : chapter.story === 'ready' ? 'Plays when you start its first level' : 'After the levels before it'} /> : null}
        {chapter.levels.map(levelRow)}
      </UpgradeSection>;
    })}
    {track.milestones.length ? <UpgradeSection label="Chests" aside={`★ ${track.stars}`}>
      {track.milestones.map((milestone) => <UpgradeActionRow key={milestone.threshold} icon="shippingbox.fill" done={milestone.state === 'claimed'} dimmed={milestone.state === 'locked'}
        label={`★ ${milestone.threshold}`}
        detail={`+${milestone.glow} Glow · ${PACK_NAMES[milestone.pack]}`}
        action={milestone.state === 'ready' ? { label: 'Open', primary: true, disabled: busy || motion.closing, onPress: () => onChest(milestone.threshold) } : undefined} />)}
    </UpgradeSection> : null}
    <UpgradeSection label="Bring" aside={heroSlots(world) === 2 ? 'Two heroes' : undefined}>
      <UpgradeLoadoutRow world={world} playable={playable} ownedWispIds={ownedWispIds} value={loadout} eligible={eligible} slots={heroSlots(world)} disabled={busy || motion.closing} onChange={setLoadout} />
    </UpgradeSection>
  </UpgradeDock>;
}
