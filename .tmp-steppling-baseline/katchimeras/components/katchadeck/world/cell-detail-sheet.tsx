import { useEffect, useState } from 'react';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Image } from 'expo-image';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ActionTile } from '@/components/katchadeck/ui/action-tile';
import { KatchaSheet } from '@/components/katchadeck/ui/katcha-sheet';
import { PLACE_CATEGORIES } from '@/components/katchadeck/world/place-prompt-sheet';
import { DayMemoryStrip } from '@/components/katchadeck/world/day-memory-strip';
import { Lantern } from '@/constants/theme';
import type { DayMapNode, HomeDayRecord } from '@/types/home';
import type { PatchCell } from '@/types/world';
import { resolvePlaceName } from '@/utils/place-names';
import { resolveMovementDisplay } from '@/utils/memory-display';

// category id → emoji / label, for confirmed places.
const PLACE_CATEGORY_EMOJI: Record<string, string> = Object.fromEntries(
  PLACE_CATEGORIES.map((category) => [category.id, category.emoji])
);
const PLACE_CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  PLACE_CATEGORIES.map((category) => [category.id, category.label])
);

function formatClock(iso?: string): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  let hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'pm' : 'am';
  hours %= 12;
  if (hours === 0) hours = 12;
  return `${hours}:${minutes} ${ampm}`;
}
function formatDwell(start?: string, end?: string): string | null {
  const startLabel = formatClock(start);
  const endLabel = formatClock(end);
  if (startLabel && endLabel && startLabel !== endLabel) return `${startLabel} – ${endLabel}`;
  return startLabel ?? endLabel ?? null;
}

// The "tap a chest" detail view — a small time-capsule reader. The photos vault
// shows the day's photos + their meanings; the notes reader (NotesDetailSheet)
// shows voice/text notes + the moments they grew. Journey/Reflection bodies stay
// for when those cells are re-enabled. Places routes to the full day map.
type CellDetailSheetProps = {
  day: HomeDayRecord;
  cell: PatchCell;
  recentAvgSteps: number | null;
  onClose: () => void;
  // Memory Vault only — opens the live camera capture flow to add a new photo.
  onAddPhoto?: () => void;
  // Surfaces a "View memories" link (Journey reader → the shared Memory Vault).
  onViewMemories?: () => void;
};

const MEANING_TINT: Record<string, string> = {
  calm: '#7DE8CD',
  energy: '#FFC36B',
  together: '#F49AC1',
  meaningful: '#A78BFA',
  focus: '#92D7FF',
};
const BIG_MOMENT_EMOJI: Record<string, string> = {
  birthday: '🎂',
  anniversary: '💛',
  firstTime: '⭐️',
  holiday: '🎏',
  trip: '🧳',
  achievement: '🏆',
  milestone: '🗿',
};

export function CellDetailSheet({ day, cell, recentAvgSteps, onClose, onAddPhoto, onViewMemories }: CellDetailSheetProps) {
  return (
    <KatchaSheet header={{ eyebrow: cell.sourceLabel, title: cell.summaryLabel }} onRequestClose={onClose} size="tall" surface="night">

      {cell.type === 'memory' ? <MemoryBody day={day} onAddPhoto={onAddPhoto} /> : null}
      {cell.type === 'journey' ? <JourneyBody day={day} recentAvgSteps={recentAvgSteps} onViewMemories={onViewMemories} /> : null}
      {cell.type === 'reflection' ? <ReflectionBody day={day} /> : null}
    </KatchaSheet>
  );
}

// The Journey reader — today's movement (steps vs the usual pace + the places
// the path passed through). When the day hasn't been interpreted yet, a quiet
// "what kind of journey was it?" action opens the interpretation prompt — the
// question itself only leads when the steps "!" fires.
export function JourneyDetailSheet({
  day,
  recentAvgSteps,
  onClose,
  onViewMemories,
  onInterpret,
}: {
  day: HomeDayRecord;
  recentAvgSteps: number | null;
  onClose: () => void;
  onViewMemories?: () => void;
  onInterpret?: () => void;
}) {
  const interpretation = day.stepsInterpretation;
  const interpretationDisplay = interpretation ? resolveMovementDisplay(interpretation) : null;
  return (
    <KatchaSheet
      header={{ eyebrow: 'Journey', title: interpretationDisplay ? `${interpretationDisplay.emoji} ${interpretationDisplay.label}` : 'How the day moved', subtitle: 'Movement, places and memories from today.' }}
      onRequestClose={onClose}
      size="tall"
      surface="night">
      <JourneyBody day={day} recentAvgSteps={recentAvgSteps} onViewMemories={onViewMemories} />
      {!interpretation && onInterpret ? (
        <Pressable
          accessibilityRole="button"
          onPress={onInterpret}
          style={({ pressed }) => [styles.addPhoto, pressed && styles.addPhotoPressed]}>
          <IconSymbol name="figure.walk" size={16} color={Lantern.ember300} />
          <ThemedText style={styles.addPhotoLabel} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
            What kind of journey was it?
          </ThemedText>
        </Pressable>
      ) : null}
    </KatchaSheet>
  );
}

// The notes chest reader — voice/text notes + the Big Moments they grew.
export function NotesDetailSheet({
  day,
  onClose,
  onAddNote,
}: {
  day: HomeDayRecord;
  onClose: () => void;
  onAddNote?: () => void;
}) {
  const notes = day.notes ?? [];
  return (
    <KatchaSheet
      header={{ eyebrow: 'Notes', title: notes.length > 0 ? `${notes.length} ${notes.length === 1 ? 'note' : 'notes'} & moments` : 'Your notes', subtitle: 'Written and spoken pieces from today.' }}
      onRequestClose={onClose}
      size="tall"
      surface="night">
      <NotesBody day={day} onAddNote={onAddNote} />
    </KatchaSheet>
  );
}

// The Places Vault reader — the day's stops with their time range, what they
// were + meant (once confirmed), and the photos taken there. Tapping an
// unconfirmed place opens the "what was it?" prompt for it.
export function PlacesDetailSheet({
  day,
  onClose,
  onAddPlace,
  onOpenMap,
  onConfirmPlace,
  onOpenObservatory,
}: {
  day: HomeDayRecord;
  onClose: () => void;
  onAddPlace?: () => void;
  onOpenMap?: () => void;
  onConfirmPlace?: (node: DayMapNode, name: string) => void;
  // Temporary cross-link: until the Observatory gets its own Kingdom building,
  // the noticing layer stays reachable from the Crossroads reader.
  onOpenObservatory?: () => void;
}) {
  const mapSummary = day.dayMap;
  const nodes = mapSummary?.nodes ?? [];
  const confirmedById = new Map((day.confirmedPlaces ?? []).map((place) => [place.id, place]));
  const [names, setNames] = useState<Record<string, { primary: string; locality: string | null }>>({});

  useEffect(() => {
    const list = mapSummary?.nodes ?? [];
    if (list.length === 0) return;
    let active = true;
    void (async () => {
      const entries = await Promise.all(
        list.slice(0, 6).map(async (node) => [node.id, await resolvePlaceName(node.latitude, node.longitude)] as const)
      );
      if (active) setNames(Object.fromEntries(entries));
    })();
    return () => {
      active = false;
    };
  }, [mapSummary]);

  return (
    <KatchaSheet
      header={{ eyebrow: 'Crossroads', title: nodes.length > 0 ? `${nodes.length} ${nodes.length === 1 ? 'place' : 'places'} today` : 'Where did you go?', subtitle: 'Stops, paths and place-linked memories.' }}
      onRequestClose={onClose}
      size="tall"
      surface="night">
      <View style={styles.body}>
        <View style={styles.tileRow}>
          {onAddPlace ? <ActionTile icon="mappin.and.ellipse" title="Add place" tint="#E8C06A" onPress={onAddPlace} /> : null}
          {onOpenMap && nodes.length > 0 ? (
            <ActionTile icon="globe.americas.fill" title="View map" tint="#7FB98A" onPress={onOpenMap} />
          ) : null}
          {onOpenObservatory ? <ActionTile icon="sparkles" title="Observatory" tint="#A78BFA" onPress={onOpenObservatory} /> : null}
        </View>

        {nodes.length > 0 ? (
          <View style={styles.sectionRow}>
            <IconSymbol name="clock" size={12} color={Lantern.ember300} />
            <ThemedText style={styles.sectionKicker} lightColor={Lantern.ember300} darkColor={Lantern.ember300}>
              {"TODAY'S PLACES"}
            </ThemedText>
          </View>
        ) : null}

        {nodes.length === 0 ? (
          <ThemedText style={styles.bodyLine} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
            No places yet — add where you are, or they’ll appear as your day moves.
          </ThemedText>
        ) : null}

        {nodes.map((node) => {
          const confirmed = confirmedById.get(node.id);
          const name = names[node.id]?.primary ?? 'A place';
          const locality = names[node.id]?.locality ?? null;
          const dwell = formatDwell(node.startedAt, node.endedAt);
          const photos = (node.photos ?? []).map((photo) => photo.thumbnailUri).filter((uri): uri is string => !!uri);
          const arrived = formatClock(node.startedAt);
          return (
            <Pressable
              key={node.id}
              disabled={!!confirmed || !onConfirmPlace}
              onPress={() => onConfirmPlace?.(node, name)}
              style={styles.placeCard}>
              <View style={styles.placeHeader}>
                {photos.length > 0 ? (
                  <Image source={{ uri: photos[0] }} style={styles.placeThumb} contentFit="cover" transition={120} />
                ) : (
                  <View style={styles.placeThumbFallback}>
                    <ThemedText style={styles.placeCardEmoji}>
                      {confirmed ? PLACE_CATEGORY_EMOJI[confirmed.category] ?? '📍' : '📍'}
                    </ThemedText>
                  </View>
                )}
                <View style={styles.placeText}>
                  <ThemedText style={styles.placePrimary} numberOfLines={1} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
                    {name}
                  </ThemedText>
                  <View style={styles.placeMetaRow}>
                    {arrived ? (
                      <>
                        <IconSymbol name="clock" size={10} color="#B7A8F0" />
                        <ThemedText style={styles.placeTime} lightColor="#B7A8F0" darkColor="#B7A8F0">
                          {arrived}
                        </ThemedText>
                      </>
                    ) : null}
                    <ThemedText
                      style={styles.placeSecondary}
                      numberOfLines={1}
                      lightColor={Lantern.moon500}
                      darkColor={Lantern.moon500}>
                      {[locality, dwell].filter(Boolean).join(' · ') || 'A stop on your day'}
                    </ThemedText>
                  </View>
                </View>
                {confirmed ? (
                  <View style={[styles.placeMeaning, { borderColor: `${MEANING_TINT[confirmed.archetype] ?? Lantern.moon300}66` }]}>
                    <View style={[styles.chipDot, { backgroundColor: MEANING_TINT[confirmed.archetype] ?? Lantern.moon300 }]} />
                    <ThemedText style={styles.placeMeaningLabel} numberOfLines={1} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
                      {confirmed.meaningLabel ?? PLACE_CATEGORY_LABEL[confirmed.category] ?? confirmed.label}
                    </ThemedText>
                  </View>
                ) : onConfirmPlace ? (
                  <View style={styles.placeAdd}>
                    <ThemedText style={styles.placeAddLabel} lightColor={Lantern.ember300} darkColor={Lantern.ember300}>
                      Add
                    </ThemedText>
                    <IconSymbol name="chevron.right" size={12} color={Lantern.ember300} />
                  </View>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </KatchaSheet>
  );
}

function MemoryBody({ day, onAddPhoto }: { day: HomeDayRecord; onAddPhoto?: () => void }) {
  const photos = [
    day.heroPhoto?.thumbnailUri,
    ...(day.capturedMeanings ?? []).map((meaning) => meaning.thumbnailUri),
  ].filter((uri): uri is string => !!uri);
  const meanings = day.capturedMeanings ?? [];
  const empty = photos.length === 0 && meanings.length === 0;

  return (
    <View style={styles.body}>
      {onAddPhoto ? (
        <View style={styles.addRow}>
          <Pressable
            accessibilityRole="button"
            onPress={onAddPhoto}
            style={({ pressed }) => [styles.addPhoto, pressed && styles.addPhotoPressed]}>
            <IconSymbol name="camera.fill" size={18} color={Lantern.ember300} />
            <ThemedText style={styles.addPhotoLabel} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
              Capture
            </ThemedText>
          </Pressable>
        </View>
      ) : null}
      {empty ? (
        <ThemedText style={styles.bodyLine} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
          No photos yet — capture one to fill the vault.
        </ThemedText>
      ) : null}
      {photos.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoRow}>
          {photos.map((uri, index) => (
            <Image key={`${uri}-${index}`} source={{ uri }} style={styles.photo} contentFit="cover" transition={120} />
          ))}
        </ScrollView>
      ) : null}
      {meanings.length > 0 ? (
        <View style={styles.chipWrap}>
          {meanings.map((meaning, index) => (
            <Chip key={index} label={meaning.label} tint={MEANING_TINT[meaning.archetype] ?? Lantern.moon300} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function NotesBody({ day, onAddNote }: { day: HomeDayRecord; onAddNote?: () => void }) {
  const notes = day.notes ?? [];
  const voiceNotes = notes.filter((note) => note.kind === 'voice' && note.audioUri);
  const textNotes = notes.filter((note) => note.kind !== 'voice');
  const moments = day.bigMoments ?? [];
  const empty = notes.length === 0 && moments.length === 0;

  const player = useAudioPlayer();
  const status = useAudioPlayerStatus(player);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const isPlaying = (id: string) => playingId === id && status.playing;
  const togglePlay = (id: string, uri: string) => {
    if (isPlaying(id)) {
      player.pause();
      return;
    }
    player.replace({ uri });
    player.play();
    setPlayingId(id);
  };

  return (
    <View style={styles.body}>
      {onAddNote ? (
        <View style={styles.addRow}>
          <Pressable
            accessibilityRole="button"
            onPress={onAddNote}
            style={({ pressed }) => [styles.addPhoto, pressed && styles.addPhotoPressed]}>
            <IconSymbol name="mic.fill" size={18} color={Lantern.ember300} />
            <ThemedText style={styles.addPhotoLabel} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
              Add a note
            </ThemedText>
          </Pressable>
        </View>
      ) : null}
      {empty ? (
        <ThemedText style={styles.bodyLine} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
          No notes yet — tap “Add a note” to record or write one.
        </ThemedText>
      ) : null}
      {voiceNotes.length > 0 ? (
        <View style={styles.voiceList}>
          {voiceNotes.map((note) => (
            <View key={note.id} style={styles.voiceItem}>
              <Pressable onPress={() => togglePlay(note.id, note.audioUri ?? '')} style={styles.voiceRow}>
                <View style={styles.voicePlay}>
                  <IconSymbol name={isPlaying(note.id) ? 'pause.fill' : 'play.fill'} size={13} color={Lantern.ink900} />
                </View>
                <ThemedText style={styles.voiceLabel} numberOfLines={1} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
                  {note.label}
                </ThemedText>
                {note.durationMs ? (
                  <ThemedText style={styles.voiceDur} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
                    {Math.max(1, Math.round(note.durationMs / 1000))}s
                  </ThemedText>
                ) : null}
              </Pressable>
              {note.text ? (
                <ThemedText style={styles.voiceTranscript} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
                  {note.text}
                </ThemedText>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}
      {textNotes.length > 0 ? (
        <View style={styles.chipWrap}>
          {textNotes.map((note) => (
            <Chip key={note.id} label={note.label} tint={MEANING_TINT[note.archetype] ?? Lantern.moon300} />
          ))}
        </View>
      ) : null}
      {moments.length > 0 ? (
        <View style={styles.momentList}>
          <ThemedText style={styles.momentHeader} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
            Moments
          </ThemedText>
          {moments.map((moment) => (
            <View key={moment.id} style={styles.momentRow}>
              <ThemedText style={styles.momentEmoji}>{BIG_MOMENT_EMOJI[moment.type] ?? '✨'}</ThemedText>
              <ThemedText style={styles.momentLabel} numberOfLines={1} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
                {moment.label}
                {moment.subject ? ` · ${moment.subject}` : ''}
              </ThemedText>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

type NamedPlace = { id: string; primary: string; locality: string | null };

function JourneyBody({ day, recentAvgSteps, onViewMemories }: { day: HomeDayRecord; recentAvgSteps: number | null; onViewMemories?: () => void }) {
  const steps = day.stepsCount ?? 0;
  const mapNodes = day.dayMap?.nodes;
  const placeCount = day.visitedPlaceCount ?? mapNodes?.length ?? 0;
  // Always non-judgmental: a quiet day is cozy, never a failure.
  let comparison = 'Every step left a mark on the path.';
  if (steps === 0) comparison = 'A restful day — the path is cozy and still.';
  else if (recentAvgSteps && recentAvgSteps > 0) {
    if (steps > recentAvgSteps * 1.15) comparison = 'You moved more than usual today.';
    else if (steps < recentAvgSteps * 0.6) comparison = 'A gentler day than usual — a good rest.';
    else comparison = 'About your usual pace today.';
  }

  // Resolve location names through the persisted resolver so they stay stable.
  const [places, setPlaces] = useState<NamedPlace[] | null>(null);
  useEffect(() => {
    const nodes = mapNodes ?? [];
    if (nodes.length === 0) {
      setPlaces([]);
      return;
    }
    let active = true;
    setPlaces(null);
    void (async () => {
      const resolved = await Promise.all(
        nodes.slice(0, 8).map(async (node) => ({
          id: node.id,
          ...(await resolvePlaceName(node.latitude, node.longitude)),
        }))
      );
      if (active) setPlaces(resolved);
    })();
    return () => {
      active = false;
    };
  }, [mapNodes]);

  return (
    <View style={styles.body}>
      <ThemedText style={styles.bigStat} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
        {steps.toLocaleString()}
      </ThemedText>
      <ThemedText style={styles.statUnit} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
        steps{recentAvgSteps ? ` · usually ~${recentAvgSteps.toLocaleString()}` : ''}
      </ThemedText>
      <ThemedText style={styles.bodyLine} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
        {comparison}
      </ThemedText>

      {placeCount > 0 ? (
        <View style={styles.momentList}>
          <ThemedText style={styles.momentHeader} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
            {placeCount} {placeCount === 1 ? 'place' : 'places'}
          </ThemedText>
          {places === null ? (
            <ThemedText style={styles.bodyLine} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
              Reading the map…
            </ThemedText>
          ) : (
            places.map((place) => (
              <View key={place.id} style={styles.placeRow}>
                <IconSymbol name="mappin.and.ellipse" size={14} color={Lantern.ember300} />
                <View style={styles.placeText}>
                  <ThemedText style={styles.placePrimary} numberOfLines={1} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
                    {place.primary}
                  </ThemedText>
                  {place.locality ? (
                    <ThemedText style={styles.placeSecondary} numberOfLines={1} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
                      {place.locality}
                    </ThemedText>
                  ) : null}
                </View>
              </View>
            ))
          )}
        </View>
      ) : null}

      <DayMemoryStrip day={day} title="Memories from today" onViewAll={onViewMemories} />
    </View>
  );
}

function ReflectionBody({ day }: { day: HomeDayRecord }) {
  const meanings = day.capturedMeanings ?? [];
  const answers = (day.promptAnswers ?? [])
    .filter((answer) => !answer.dismissed)
    .flatMap((answer) => answer.labels ?? []);

  if (meanings.length === 0 && answers.length === 0) {
    return <EmptyBody label="Nothing reflected yet. Tap the egg to add what stood out." />;
  }

  return (
    <View style={styles.body}>
      <View style={styles.chipWrap}>
        {meanings.map((meaning, index) => (
          <Chip key={`m-${index}`} label={meaning.label} tint={MEANING_TINT[meaning.archetype] ?? Lantern.moon300} />
        ))}
        {answers.map((label, index) => (
          <Chip key={`a-${index}`} label={label} tint={Lantern.moon300} />
        ))}
      </View>
    </View>
  );
}

function Chip({ label, tint }: { label: string; tint: string }) {
  return (
    <View style={[styles.chip, { borderColor: `${tint}66` }]}>
      <View style={[styles.chipDot, { backgroundColor: tint }]} />
      <ThemedText style={styles.chipLabel} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
        {label}
      </ThemedText>
    </View>
  );
}

function EmptyBody({ label }: { label: string }) {
  return (
    <View style={styles.body}>
      <ThemedText style={styles.bodyLine} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: 12, paddingTop: 6 },
  photoRow: { gap: 8, paddingVertical: 2 },
  photo: { width: 88, height: 88, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.06)' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 11,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: 'rgba(12,10,20,0.6)',
  },
  chipDot: { width: 7, height: 7, borderRadius: 999 },
  chipLabel: { fontSize: 12.5, fontWeight: '700' },
  voiceList: { gap: 8 },
  voiceItem: {
    gap: 7,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  voiceRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  // The transcript, indented to sit under the label (past the play button).
  voiceTranscript: { fontSize: 13, fontWeight: '500', lineHeight: 18, fontStyle: 'italic', paddingLeft: 38 },
  voicePlay: {
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Lantern.ember300,
  },
  voiceLabel: { flex: 1, fontSize: 13.5, fontWeight: '700' },
  voiceDur: { fontSize: 12, fontWeight: '700' },
  momentList: { gap: 8 },
  momentHeader: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  momentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,195,107,0.4)',
    backgroundColor: 'rgba(255,195,107,0.1)',
  },
  momentEmoji: { fontSize: 18 },
  momentLabel: { flex: 1, fontSize: 13.5, fontWeight: '700' },
  placeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  placeText: { flex: 1, gap: 1 },
  placePrimary: { fontSize: 14, fontWeight: '700' },
  placeSecondary: { flexShrink: 1, fontSize: 12, fontWeight: '600' },
  placeCard: {
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  placeHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tileRow: { flexDirection: 'row', gap: 8 },
  sectionRow: { alignItems: 'center', flexDirection: 'row', gap: 6, marginTop: 4 },
  sectionKicker: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  placeThumb: {
    borderCurve: 'continuous',
    borderRadius: 11,
    height: 44,
    width: 44,
  },
  placeThumbFallback: {
    alignItems: 'center',
    backgroundColor: 'rgba(244, 222, 180, 0.08)',
    borderColor: 'rgba(244, 222, 180, 0.18)',
    borderCurve: 'continuous',
    borderRadius: 11,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  placeMetaRow: { alignItems: 'center', flexDirection: 'row', gap: 4, marginTop: 1 },
  placeTime: { fontSize: 11.5, fontWeight: '700' },
  placeCardEmoji: { fontSize: 17 },
  placeMeaning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    maxWidth: 120,
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: 'rgba(12,10,20,0.6)',
  },
  placeMeaningLabel: { flexShrink: 1, fontSize: 11, fontWeight: '700' },
  placeAdd: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  placeAddLabel: { fontSize: 12.5, fontWeight: '800' },
  placePhotoRow: { gap: 8, paddingTop: 2 },
  placePhoto: { width: 72, height: 72, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)' },
  addRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  addPhoto: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,195,107,0.5)',
    backgroundColor: 'rgba(255,195,107,0.12)',
  },
  addPhotoPressed: { backgroundColor: 'rgba(255,195,107,0.22)' },
  addPhotoLabel: { fontSize: 13.5, fontWeight: '800' },
  bigStat: { fontSize: 40, fontWeight: '900', lineHeight: 44 },
  statUnit: { fontSize: 13, fontWeight: '700', marginTop: -4 },
  bodyLine: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
});
