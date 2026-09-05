import { MossproutNoticeChoices } from './mossprout-notice-choices';
import Animated from 'react-native-reanimated';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Image } from 'expo-image';
import { DayActionActiveRow, DayActionCompletedRow, type DayActionSourceRect } from '@/components/katchadeck/ui/day-action-row';
import { DayActionCardSurface, DayActionRewardChip } from '@/components/katchadeck/ui/day-action-card';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { katchimeraActionArt } from '@/constants/katchimera-action-art';
import { COMPANION_BOND_REWARDS, type CompanionBondAwardReceipt } from '@/utils/companion-bond';
import { useCompanionCalendarDay } from '@/hooks/use-companion-calendar-day';
import { MOSSPROUT_LIFE_TITLES, mossproutLifeActivityId, mossproutNoticePrompt, NATURE_PHOTO_CHOICES, type MossproutLifeActivity } from '@/utils/mossprout-life-activities';
import { acknowledgeMossproutLifeCompletion, beginMossproutNatureCapture, cancelMossproutNatureCapture, commitMossproutLifeCompletion,
  loadMossproutLifeActivities, prepareMossproutLifeCompletion, subscribeMossproutLifeActivities,
  type MossproutLifeCompletion, type MossproutNaturePhoto } from '@/utils/mossprout-life-activity-storage';
import { CompanionSceneOverlay, useCompanionActionNavigation } from './companion-scene-overlay';
import { CompanionChoiceList } from './companion-choice-list';
import { MossproutWaterAction } from './mossprout-water-action';

type Mode = 'menu' | 'notice' | 'photo-confirm' | 'photo-question' | 'no-match' | 'response' | 'saving' | 'error';
type Answer = { kind: MossproutLifeActivity; answer: string; response: string; photo?: MossproutNaturePhoto };
export function MossproutLifeActivityCard({ onOpenChange, onNarration, onBondRewardRequest }: {
  onOpenChange: (open: boolean) => void; onNarration?: (text: string | null) => void;
  onBondRewardRequest?: (source: DayActionSourceRect, arrive: () => void, receipt?: CompanionBondAwardReceipt) => void;
}) {
  const router = useRouter();
  const returnTo = usePathname();
  const navigation = useCompanionActionNavigation();
  const dayId = useCompanionCalendarDay();
  const { height, width } = useWindowDimensions();
  const [state, setState] = useState(loadMossproutLifeActivities);
  const [open, setOpen] = useState(false);
  const [waterBusy, setWaterBusy] = useState(false);
  const [mode, setMode] = useState<Mode>('menu');
  const [photo, setPhoto] = useState<MossproutNaturePhoto>();
  const [answer, setAnswer] = useState<Answer>();
  const [flight, setFlight] = useState<MossproutLifeCompletion>();
  const [error, setError] = useState('');
  const [noticeReply, setNoticeReply] = useState<string | null>(null);
  const requestRevision = useRef(0);
  const [prompt, setPrompt] = useState(() => mossproutNoticePrompt(dayId));
  const pendingId = useRef<string | undefined>(undefined);
  const handledCapture = useRef<string | undefined>(undefined);
  const recovering = useRef(false);
  const alive = useRef(true);
  const slideOpened = useRef(false);
  useLayoutEffect(() => {
    if (open && !slideOpened.current) navigation?.navigate(true);
    slideOpened.current = open;
  }, [navigation, open]);
  const showError = useCallback((message: string) => { setError(message); setMode('error'); }, []);
  useFocusEffect(useCallback(() => {
    // A dismissed camera or a restored route must not strand a capturing session.
    try { if (loadMossproutLifeActivities().capture?.phase === 'capturing') cancelMossproutNatureCapture(); }
    catch { setOpen(true); showError('The camera could not close its last moment. Shall we try again?'); }
  }, [showError]));
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => subscribeMossproutLifeActivities((reset) => {
    setState(loadMossproutLifeActivities());
    if (!reset) return;
    requestRevision.current++; pendingId.current = undefined; handledCapture.current = undefined; recovering.current = false;
    setAnswer(undefined); setPhoto(undefined); setFlight(undefined); setNoticeReply(null); setMode('menu');
  }), []);
  useLayoutEffect(() => { onOpenChange(open); return () => onOpenChange(false); }, [onOpenChange, open]);
  const saveCompletion = useCallback(async (id: string) => {
    const revision = requestRevision.current;
    pendingId.current = id; setMode('saving');
    try {
      const complete = await commitMossproutLifeCompletion(id);
      if (!alive.current || requestRevision.current !== revision) return;
      pendingId.current = undefined; setAnswer(undefined); setPhoto(undefined); setFlight(complete.presentedAt ? undefined : complete); setMode('menu');
    } catch { if (alive.current && requestRevision.current === revision) showError('That moment could not be saved yet. Shall we try again?'); }
  }, [showError]);
  useEffect(() => {
    if (recovering.current) return;
    const pending = Object.values(state.completions).find((item) => !item.presentedAt);
    if (!pending) return;
    recovering.current = true; setOpen(true);
    if (pending.status === 'pending') void saveCompletion(pending.id);
    else { setFlight(pending); setMode('menu'); }
  }, [saveCompletion, state.completions]);
  useEffect(() => {
    const capture = state.capture;
    if (capture?.phase !== 'ready' || handledCapture.current === capture.id) return;
    handledCapture.current = capture.id; setOpen(true); pendingId.current = undefined;
    if (!capture.photo) { showError(capture.error ?? 'That photo could not be saved. Shall we try again?'); return; }
    setPhoto(capture.photo);
    setMode(capture.photo.match === 'ready' ? 'photo-question' : capture.photo.match === 'no_match' ? 'no-match' : 'photo-confirm');
  }, [showError, state.capture]);
  const narration = !open ? null : mode === 'notice' ? prompt.prompt
    : mode === 'photo-confirm' ? 'I’m not quite sure what I can see. What did you find?'
    : mode === 'photo-question' ? 'A little green neighbour! What caught your eye?'
    : mode === 'no-match' ? 'I couldn’t find something growing in that photo. A plant, tree, or flower would be lovely.'
    : mode === 'response' ? answer?.response ?? null
    : mode === 'saving' ? noticeReply ?? 'Let’s keep this little moment.'
    : mode === 'error' ? error : mode === 'menu' ? noticeReply : null;
  useEffect(() => { onNarration?.(narration); return () => onNarration?.(null); }, [narration, onNarration]);
  const camera = () => {
    setNoticeReply(null);
    try {
      const capture = beginMossproutNatureCapture(); setMode('menu'); setPhoto(undefined);
      router.push({ pathname: '/moment-capture', params: { companionActivityId: capture.id, companionReturnTo: returnTo } });
    } catch { showError('The camera could not open. You can try again or notice something nearby.'); }
  };
  const back = () => {
    setNoticeReply(null);
    if (mode === 'menu') {
      if (navigation) navigation.navigate(false, () => setOpen(false));
      else setOpen(false);
    }
    else {
      try { if (photo || state.capture) cancelMossproutNatureCapture(); }
      catch { showError('That moment could not be put away yet. Shall we try again?'); return; }
      setPhoto(undefined); setAnswer(undefined); setMode('menu');
    }
  };
  const finishAnswer = (value = answer) => {
    if (!value) return;
    try { recovering.current = true; const pending = prepareMossproutLifeCompletion(value); void saveCompletion(pending.id); }
    catch { showError('That moment could not be saved yet. Shall we try again?'); }
  };
  const art = (kind: MossproutLifeActivity | 'gateway') => <Image contentFit="contain" transition={0}
    source={katchimeraActionArt(kind === 'photo' ? 'today:photo' : kind === 'notice' ? 'mossprout:nature-observation' : 'mossprout:plant-care')}
    style={{ width: 48, height: 48 }} />;
  const reward = <DayActionRewardChip reward={{ kind: 'bond', amount: COMPANION_BOND_REWARDS.life_activity_completed }} />;
  const activity = (kind: MossproutLifeActivity) => {
    if (flight?.kind === kind) return <DayActionCompletedRow key={flight.id} enteringEnabled={false} animateLayout artwork={art(kind)} title={MOSSPROUT_LIFE_TITLES[kind]}
      reward={reward} start
      onRewardRequest={flight.receipt && onBondRewardRequest ? (source, arrive) => onBondRewardRequest(source, arrive, flight.receipt) : undefined}
      onFinished={() => {
        try { acknowledgeMossproutLifeCompletion(flight.id); setFlight(undefined); recovering.current = false; }
        catch { showError('Your moment is saved. Shall we finish putting it away?'); }
      }} />;
    if (state.completions[mossproutLifeActivityId(dayId, kind)]?.status === 'complete') return null;
    return <DayActionActiveRow key={kind} enteringEnabled={false} label={MOSSPROUT_LIFE_TITLES[kind]}>
      <Pressable accessibilityRole="button" disabled={Boolean(flight) || waterBusy} onPress={kind === 'photo' ? camera : () => { setNoticeReply(null); setPrompt(mossproutNoticePrompt(dayId)); setMode('notice'); }}>
        <DayActionCardSurface artwork={art(kind)} title={MOSSPROUT_LIFE_TITLES[kind]} reward={reward} />
      </Pressable>
    </DayActionActiveRow>;
  };
  const choices = mode === 'notice' ? [
    ...prompt.choices.map((choice) => ({ id: choice.id, label: choice.label })), { id: 'later', label: 'Not right now' },
  ] : mode === 'photo-confirm' ? [{ id: 'plant', label: 'A plant or tree' }, { id: 'flowers', label: 'Flowers' }, { id: 'other', label: 'Something else' }]
    : mode === 'photo-question' ? [...NATURE_PHOTO_CHOICES]
    : mode === 'response' ? [{ id: 'done', label: 'Done' }, { id: 'later', label: 'Not right now' }]
    : mode === 'no-match' ? [{ id: 'retake', label: 'Retake photo' }]
    : mode === 'error' ? [{ id: 'retry', label: 'Try again' }] : [];
  const select = (id: string) => {
    if (id === 'later') { back(); return; }
    if (mode === 'notice') {
      const choice = prompt.choices.find((item) => item.id === id);
      if (choice) {
        const selected: Answer = { kind: 'notice', answer: choice.label, response: choice.reply };
        setAnswer(selected); setNoticeReply(choice.reply); finishAnswer(selected);
      }
    } else if (mode === 'photo-confirm' && photo) {
      if (id === 'other') { setMode('no-match'); return; }
      const qualityId = id === 'flowers' ? 'nature.flowers' : 'nature.plants';
      setPhoto({ ...photo, confirmedSubject: id === 'flowers' ? 'Flowers' : 'A plant or tree', memory: { ...photo.memory,
        qualities: [...photo.memory.qualities.filter((item) => item.qualityId !== qualityId), { qualityId, score: 1, status: 'confirmed', centrality: 'primary', sources: [], reasons: ['Confirmed by the player'] }] } });
      setMode('photo-question');
    } else if (mode === 'photo-question' && photo) {
      const choice = NATURE_PHOTO_CHOICES.find((item) => item.id === id);
      if (choice) { setAnswer({ kind: 'photo', answer: choice.label, response: choice.reply, photo }); setMode('response'); }
    } else if (mode === 'response') finishAnswer();
    else if (id === 'retake') camera();
    else if (id === 'retry') {
      if (pendingId.current) void saveCompletion(pendingId.current);
      else if (answer) finishAnswer();
      else if (flight) { try { acknowledgeMossproutLifeCompletion(flight.id); setFlight(undefined); recovering.current = false; setMode('menu'); } catch { showError(error); } }
      else if (state.capture?.error) camera();
      else setMode('menu');
    }
  };
  return <>
    <DayActionActiveRow label="Grow with Mossprout">
      <Pressable accessibilityRole="button" accessibilityLabel="Grow with Mossprout" onPress={() => { setOpen(true); setMode('menu'); }}>
        <DayActionCardSurface artwork={art('gateway')} title="Grow with Mossprout" subtitle="Water, a nature photo, or a quiet moment." />
      </Pressable>
    </DayActionActiveRow>
    <CompanionSceneOverlay visible={open}>
      <Animated.View collapsable={false} style={navigation?.destinationStyle} pointerEvents={navigation?.busy ? 'none' : 'auto'}>
        <ScrollView nestedScrollEnabled removeClippedSubviews={false} showsVerticalScrollIndicator={false}
          style={{ maxHeight: Math.max(240, height * 0.53), marginHorizontal: -width }}
          contentContainerStyle={{ paddingHorizontal: width, gap: 8, paddingBottom: 4 }}>
          <View collapsable={false} style={{ opacity: mode === 'menu' ? 1 : 0 }} pointerEvents={mode === 'menu' ? 'auto' : 'none'}
            accessibilityElementsHidden={mode !== 'menu'} importantForAccessibility={mode === 'menu' ? 'auto' : 'no-hide-descendants'}>
            <View style={{ gap: 8 }}>
              <MossproutWaterAction disabled={Boolean(flight)} onBusyChange={setWaterBusy} enteringEnabled={false} onBondRewardRequest={onBondRewardRequest} onError={showError} />
              {activity('photo')}{activity('notice')}
            </View>
          </View>
          <KatchaButton label="Back" disabled={mode === 'saving' || Boolean(flight) || waterBusy} onPress={back} />
        </ScrollView>
        {mode !== 'menu' ? <View style={{ position: 'absolute', bottom: 64, left: 0, right: 0 }}>
          {mode === 'notice' ? <MossproutNoticeChoices options={choices} onSelect={select} /> : <CompanionChoiceList presentation="single-column" disabled={mode === 'saving'} options={choices} onSelect={select} />}
        </View> : null}
      </Animated.View>
    </CompanionSceneOverlay>
  </>;
}
