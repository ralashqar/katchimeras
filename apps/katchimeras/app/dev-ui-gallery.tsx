import { useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionTile } from '@/components/katchadeck/ui/action-tile';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { KatchaInlineNotice } from '@/components/katchadeck/ui/katcha-inline-notice';
import { KatchaSectionHeading, KatchaSurfaceCard } from '@/components/katchadeck/ui/katcha-sheet-primitives';
import { KatchaSurfaceProvider, useKatchaSurface } from '@/components/katchadeck/ui/katcha-surface';
import { GameBadge, GameIconWell, GameRewardChip, GameSurface } from '@/components/katchadeck/ui/game-surface';
import { UpgradeDock, useUpgradeDockMotion } from '@/components/katchadeck/upgrade/upgrade-dock';
import { UpgradeBenefitRow, UpgradeHero, UpgradeLevelSlots, UpgradeRequirementRow, UpgradeSection, useUpgradeLevelPick } from '@/components/katchadeck/upgrade/upgrade-rows';
import { CompanionThreadSwitcher } from '@/components/katchadeck/world/companion-thread-switcher';
import {
  CompanionCard,
  CompanionResultNotice,
  CompanionSection,
  CompanionStatusBadge,
} from '@/components/katchadeck/world/companion-ui-primitives';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { GAME_CURRENCY_ART } from '@/constants/game-currency-art';
import { GameUI, type GameSurfaceTone } from '@/constants/game-ui';
import { KatchaUI, type KatchaSurface } from '@/constants/katcha-ui';
import { lanternLevelArt, tileLevelArt } from '@/features/upgrade-stage/upgrade-level-art';
import { lanternUpgradeModel, tileUpgradeModel, type UpgradePanelModel } from '@/features/upgrade-stage/upgrade-panel-model';
import { upgradeStageLayout } from '@/features/upgrade-stage/upgrade-stage-layout';
import type { WorldUpgradeOffer } from '@/features/world-upgrades/world-upgrade-offers';
import type { CompanionThread } from '@/types/companion-interaction';

const GALLERY_OFFER = {
  id: 'nature:bloom-garden', name: 'Bloom Garden', nextName: 'Colour Beds', description: 'Flower beds return along the path.',
  nextLevel: 3, cost: 400, action: 'Upgrade', currentLevel: 2, maxLevel: 4, eligible: true, affordable: false, missingGlow: 160,
} as WorldUpgradeOffer;
const GALLERY_LANTERN = { startedAt: 0, clock: 0, day: '', dailyOrders: 0, dailyGranted: false, processedEvents: [], welcomeServed: ['lantern:welcome:plant'], lifetimeOrders: 7, rewards: {} };
const UPGRADE_PREVIEWS: { label: string; model: UpgradePanelModel }[] = [
  { label: 'Tile · short of Glow', model: tileUpgradeModel(GALLERY_OFFER, 240, { rewardName: 'Petalimp' }) },
  { label: 'Tile · ready', model: tileUpgradeModel(GALLERY_OFFER, 1240) },
  { label: 'Tile · held', model: tileUpgradeModel({ ...GALLERY_OFFER, eligible: false, lockedLabel: 'Held', lockedReason: 'Petalimp wakes first.' }, 1240) },
  { label: 'Lantern · milestones', model: lanternUpgradeModel(GALLERY_LANTERN) },
  { label: 'Lantern · fully grown', model: lanternUpgradeModel({ ...GALLERY_LANTERN, level: 3 }) },
];

/** The shared upgrade stage's docked panel, over the gallery, at the size the Kingdom gives it. */
function UpgradeDockPreview({ model, onClose }: { model: UpgradePanelModel; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const layout = upgradeStageLayout(useWindowDimensions(), insets);
  const motion = useUpgradeDockMotion({ busy: false, onClose });
  const [tab, setTab] = useState<'upgrade' | 'story'>('upgrade');
  const lantern = model.title === 'Wisp Lantern';
  const pick = useUpgradeLevelPick(model.levels, model.level.current, (level) => lantern ? lanternLevelArt(level) : tileLevelArt(GALLERY_OFFER.id, level));
  return <UpgradeDock motion={motion} title={model.title} levelLabel={`Lv. ${model.level.current}`} progressLabel={model.progressLabel} progressFraction={model.progressFraction}
    height={layout.panelHeight} width={layout.panelWidth} bottomInset={insets.bottom}
    tagline={model.tagline}
    tabs={lantern ? undefined : { items: [{ id: 'upgrade', label: 'Upgrade', icon: 'leaf.fill' }, { id: 'story', label: 'Story', icon: 'book.fill' }], value: tab, onChange: setTab }}
    hero={<UpgradeHero art={model.locked ? null : pick.art} dim={Boolean(model.locked)} ribbon={model.locked ? undefined : pick.ribbon}
      name={model.locked ? model.locked.label : pick.name ?? model.title} description={model.locked ? model.locked.reason : pick.description}
      action={pick.onFocus && model.primary ? <KatchaButton fullWidth size="compact" disabled={model.primary.disabled} label={model.primary.label}
        cost={model.primary.cost ? { currency: 'coins', amount: model.primary.cost } : undefined} onPress={motion.dismiss} /> : null}
      caption={pick.caption ?? (model.complete ? 'Fully grown' : model.primary?.cost == null && model.primary ? 'Free' : null)} />}>
    {tab === 'upgrade' ? <>
      {model.benefits.map((benefit) => <UpgradeBenefitRow key={benefit.id} benefit={benefit} />)}
      {!model.locked && model.levels.length > 1 ? <UpgradeSection label="Stages" aside="Each one is a surprise"><UpgradeLevelSlots levels={model.levels} selected={pick.shown?.level ?? null} onSelect={pick.pick} artFor={pick.slotArt} /></UpgradeSection> : null}
      {model.requirements.length ? <UpgradeSection label="Requires">{model.requirements.map((requirement) => <UpgradeRequirementRow key={requirement.id} requirement={requirement} onAction={motion.dismiss} />)}</UpgradeSection> : null}
    </> : <ThemedText style={styles.body} lightColor={GameUI.color.inkSecondary} darkColor={GameUI.color.inkSecondary}>The Story tab holds a tile’s dialogue and a friend’s chapters.</ThemedText>}
  </UpgradeDock>;
}

function SurfaceGallery({ surface }: { surface: KatchaSurface }) {
  const { tokens } = useKatchaSurface();
  return (
    <View style={[styles.surface, { backgroundColor: tokens.background, borderColor: tokens.borderStrong }]}>
      <ThemedText style={styles.eyebrow} lightColor={tokens.textTertiary} darkColor={tokens.textTertiary}>{surface}</ThemedText>
      <ThemedText style={styles.title} lightColor={tokens.text} darkColor={tokens.text}>{surface === 'parchment' ? 'Keep a piece of today' : 'Return to your collection'}</ThemedText>
      <ThemedText style={styles.body} lightColor={tokens.textSecondary} darkColor={tokens.textSecondary}>Development gallery for shared surface states, spacing, contrast, and enlarged-copy checks.</ThemedText>
      <KatchaSectionHeading>Actions</KatchaSectionHeading>
      <KatchaButton fullWidth label="Restore" cost={{ currency: 'coins', amount: 40 }} onPress={() => {}} />
      <KatchaButton fullWidth label="Complete and return to your companion" onPress={() => {}} />
      <KatchaButton fullWidth label="Restore" cost={{ currency: 'coins', amount: 40 }} loading />
      <KatchaButton fullWidth label="Continue" disabled />
      <View style={styles.row}>
        <KatchaButton label="Primary" onPress={() => {}} size="compact" />
        <KatchaButton label="Secondary" onPress={() => {}} size="compact" variant="secondary" />
      </View>
      <View style={styles.row}>
        <KatchaButton label="Tertiary" onPress={() => {}} size="compact" variant="tertiary" />
        <KatchaButton label="Discard" onPress={() => {}} size="compact" variant="destructive" />
      </View>
      <KatchaSectionHeading>Tiles</KatchaSectionHeading>
      <View style={styles.row}>
        <ActionTile description="Selected state" icon="heart.fill" onPress={() => {}} selected tint={tokens.accent} title="Mood" />
        <ActionTile disabled icon="moon.fill" onPress={() => {}} tint={tokens.textTertiary} title="Sleep" />
      </View>
      <KatchaInlineNotice body="This is a recoverable message with a clear next action." onAction={() => {}} actionLabel="Try again" tone="warning" />
      <KatchaSurfaceCard>
        <ThemedText style={styles.cardText} lightColor={tokens.text} darkColor={tokens.text}>Elevated card and inherited text</ThemedText>
      </KatchaSurfaceCard>
    </View>
  );
}

function CompanionGallery() {
  const { tokens } = useKatchaSurface();
  const [thread, setThread] = useState<CompanionThread>('skins');
  return (
    <View style={[styles.surface, { backgroundColor: tokens.background, borderColor: tokens.borderStrong }]}>
      <ThemedText style={styles.eyebrow} lightColor={tokens.textTertiary} darkColor={tokens.textTertiary}>
        Companion system
      </ThemedText>
      <ThemedText style={styles.companionTitle} lightColor={tokens.text} darkColor={tokens.text}>
        Mossprout
      </ThemedText>
      <CompanionThreadSwitcher onChange={setThread} showSkins value={thread} />
      <CompanionSection
        description="Shared spacing, typography, surface and state treatment."
        label="Today together">
        <CompanionCard selected>
          <View style={styles.statusRow}>
            <ThemedText style={styles.cardText} lightColor={tokens.text} darkColor={tokens.text}>
              Notice one living detail
            </ThemedText>
            <CompanionStatusBadge label="In progress" tone="neutral" />
          </View>
          <ThemedText style={styles.body} lightColor={tokens.textSecondary} darkColor={tokens.textSecondary}>
            Add one small observation from outside.
          </ThemedText>
        </CompanionCard>
      </CompanionSection>
      <CompanionResultNotice tasks={['Notice one living detail', 'Take a ten-minute outdoor pause']} />
    </View>
  );
}

const PLAYFUL_TONES: GameSurfaceTone[] = ['cream', 'gold', 'teal', 'sage', 'rose', 'dark'];

function PlayfulGameGallery() {
  return <View style={styles.gameGallery}>
    <ThemedText style={styles.eyebrow} lightColor={GameUI.color.creamMuted} darkColor={GameUI.color.creamMuted}>Procedural game surfaces</ThemedText>
    <View style={styles.gameSurfaceGrid}>
      {PLAYFUL_TONES.map((tone) => <GameSurface contentStyle={styles.gameSurfaceContent} key={tone} tone={tone}>
        <GameIconWell size={38} tone={tone}><IconSymbol color={GameUI.surface[tone].ink} name="sparkles" size={18} /></GameIconWell>
        <ThemedText style={styles.gameSurfaceLabel} lightColor={GameUI.surface[tone].ink} darkColor={GameUI.surface[tone].ink}>{tone}</ThemedText>
        <GameBadge label="3" tone={tone} />
      </GameSurface>)}
    </View>
    <View style={styles.row}>
      <GameRewardChip amount={10} art={GAME_CURRENCY_ART.energy} />
      <GameRewardChip amount={25} art={GAME_CURRENCY_ART.coins} tone="cream" />
      <GameBadge icon="checkmark" label="Done" tone="sage" />
    </View>
  </View>;
}

export default function DevUiGalleryScreen() {
  const [upgradePreview, setUpgradePreview] = useState<number | null>(null);
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText style={styles.pageTitle} lightColor="#F8F2E7" darkColor="#F8F2E7">Katcha UI gallery</ThemedText>
        <View style={styles.gameGallery}>
          <ThemedText style={styles.eyebrow} lightColor={GameUI.color.creamMuted} darkColor={GameUI.color.creamMuted}>Upgrade stage · docked panel</ThemedText>
          {UPGRADE_PREVIEWS.map((preview, index) => <KatchaButton fullWidth key={preview.label} label={preview.label} size="compact" variant="secondary" onPress={() => setUpgradePreview(index)} />)}
        </View>
        <PlayfulGameGallery />
        <KatchaSurfaceProvider surface="parchment"><CompanionGallery /></KatchaSurfaceProvider>
        <KatchaSurfaceProvider surface="parchment"><SurfaceGallery surface="parchment" /></KatchaSurfaceProvider>
        <KatchaSurfaceProvider surface="night"><SurfaceGallery surface="night" /></KatchaSurfaceProvider>
      </ScrollView>
      {upgradePreview != null ? <UpgradeDockPreview key={upgradePreview} model={UPGRADE_PREVIEWS[upgradePreview].model} onClose={() => setUpgradePreview(null)} /> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#090813', flex: 1 },
  content: { gap: 20, padding: 16, paddingBottom: 48 },
  pageTitle: { ...KatchaUI.type.display, fontSize: 34 },
  surface: { borderCurve: 'continuous', borderRadius: KatchaUI.radius.sheet, borderWidth: 1, gap: 14, padding: 20 },
  eyebrow: KatchaUI.type.label,
  title: KatchaUI.type.display,
  companionTitle: KatchaUI.type.companionName,
  body: KatchaUI.type.body,
  row: { alignItems: 'stretch', flexDirection: 'row', gap: 10 },
  statusRow: { alignItems: 'center', flexDirection: 'row', gap: 10, justifyContent: 'space-between' },
  cardText: KatchaUI.type.body,
  gameGallery: { backgroundColor: GameUI.color.canvas, borderRadius: 24, gap: 14, padding: 16 },
  gameSurfaceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  gameSurfaceContent: { alignItems: 'center', flexDirection: 'row', gap: 7, minWidth: 146, padding: 8 },
  gameSurfaceLabel: { fontFamily: GameUI.type.title.fontFamily, fontSize: 14, textTransform: 'capitalize' },
});
