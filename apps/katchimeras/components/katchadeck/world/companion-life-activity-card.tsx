import { MossproutNoticeChoices } from './mossprout-notice-choices';
import Animated from 'react-native-reanimated';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Image } from 'expo-image';
import type { GestureType } from 'react-native-gesture-handler';
import { DayActionActiveRow, DayActionCompletedRow, DAY_ACTION_MOTION, type DayActionSourceRect } from '@/components/katchadeck/ui/day-action-row';
import { DayActionCardSurface, DayActionRewardChip } from '@/components/katchadeck/ui/day-action-card';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { katchimeraActionArt } from '@/constants/katchimera-action-art';
import { noticePromptForDay, photoThanksForDay } from '@/constants/companion-daily/rotation';
import { hatchSupportInvitation } from '@/features/onboarding/hatch-profile-storage';
import { COMPANION_BOND_REWARDS, type CompanionBondAwardReceipt } from '@/utils/companion-bond';
import { useCompanionCalendarDay } from '@/hooks/use-companion-calendar-day';
import type { CompanionDailyConfig } from '@/types/companion-daily';
import { acknowledgeCompanionLifeCompletion, beginCompanionLifeCapture, cancelCompanionLifeCapture, commitCompanionLifeCompletion,
  companionLifeActivityId, loadCompanionLifeActivities, prepareCompanionLifeCompletion, subscribeCompanionLifeActivities,
  type CompanionLifeActivity, type CompanionLifeCompletion, type CompanionLifePhoto } from '@/utils/companion-life-activity-storage';
import { CompanionSceneOverlay, useCompanionActionNavigation } from './companion-scene-overlay';
import { CompanionChoiceList } from './companion-choice-list';
import { MossproutWaterAction } from './mossprout-water-action';

type Mode = 'menu' | 'notice' | 'photo-confirm' | 'photo-question' | 'no-match' | 'response' | 'saving' | 'error';
type Answer = { kind: CompanionLifeActivity; answer: string; response: string; photo?: CompanionLifePhoto };

/**
 * A friend's daily life activities, from their daily config: a photo of
 * what they asked for, one small thing noticed, and water, each worth Bond
 * once a day. A `menu` config keeps them behind one gateway card that
 * slides a submenu in (Mossprout); a `rows` config lays them flat among the
 * friend's other cards. Either way the dialogue after a photo or a prompt
 * plays in the scene overlay, and the camera answers through the friend's
 * capture session, so a relaunch mid-photo resumes where it was.
 */
export function CompanionLifeActivityCard({ companion, config, onOpenChange, onNarration, onBondRewardRequest, externalGesture }: {
  companion: string; config: CompanionDailyConfig;
  onOpenChange?: (open: boolean) => void; onNarration?: (text: string | null) => void;
  onBondRewardRequest?: (source: DayActionSourceRect, arrive: () => void, receipt?: CompanionBondAwardReceipt) => void;
  externalGesture?: GestureType;
}) {
  const inline = config.presentation === 'rows';
  const photoConfig = config.photo ?? null;
  const noticeConfig = config.notice ?? null;
  const router = useRouter();
  const returnTo = usePathname();
  const navigation = useCompanionActionNavigation();
  const dayId = useCompanionCalendarDay();
  const { height, width } = useWindowDimensions();
  const [state, setState] = useState(() => loadCompanionLifeActivities(companion));
  const [menuOpen, setMenuOpen] = useState(false);
  const [waterBusy, setWaterBusy] = useState(false);
  const [mode, setMode] = useState<Mode>('menu');
  const [photo, setPhoto] = useState<CompanionLifePhoto>();
  const [answer, setAnswer] = useState<Answer>();
  const [flight, setFlight] = useState<CompanionLifeCompletion>();
  const [error, setError] = useState('');
  const [noticeReply, setNoticeReply] = useState<string | null>(null);
  const requestRevision = useRef(0);
  const [prompt, setPrompt] = useState(() => noticeConfig ? noticePromptForDay(noticeConfig, dayId) : null);
  const pendingId = useRef<string | undefined>(undefined);
  const handledCapture = useRef<string | undefined>(undefined);
  const recovering = useRef(false);
  const alive = useRef(true);
  const slideOpened = useRef(false);
  // The overlay is open for the menu, or for any dialogue of a flat layout.
  const open = inline ? mode !== 'menu' : menuOpen;
  useLayoutEffect(() => {
    if (open && !slideOpened.current) navigation?.navigate(true);
    slideOpened.current = open;
  }, [navigation, open]);
  const showError = useCallback((message: string) => { setError(message); setMode('error'); }, []);
  useFocusEffect(useCallback(() => {
    // A dismissed camera or a restored route must not strand a capturing session.
    try { if (loadCompanionLifeActivities(companion).capture?.phase === 'capturing') cancelCompanionLifeCapture(companion); }
    catch { setMenuOpen(true); showError('The camera could not close its last moment. Shall we try again?'); }
  }, [companion, showError]));
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => subscribeCompanionLifeActivities((reset) => {
    setState(loadCompanionLifeActivities(companion));
    if (!reset) return;
    requestRevision.current++; pendingId.current = undefined; handledCapture.current = undefined; recovering.current = false;
    setAnswer(undefined); setPhoto(undefined); setFlight(undefined); setNoticeReply(null); setMode('menu');
  }), [companion]);
  useLayoutEffect(() => { onOpenChange?.(open); return () => onOpenChange?.(false); }, [onOpenChange, open]);
  const saveCompletion = useCallback(async (id: string) => {
    const revision = requestRevision.current;
    pendingId.current = id; setMode('saving');
    try {
      const complete = await commitCompanionLifeCompletion(companion, id);
      if (!alive.current || requestRevision.current !== revision) return;
      pendingId.current = undefined; setAnswer(undefined); setPhoto(undefined); setFlight(complete.presentedAt ? undefined : complete); setMode('menu');
    } catch { if (alive.current && requestRevision.current === revision) showError('That moment could not be saved yet. Shall we try again?'); }
  }, [companion, showError]);
  useEffect(() => {
    if (recovering.current) return;
    const pending = Object.values(state.completions).find((item) => !item.presentedAt);
    if (!pending) return;
    recovering.current = true; setMenuOpen(true);
    if (pending.status === 'pending') void saveCompletion(pending.id);
    else { setFlight(pending); setMode('menu'); }
  }, [saveCompletion, state.completions]);
  const finishAnswer = useCallback((value: Answer | undefined) => {
    if (!value) return;
    try { recovering.current = true; const pending = prepareCompanionLifeCompletion(companion, value); void saveCompletion(pending.id); }
    catch { showError('That moment could not be saved yet. Shall we try again?'); }
  }, [companion, saveCompletion, showError]);
  useEffect(() => {
    const capture = state.capture;
    if (!photoConfig || capture?.phase !== 'ready' || handledCapture.current === capture.id) return;
    handledCapture.current = capture.id; setMenuOpen(true); pendingId.current = undefined;
    if (!capture.photo) { showError(capture.error ?? 'That photo could not be saved. Shall we take it again?'); return; }
    setPhoto(capture.photo);
    const matched = capture.photo.match;
    if (matched === 'no_match') { setMode('no-match'); return; }
    // An unsure reading asks what was found when the friend has choices for it; a friend without them trusts the player.
    if (matched !== 'ready' && photoConfig.confirm?.length) { setMode('photo-confirm'); return; }
    if (photoConfig.followUps?.length) { setMode('photo-question'); return; }
    const thanks = photoThanksForDay(photoConfig, dayId);
    const selected: Answer = { kind: 'photo', answer: capture.photo.confirmedSubject ?? photoConfig.category, response: thanks, photo: capture.photo };
    setAnswer(selected); setNoticeReply(thanks); finishAnswer(selected);
  }, [dayId, finishAnswer, photoConfig, showError, state.capture]);
  const supportInvitation = hatchSupportInvitation(companion);
  const narration = !open && !inline ? null : mode === 'notice' ? prompt ? [supportInvitation, prompt.prompt].filter(Boolean).join('\n\n') : null
    : mode === 'photo-confirm' ? photoConfig?.lines.unsure ?? 'What did you find?'
    : mode === 'photo-question' ? photoConfig?.lines.question ?? 'What caught your eye?'
    : mode === 'no-match' ? photoConfig?.lines.noMatch ?? null
    : mode === 'response' ? answer?.response ?? null
    : mode === 'saving' ? noticeReply ?? config.savingLine ?? 'Let’s keep this little moment.'
    : mode === 'error' ? error : mode === 'menu' ? noticeReply : null;
  useEffect(() => { onNarration?.(narration); return () => onNarration?.(null); }, [narration, onNarration]);
  const camera = () => {
    if (!photoConfig) return;
    setNoticeReply(null);
    try {
      const capture = beginCompanionLifeCapture(companion); setMode('menu'); setPhoto(undefined);
      router.push({ pathname: '/moment-capture', params: { companionActivityId: capture.id, companionActivityFor: companion, companionReturnTo: returnTo } });
    } catch { showError('The camera could not open. You can try again or notice something nearby.'); }
  };
  const back = () => {
    setNoticeReply(null);
    if (mode === 'menu') {
      if (navigation) navigation.navigate(false, () => setMenuOpen(false));
      else setMenuOpen(false);
    }
    else {
      try { if (photo || state.capture) cancelCompanionLifeCapture(companion); }
      catch { showError('That moment could not be put away yet. Shall we try again?'); return; }
      setPhoto(undefined); setAnswer(undefined);
      if (inline && navigation) navigation.navigate(false, () => setMode('menu'));
      else setMode('menu');
    }
  };
  const artFor = (kind: CompanionLifeActivity | 'gateway') => <Image contentFit="contain" transition={0}
    source={katchimeraActionArt(kind === 'photo' ? photoConfig?.artKey : kind === 'notice' ? noticeConfig?.artKey : config.menu?.artKey)}
    style={{ width: 48, height: 48 }} />;
  const reward = <DayActionRewardChip reward={{ kind: 'bond', amount: COMPANION_BOND_REWARDS.life_activity_completed }} />;
  const activity = (kind: CompanionLifeActivity, index: number) => {
    const title = kind === 'photo' ? photoConfig?.title : noticeConfig?.title;
    if (!title) return null;
    if (flight?.kind === kind) return <DayActionCompletedRow key={flight.id} enteringEnabled={false} animateLayout artwork={artFor(kind)} title={title}
      reward={reward} start
      onRewardRequest={flight.receipt && onBondRewardRequest ? (source, arrive) => onBondRewardRequest(source, arrive, flight.receipt) : undefined}
      onFinished={() => {
        try { acknowledgeCompanionLifeCompletion(companion, flight.id); setFlight(undefined); recovering.current = false; }
        catch { showError('Your moment is saved. Shall we finish putting it away?'); }
      }} />;
    if (state.completions[companionLifeActivityId(companion, dayId, kind)]?.status === 'complete') return null;
    const busy = Boolean(flight) || waterBusy;
    return <DayActionActiveRow key={kind} enteringEnabled={false} animateLayout={inline} entryDelayMs={inline ? DAY_ACTION_MOTION.entryBaseDelayMs + index * DAY_ACTION_MOTION.entryStaggerMs : undefined}
      externalGesture={inline ? externalGesture : undefined} disabled={busy} label={title}>
      <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityHint={kind === 'photo' ? photoConfig?.subtitle : undefined} disabled={busy}
        onPress={kind === 'photo' ? camera : () => { setNoticeReply(null); if (noticeConfig) setPrompt(noticePromptForDay(noticeConfig, dayId)); setMode('notice'); }}>
        <DayActionCardSurface artwork={artFor(kind)} title={title} subtitle={inline && kind === 'photo' ? photoConfig?.subtitle : undefined} reward={reward} />
      </Pressable>
    </DayActionActiveRow>;
  };
  const choices = mode === 'notice' && prompt ? [
    ...prompt.choices.map((choice) => ({ id: choice.id, label: choice.label })), { id: 'later', label: 'Not right now' },
  ] : mode === 'photo-confirm' ? [...(photoConfig?.confirm ?? []).map((choice) => ({ id: choice.id, label: choice.label })), { id: 'other', label: 'Something else' }]
    : mode === 'photo-question' ? (photoConfig?.followUps ?? []).map((choice) => ({ id: choice.id, label: choice.label }))
    : mode === 'response' ? [{ id: 'done', label: 'Done' }, { id: 'later', label: 'Not right now' }]
    : mode === 'no-match' ? [{ id: 'retake', label: 'Retake photo' }]
    : mode === 'error' ? [{ id: 'retry', label: 'Try again' }] : [];
  const select = (id: string) => {
    if (id === 'later') { back(); return; }
    if (mode === 'notice' && prompt) {
      const choice = prompt.choices.find((item) => item.id === id);
      if (choice) {
        const selected: Answer = { kind: 'notice', answer: choice.label, response: choice.reply };
        setAnswer(selected); setNoticeReply(choice.reply); finishAnswer(selected);
      }
    } else if (mode === 'photo-confirm' && photo && photoConfig) {
      if (id === 'other') { setMode('no-match'); return; }
      const choice = photoConfig.confirm?.find((item) => item.id === id);
      if (!choice) return;
      const confirmed: CompanionLifePhoto = { ...photo, confirmedSubject: choice.subject, memory: { ...photo.memory,
        qualities: [...photo.memory.qualities.filter((item) => item.qualityId !== choice.qualityId), { qualityId: choice.qualityId, score: 1, status: 'confirmed', centrality: 'primary', sources: [], reasons: ['Confirmed by the player'] }] } };
      setPhoto(confirmed);
      if (photoConfig.followUps?.length) { setMode('photo-question'); return; }
      const thanks = photoThanksForDay(photoConfig, dayId);
      const selected: Answer = { kind: 'photo', answer: choice.subject, response: thanks, photo: confirmed };
      setAnswer(selected); setNoticeReply(thanks); finishAnswer(selected);
    } else if (mode === 'photo-question' && photo && photoConfig) {
      const choice = photoConfig.followUps?.find((item) => item.id === id);
      if (choice) { setAnswer({ kind: 'photo', answer: choice.label, response: choice.reply, photo }); setMode('response'); }
    } else if (mode === 'response') finishAnswer(answer);
    else if (id === 'retake') camera();
    else if (id === 'retry') {
      if (pendingId.current) void saveCompletion(pendingId.current);
      else if (answer) finishAnswer(answer);
      else if (flight) { try { acknowledgeCompanionLifeCompletion(companion, flight.id); setFlight(undefined); recovering.current = false; setMode('menu'); } catch { showError(error); } }
      else if (state.capture?.error) camera();
      else setMode('menu');
    }
  };
  const rows = <View style={{ gap: inline ? 7 : 8 }}>
    {config.water ? <MossproutWaterAction disabled={Boolean(flight)} onBusyChange={setWaterBusy} enteringEnabled={false} onBondRewardRequest={onBondRewardRequest} onError={showError} /> : null}
    {activity('photo', 0)}{activity('notice', 1)}
  </View>;
  const dialogue = mode !== 'menu' ? <View style={{ position: 'absolute', bottom: 64, left: 0, right: 0 }}>
    {mode === 'notice' ? <MossproutNoticeChoices options={choices} onSelect={select} /> : <CompanionChoiceList presentation="single-column" disabled={mode === 'saving'} options={choices} onSelect={select} />}
  </View> : null;
  const overlay = <CompanionSceneOverlay visible={open}>
    <Animated.View collapsable={false} style={navigation?.destinationStyle} pointerEvents={navigation?.busy ? 'none' : 'auto'}>
      <ScrollView nestedScrollEnabled removeClippedSubviews={false} showsVerticalScrollIndicator={false}
        style={{ maxHeight: Math.max(240, height * 0.53), marginHorizontal: -width }}
        contentContainerStyle={{ paddingHorizontal: width, gap: 8, paddingBottom: 4 }}>
        {!inline ? <View collapsable={false} style={{ opacity: mode === 'menu' ? 1 : 0 }} pointerEvents={mode === 'menu' ? 'auto' : 'none'}
          accessibilityElementsHidden={mode !== 'menu'} importantForAccessibility={mode === 'menu' ? 'auto' : 'no-hide-descendants'}>
          {rows}
        </View> : null}
        <KatchaButton label="Back" disabled={mode === 'saving' || Boolean(flight) || waterBusy} onPress={back} />
      </ScrollView>
      {dialogue}
    </Animated.View>
  </CompanionSceneOverlay>;
  if (inline) return <>{rows}{overlay}</>;
  const menu = config.menu ?? { title: 'Grow together', subtitle: '', artKey: photoConfig?.artKey ?? 'today:photo' };
  return <>
    <DayActionActiveRow label={menu.title}>
      <Pressable accessibilityRole="button" accessibilityLabel={menu.title} onPress={() => { setMenuOpen(true); setMode('menu'); }}>
        <DayActionCardSurface artwork={artFor('gateway')} title={menu.title} subtitle={menu.subtitle} />
      </Pressable>
    </DayActionActiveRow>
    {overlay}
  </>;
}
