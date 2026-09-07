import { FtueGrowDialogue } from './ftue-grow-dialogue';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { DayActionCardSurface, DayActionRewardChip } from '@/components/katchadeck/ui/day-action-card';
import { DayActionActiveRow, DayActionCompletedRow, type DayActionSourceRect } from '@/components/katchadeck/ui/day-action-row';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { katchimeraActionArt } from '@/constants/katchimera-action-art';
import { advanceFtueActionDurably, loadFtueRun, useFtueRun } from '@/features/onboarding/ftue-runtime';
import { MOSSPROUT_GARDEN_RETURN, MOSSPROUT_FIRST_NOTICE } from '@/features/onboarding/mossprout-first-grow';
import { completeFirstNotice, loadFirstNoticeCompletion } from '@/features/onboarding/mossprout-first-grow-runtime';
import { acknowledgeMossproutLifeCompletion, commitMossproutLifeCompletion, type MossproutLifeCompletion } from '@/utils/mossprout-life-activity-storage';
import { COMPANION_BOND_REWARDS, type CompanionBondAwardReceipt } from '@/utils/companion-bond';

export function MossproutFirstGrowStage({ onNarration, onBondRewardRequest }: {
  onNarration?: (text: string | null) => void;
  onBondRewardRequest?: (source: DayActionSourceRect, arrive: () => void, receipt: CompanionBondAwardReceipt) => void;
}) {
  const run = useFtueRun();
  const [open, setOpen] = useState(run?.stepId === 'companion.first_notice');
  const [finishing, setFinishing] = useState(false);
  const [flight, setFlight] = useState<MossproutLifeCompletion>();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const alive = useRef(true);
  const retry = useRef<() => Promise<unknown>>(async () => {});
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const recovered = useRef<string | null>(null);
  const perform = useCallback(async (work: () => Promise<unknown>) => {
    if (pending.current) return;
    pending.current = true; retry.current = work; setBusy(true); setError(null);
    try { await work(); }
    catch { if (alive.current) setError('That moment could not be saved. Shall we try again?'); }
    finally { pending.current = false; if (alive.current) setBusy(false); }
  }, []);
  const advance = useCallback((actionId: string, optionId?: string) => advanceFtueActionDurably({
    expectedStepId: 'companion.first_notice', actionId, optionId,
  }), []);
  const present = useCallback(async (completion: MossproutLifeCompletion) => {
    const done = completion.status === 'pending' ? await commitMossproutLifeCompletion(completion.id) : completion;
    if (!alive.current) return;
    if (done.presentedAt) await advance('companion.complete_first_notice', done.answer);
    else { setOpen(true); setFlight(done); }
  }, [advance]);
  useEffect(() => {
    if (run?.stepId !== 'companion.first_notice' || finishing || busy || pending.current || recovered.current === run.runId) return;
    recovered.current = run.runId;
    void perform(async () => {
      const completion = loadFirstNoticeCompletion();
      if (completion) await present(completion);
    });
  }, [busy, finishing, perform, present, run?.runId, run?.stepId]);
  const returning = run?.stepId === 'companion.water_together';
  const reply = MOSSPROUT_GARDEN_RETURN.choices.find((choice) => choice.id === run?.answers['companion.choose_garden_return']?.optionId)?.reply;
  const narration = error ?? flight?.response ?? (returning ? MOSSPROUT_GARDEN_RETURN.prompt
    : open ? MOSSPROUT_FIRST_NOTICE.prompt
    : [reply, MOSSPROUT_GARDEN_RETURN.invitation].filter(Boolean).join('\n\n'));
  const showingDialogue = returning || ((open || run?.stepId === 'companion.first_grow') && !flight);
  useEffect(() => { onNarration?.(showingDialogue || finishing || flight ? null : narration); return () => onNarration?.(null); }, [narration, showingDialogue, finishing, flight, onNarration]);
  const artwork = <Image contentFit="contain" transition={0} source={katchimeraActionArt('mossprout:nature-observation')} style={{ width: 48, height: 48 }} />;
  const reward = <DayActionRewardChip reward={{ kind: 'bond', amount: COMPANION_BOND_REWARDS.life_activity_completed }} />;
  const retryCard = error ? <KatchaButton label="Try again" onPress={() => void perform(retry.current)} disabled={busy} /> : null;
  const finishNotice = async (id: string, gardenChoice?: string) => {
    setFinishing(true);
    await perform(async () => {
      // Cross every authored checkpoint after the modal has closed. Reload after
      // each durable write so a retry resumes instead of replaying a stale edge.
      if (loadFtueRun()?.stepId === 'companion.water_together') {
        if (!gardenChoice) throw new Error('Choose a Garden reply first.');
        await advanceFtueActionDurably({ expectedStepId: 'companion.water_together', actionId: 'companion.choose_garden_return', optionId: gardenChoice });
      }
      if (loadFtueRun()?.stepId === 'companion.first_grow') {
        await advanceFtueActionDurably({ expectedStepId: 'companion.first_grow', actionId: 'companion.open_first_grow' });
      }
      if (id === 'later') await advance('companion.skip_first_notice', 'skipped');
      else await present(await completeFirstNotice(id));
    });
  };
  const noticeChoices = [...MOSSPROUT_FIRST_NOTICE.choices, { id: 'later', label: 'Not now', reply: 'Of course. We can notice something together another time.' }];
  if (finishing && !flight) return <View collapsable={false}>{retryCard}</View>;
  if (returning) return <FtueGrowDialogue key="garden-return" runId={run!.runId} id="garden-return"
    prompt={MOSSPROUT_GARDEN_RETURN.prompt} choices={MOSSPROUT_GARDEN_RETURN.choices} invitation={MOSSPROUT_GARDEN_RETURN.invitation}
    nextDialogue={{ id: 'first-notice', prompt: MOSSPROUT_FIRST_NOTICE.prompt, choices: noticeChoices }}
    onFinish={finishNotice} />;
  if ((open || run?.stepId === 'companion.first_grow') && !flight) return <FtueGrowDialogue key="first-notice" runId={run?.runId ?? 'first-session'} id="first-notice"
    prompt={MOSSPROUT_FIRST_NOTICE.prompt} choices={noticeChoices} onFinish={finishNotice} />;
  // FTUE replaces a single control group at its natural height. It does not
  // need a retained root, measured footprint, or submenu navigation animation.
  return <View collapsable={false} style={{ gap: 8 }}>
    {open && !returning ? <View style={{ gap: 8 }}>
      {flight ? <DayActionCompletedRow animateLayout={false} enteringEnabled={false} artwork={artwork} title="Notice one small thing" reward={reward}
        onRewardRequest={flight.receipt && onBondRewardRequest ? (source, arrive) => onBondRewardRequest(source, arrive, flight.receipt!) : undefined}
        onFinished={() => void perform(async () => {
          acknowledgeMossproutLifeCompletion(flight.id);
          await advance('companion.complete_first_notice', flight.answer);
        })} /> : null}
      {retryCard}
    </View> : <View style={{ gap: 8 }}>
      <DayActionActiveRow animateLayout={false} enteringEnabled={false} label="Notice one small thing">
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => void perform(async () => {
          if (run?.stepId === 'companion.first_grow') await advanceFtueActionDurably({ expectedStepId: 'companion.first_grow', actionId: 'companion.open_first_grow' });
          if (alive.current) setOpen(true);
        })}><DayActionCardSurface artwork={artwork} title="Notice one small thing" reward={reward} /></Pressable>
      </DayActionActiveRow>{!open ? retryCard : null}
    </View>}
  </View>;
}
