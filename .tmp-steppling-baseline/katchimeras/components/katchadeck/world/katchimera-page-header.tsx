import { createContext, use, useEffect, useMemo, useState, type ReactNode, type RefObject } from 'react';
import { StyleSheet, useWindowDimensions, View, type View as ViewType } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BondIconArt } from '@/components/katchadeck/ui/bond-icon-art';
import { runRewardIconArrivalPulse } from '@/components/katchadeck/ui/reward-arrival-motion';
import { GameCurrencyHud } from '@/components/katchadeck/ui/game-currency-hud';
import { KatchimeraBackButton } from '@/components/katchadeck/ui/katchimera-back-button';
import { ThemedText } from '@/components/themed-text';
import { AppFontFamilies } from '@/constants/theme';
import { GAME_CURRENCY_ART } from '@/constants/game-currency-art';
import { GameUI } from '@/constants/game-ui';
import { useGameWallet } from '@/features/ui/game-wallet-provider';
import { companionBondProgress, type CompanionBondProgress } from '@/utils/companion-bond';
import { loadCompanionBondState, subscribeCompanionBondState } from '@/utils/companion-bond-storage';

type KatchimeraPageHeaderChromeMode = 'standard' | 'hosted' | 'hidden';

const KatchimeraPageHeaderChromeContext = createContext<KatchimeraPageHeaderChromeMode>('standard');

export function KatchimeraPageHeaderChromeProvider({ children, mode }: {
  children: ReactNode;
  mode: KatchimeraPageHeaderChromeMode;
}) {
  return (
    <KatchimeraPageHeaderChromeContext.Provider value={mode}>
      {children}
    </KatchimeraPageHeaderChromeContext.Provider>
  );
}

export function KatchimeraPageHeader({
  bondProgress: suppliedBondProgress,
  creatureId,
  includeSafeArea = true,
  bondIconTargetRef,
  bondRewardPulseKey = 0,
  bondTargetRef,
  navigationLocked = false,
  hideBack = false,
  onBack,
}: {
  bondProgress?: CompanionBondProgress;
  creatureId?: string;
  includeSafeArea?: boolean;
  bondIconTargetRef?: RefObject<ViewType | null>;
  bondRewardPulseKey?: number;
  bondTargetRef?: RefObject<ViewType | null>;
  navigationLocked?: boolean;
  hideBack?: boolean;
  onBack: () => void;
}) {
  const chromeMode = use(KatchimeraPageHeaderChromeContext);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const compact = width < 360;
  const reduceMotion = useReducedMotion();
  const medallionScale = useSharedValue(0);
  const medallionGlow = useSharedValue(0);
  const wallet = useGameWallet();
  const [bondState, setBondState] = useState(loadCompanionBondState);
  useEffect(() => subscribeCompanionBondState(() => setBondState(loadCompanionBondState())), []);
  const loadedBondProgress = useMemo(
    () => creatureId ? companionBondProgress(bondState, creatureId) : undefined,
    [bondState, creatureId],
  );
  const bondProgress = suppliedBondProgress ?? loadedBondProgress;
  const relationshipTarget = bondProgress
    ? bondProgress.totalPoints + bondProgress.relationshipPointsRemaining
    : 0;
  useEffect(() => {
    if (!bondRewardPulseKey) return;
    runRewardIconArrivalPulse(medallionScale, reduceMotion);
    runRewardIconArrivalPulse(medallionGlow, reduceMotion);
  }, [bondRewardPulseKey, medallionGlow, medallionScale, reduceMotion]);
  useEffect(() => () => {
    cancelAnimation(medallionScale);
    cancelAnimation(medallionGlow);
  }, [medallionGlow, medallionScale]);
  const medallionPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + medallionScale.value * 0.23 }],
  }));
  const medallionGlowStyle = useAnimatedStyle(() => ({
    opacity: medallionGlow.value,
    transform: [{ scale: 0.82 + medallionGlow.value * 0.48 }],
  }));
  if (chromeMode === 'hidden' || (chromeMode === 'hosted' && !bondProgress)) return null;
  return (
    <View style={[styles.root, includeSafeArea && { minHeight: insets.top + 58 }]}>
      {chromeMode === 'standard' ? <View style={styles.backSlot}>{!hideBack ? <KatchimeraBackButton compact={compact} disabled={navigationLocked} onPress={onBack} /> : null}</View> : null}
      {bondProgress ? (
        <View
          ref={bondTargetRef}
          accessibilityLabel={`${bondProgress.relationshipStage} bond, ${Math.round(bondProgress.relationshipStageRatio * 100)} percent to the next stage`}
          style={[styles.bondPill, compact && styles.bondPillCompact]}>
          <Animated.View
            collapsable={false}
            ref={bondIconTargetRef}
            style={[styles.bondMedallion, compact && styles.bondMedallionCompact, medallionPulseStyle]}>
            <Animated.View pointerEvents="none" style={[styles.medallionGlow, medallionGlowStyle]} />
            <View pointerEvents="none" style={styles.medallionHighlight} />
            <BondIconArt size={compact ? 35 : 43} />
          </Animated.View>
          <View style={[styles.bondCopy, compact && styles.bondCopyCompact]}>
            <ThemedText numberOfLines={1} style={[styles.bondLabel, compact && styles.bondLabelCompact]} lightColor="#3E2D1E" darkColor="#3E2D1E">{bondProgress.relationshipStage}</ThemedText>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${Math.max(bondProgress.totalPoints ? 6 : 0, bondProgress.relationshipStageRatio * 100)}%` }]} />
              <View pointerEvents="none" style={styles.trackShine} />
              <ThemedText
                numberOfLines={1}
                style={styles.trackValue}
                lightColor="#51351D"
                darkColor="#51351D">
                {bondProgress.totalPoints}/{relationshipTarget}
              </ThemedText>
            </View>
          </View>
        </View>
      ) : null}
      {chromeMode === 'standard' ? <View style={styles.currencySlot}>
        <GameCurrencyHud
          balances={[{ art: GAME_CURRENCY_ART.coins, id: 'coins', value: wallet.coins }]}
          style={styles.currencyHud}
          tone="glass"
        />
      </View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', minHeight: 58, paddingHorizontal: 12, position: 'relative', width: '100%', zIndex: 20 },
  backSlot: { bottom: 0, left: 14, position: 'absolute', zIndex: 3 },
  currencySlot: { bottom: 8, position: 'absolute', right: 8, width: 92, zIndex: 3 },
  bondPill: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#F8E8C6',
    borderColor: '#C99137',
    borderCurve: 'continuous',
    borderRadius: 24,
    borderWidth: 2,
    bottom: 1,
    boxShadow: '0 6px 16px rgba(75,42,17,0.24), inset 0 2px 0 rgba(255,255,255,0.9), inset 0 -3px 0 rgba(184,119,34,0.2)',
    flexDirection: 'row',
    height: 48,
    paddingRight: 13,
    position: 'absolute',
    width: 180,
  },
  bondPillCompact: { height: 44, width: 138 },
  bondMedallion: { alignItems: 'center', backgroundColor: '#F6DC9D', borderColor: '#C28A2F', borderRadius: 999, borderWidth: 2, height: 54, justifyContent: 'center', left: -6, position: 'absolute', width: 54 },
  bondMedallionCompact: { height: 48, left: -4, width: 48 },
  medallionGlow: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,198,74,0.42)', borderColor: 'rgba(255,238,153,0.92)', borderRadius: 999, borderWidth: 2, boxShadow: '0 0 16px rgba(255,184,54,0.78)' },
  medallionHighlight: { ...StyleSheet.absoluteFillObject, borderColor: 'rgba(255,255,255,0.7)', borderRadius: 999, borderWidth: 1, margin: 3 },
  bondCopy: { gap: 1, marginLeft: 52, minWidth: 0, width: 107 },
  bondCopyCompact: { marginLeft: 44, width: 84 },
  bondLabel: { fontFamily: AppFontFamilies.fredokaBold, fontSize: 15, fontWeight: '700', letterSpacing: -0.2, lineHeight: 17, textAlign: 'center' },
  bondLabelCompact: { fontSize: 12.5, lineHeight: 14 },
  track: { alignItems: 'center', backgroundColor: '#D9B873', borderColor: 'rgba(133,83,27,0.25)', borderRadius: 999, borderWidth: 1, height: 13, justifyContent: 'center', overflow: 'hidden', position: 'relative' },
  fill: { backgroundColor: '#F14D7B', borderRadius: 999, bottom: 0, left: 0, position: 'absolute', top: 0 },
  trackShine: { backgroundColor: 'rgba(255,255,255,0.35)', borderRadius: 999, height: 2, left: 4, position: 'absolute', right: 4, top: 1 },
  trackValue: { ...GameUI.type.numeric, fontFamily: GameUI.type.title.fontFamily, fontSize: 9.5, letterSpacing: -0.15, lineHeight: 11, textAlign: 'center', zIndex: 2 },
  currencyHud: { justifyContent: 'flex-end' },
});
