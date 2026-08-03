import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KatchaDialog } from '@/components/katchadeck/ui/katcha-dialog';
import { CompanionGameBackdrop } from '@/components/katchadeck/world/companion-game-backdrop';
import { CompanionBackAction } from '@/components/katchadeck/world/companion-ui-primitives';
import { BlockBlastGameShell } from '@/components/katchadeck/world/quests/block-blast-game-shell';
import { QuestExperienceHost } from '@/components/katchadeck/world/quests/quest-experience-host';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { katchimeraSkinById } from '@/constants/katchimera-skins';
import { AppFontFamilies, Lantern } from '@/constants/theme';
import { useAllDays } from '@/hooks/use-all-days';
import { homeRepository } from '@/storage/repositories/home-repository';
import { questBondEventKind, recordCompanionBondEvent } from '@/utils/companion-bond';
import { loadCompanionBondState, saveCompanionBondState } from '@/utils/companion-bond-storage';
import { resolveCreatureArtSource } from '@/utils/creature-art';
import { gameCatalogEntry } from '@/utils/game-hub';
import { companionQuestPresentation } from '@/utils/companion-interaction';
import { companionIdResolverForHomeState, identityForCreature } from '@/utils/katchimera-identity';
import {
  cancelQuestAttempt,
  completeInteractiveQuest,
  gameHubQuestFor,
  loadCompanionQuests,
  releaseGameHubQuest,
  saveCompanionQuests,
  startQuestAttempt,
} from '@/utils/katchimera-quests';
import { applyWardrobeToKingdom } from '@/utils/katchimera-wardrobe';
import { loadKatchimeraWardrobe } from '@/utils/katchimera-wardrobe-storage';
import { deriveKingdom } from '@/utils/kingdom-engine';
import { questDefinition } from '@/utils/quests/definitions';
import { isInteractiveExecution, type QuestResult } from '@/utils/quests/experiences/types';
import { questExperienceHistory } from '@/utils/quests/interactive-session';
import {
  todayKatchimeraExplorationBackgroundKeyForEnvironment,
  todayKatchimeraExplorationBackgroundKeyForFamily,
} from '@/utils/today-exploration-backgrounds';
import { localDayId } from '@/utils/world-identity-rules';

function loadState() {
  const homeState = homeRepository.load();
  const resolveCompanionId = companionIdResolverForHomeState(homeState);
  return { homeState, resolveCompanionId, quests: loadCompanionQuests(resolveCompanionId) };
}

export function GameHubGameRouteScreen() {
  const { creatureId = '', questId = '' } = useLocalSearchParams<{ creatureId: string; questId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { days } = useAllDays({ refreshOnFocus: false });
  const initial = useMemo(loadState, []);
  const wardrobe = useMemo(loadKatchimeraWardrobe, []);
  const kingdom = useMemo(
    () => applyWardrobeToKingdom(deriveKingdom(days), wardrobe),
    [days, wardrobe],
  );
  const quest = gameHubQuestFor(initial.quests, creatureId, questId);
  const definition = questDefinition(questId);
  const execution = definition?.execution;
  const entry = gameCatalogEntry(questId);
  const presentation = companionQuestPresentation(isInteractiveExecution(execution) ? execution : null);
  const fullBleed = presentation.layout === 'fullBleed';
  const isBlockBlast = execution?.kind === 'block_blast';
  const companion = useMemo(
    () => kingdom.creatures.find((creature) => (
      identityForCreature({ ...creature, encounterProfileId: null })?.companionId === creatureId
    )) ?? null,
    [creatureId, kingdom.creatures],
  );
  const companionIdentity = companion
    ? identityForCreature({ ...companion, encounterProfileId: null })
    : null;
  const visualKey = companion?.visualKey ?? entry?.visualKey ?? null;
  const companionName = companion && companionIdentity
    ? katchimeraSkinById.get(companionIdentity.skinId)?.displayName ?? companion.name
    : entry?.companionName ?? 'Katchimera';
  const environmentKey = visualKey
    ? todayKatchimeraExplorationBackgroundKeyForEnvironment(visualKey)
      ?? todayKatchimeraExplorationBackgroundKeyForFamily(entry?.familyId)
    : null;
  const creatureArt = visualKey ? resolveCreatureArtSource(visualKey) : null;
  const valid = Boolean(quest && entry && visualKey && creatureArt && isInteractiveExecution(execution));
  const [runningAttemptId, setRunningAttemptId] = useState<string | null>(null);
  const [confirmExit, setConfirmExit] = useState(false);
  const completionInFlight = useRef(false);
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const returnToGames = useCallback(() => {
    router.dismissTo('/games');
  }, [router]);

  const abandon = useCallback(() => {
    if (!quest?.questRunId) {
      returnToGames();
      return;
    }
    const latest = loadState();
    const cancelled = runningAttemptId
      ? cancelQuestAttempt(latest.quests, runningAttemptId)
      : latest.quests;
    saveCompanionQuests(releaseGameHubQuest(cancelled, quest.questRunId));
    returnToGames();
  }, [quest?.questRunId, returnToGames, runningAttemptId]);

  const requestExit = useCallback(() => {
    if (runningAttemptId) setConfirmExit(true);
    else abandon();
  }, [abandon, runningAttemptId]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      requestExit();
      return true;
    });
    return () => subscription.remove();
  }, [requestExit]);

  useEffect(() => () => {
    if (exitTimer.current) clearTimeout(exitTimer.current);
  }, []);

  const startAttempt = useCallback((configSnapshot: Record<string, unknown>) => {
    if (!quest?.questRunId || !isInteractiveExecution(execution)) return '';
    const latest = loadState();
    const active = gameHubQuestFor(latest.quests, creatureId, questId);
    if (!active) return '';
    const started = startQuestAttempt(latest.quests, {
      questId,
      creatureId,
      dayId: localDayId(),
      seed: active.offerSeed ?? `${creatureId}:${questId}`,
      executionKind: execution.kind,
      configSnapshot,
      questRunId: active.questRunId,
    });
    saveCompanionQuests(started.state);
    setRunningAttemptId(started.attempt.id);
    return started.attempt.id;
  }, [creatureId, execution, quest?.questRunId, questId]);

  const cancelAttempt = useCallback((attemptId: string) => {
    const latest = loadState();
    saveCompanionQuests(cancelQuestAttempt(latest.quests, attemptId));
    setRunningAttemptId((current) => current === attemptId ? null : current);
  }, []);

  const completeAttempt = useCallback((attemptId: string, result: QuestResult) => {
    completionInFlight.current = true;
    if (exitTimer.current) clearTimeout(exitTimer.current);
    const latest = loadState();
    const completedAt = Date.now();
    const dayId = localDayId(new Date(completedAt));
    const next = completeInteractiveQuest(latest.quests, { attemptId, creatureId, result, dayId }, completedAt);
    saveCompanionQuests(next);
    const bondState = loadCompanionBondState(next, latest.resolveCompanionId, latest.homeState);
    const bond = recordCompanionBondEvent(bondState, {
      id: `mini-game:${creatureId}:${dayId}`,
      creatureId,
      kind: questBondEventKind(definition),
      occurredAt: completedAt,
      dayId,
    });
    if (bond.awarded) saveCompanionBondState(bond.state);
    setRunningAttemptId(null);
    returnToGames();
  }, [creatureId, definition, returnToGames]);

  const handleRunningChange = useCallback((running: boolean, attemptId?: string | null) => {
    if (running) {
      if (exitTimer.current) clearTimeout(exitTimer.current);
      setRunningAttemptId(attemptId ?? null);
      return;
    }
    setRunningAttemptId(null);
    // A game-owned back control ends its run by reporting running=false. The
    // companion flow then returns to its quest surface; this route mirrors that
    // lifecycle but returns to Games. Completion reports false immediately
    // before onComplete, so defer long enough for completion to claim the exit.
    exitTimer.current = setTimeout(() => {
      if (!completionInFlight.current) abandon();
    }, 0);
  }, [abandon]);

  if (!valid || !quest || !entry || !visualKey || !creatureArt || !isInteractiveExecution(execution)) {
    return (
      <View style={[styles.invalid, { paddingBottom: insets.bottom + 24, paddingTop: insets.top + 24 }]}>
        <IconSymbol name="exclamationmark.triangle.fill" size={29} color={Lantern.ember300} />
        <ThemedText selectable style={styles.invalidTitle} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>This game is no longer ready</ThemedText>
        <ThemedText selectable style={styles.invalidBody} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>Return to Games and launch a fresh round.</ThemedText>
        <Pressable accessibilityRole="button" onPress={returnToGames} style={styles.returnButton}>
          <ThemedText style={styles.returnLabel} lightColor="#23170A" darkColor="#23170A">Back to Games</ThemedText>
        </Pressable>
      </View>
    );
  }

  const history = questExperienceHistory(initial.quests, questId, quest.resolvedConfig ?? {});
  const experience = (
    <QuestExperienceHost
      handlers={{
        onAttemptCancel: cancelAttempt,
        onAttemptStart: startAttempt,
        onComplete: completeAttempt,
        onRequestExit: requestExit,
        onRunningChange: handleRunningChange,
      }}
      history={history}
      session={{
        execution,
        config: quest.resolvedConfig ?? {},
        seed: quest.offerSeed ?? `${creatureId}:${questId}`,
        startImmediately: true,
      }}
    />
  );
  return (
    <View style={styles.screen}>
      {isBlockBlast ? (
        <BlockBlastGameShell>{experience}</BlockBlastGameShell>
      ) : (
        <>
          <CompanionGameBackdrop
            backgroundKey={environmentKey}
            creature={creatureArt}
            name={companionName}
            strong={presentation.backdrop === 'strong'}
            visualKey={visualKey}
          />
          {!fullBleed ? (
            <View style={[styles.gameBackPosition, { top: insets.top + 10 }]}>
              <CompanionBackAction label="Games" onPress={requestExit} tone="night" />
            </View>
          ) : null}
          <View style={[
            styles.experience,
            !fullBleed && {
              paddingBottom: Math.max(10, insets.bottom + 8),
              paddingHorizontal: 14,
              paddingTop: insets.top + 64,
            },
          ]}>
            {experience}
          </View>
        </>
      )}
      <KatchaDialog
        body="Your current round will end and you’ll return to the Games hub. Your companion quest will stay exactly as it is."
        cancelLabel="Keep playing"
        confirmLabel="End round"
        onCancel={() => setConfirmExit(false)}
        onConfirm={abandon}
        open={confirmExit}
        title="Leave this game?"
        tone="warning"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#101318', flex: 1 },
  experience: { flex: 1, minHeight: 0, position: 'relative', zIndex: 3 },
  gameBackPosition: { left: 14, position: 'absolute', zIndex: 80 },
  invalid: { alignItems: 'center', backgroundColor: '#11131B', flex: 1, gap: 12, justifyContent: 'center', paddingHorizontal: 28 },
  invalidTitle: { fontFamily: AppFontFamilies.fredokaBold, fontSize: 28, lineHeight: 33, textAlign: 'center' },
  invalidBody: { fontFamily: AppFontFamilies.manrope, fontSize: 14, fontWeight: '600', lineHeight: 20, textAlign: 'center' },
  returnButton: { alignItems: 'center', backgroundColor: Lantern.ember300, borderRadius: 999, justifyContent: 'center', marginTop: 8, minHeight: 44, paddingHorizontal: 18 },
  returnLabel: { fontFamily: AppFontFamilies.manrope, fontSize: 13, fontWeight: '900' },
});
