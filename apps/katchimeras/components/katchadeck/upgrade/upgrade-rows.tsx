import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, type ImageSourcePropType, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { ProgressBar } from '@/components/katchadeck/progress-bar';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { GAME_CURRENCY_ART } from '@/constants/game-currency-art';
import { KatchaUI } from '@/constants/katcha-ui';
import { AppFontFamilies } from '@/constants/theme';
import { UpgradePanelUI } from '@/constants/upgrade-panel';
import { upgradeFocusLevel, type UpgradeBenefit, type UpgradeLevelEntry, type UpgradeRequirement } from '@/features/upgrade-stage/upgrade-panel-model';

/**
 * Every raised thing in the panel: a gradient face inside a rim, with a light
 * stroke just inside that rim all the way round (not a line along the top).
 */
function Face({ colors, radius, rim = 1.5, style, children, stroke = true }: {
  colors: readonly [string, string, ...string[]]; radius: number; rim?: number; style?: StyleProp<ViewStyle>; children?: ReactNode; stroke?: boolean;
}) {
  // The fill carries the rim's inner radius: clipped only by `overflow: 'hidden'` (the OUTER curve), a square-cornered
  // fill would reach that curve at each corner and paint over the rim there.
  const inner = Math.max(0, radius - rim);
  return <View style={[styles.face, { borderRadius: radius, borderWidth: rim }, style]}>
    <LinearGradient colors={colors} style={[StyleSheet.absoluteFill, { borderRadius: inner }]} />
    {stroke ? <View pointerEvents="none" style={[styles.faceStroke, { borderRadius: inner }]} /> : null}
    {children}
  </View>;
}

/**
 * Which level the hero row is describing, and how much of it may be known. The
 * tile itself is framed above the panel, so the hero row carries no picture of
 * it: the current stage is pictured in its own slot instead, as the world is
 * drawing it right now (`currentArt`), and earlier stages show their own art.
 * The level being bought and everything after it stay a question mark: what a
 * level will look like is for the world to reveal, not the panel.
 */
export function useUpgradeLevelPick<Art>(levels: readonly UpgradeLevelEntry[], artFor: (level: number) => Art | null, currentArt?: Art | null, levelOffset = 0) {
  const focus = upgradeFocusLevel(levels);
  const [picked, setPicked] = useState<number | null>(null);
  const shown = levels.find((entry) => entry.level === picked) ?? focus;
  const onFocus = shown === focus;
  const ahead = shown?.state === 'ahead';
  const current = [...levels].reverse().find((entry) => entry.state === 'done')?.level ?? null;
  return {
    shown, onFocus, pick: setPicked, reset: () => setPicked(null),
    name: ahead ? '? ? ?' : shown?.name,
    description: ahead ? null : shown?.description,
    caption: !shown || onFocus ? null : shown.state === 'done' ? (shown.level === current ? 'Current stage' : 'Reached') : `Reach Level ${shown.level - 1 + levelOffset} first`,
    /** The stage the subject stands at now, for the slot that wears the marker. */
    current,
    /** A slot's picture: only a level already reached has one, and the current one is the world's own tile. */
    slotArt: (level: number) => levels.find((entry) => entry.level === level)?.state !== 'done' ? null : level === current ? currentArt ?? artFor(level) : artFor(level),
  };
}

/**
 * The pinned row under the title: what the subject becomes, a line about it,
 * and the action at full width. It carries no picture of the subject, which is
 * framed right above the panel; only something held or hidden gets a small
 * one (the friend resting there, the lock, the mist), because that is not what
 * the world is showing.
 */
export function UpgradeHero({ picture, name, description, action, caption, captionTone }: {
  picture?: { art?: ImageSourcePropType | null; /** The picture as a dark shape: someone not met yet. */ silhouette?: boolean; glyph?: string } | null;
  /** Omitted, the hero is its description (if any) and its action: the title bar already names the subject. */
  name?: string | null;
  description?: string | null;
  action?: ReactNode;
  /** A short line under the action (`Free`, `Reached`). */
  caption?: string | null;
  captionTone?: 'danger';
}) {
  return <View style={styles.hero}>
    {picture || name ? <View style={styles.heroTop}>
      {picture ? <View style={styles.mount}>
        <View style={styles.picture}>
          <LinearGradient colors={UpgradePanelUI.pictureLockedFace} style={StyleSheet.absoluteFill} />
          {picture.art ? <Image accessibilityIgnoresInvertColors cachePolicy="memory-disk" contentFit="contain" source={picture.art} style={[styles.pictureArt, picture.silhouette && styles.pictureSilhouette]} transition={0} />
            : <Text style={styles.pictureGlyph}>{picture.glyph ?? '?'}</Text>}
        </View>
      </View> : null}
      <View style={styles.heroText}>
        <Text numberOfLines={2} style={styles.heroName}>{name}</Text>
        <View style={styles.ornament}>
          <LinearGradient colors={[UpgradePanelUI.dividerFade[0], UpgradePanelUI.dividerFade[1]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ornamentRule} />
          <IconSymbol color={UpgradePanelUI.leaf} name="leaf.fill" size={11} />
          <LinearGradient colors={[UpgradePanelUI.dividerFade[1], UpgradePanelUI.dividerFade[0]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ornamentRule} />
        </View>
        {description ? <Text numberOfLines={3} style={styles.heroDescription}>{description}</Text> : null}
      </View>
    </View> : description ? <Text numberOfLines={3} style={styles.heroDescription}>{description}</Text> : null}
    {action ? <View>{action}</View> : null}
    {caption ? <View style={[styles.heroStatus, captionTone === 'danger' && styles.heroStatusDanger]}>
      <Text accessibilityLiveRegion="polite" style={[styles.heroCaption, captionTone === 'danger' && styles.heroCaptionDanger]}>{caption}</Text>
    </View> : null}
  </View>;
}

/** A card of its own on the body: a leaf, a heading, a rule fading away, and an aside at the far end. */
export function UpgradeSection({ label, aside, children }: { label: string; aside?: string; children: ReactNode }) {
  return <Face colors={UpgradePanelUI.cardFace} radius={UpgradePanelUI.cardRadius} style={styles.card}>
    <View style={styles.cardBody}>
      <View style={styles.sectionHead}>
        <IconSymbol color={UpgradePanelUI.leaf} name="leaf.fill" size={14} />
        <Text style={styles.sectionLabel}>{label}</Text>
        <LinearGradient colors={[UpgradePanelUI.dividerFade[1], UpgradePanelUI.dividerFade[0]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.sectionRule} />
        {aside ? <Text numberOfLines={1} style={styles.sectionAside}>{aside}</Text> : null}
      </View>
      {children}
    </View>
  </Face>;
}

/** One gain as a single strip: a chip naming it, then the stat (`3 +1`) or what is unlocked. */
export function UpgradeBenefitRow({ benefit }: { benefit: UpgradeBenefit }) {
  const stat = benefit.from != null && benefit.to != null;
  const numeric = typeof benefit.from === 'number' && typeof benefit.to === 'number';
  const changes = stat && benefit.from !== benefit.to;
  const gain = !changes ? null : benefit.delta ?? (numeric ? `${(benefit.to as number) >= (benefit.from as number) ? '+' : ''}${(benefit.to as number) - (benefit.from as number)}` : null);
  return <Face colors={UpgradePanelUI.rowFace} radius={UpgradePanelUI.rowRadius} style={styles.strip}>
    <View accessible accessibilityLabel={!stat ? `${benefit.label}${benefit.detail ? `. ${benefit.detail}` : ''}` : changes ? `${benefit.label}: ${benefit.from} to ${benefit.to}` : `${benefit.label}: ${benefit.from}`}
      accessibilityRole="text" style={styles.stripRow}>
      {/* What kind of number it is, at a glance: the same picture the rest of the game uses for it. */}
      {benefit.icon ? <View style={[styles.stripIcon, { backgroundColor: `${benefit.tint ?? UpgradePanelUI.leaf}22`, borderColor: `${benefit.tint ?? UpgradePanelUI.leaf}55` }]}>
        {benefit.icon === 'glow'
          ? <Image accessibilityIgnoresInvertColors contentFit="contain" source={GAME_CURRENCY_ART.coins} style={styles.stripIconArt} transition={0} />
          : <IconSymbol color={benefit.tint ?? UpgradePanelUI.leaf} name={benefit.icon} size={18} weight="bold" />}
      </View> : null}
      <Text numberOfLines={1} style={styles.stripLabel}>{benefit.label}</Text>
      {stat ? <View style={styles.stripValue}>
        <Text style={changes ? styles.statFrom : styles.statNow}>{benefit.from}</Text>
        {changes ? <>
          <IconSymbol color={UpgradePanelUI.successInk} name="arrow.right" size={13} weight="bold" />
          <Text style={styles.statTo}>{benefit.to}</Text>
          {gain ? <Face colors={UpgradePanelUI.successFace} radius={999} rim={1} style={styles.statGain} stroke={false}><Text style={styles.statGainText}>{gain}</Text></Face> : null}
        </> : null}
      </View> : <Text numberOfLines={2} style={[styles.stripValue, styles.stripDetail]}>{benefit.detail}</Text>}
    </View>
  </Face>;
}

/**
 * One thing the upgrade waits on: what it is, have / need in a pill (ticked
 * when met), and while it is short a bar and a way to go and work on it.
 */
export function UpgradeRequirementRow({ requirement, disabled, onAction }: {
  requirement: UpgradeRequirement; disabled?: boolean; onAction?: (requirement: UpgradeRequirement) => void;
}) {
  const counted = requirement.current != null && requirement.total != null;
  const amount = counted ? `${requirement.current!.toLocaleString()} / ${requirement.total!.toLocaleString()}` : null;
  const go = requirement.action && !requirement.met && onAction ? requirement.action : null;
  return <Face colors={requirement.met ? UpgradePanelUI.rowMetFace : UpgradePanelUI.rowFace} radius={UpgradePanelUI.rowRadius} style={requirement.met ? styles.requirementMet : styles.requirement}>
    <View style={styles.requirementBody}>
      {/* Read as one line; the Go button under it stays its own control. */}
      <View accessible accessibilityLabel={`${requirement.label}${amount ? `, ${amount}` : ''}. ${requirement.met ? 'Complete' : 'Not yet'}`} style={styles.requirementRow}>
        <Face colors={UpgradePanelUI.chipFace} radius={23} style={styles.mark}>
          {requirement.currency
            ? <Image accessibilityIgnoresInvertColors cachePolicy="memory-disk" contentFit="contain" source={GAME_CURRENCY_ART[requirement.currency]} style={styles.currencyArt} transition={0} />
            : <IconSymbol color={requirement.met ? UpgradePanelUI.leaf : UpgradePanelUI.inkFaint} name={requirement.met ? 'checkmark' : 'leaf.fill'} size={20} />}
        </Face>
        <View style={styles.requirementText}>
          <Text numberOfLines={1} style={styles.requirementLabel}>{requirement.label}</Text>
          {requirement.detail ? <Text numberOfLines={2} style={styles.requirementDetail}>{requirement.detail}</Text> : null}
        </View>
        {amount ? <Face colors={requirement.met ? UpgradePanelUI.successFace : UpgradePanelUI.dangerFace} radius={13} style={requirement.met ? styles.amountPillMet : styles.amountPill}>
          <View style={styles.amountRow}>
            {requirement.met ? <View style={styles.tick}><IconSymbol color={UpgradePanelUI.badgeInk} name="checkmark" size={11} /></View> : null}
            <Text style={[styles.amount, !requirement.met && styles.amountShort]}>{amount}</Text>
          </View>
        </Face> : null}
      </View>
      {counted && !requirement.met ? <View style={styles.requirementFoot}>
        <View style={styles.requirementBar}><ProgressBar current={requirement.current!} total={requirement.total!} color={UpgradePanelUI.barFillShort} variant="egg" /></View>
        {go ? <KatchaButton accessibilityLabel={`${go.label}. ${requirement.label}`} disabled={disabled} label={go.label} size="compact" variant="secondary" onPress={() => onAction!(requirement)} /> : null}
      </View> : null}
    </View>
  </Face>;
}

/**
 * The subject's road as a chain of slots. A reached level shows its picture; the
 * one being bought and everything after it show a question mark, so the panel
 * never spoils what the world will reveal. Picking a slot shows that level in
 * the hero row. A level gained while the panel is up (the Lantern's stays open)
 * pops its badge with a success tap.
 */
export function UpgradeLevelSlots({ levels, selected, current, levelOffset = 0, onSelect, artFor, disabled }: {
  levels: readonly UpgradeLevelEntry[]; selected: number | null; onSelect: (level: number) => void;
  /** The stage the subject stands at now: its slot wears a small marker. */
  current?: number | null;
  /** Added to every level shown (a tile counts from 0 inside, from 1 on screen). */
  levelOffset?: number;
  /** Asked only for levels already reached. */
  artFor?: (level: number) => ImageSourcePropType | null | undefined; disabled?: boolean;
}) {
  const reached = levels.filter((entry) => entry.state === 'done').length;
  const previous = useRef(reached);
  const [popped, setPopped] = useState<number | null>(null);
  useEffect(() => {
    const rose = reached > previous.current;
    previous.current = reached;
    if (!rose) return;
    setPopped([...levels].reverse().find((entry) => entry.state === 'done')?.level ?? null);
    if (Platform.OS === 'ios') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    const timer = setTimeout(() => setPopped(null), 700);
    return () => clearTimeout(timer);
  // Only a level actually gained replays this; the list's identity changes every render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reached]);
  // More stages than fit: the row scrolls, opened on the stage in play so the one before it and the one after it are
  // always on screen, however far along the road is.
  const scrolls = levels.length > SLOTS_THAT_FIT;
  const scroller = useRef<ScrollView>(null);
  const [rowWidth, setRowWidth] = useState(0);
  const focusIndex = Math.max(0, levels.findIndex((entry) => entry === upgradeFocusLevel(levels)));
  const contentWidth = levels.length * SLOT_OUTER + (levels.length - 1) * CONNECTOR + SLOT_ROW_PAD * 2;
  const centred = Math.max(0, Math.min(contentWidth - rowWidth, SLOT_ROW_PAD + focusIndex * (SLOT_OUTER + CONNECTOR) + SLOT_OUTER / 2 - rowWidth / 2));
  const opened = useRef(false);
  useEffect(() => {
    if (!scrolls || !rowWidth) return;
    // Placed without motion the first time, then it follows the road as levels are gained.
    scroller.current?.scrollTo({ x: centred, animated: opened.current });
    opened.current = true;
  }, [centred, rowWidth, scrolls]);
  if (levels.length < 2) return null;
  const row = levels.map((entry, index) => {
      const art = entry.state === 'done' ? artFor?.(entry.level) : null;
      const picked = entry.level === selected;
      const badge = <Text style={styles.badgeText}>{entry.level + levelOffset}</Text>;
      const badgeStyle = [styles.badge, entry.state === 'done' ? styles.badgeDone : entry.state === 'next' ? styles.badgeNext : styles.badgeAhead];
      return <Fragment key={entry.level}>
        {index > 0 ? <View style={[styles.connector, scrolls && styles.connectorFixed]}><View style={styles.connectorDot} /><View style={styles.connectorDot} /></View> : null}
        <Pressable accessibilityRole="radio" accessibilityState={{ selected: picked, disabled }}
          accessibilityLabel={`Level ${entry.level + levelOffset}${entry.state === 'ahead' ? '' : `, ${entry.name}`}. ${entry.level === current ? 'Current stage' : entry.state === 'done' ? 'Reached' : entry.state === 'next' ? 'Next' : 'Not yet known'}`}
          disabled={disabled} onPress={() => onSelect(entry.level)} style={({ pressed }) => [styles.slotHit, pressed && styles.slotPressed]}>
          <Face colors={entry.state === 'done' ? UpgradePanelUI.slotDoneFace : entry.state === 'next' ? UpgradePanelUI.slotNextFace : UpgradePanelUI.slotAheadFace} radius={16} rim={2}
            style={[entry.state === 'done' ? styles.slotDone : entry.state === 'next' ? styles.slotNext : styles.slotAhead, picked && styles.slotPicked]}>
            <View style={styles.slotBody}>
              {art ? <Image accessibilityIgnoresInvertColors cachePolicy="memory-disk" contentFit="contain" source={art} style={styles.slotArt} transition={0} />
                : <Text style={[styles.slotUnknown, entry.state === 'next' && styles.slotUnknownNext]}>?</Text>}
            </View>
          </Face>
          {entry.level === popped ? <PoppingBadge style={badgeStyle}>{badge}</PoppingBadge> : <View style={badgeStyle}>{badge}</View>}
          {entry.level === current ? <View style={styles.nowTag}><Text style={styles.nowText}>Now</Text></View> : null}
        </Pressable>
      </Fragment>;
    });
  return scrolls
    ? <ScrollView ref={scroller} horizontal accessibilityRole="radiogroup" showsHorizontalScrollIndicator={false} contentOffset={{ x: centred, y: 0 }}
      onLayout={(event) => setRowWidth(event.nativeEvent.layout.width)} style={styles.slotScroll} contentContainerStyle={styles.slotScrollContent}>{row}</ScrollView>
    : <View accessibilityRole="radiogroup" style={styles.slots}>{row}</View>;
}

function PoppingBadge({ style, children }: { style: object[]; children: ReactNode }) {
  const reduced = useReducedMotion();
  const pop = useSharedValue(reduced ? 1 : 0.4);
  useEffect(() => {
    if (!reduced) pop.value = withSequence(withTiming(1.6, { duration: 180 }), withTiming(1, { duration: 260 }));
  }, [pop, reduced]);
  const motion = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  return <Animated.View style={[...style, motion]}>{children}</Animated.View>;
}

const SLOT = 62;
/** A slot with its rim, the dots between two slots, and the row's own padding: the scroller's arithmetic. */
const SLOT_OUTER = SLOT + 4;
const CONNECTOR = 28;
const SLOT_ROW_PAD = 6;
const SLOTS_THAT_FIT = 4;
const PICTURE = 64;
const styles = StyleSheet.create({
  // Plain circular corners: the stroke inside the rim is inset by the rim's width, which is only concentric on a true arc.
  face: { overflow: 'hidden' },
  faceStroke: { ...StyleSheet.absoluteFillObject, borderColor: UpgradePanelUI.innerStroke, borderWidth: 1.5 },
  hero: { gap: 10 },
  heroTop: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  // A thick pale mount with its own rim, the picture under an open sky inside it.
  mount: { backgroundColor: UpgradePanelUI.mount, borderColor: UpgradePanelUI.mountBorder, borderRadius: 16, borderWidth: 1.5, padding: 4 },
  picture: { alignItems: 'center', borderRadius: 11, height: PICTURE, justifyContent: 'center', overflow: 'hidden', width: PICTURE },
  pictureArt: { height: PICTURE - 8, width: PICTURE - 8 },
  pictureSilhouette: { opacity: 0.78, tintColor: UpgradePanelUI.ink },
  pictureGlyph: { color: UpgradePanelUI.slotUnknownInk, fontFamily: AppFontFamilies.fredokaBold, fontSize: 32, lineHeight: 38 },
  heroText: { flex: 1, gap: 4 },
  heroName: { ...KatchaUI.type.companionCardTitle, color: UpgradePanelUI.ink, fontSize: 22, lineHeight: 26 },
  ornament: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  ornamentRule: { flex: 1, height: 1.5 },
  heroDescription: { ...KatchaUI.type.companionBody, color: UpgradePanelUI.inkSoft, fontSize: 13, lineHeight: 18 },
  heroStatus: { alignSelf: 'center', backgroundColor: UpgradePanelUI.row, borderColor: UpgradePanelUI.rowBorder, borderRadius: 999, borderWidth: 1.5, paddingHorizontal: 12, paddingVertical: 3 },
  heroStatusDanger: { backgroundColor: UpgradePanelUI.dangerFace[0], borderColor: UpgradePanelUI.dangerBorder },
  heroCaption: { ...KatchaUI.type.companionBody, color: UpgradePanelUI.inkSoft, fontSize: 12, fontWeight: '800', lineHeight: 16 },
  heroCaptionDanger: { color: UpgradePanelUI.danger },
  card: { borderColor: UpgradePanelUI.cardBorder },
  cardBody: { gap: 10, padding: 12 },
  sectionHead: { alignItems: 'center', flexDirection: 'row', gap: 7 },
  sectionLabel: { ...KatchaUI.type.companionCardTitle, color: UpgradePanelUI.ink, fontSize: 15, lineHeight: 19 },
  sectionRule: { flex: 1, height: 1.5 },
  sectionAside: { ...KatchaUI.type.companionBody, color: UpgradePanelUI.inkFaint, fontSize: 11.5, lineHeight: 15 },
  strip: { borderColor: UpgradePanelUI.rowBorder },
  stripRow: { alignItems: 'center', flexDirection: 'row', gap: 9, minHeight: 46, paddingHorizontal: 9, paddingVertical: 6 },
  stripIcon: { alignItems: 'center', borderRadius: 10, borderWidth: 1, height: 32, justifyContent: 'center', width: 32 },
  stripIconArt: { height: 22, width: 22 },
  stripLabel: { ...KatchaUI.type.companionCardTitle, color: UpgradePanelUI.ink, flexShrink: 1, fontSize: 15, lineHeight: 19 },
  stripValue: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 6, justifyContent: 'flex-end' },
  stripDetail: { ...KatchaUI.type.companionBody, color: UpgradePanelUI.ink, fontSize: 13, fontWeight: '700', lineHeight: 17, textAlign: 'right' },
  // Now, quietly; next, loudly. The eye should land on the new number.
  statFrom: { ...KatchaUI.type.companionCardTitle, color: UpgradePanelUI.inkSoft, fontSize: 15, fontVariant: ['tabular-nums'], lineHeight: 19 },
  statNow: { ...KatchaUI.type.companionCardTitle, color: UpgradePanelUI.ink, fontSize: 17, fontVariant: ['tabular-nums'], lineHeight: 21 },
  statTo: { ...KatchaUI.type.companionCardTitle, color: UpgradePanelUI.successInk, fontSize: 19, fontVariant: ['tabular-nums'], lineHeight: 23 },
  statGain: { borderColor: UpgradePanelUI.rowMetBorder, paddingHorizontal: 7, paddingVertical: 1 },
  statGainText: { ...KatchaUI.type.companionCardTitle, color: UpgradePanelUI.successInk, fontSize: 12, lineHeight: 16, fontVariant: ['tabular-nums'] },
  requirement: { borderColor: UpgradePanelUI.rowBorder },
  requirementMet: { borderColor: UpgradePanelUI.rowMetBorder },
  requirementBody: { gap: 8, padding: 9 },
  requirementRow: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  requirementText: { flex: 1, gap: 1 },
  requirementLabel: { ...KatchaUI.type.companionCardTitle, color: UpgradePanelUI.ink, fontSize: 16, lineHeight: 20 },
  requirementDetail: { ...KatchaUI.type.companionBody, color: UpgradePanelUI.inkSoft, fontSize: 12, lineHeight: 16 },
  requirementFoot: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  requirementBar: { flex: 1 },
  mark: { alignItems: 'center', borderColor: UpgradePanelUI.rowBorder, height: 46, justifyContent: 'center', width: 46 },
  currencyArt: { width: 32, height: 32 },
  amountPill: { borderColor: UpgradePanelUI.dangerBorder },
  amountPillMet: { borderColor: UpgradePanelUI.rowMetBorder },
  amountRow: { alignItems: 'center', flexDirection: 'row', gap: 6, paddingHorizontal: 10, paddingVertical: 5 },
  tick: { alignItems: 'center', backgroundColor: UpgradePanelUI.badgeDone, borderRadius: 9, height: 18, justifyContent: 'center', width: 18 },
  amount: { ...KatchaUI.type.companionCardTitle, color: UpgradePanelUI.successInk, fontSize: 15, lineHeight: 19, fontVariant: ['tabular-nums'] },
  amountShort: { color: UpgradePanelUI.danger },
  slots: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 8, paddingTop: 8 },
  connector: { flexDirection: 'row', gap: 4 },
  connectorFixed: { justifyContent: 'center', width: CONNECTOR },
  // Room above for the Now tag and below for the level tag; the card's padding is given back so the row runs edge to edge.
  slotScroll: { marginHorizontal: -12 },
  slotScrollContent: { alignItems: 'center', paddingBottom: 8, paddingHorizontal: SLOT_ROW_PAD + 12, paddingTop: 8 },
  connectorDot: { backgroundColor: UpgradePanelUI.connector, borderRadius: 2, height: 4, width: 4 },
  slotHit: { alignItems: 'center' },
  slotPressed: { transform: [{ scale: 0.95 }] },
  slotBody: { alignItems: 'center', height: SLOT, justifyContent: 'center', width: SLOT },
  slotDone: { borderColor: UpgradePanelUI.slotDoneBorder },
  slotNext: { borderColor: UpgradePanelUI.slotNextBorder },
  slotAhead: { borderColor: UpgradePanelUI.slotAheadBorder },
  // The picked slot glows instead of wearing brackets.
  slotPicked: { borderColor: UpgradePanelUI.slotNextBorder, boxShadow: UpgradePanelUI.slotPickedGlow },
  slotArt: { height: SLOT - 8, width: SLOT - 8 },
  slotUnknown: { color: UpgradePanelUI.slotUnknownInk, fontFamily: AppFontFamilies.fredokaBold, fontSize: 30, lineHeight: 35 },
  slotUnknownNext: { color: UpgradePanelUI.slotNextInk },
  // The level sits on the slot's lower edge, like a tag.
  badge: { alignItems: 'center', borderColor: UpgradePanelUI.badgeBorder, borderRadius: 9, borderWidth: 1.5, height: 22, justifyContent: 'center', marginTop: -13, minWidth: 28, paddingHorizontal: 6 },
  badgeDone: { backgroundColor: UpgradePanelUI.badgeDone },
  badgeNext: { backgroundColor: UpgradePanelUI.badgeNext },
  badgeAhead: { backgroundColor: UpgradePanelUI.badgeAhead },
  nowTag: { backgroundColor: UpgradePanelUI.levelPillFace[1], borderColor: UpgradePanelUI.levelPillBorder, borderRadius: 999, borderWidth: 1, paddingHorizontal: 6, position: 'absolute', top: -7 },
  nowText: { color: UpgradePanelUI.levelPillInk, fontFamily: AppFontFamilies.fredokaBold, fontSize: 10, lineHeight: 13 },
  badgeText: { color: UpgradePanelUI.badgeInk, fontFamily: AppFontFamilies.fredokaBold, fontSize: 13, lineHeight: 16 },
});
