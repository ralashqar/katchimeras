import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TodayExplorationBackground } from '@/components/katchadeck/home/today-exploration-background';
import { AmbientEnvironmentDrift } from '@/components/katchadeck/ui/ambient-environment-drift';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { KatchaSheet } from '@/components/katchadeck/ui/katcha-sheet';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { AppFontFamilies, Lantern } from '@/constants/theme';
import { KatchaUI } from '@/constants/katcha-ui';
import { gameHubArtSource } from '@/constants/game-hub-art.generated';
import { resolveCreatureArtSource } from '@/utils/creature-art';
import { sortPlayableGames, type GameHubCategory, type GameHubItem } from '@/utils/game-hub';
import type { TodayExplorationBackgroundKey } from '@/utils/today-exploration-backgrounds';

const CATEGORY_ART: Record<GameHubCategory, { accent: string; colors: readonly [string, string, string]; icon: IconSymbolName }> = {
  movement: { accent: '#A9D08E', colors: ['#506F4F', '#28433A', '#17241F'], icon: 'figure.walk' },
  trivia: { accent: '#E2B48E', colors: ['#72564C', '#443639', '#211F2B'], icon: 'book.closed.fill' },
  words: { accent: '#CDB1E9', colors: ['#6D5B79', '#403A58', '#201F31'], icon: 'book.fill' },
  calm: { accent: '#A9D2D0', colors: ['#587577', '#334C58', '#1B2935'], icon: 'moon.stars.fill' },
  timing: { accent: '#E4C777', colors: ['#79643F', '#4C4131', '#27251F'], icon: 'timer' },
  memory: { accent: '#A9CDB8', colors: ['#547264', '#33493F', '#1C2926'], icon: 'sparkles' },
  puzzle: { accent: '#D5A5C9', colors: ['#725069', '#433349', '#241E31'], icon: 'circle.grid.2x2.fill' },
  rhythm: { accent: '#C0A9E2', colors: ['#65517A', '#393651', '#201F30'], icon: 'music.note' },
};

const CATEGORY_FILTER_LABELS: Record<GameHubCategory, string> = {
  movement: 'Movement',
  trivia: 'Trivia',
  words: 'Words',
  calm: 'Calm',
  timing: 'Timing',
  memory: 'Memory',
  puzzle: 'Puzzle',
  rhythm: 'Rhythm',
};

export function GameHubScreen({
  backgroundKey,
  items,
  onOpenGame,
  onViewKatchimeras,
}: {
  backgroundKey: TodayExplorationBackgroundKey;
  items: GameHubItem[];
  onOpenGame: (item: GameHubItem) => void;
  onViewKatchimeras: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const [lockedSelection, setLockedSelection] = useState<GameHubItem | null>(null);
  const [filter, setFilter] = useState<'all' | GameHubCategory>('all');
  const columns = 2;
  const gutter = width >= 700 ? 24 : 14;
  const gap = width >= 700 ? 16 : 10;
  const sectionInset = width >= 700 ? 14 : 9;
  // Floor with a small border allowance so two cards never wrap because the
  // framed section's inner content box is a fractional pixel narrower.
  const cardWidth = Math.floor((width - gutter * 2 - sectionInset * 2 - 4 - gap * (columns - 1)) / columns);
  const playable = useMemo(() => sortPlayableGames(items.filter((item) => !item.locked)), [items]);
  const locked = useMemo(() => items.filter((item) => item.locked), [items]);
  const availableCategories = useMemo(
    () => (Object.keys(CATEGORY_ART) as GameHubCategory[]).filter((category) =>
      items.some((item) => item.category === category)
    ),
    [items]
  );
  const visiblePlayable = useMemo(
    () => filter === 'all' ? playable : playable.filter((item) => item.category === filter),
    [filter, playable]
  );
  const visibleLocked = useMemo(
    () => filter === 'all' ? locked : locked.filter((item) => item.category === filter),
    [filter, locked]
  );

  const select = (item: GameHubItem) => {
    if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (item.locked) setLockedSelection(item);
    else onOpenGame(item);
  };

  return (
    <View style={styles.screen}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <AmbientEnvironmentDrift>
          <TodayExplorationBackground backgroundKey={backgroundKey} imageSize={Math.max(width, height)} />
        </AmbientEnvironmentDrift>
        <LinearGradient
          colors={['rgba(17,18,27,0.56)', 'rgba(13,16,21,0.76)', 'rgba(9,12,16,0.94)']}
          locations={[0, 0.46, 1]}
          style={StyleSheet.absoluteFill}
        />
      </View>
      <View pointerEvents="none" style={styles.ambientOne} />
      <View pointerEvents="none" style={styles.ambientTwo} />
      <Animated.ScrollView
        contentContainerStyle={{ gap: 16, paddingBottom: insets.bottom + 116, paddingHorizontal: gutter, paddingTop: insets.top + 12 }}
        contentInsetAdjustmentBehavior="automatic"
        entering={reduceMotion ? undefined : FadeIn.duration(240)}
        showsVerticalScrollIndicator={false}>
        <GameFilterRail
          availableCategories={availableCategories}
          filter={filter}
          onSelect={setFilter}
        />

        {visiblePlayable.length ? (
          <GameSection
            cardWidth={cardWidth}
            count={visiblePlayable.length}
            gap={gap}
            items={visiblePlayable}
            onSelect={select}
            title="Your games"
          />
        ) : (
          <View style={styles.emptyPanel}>
            <IconSymbol name="sparkles" size={24} color={Lantern.ember300} />
            <View style={styles.emptyCopy}>
              <ThemedText selectable style={styles.emptyTitle} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
                {filter === 'all' ? 'Your first game is still in its shell' : `No unlocked ${CATEGORY_FILTER_LABELS[filter].toLowerCase()} games yet`}
              </ThemedText>
              <ThemedText selectable style={styles.emptyBody} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
                {filter === 'all' ? 'Hatch a Katchimera and its signature game will appear here.' : 'Try another filter, or hatch the companion shown below to unlock this category.'}
              </ThemedText>
            </View>
          </View>
        )}

        {visibleLocked.length ? (
          <GameSection
            cardWidth={cardWidth}
            count={visibleLocked.length}
            gap={gap}
            items={visibleLocked}
            onSelect={select}
            title="More to hatch"
          />
        ) : null}
      </Animated.ScrollView>

      {lockedSelection ? (
        <LockedGameSheet
          item={lockedSelection}
          onClose={() => setLockedSelection(null)}
          onViewKatchimeras={() => {
            setLockedSelection(null);
            onViewKatchimeras();
          }}
        />
      ) : null}
    </View>
  );
}

function GameFilterRail({
  availableCategories,
  filter,
  onSelect,
}: {
  availableCategories: GameHubCategory[];
  filter: 'all' | GameHubCategory;
  onSelect: (filter: 'all' | GameHubCategory) => void;
}) {
  return (
    <View style={styles.filterPanel}>
      <View pointerEvents="none" style={styles.filterPanelRim} />
      <ScrollView
        contentContainerStyle={styles.filterContent}
        horizontal
        showsHorizontalScrollIndicator={false}>
        <GameFilterChip
          icon="gamecontroller.fill"
          label="All games"
          onPress={() => onSelect('all')}
          selected={filter === 'all'}
        />
        {availableCategories.map((category) => (
          <GameFilterChip
            accent={CATEGORY_ART[category].accent}
            icon={CATEGORY_ART[category].icon}
            key={category}
            label={CATEGORY_FILTER_LABELS[category]}
            onPress={() => onSelect(category)}
            selected={filter === category}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function GameFilterChip({
  accent = Lantern.ember300,
  icon,
  label,
  onPress,
  selected,
}: {
  accent?: string;
  icon: IconSymbolName;
  label: string;
  onPress: () => void;
  selected: boolean;
}) {
  return (
    <Pressable
      accessibilityLabel={`Show ${label}`}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.filterChip,
        selected && styles.filterChipSelected,
        selected && { borderColor: `${accent}70` },
        pressed && styles.filterChipPressed,
      ]}>
      <IconSymbol name={icon} size={15} color={selected ? accent : Lantern.moon500} />
      <ThemedText
        numberOfLines={1}
        style={styles.filterChipLabel}
        lightColor={selected ? Lantern.moon50 : Lantern.moon300}
        darkColor={selected ? Lantern.moon50 : Lantern.moon300}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function GameSection({
  cardWidth,
  count,
  gap,
  items,
  onSelect,
  title,
}: {
  cardWidth: number;
  count: number;
  gap: number;
  items: GameHubItem[];
  onSelect: (item: GameHubItem) => void;
  title: string;
}) {
  return (
    <View style={styles.section}>
      <View pointerEvents="none" style={styles.sectionRim} />
      <View style={styles.sectionHeading}>
        <ThemedText selectable style={styles.sectionTitle} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>{title}</ThemedText>
        <ThemedText selectable style={styles.sectionCount} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>{count}</ThemedText>
      </View>
      <View style={[styles.grid, { gap }]}>
        {items.map((item) => <GameCard item={item} key={item.questId} onPress={() => onSelect(item)} width={cardWidth} />)}
      </View>
    </View>
  );
}

function GameCard({ item, onPress, width }: { item: GameHubItem; onPress: () => void; width: number }) {
  const art = CATEGORY_ART[item.category];
  const bespokeArt = gameHubArtSource(item.questId);
  const source = item.displayVisualKey ? resolveCreatureArtSource(item.displayVisualKey, { lod: 'medium' }) : null;
  return (
    <Pressable
      accessibilityHint={item.locked ? item.lockReason ?? undefined : 'Opens the game'}
      accessibilityLabel={`${item.title}, ${item.displayCompanionName}${item.locked ? ', locked' : ''}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.cardPressable, { opacity: pressed ? 0.88 : 1, transform: [{ scale: pressed ? 0.98 : 1 }], width }]}>
      <View style={[styles.card, item.locked && styles.cardLocked]}>
        <View style={[styles.art, { height: width * 0.84 }]}> 
          <LinearGradient colors={[...art.colors]} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          {bespokeArt ? <Image accessibilityLabel={`${item.displayCompanionName} playing ${item.title}`} contentFit="cover" source={bespokeArt} style={StyleSheet.absoluteFill} /> : null}
          {!bespokeArt ? <View style={styles.artGlyph}>
            <IconSymbol name={art.icon} size={28} color="rgba(255,247,221,0.74)" />
          </View> : null}
          {!bespokeArt && source ? (
            <Image
              accessibilityLabel={`${item.displayCompanionName} playing ${item.title}`}
              cachePolicy="memory-disk"
              contentFit="contain"
              source={source}
              style={styles.creatureArt}
              transition={0}
            />
          ) : null}
          <LinearGradient colors={['rgba(255,255,255,0.08)', 'transparent', 'rgba(10,10,16,0.82)']} locations={[0, 0.47, 1]} style={StyleSheet.absoluteFill} />
          <View style={styles.companionBadge}>
            <ThemedText numberOfLines={1} style={styles.companionBadgeText} lightColor="#FFF7E7" darkColor="#FFF7E7">
              {item.displayCompanionName}
            </ThemedText>
          </View>
          {item.playedToday && !item.locked ? (
            <View style={styles.playedBadge}>
              <IconSymbol name="checkmark" size={12} color="#1F2A1D" />
              <ThemedText style={styles.playedText} lightColor="#1F2A1D" darkColor="#1F2A1D">TODAY</ThemedText>
            </View>
          ) : null}
          {item.locked ? (
            <View style={styles.lockVeil}>
              <View style={styles.lockBadge}>
                <IconSymbol name="lock.fill" size={17} color="#FFF3D1" />
              </View>
            </View>
          ) : null}
          {!item.locked ? (
            <View style={[styles.playBadge, { borderColor: `${art.accent}88` }]}>
              <IconSymbol name="play.fill" size={13} color={art.accent} />
            </View>
          ) : null}
        </View>
        <LinearGradient colors={['rgba(43,42,52,0.98)', 'rgba(27,27,35,0.99)']} style={styles.cardCopy}>
          <ThemedText numberOfLines={2} selectable style={styles.cardTitle} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>{item.title}</ThemedText>
          <ThemedText numberOfLines={2} selectable style={styles.cardDescription} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
            {item.description}
          </ThemedText>
          <View style={styles.cardFooter}>
            <View style={[styles.categoryMark, { backgroundColor: `${art.accent}1F`, borderColor: `${art.accent}52` }]}>
              <IconSymbol name={art.icon} size={11} color={art.accent} />
              <ThemedText numberOfLines={1} style={styles.cardCategory} lightColor={art.accent} darkColor={art.accent}>{item.categoryLabel}</ThemedText>
            </View>
            <ThemedText style={styles.cardMeta} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>{item.estimatedMinutes} min</ThemedText>
          </View>
        </LinearGradient>
      </View>
    </Pressable>
  );
}

function LockedGameSheet({ item, onClose, onViewKatchimeras }: { item: GameHubItem; onClose: () => void; onViewKatchimeras: () => void }) {
  const art = CATEGORY_ART[item.category];
  const bespokeArt = gameHubArtSource(item.questId);
  const source = item.displayVisualKey ? resolveCreatureArtSource(item.displayVisualKey, { lod: 'medium' }) : null;
  return (
    <KatchaSheet
      footer={<KatchaButton fullWidth icon="pawprint.fill" label="View Katchimeras" onPress={onViewKatchimeras} />}
      header={{ eyebrow: item.categoryLabel, title: item.title, subtitle: item.description }}
      onRequestClose={onClose}
      surface="parchment">
      <View style={styles.sheetStack}>
        <View style={styles.sheetArt}>
          <LinearGradient colors={[...art.colors]} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          {bespokeArt ? <Image accessibilityLabel={`${item.displayCompanionName} playing ${item.title}`} contentFit="cover" source={bespokeArt} style={StyleSheet.absoluteFill} /> : null}
          {!bespokeArt && source ? <Image accessibilityLabel={item.displayCompanionName} contentFit="contain" source={source} style={styles.sheetCreature} /> : null}
          <View style={styles.sheetLock}><IconSymbol name="lock.fill" size={19} color="#FFF3D1" /></View>
        </View>
        <View style={styles.unlockNotice}>
          <IconSymbol name="sparkles" size={18} color="#7B5000" />
          <ThemedText selectable style={styles.unlockText} lightColor="#533A24" darkColor="#533A24">{item.lockReason}</ThemedText>
        </View>
      </View>
    </KatchaSheet>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#101419', flex: 1 },
  ambientOne: { backgroundColor: 'rgba(210,165,96,0.08)', borderRadius: 999, height: 260, position: 'absolute', right: -110, top: -70, width: 260 },
  ambientTwo: { backgroundColor: 'rgba(105,126,101,0.09)', borderRadius: 999, height: 220, left: -100, position: 'absolute', top: 310, width: 220 },
  filterPanel: { backgroundColor: 'rgba(30,30,34,0.7)', borderColor: 'rgba(236,214,166,0.16)', borderCurve: 'continuous', borderRadius: 22, borderWidth: 1, boxShadow: '0 12px 28px rgba(3,5,7,0.24), inset 0 1px 0 rgba(255,246,220,0.1)', overflow: 'hidden', padding: 6 },
  filterPanelRim: { borderColor: 'rgba(255,238,195,0.06)', borderRadius: 19, borderWidth: 1, bottom: 3, left: 3, position: 'absolute', right: 3, top: 3 },
  filterContent: { gap: 6, paddingHorizontal: 1 },
  filterChip: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.035)', borderColor: 'rgba(255,245,218,0.08)', borderCurve: 'continuous', borderRadius: 16, borderWidth: 1, flexDirection: 'row', gap: 7, minHeight: 43, paddingHorizontal: 13 },
  filterChipSelected: { backgroundColor: 'rgba(255,242,207,0.11)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1)' },
  filterChipPressed: { opacity: 0.76, transform: [{ scale: 0.98 }] },
  filterChipLabel: { fontFamily: AppFontFamilies.manrope, fontSize: 11, fontWeight: '800' },
  section: { backgroundColor: 'rgba(30,30,34,0.62)', borderColor: 'rgba(236,214,166,0.14)', borderCurve: 'continuous', borderRadius: 25, borderWidth: 1, boxShadow: '0 16px 34px rgba(3,5,7,0.26), inset 0 1px 0 rgba(255,246,220,0.09)', gap: 13, overflow: 'hidden', padding: 9, paddingBottom: 12 },
  sectionRim: { borderColor: 'rgba(255,238,195,0.07)', borderRadius: 22, borderWidth: 1, bottom: 3, left: 3, position: 'absolute', right: 3, top: 3 },
  sectionHeading: { alignItems: 'baseline', flexDirection: 'row', gap: 8, paddingHorizontal: 4, paddingTop: 4 },
  sectionTitle: { ...KatchaUI.type.companionSectionTitle },
  sectionCount: { fontFamily: AppFontFamilies.manrope, fontSize: 12, fontVariant: ['tabular-nums'], fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cardPressable: { borderCurve: 'continuous', borderRadius: 19 },
  card: { backgroundColor: '#24242F', borderColor: 'rgba(244,220,170,0.2)', borderCurve: 'continuous', borderRadius: 19, borderWidth: 1, boxShadow: '0 11px 22px rgba(4,6,10,0.38)', overflow: 'hidden' },
  cardLocked: { borderColor: 'rgba(205,198,181,0.1)', opacity: 0.84 },
  art: { overflow: 'hidden', position: 'relative', width: '100%' },
  artGlyph: { left: 13, opacity: 0.66, position: 'absolute', top: 13 },
  creatureArt: { bottom: -5, height: '89%', position: 'absolute', right: -12, width: '94%' },
  playedBadge: { alignItems: 'center', backgroundColor: '#DCC873', borderRadius: 8, flexDirection: 'row', gap: 3, left: 9, minHeight: 25, paddingHorizontal: 7, position: 'absolute', top: 9 },
  playedText: { fontFamily: AppFontFamilies.manrope, fontSize: 8.5, fontWeight: '900', letterSpacing: 0.7 },
  companionBadge: { backgroundColor: 'rgba(17,16,22,0.72)', borderColor: 'rgba(255,245,218,0.18)', borderRadius: 9, borderWidth: 1, bottom: 8, justifyContent: 'center', left: 8, maxWidth: '68%', minHeight: 25, paddingHorizontal: 7, position: 'absolute' },
  companionBadgeText: { fontFamily: AppFontFamilies.manrope, fontSize: 9, fontWeight: '900' },
  playBadge: { alignItems: 'center', backgroundColor: 'rgba(22,21,28,0.86)', borderRadius: 999, borderWidth: 1, bottom: 8, height: 32, justifyContent: 'center', position: 'absolute', right: 8, width: 32 },
  lockVeil: { alignItems: 'center', backgroundColor: 'rgba(12,13,19,0.5)', justifyContent: 'center', ...StyleSheet.absoluteFillObject },
  lockBadge: { alignItems: 'center', backgroundColor: 'rgba(32,29,39,0.86)', borderColor: 'rgba(255,243,209,0.22)', borderRadius: 16, borderWidth: 1, height: 42, justifyContent: 'center', width: 42 },
  cardCopy: { gap: 5, minHeight: 130, paddingBottom: 11, paddingHorizontal: 11, paddingTop: 10 },
  cardTitle: { fontFamily: AppFontFamilies.fredokaBold, fontSize: 16, letterSpacing: -0.15, lineHeight: 19, minHeight: 38 },
  cardDescription: { fontFamily: AppFontFamilies.manrope, fontSize: 10.5, fontWeight: '600', lineHeight: 14, minHeight: 28 },
  cardFooter: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 'auto', paddingTop: 3 },
  categoryMark: { alignItems: 'center', borderRadius: 8, borderWidth: 1, flexDirection: 'row', gap: 4, minHeight: 24, paddingHorizontal: 6 },
  cardMeta: { fontFamily: AppFontFamilies.manrope, fontSize: 9, fontVariant: ['tabular-nums'], fontWeight: '800' },
  cardCategory: { fontFamily: AppFontFamilies.manrope, fontSize: 8, fontWeight: '900', letterSpacing: 0.55, textTransform: 'uppercase' },
  emptyPanel: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.045)', borderCurve: 'continuous', borderRadius: 20, flexDirection: 'row', gap: 13, padding: 17 },
  emptyCopy: { flex: 1, gap: 3 },
  emptyTitle: { fontFamily: AppFontFamilies.fredokaBold, fontSize: 17, lineHeight: 21 },
  emptyBody: { fontFamily: AppFontFamilies.manrope, fontSize: 12, fontWeight: '600', lineHeight: 18 },
  sheetStack: { gap: 14 },
  sheetArt: { borderCurve: 'continuous', borderRadius: 18, height: 190, overflow: 'hidden', position: 'relative' },
  sheetCreature: { bottom: -8, height: '108%', position: 'absolute', right: '3%', width: '80%' },
  sheetLock: { alignItems: 'center', backgroundColor: 'rgba(29,26,36,0.82)', borderRadius: 15, height: 40, justifyContent: 'center', left: 14, position: 'absolute', top: 14, width: 40 },
  unlockNotice: { alignItems: 'center', backgroundColor: 'rgba(255,248,232,0.38)', borderColor: 'rgba(122,84,44,0.16)', borderCurve: 'continuous', borderRadius: 15, borderWidth: 1, flexDirection: 'row', gap: 10, padding: 13 },
  unlockText: { flex: 1, fontFamily: AppFontFamilies.manrope, fontSize: 13, fontWeight: '700', lineHeight: 19 },
});
