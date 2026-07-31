import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { BlockBlastQuest } from '@/components/katchadeck/world/quests/block-blast-quest';
import { QuestExperienceAutoStartProvider } from '@/components/katchadeck/world/quests/quest-experience-ui';
import { homeRepository } from '@/storage/repositories/home-repository';
import { AppFontFamilies, Lantern } from '@/constants/theme';
import { questBondEventKind, recordCompanionBondEvent } from '@/utils/companion-bond';
import { loadCompanionBondState, saveCompanionBondState } from '@/utils/companion-bond-storage';
import { companionIdResolverForHomeState } from '@/utils/katchimera-identity';
import {
  cancelQuestAttempt,
  completeInteractiveQuest,
  loadCompanionQuests,
  questFor,
  saveCompanionQuests,
  startQuestAttempt,
} from '@/utils/katchimera-quests';
import { questDefinition } from '@/utils/quests/definitions';
import type { QuestResult } from '@/utils/quests/experiences/types';
import { localDayId } from '@/utils/world-identity-rules';
import { reportFlowReady } from '@/utils/flow-performance';

type BlockBlastConfig = {
  packId: 'cheerlet-party';
  rulesetId: 'cheerlet-block-party-v2';
  boardSize?: 8;
  mode?: 'endless';
};

function loadQuestState() {
  const homeState = homeRepository.load();
  const resolveCompanionId = companionIdResolverForHomeState(homeState);
  return {
    homeState,
    resolveCompanionId,
    quests: loadCompanionQuests(resolveCompanionId),
  };
}

/** A game-only route: no roster, companion sheet, journey UI, or image backdrop. */
export function BlockBlastRouteScreen({
  creatureId,
  questId,
}: {
  creatureId: string;
  questId: string;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const initial = useMemo(loadQuestState, []);
  const activeQuest = questFor(initial.quests, creatureId);
  const definition = questDefinition(questId);
  const execution = definition?.execution;
  const valid = Boolean(
    activeQuest
    && activeQuest.questId === questId
    && execution?.kind === 'block_blast',
  );
  const config = useMemo<BlockBlastConfig>(() => ({
    packId: 'cheerlet-party',
    rulesetId: 'cheerlet-block-party-v2',
    boardSize: 8,
    mode: 'endless',
    ...(activeQuest?.resolvedConfig as Partial<BlockBlastConfig> | undefined),
  }), [activeQuest?.resolvedConfig]);
  const seed = activeQuest?.offerSeed ?? `${creatureId}:${questId}:${localDayId()}`;

  useEffect(() => reportFlowReady('katchimera-block-blast'), []);

  const startAttempt = useCallback((configSnapshot: Record<string, unknown>) => {
    const latest = loadQuestState();
    const quest = questFor(latest.quests, creatureId);
    if (!quest || quest.questId !== questId) return '';
    const result = startQuestAttempt(latest.quests, {
      questId,
      creatureId,
      dayId: localDayId(),
      seed: quest.offerSeed ?? seed,
      executionKind: 'block_blast',
      configSnapshot,
    });
    saveCompanionQuests(result.state);
    return result.attempt.id;
  }, [creatureId, questId, seed]);

  const cancelAttempt = useCallback((attemptId: string) => {
    const latest = loadQuestState();
    saveCompanionQuests(cancelQuestAttempt(latest.quests, attemptId));
    router.back();
  }, [router]);

  const completeAttempt = useCallback((attemptId: string, result: QuestResult) => {
    const latest = loadQuestState();
    const completedAt = Date.now();
    const dayId = localDayId(new Date(completedAt));
    const nextQuestState = completeInteractiveQuest(latest.quests, {
      attemptId,
      creatureId,
      result,
      dayId,
    }, completedAt);
    saveCompanionQuests(nextQuestState);

    const bondState = loadCompanionBondState(
      nextQuestState,
      latest.resolveCompanionId,
      latest.homeState,
    );
    const bond = recordCompanionBondEvent(bondState, {
      id: `mini-game:${creatureId}:${dayId}`,
      creatureId,
      kind: questBondEventKind(definition),
      occurredAt: completedAt,
      dayId,
    });
    if (bond.awarded) saveCompanionBondState(bond.state);
    router.back();
  }, [creatureId, definition, router]);

  if (!valid) {
    return (
      <View style={[styles.invalid, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
        <IconSymbol name="exclamationmark.triangle.fill" size={28} color={Lantern.ember300} />
        <ThemedText selectable style={styles.invalidTitle} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
          This party is no longer available
        </ThemedText>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
          <ThemedText style={styles.backLabel} lightColor="#17121F" darkColor="#17121F">Back to Cheerlet</ThemedText>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <LinearGradient
        colors={['#17132C', '#0E0D1C', '#080912']}
        locations={[0, 0.54, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={{ flex: 1, paddingTop: insets.top + 8, paddingBottom: Math.max(10, insets.bottom + 8), paddingHorizontal: 14 }}>
        <QuestExperienceAutoStartProvider enabled>
          <BlockBlastQuest
            config={config}
            seed={seed}
            onAttemptStart={startAttempt}
            onAttemptCancel={cancelAttempt}
            onComplete={completeAttempt}
            onRunningChange={() => undefined}
          />
        </QuestExperienceAutoStartProvider>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#080912' },
  invalid: { alignItems: 'center', backgroundColor: '#11131B', flex: 1, gap: 18, justifyContent: 'center', paddingHorizontal: 28 },
  invalidTitle: { fontFamily: AppFontFamilies.instrumentSerif, fontSize: 28, lineHeight: 34, textAlign: 'center' },
  backButton: { backgroundColor: Lantern.ember300, borderCurve: 'continuous', borderRadius: 999, minHeight: 44, justifyContent: 'center', paddingHorizontal: 18 },
  backLabel: { fontSize: 13, fontWeight: '900' },
});
