import { memo, useMemo, useRef, type Ref } from 'react';
import { Pressable, StyleSheet, Text, View, type View as NativeView } from 'react-native';
import Animated, { FadeIn, FadeOut, useReducedMotion } from 'react-native-reanimated';

import { AppFontFamilies } from '@/constants/theme';
import type { HavenTilePresentation } from '@/utils/haven-tile-presentation';
import type { KingdomResidentScreenAnchor } from './kingdom-hex-canvas';

type HudFrame = { bottom: number; left: number; right: number; top: number };

type Props = {
  anchors: readonly KingdomResidentScreenAnchor[];
  bottomInset: number;
  height: number;
  interactionCharacterId?: string | null;
  onOpen: (creatureId: string) => void;
  onTargetRef?: (characterId: string, node: NativeView | null) => void;
  presentations: readonly HavenTilePresentation[];
  selectedCreatureId: string | null;
  topInset: number;
  width: number;
};

function intersects(a: HudFrame, b: HudFrame) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

export const HavenTileHudLayer = memo(function HavenTileHudLayer({
  anchors,
  bottomInset,
  height,
  interactionCharacterId,
  onOpen,
  onTargetRef,
  presentations,
  selectedCreatureId,
  topInset,
  width,
}: Props) {
  const reduceMotion = useReducedMotion();
  const anchorByCreature = useMemo(() => new Map(anchors.map((anchor) => [anchor.creatureId, anchor])), [anchors]);
  const onTargetRefValue = useRef(onTargetRef);
  onTargetRefValue.current = onTargetRef;
  const targetRefCallbacks = useRef(new Map<string, (node: NativeView | null) => void>());
  const visible = useMemo(() => {
    const candidates = presentations
      .filter((presentation) => (
        presentation.creatureId === selectedCreatureId
        || presentation.storyReady
      ))
      .filter((presentation) => anchorByCreature.has(presentation.creatureId))
      .sort((left, right) => {
        const leftSelected = left.creatureId === selectedCreatureId ? 1 : 0;
        const rightSelected = right.creatureId === selectedCreatureId ? 1 : 0;
        if (leftSelected !== rightSelected) return rightSelected - leftSelected;
        const priority = { affordable: 3, upgrade_ready: 2, saving: 1, story_locked: 0, complete: 0 } as const;
        return priority[right.hudState] - priority[left.hudState];
      });
    const occupied: HudFrame[] = [];
    return candidates.flatMap((presentation) => {
      const anchor = anchorByCreature.get(presentation.creatureId)!;
      const expanded = presentation.creatureId === selectedCreatureId;
      const cardWidth = expanded ? Math.min(212, width - 24) : 154;
      const cardHeight = expanded ? 116 : 76;
      const left = Math.max(12, Math.min(width - cardWidth - 12, anchor.x - cardWidth / 2));
      const top = Math.max(topInset + 76, Math.min(height - bottomInset - cardHeight - 64, anchor.y - cardHeight - 12));
      const frame = { left, right: left + cardWidth, top, bottom: top + cardHeight };
      if (!expanded && occupied.some((other) => intersects(frame, other))) return [];
      occupied.push(frame);
      return [{ cardHeight, cardWidth, expanded, frame, presentation }];
    });
  }, [anchorByCreature, bottomInset, height, presentations, selectedCreatureId, topInset, width]);

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {visible.map(({ cardWidth, expanded, frame, presentation }) => {
        const allowed = !interactionCharacterId || interactionCharacterId === presentation.characterId;
        const nextName = presentation.next?.name ?? 'Signature Haven';
        const cta = presentation.hudState === 'complete'
          ? 'View'
          : presentation.storyReady
            ? 'Upgrade'
            : 'View';
        let targetRef = targetRefCallbacks.current.get(presentation.characterId);
        if (!targetRef) {
          const characterId = presentation.characterId;
          targetRef = (node) => onTargetRefValue.current?.(characterId, node);
          targetRefCallbacks.current.set(characterId, targetRef);
        }
        return (
          <Animated.View
            entering={reduceMotion ? undefined : FadeIn.duration(180)}
            exiting={reduceMotion ? undefined : FadeOut.duration(120)}
            key={presentation.creatureId}
            style={[styles.positioner, { left: frame.left, top: frame.top, width: cardWidth }]}> 
            <View
              collapsable={false}
              ref={targetRef as Ref<NativeView>}
              style={[styles.card, expanded && styles.cardExpanded, presentation.affordable && styles.cardAffordable]}>
              <View style={styles.headingRow}>
                <View style={styles.headingCopy}>
                  <Text numberOfLines={1} style={styles.name}>{presentation.creatureName}</Text>
                  <Text numberOfLines={1} style={styles.level}>HAVEN LV{presentation.currentStage}</Text>
                </View>
                {presentation.affordable ? <View style={styles.readyDot}><Text style={styles.readyDotText}>!</Text></View> : null}
              </View>
              <Text numberOfLines={1} style={styles.nextName}>{nextName}</Text>
              {presentation.next ? (
                <>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${Math.round(presentation.coinProgress * 100)}%` }]} />
                  </View>
                  <View style={styles.footerRow}>
                    <Text style={styles.requirement}>
                      {presentation.storyReady ? `${presentation.coins} / ${presentation.coinCost} Coins` : 'Story locked'}
                    </Text>
                    <Pressable
                      accessibilityLabel={`${cta} ${presentation.creatureName}'s Haven`}
                      accessibilityRole="button"
                      disabled={!allowed || presentation.hudState === 'saving'}
                      hitSlop={8}
                      onPress={() => onOpen(presentation.creatureId)}
                      style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed, !allowed && styles.ctaDisabled]}>
                      <Text style={styles.ctaText}>{presentation.hudState === 'saving' ? 'Saving…' : cta}</Text>
                    </Pressable>
                  </View>
                </>
              ) : (
                <Pressable
                  accessibilityLabel={`View ${presentation.creatureName}'s completed Haven`}
                  accessibilityRole="button"
                  disabled={!allowed}
                  onPress={() => onOpen(presentation.creatureId)}
                  style={({ pressed }) => [styles.completeCta, pressed && styles.ctaPressed]}>
                  <Text style={styles.completeText}>Signature Haven complete · View</Text>
                </Pressable>
              )}
            </View>
          </Animated.View>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  positioner: { position: 'absolute', zIndex: 40 },
  card: {
    backgroundColor: 'rgba(22,29,25,0.94)',
    borderColor: 'rgba(215,238,192,0.38)',
    borderCurve: 'continuous',
    borderRadius: 17,
    borderWidth: 1,
    boxShadow: '0 8px 22px rgba(11,18,14,0.36)',
    gap: 4,
    minHeight: 76,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  cardExpanded: { minHeight: 116, paddingHorizontal: 14, paddingVertical: 12 },
  cardAffordable: { borderColor: 'rgba(255,219,112,0.72)', boxShadow: '0 8px 24px rgba(93,72,18,0.38)' },
  headingRow: { alignItems: 'center', flexDirection: 'row', gap: 7 },
  headingCopy: { flex: 1, minWidth: 0 },
  name: { color: '#F8FCFF', fontFamily: AppFontFamilies.fredokaBold, fontSize: 15, lineHeight: 18 },
  level: { color: '#B7D98B', fontFamily: AppFontFamilies.manrope, fontSize: 8, fontWeight: '900', letterSpacing: 0.75 },
  nextName: { color: '#E6EEDC', fontFamily: AppFontFamilies.manrope, fontSize: 10, fontWeight: '800' },
  readyDot: { alignItems: 'center', backgroundColor: '#FFD36E', borderRadius: 10, height: 20, justifyContent: 'center', width: 20 },
  readyDotText: { color: '#45320A', fontFamily: AppFontFamilies.fredokaBold, fontSize: 14 },
  progressTrack: { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 99, height: 5, overflow: 'hidden' },
  progressFill: { backgroundColor: '#FFD36E', borderRadius: 99, height: '100%' },
  footerRow: { alignItems: 'center', flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  requirement: { color: '#D6E2CA', flex: 1, fontFamily: AppFontFamilies.manrope, fontSize: 9, fontVariant: ['tabular-nums'], fontWeight: '800' },
  cta: { alignItems: 'center', backgroundColor: '#F0B946', borderRadius: 99, justifyContent: 'center', minHeight: 30, minWidth: 60, paddingHorizontal: 10 },
  ctaPressed: { opacity: 0.82, transform: [{ scale: 0.97 }] },
  ctaDisabled: { opacity: 0.45 },
  ctaText: { color: '#332507', fontFamily: AppFontFamilies.manrope, fontSize: 9, fontWeight: '900' },
  completeCta: { minHeight: 30, justifyContent: 'center' },
  completeText: { color: '#FFE19A', fontFamily: AppFontFamilies.manrope, fontSize: 9, fontWeight: '900' },
});
