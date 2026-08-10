import { useState, type ComponentProps, type ReactNode } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { KatchaUI } from '@/constants/katcha-ui';
import type { CompanionMemory } from '@/utils/companion-content';

export function CompanionSharedHistory({
  activeFocusTitle,
  activeQuestTitle,
  activePlus,
  hasOlderHistory,
  companionName,
  memories,
  onResetMemory,
  onUpdateMemory,
}: {
  activeFocusTitle?: string | null;
  activeQuestTitle?: string | null;
  activePlus: boolean;
  hasOlderHistory: boolean;
  companionName: string;
  memories: readonly CompanionMemory[];
  onResetMemory?: () => void;
  onUpdateMemory: (input: { memoryId: string; status: 'confirmed' | 'rejected' | 'forgotten'; summary?: string }) => void;
}) {
  const patterns = memories.filter((memory) => memory.kind === 'pattern' && memory.status === 'confirmed');
  const moments = memories.filter((memory) => (memory.kind === 'shared_moment' || memory.kind === 'milestone') && memory.status === 'confirmed');
  const threads = memories.filter((memory) => memory.kind === 'open_thread' && memory.status === 'confirmed');
  const hasCurrentChapter = Boolean(activeFocusTitle || activeQuestTitle);

  return (
    <View style={styles.stack}>
      <HistoryIntro companionName={companionName} />

      <HistorySection icon="book.closed.fill" title="Current chapter">
        {hasCurrentChapter ? (
          <View style={styles.chapterStack}>
            {activeFocusTitle ? <ChapterRow eyebrow="GOAL PLAN" title={activeFocusTitle} /> : null}
            {activeQuestTitle ? <ChapterRow eyebrow="OPEN QUEST" title={activeQuestTitle} /> : null}
          </View>
        ) : <EmptyCopy text="Nothing is asking for your attention right now." />}
      </HistorySection>

      {patterns.length ? (
        <HistorySection icon="sparkles" title="Things noticed">
          {patterns.map((memory) => (
          <MemoryRow key={memory.id} memory={memory} onUpdate={onUpdateMemory} />
          ))}
        </HistorySection>
      ) : null}

      <HistorySection icon="photo.on.rectangle.angled" title="Remembered moments">
        {moments.length ? moments.map((memory) => (
          <MemoryRow key={memory.id} memory={memory} onUpdate={onUpdateMemory} />
        )) : <EmptyCopy text="When you ask this Katchimera to keep a moment, it will live here." />}
      </HistorySection>

      {threads.length ? (
        <HistorySection icon="point.topleft.down.curvedto.point.bottomright.up" title="Open threads">
          {threads.map((memory) => <MemoryRow key={memory.id} memory={memory} onUpdate={onUpdateMemory} />)}
        </HistorySection>
      ) : null}

      {!activePlus && hasOlderHistory ? (
        <View style={styles.plusCard}>
          <View style={styles.plusIcon}>
            <IconSymbol color="#FFF4CD" name="lock.fill" size={18} />
          </View>
          <View style={styles.plusCopy}>
            <ThemedText selectable style={styles.plusTitle} lightColor="#FFF4CD" darkColor="#FFF4CD">
              Plus Long Memory
            </ThemedText>
            <ThemedText selectable style={styles.plusBody} lightColor="#E5D4B5" darkColor="#E5D4B5">
              Compare months and years, revisit anniversaries, and let {companionName} notice patterns beyond the latest 14 days.
            </ThemedText>
          </View>
        </View>
      ) : activePlus ? (
        <View style={styles.plusActive}>
          <IconSymbol color="#8B6B30" name="checkmark.seal.fill" size={17} />
          <ThemedText selectable style={styles.plusActiveText} lightColor="#6D5528" darkColor="#6D5528">
            Full-history Long Memory is active.
          </ThemedText>
        </View>
      ) : null}

      {typeof __DEV__ !== 'undefined' && __DEV__ && onResetMemory ? (
        <Pressable accessibilityRole="button" onPress={onResetMemory} style={({ pressed }) => [styles.devReset, pressed && styles.pressed]}>
          <IconSymbol color="#8A554A" name="arrow.counterclockwise" size={15} />
          <ThemedText style={styles.devResetLabel} lightColor="#8A554A" darkColor="#8A554A">
            Reset this companion’s memory
          </ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

function HistoryIntro({ companionName }: { companionName: string }) {
  return (
    <View style={styles.intro}>
      <ThemedText selectable style={styles.introTitle} lightColor="#3D2D20" darkColor="#3D2D20">
        What {companionName} remembers
      </ThemedText>
      <ThemedText selectable style={styles.introBody} lightColor="#6C5947" darkColor="#6C5947">
        Only moments you explicitly saved and patterns you confirmed appear here. Goal answers stay with their original conversation.
      </ThemedText>
    </View>
  );
}

function HistorySection({ children, icon, title }: { children: ReactNode; icon: ComponentProps<typeof IconSymbol>['name']; title: string }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeading}>
        <IconSymbol color="#81633C" name={icon} size={17} />
        <ThemedText selectable style={styles.sectionTitle} lightColor="#463323" darkColor="#463323">
          {title}
        </ThemedText>
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function ChapterRow({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <View style={styles.chapterRow}>
      <ThemedText style={styles.rowEyebrow} lightColor="#8A6C44" darkColor="#8A6C44">{eyebrow}</ThemedText>
      <ThemedText selectable style={styles.chapterTitle} lightColor="#493727" darkColor="#493727">{title}</ThemedText>
    </View>
  );
}

function MemoryRow({
  memory,
  onUpdate,
}: {
  memory: CompanionMemory;
  onUpdate: (input: { memoryId: string; status: 'confirmed' | 'rejected' | 'forgotten'; summary?: string }) => void;
}) {
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [managing, setManaging] = useState(false);
  const [draft, setDraft] = useState(memory.summary);
  const dates = [...new Set(memory.evidenceRefs.flatMap((evidence) => evidence.dayId ? [evidence.dayId] : []))];
  return (
    <View style={styles.memoryRow}>
      <View style={styles.memoryHeading}>
        <View style={styles.statusDot} />
        <View style={styles.memoryCopy}>
          <ThemedText selectable style={styles.memorySummary} lightColor="#4B3929" darkColor="#4B3929">
            {memory.summary}
          </ThemedText>
          <ThemedText style={styles.memoryKind} lightColor="#806C56" darkColor="#806C56">
            {memory.kind === 'pattern' ? 'Confirmed pattern' : memory.kind === 'milestone' ? 'Milestone' : memory.kind === 'open_thread' ? 'Open thread' : 'Saved moment'}
          </ThemedText>
        </View>
      </View>
      <View style={styles.memoryActions}>
        {memory.kind === 'pattern' ? (
          <Pressable accessibilityRole="button" onPress={() => setEvidenceOpen((value) => !value)} style={styles.quietAction}>
            <ThemedText style={styles.quietActionLabel} lightColor="#795B34" darkColor="#795B34">
              {evidenceOpen ? 'Hide why' : 'Why?'}
            </ThemedText>
          </Pressable>
        ) : <View />}
        <Pressable accessibilityLabel="Manage memory" accessibilityRole="button" onPress={() => setManaging((value) => !value)} style={styles.manageButton}>
          <IconSymbol color="#795B34" name="ellipsis" size={17} />
        </Pressable>
      </View>
      {managing ? (
        <View style={styles.manageActions}>
          <Pressable accessibilityRole="button" onPress={() => { setEditing(true); setManaging(false); }} style={styles.textAction}>
            <ThemedText style={styles.textActionLabel} lightColor="#795B34" darkColor="#795B34">Edit wording</ThemedText>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => onUpdate({ memoryId: memory.id, status: 'forgotten' })} style={styles.textAction}>
            <ThemedText style={styles.textActionLabel} lightColor="#8A554A" darkColor="#8A554A">Forget</ThemedText>
          </Pressable>
        </View>
      ) : null}
      {editing ? (
        <View style={styles.editor}>
          <TextInput
            accessibilityLabel="Correct remembered detail"
            multiline
            onChangeText={setDraft}
            placeholder="Write the more accurate version"
            placeholderTextColor="#9A8772"
            style={styles.input}
            value={draft}
          />
          <View style={styles.editorActions}>
            <Pressable accessibilityRole="button" onPress={() => { setDraft(memory.summary); setEditing(false); }} style={styles.textAction}>
              <ThemedText style={styles.textActionLabel} lightColor="#795B34" darkColor="#795B34">Cancel</ThemedText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={!draft.trim()}
              onPress={() => {
                if (!draft.trim()) return;
                onUpdate({ memoryId: memory.id, status: 'confirmed', summary: draft.trim() });
                setEditing(false);
              }}
              style={styles.saveAction}>
              <ThemedText style={styles.saveActionLabel} lightColor="#FFF9E9" darkColor="#FFF9E9">Save correction</ThemedText>
            </Pressable>
          </View>
        </View>
      ) : null}
      {evidenceOpen ? (
        <ThemedText selectable style={styles.evidence} lightColor="#76624E" darkColor="#76624E">
          {memory.evidenceSummary ?? (dates.length
            ? `Based on ${dates.length} day${dates.length === 1 ? '' : 's'}: ${dates.slice(0, 4).join(', ')}${dates.length > 4 ? '…' : ''}`
            : `Based on ${memory.evidenceRefs.length} saved activity reference${memory.evidenceRefs.length === 1 ? '' : 's'}.`)}
        </ThemedText>
      ) : null}
    </View>
  );
}

function EmptyCopy({ text }: { text: string }) {
  return <ThemedText selectable style={styles.empty} lightColor="#7A6753" darkColor="#7A6753">{text}</ThemedText>;
}

const styles = StyleSheet.create({
  stack: { gap: 12, paddingBottom: 22 },
  intro: { gap: 6, paddingHorizontal: 8, paddingVertical: 4 },
  introTitle: { fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  introBody: { fontSize: 14, lineHeight: 20 },
  section: { backgroundColor: KatchaUI.companionPanel.background, borderColor: KatchaUI.companionPanel.border, borderCurve: 'continuous', borderRadius: 24, borderWidth: 1, boxShadow: KatchaUI.companionPanel.shadow, gap: 10, padding: 14 },
  sectionHeading: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '900' },
  sectionBody: { gap: 9 },
  chapterStack: { gap: 8 },
  chapterRow: { backgroundColor: 'rgba(255,255,255,0.42)', borderRadius: 16, gap: 3, padding: 11 },
  rowEyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  chapterTitle: { fontSize: 14, fontWeight: '800', lineHeight: 19 },
  memoryRow: { backgroundColor: 'rgba(255,255,255,0.38)', borderRadius: 17, gap: 8, padding: 12 },
  memoryHeading: { alignItems: 'flex-start', flexDirection: 'row', gap: 9 },
  statusDot: { backgroundColor: '#6A9B78', borderRadius: 999, height: 8, marginTop: 6, width: 8 },
  memoryCopy: { flex: 1, gap: 3 },
  memorySummary: { fontSize: 14, fontWeight: '700', lineHeight: 20 },
  memoryKind: { fontSize: 10, fontWeight: '800', letterSpacing: 0.35 },
  memoryActions: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  quietAction: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 6 },
  quietActionLabel: { fontSize: 11, fontWeight: '800' },
  manageButton: { alignItems: 'center', borderRadius: 999, height: 32, justifyContent: 'center', width: 32 },
  manageActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end' },
  textAction: { backgroundColor: 'rgba(255,255,255,0.54)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
  textActionLabel: { fontSize: 11, fontWeight: '900' },
  evidence: { fontSize: 12, lineHeight: 17 },
  editor: { gap: 8 },
  input: { backgroundColor: 'rgba(255,255,255,0.7)', borderColor: 'rgba(109,78,43,0.16)', borderRadius: 14, borderWidth: 1, color: '#3F3022', fontSize: 14, lineHeight: 19, minHeight: 72, padding: 11, textAlignVertical: 'top' },
  editorActions: { alignItems: 'center', flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
  saveAction: { backgroundColor: '#6B7E58', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  saveActionLabel: { fontSize: 11, fontWeight: '900' },
  empty: { fontSize: 13, lineHeight: 19 },
  plusCard: { alignItems: 'flex-start', backgroundColor: '#443A35', borderCurve: 'continuous', borderRadius: 22, flexDirection: 'row', gap: 12, padding: 15 },
  plusIcon: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 999, height: 38, justifyContent: 'center', width: 38 },
  plusCopy: { flex: 1, gap: 4 },
  plusTitle: { fontSize: 14, fontWeight: '900' },
  plusBody: { fontSize: 12, lineHeight: 18 },
  plusActive: { alignItems: 'center', backgroundColor: '#FFF0C3', borderRadius: 18, flexDirection: 'row', gap: 8, padding: 12 },
  plusActiveText: { flex: 1, fontSize: 12, fontWeight: '800' },
  devReset: { alignItems: 'center', alignSelf: 'center', borderRadius: 999, flexDirection: 'row', gap: 7, paddingHorizontal: 12, paddingVertical: 9 },
  devResetLabel: { fontSize: 11, fontWeight: '800' },
  pressed: { opacity: 0.68 },
});
