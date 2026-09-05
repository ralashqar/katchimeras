import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Meadow } from '@/constants/meadow-theme';
import { AppFontFamilies } from '@/constants/theme';
import type { CompanionReflectionDraft } from '@/types/companion-interaction';

import { CompanionReflectionComposerModal } from './companion-reflection-composer-modal';
import { CompanionSection } from './companion-interaction-primitives';

export function CompanionReflectionThread({
  autoOpen = false,
  composerTitle = 'Add a note',
  initialDraft,
  onCancel,
  onDraftChange,
  onSave,
  promptId,
  promptText,
}: {
  autoOpen?: boolean;
  composerTitle?: string;
  initialDraft?: CompanionReflectionDraft | null;
  onCancel?: () => void;
  onDraftChange: (draft: CompanionReflectionDraft | null) => void;
  onSave?: (draft: CompanionReflectionDraft) => void;
  promptId: string;
  promptText: string;
}) {
  const [open, setOpen] = useState(autoOpen);
  const [savedDraft, setSavedDraft] = useState<CompanionReflectionDraft | null>(initialDraft ?? null);

  return (
    <View style={styles.root}>
      {!autoOpen ? (
        <View style={styles.launcher}>
          <View style={styles.launcherPrompt}>
            <ThemedText style={styles.launcherEyebrow} lightColor={Meadow.goldDeep} darkColor={Meadow.goldDeep}>
              A QUESTION FOR YOU
            </ThemedText>
            <ThemedText selectable style={styles.prompt} lightColor={Meadow.ink} darkColor={Meadow.ink}>
              {promptText}
            </ThemedText>
          </View>
          {savedDraft ? (
            <View style={styles.draftPreview}>
              <IconSymbol color={Meadow.goldDeep} name={savedDraft.audioUri ? 'waveform' : 'square.and.pencil'} size={17} />
              <ThemedText numberOfLines={2} selectable style={styles.draftPreviewText} lightColor={Meadow.ink} darkColor={Meadow.ink}>
                {savedDraft.text.trim() || 'Voice note ready'}
              </ThemedText>
            </View>
          ) : null}
          <Pressable
            accessibilityHint="Opens a popup where you can type or record"
            accessibilityRole="button"
            onPress={() => setOpen(true)}
            style={({ pressed }) => [styles.launchButton, pressed && styles.pressed]}>
            <View style={styles.launchIcon}>
              <IconSymbol color={Meadow.ink} name="mic.fill" size={16} />
            </View>
            <View style={styles.launchCopy}>
              <ThemedText style={styles.launchTitle} lightColor={Meadow.ink} darkColor={Meadow.ink}>
                {savedDraft ? 'Edit my note' : composerTitle}
              </ThemedText>
              <ThemedText style={styles.launchHint} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>
                Type it or use your voice
              </ThemedText>
            </View>
            <IconSymbol color={Meadow.ink} name="arrow.right" size={17} />
          </Pressable>
        </View>
      ) : null}

      {open ? (
        <CompanionReflectionComposerModal
          initialDraft={savedDraft}
          onCancel={() => {
            setOpen(false);
            onCancel?.();
          }}
          onSave={(draft) => {
            setSavedDraft(draft);
            onDraftChange(draft);
            onSave?.(draft);
            setOpen(false);
          }}
          promptId={promptId}
          promptText={promptText}
          title={composerTitle}
        />
      ) : null}
    </View>
  );
}

export function CompanionReflectionReview({
  draft,
  promptText,
}: {
  draft: CompanionReflectionDraft;
  promptText: string;
}) {
  return (
    <View style={styles.reviewRoot}>
      <View style={styles.reviewIntro}>
        <View style={styles.reviewIcon}>
          <IconSymbol name="sparkles" size={22} color={Meadow.goldDeep} />
        </View>
        <View style={styles.reviewIntroCopy}>
          <ThemedText style={styles.reviewTitle} lightColor={Meadow.ink} darkColor={Meadow.ink}>
            Ready to remember
          </ThemedText>
          <ThemedText selectable style={styles.reviewHelper} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>
            This will be kept with today and strengthen your bond.
          </ThemedText>
        </View>
      </View>
      <CompanionSection label="Your companion asked">
        <ThemedText selectable style={styles.reviewPrompt} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>
          {promptText}
        </ThemedText>
      </CompanionSection>
      <CompanionSection label="Your reflection">
        <View style={styles.reviewAnswer}>
          <ThemedText selectable style={styles.reviewAnswerText} lightColor={Meadow.ink} darkColor={Meadow.ink}>
            {draft.text.trim() || 'Voice reflection'}
          </ThemedText>
          {draft.audioUri ? (
            <View style={styles.voiceIncluded}>
              <IconSymbol name="waveform" size={14} color={Meadow.goldDeep} />
              <ThemedText style={styles.voiceIncludedText} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>
                Voice answer included
              </ThemedText>
            </View>
          ) : null}
        </View>
      </CompanionSection>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  launcher: { gap: 12 },
  launcherPrompt: { gap: 5 },
  launcherEyebrow: { fontFamily: AppFontFamilies.manrope, fontSize: 9.5, fontWeight: '900', letterSpacing: 1.1 },
  prompt: { fontFamily: AppFontFamilies.manrope, fontSize: 20, fontWeight: '900', letterSpacing: -0.25, lineHeight: 27 },
  draftPreview: { alignItems: 'center', backgroundColor: 'rgba(255,248,232,0.52)', borderColor: Meadow.cardBorder, borderCurve: 'continuous', borderRadius: 16, borderWidth: 1, flexDirection: 'row', gap: 9, minHeight: 54, paddingHorizontal: 12, paddingVertical: 9 },
  draftPreviewText: { flex: 1, fontFamily: AppFontFamilies.manrope, fontSize: 12.5, fontWeight: '700', lineHeight: 17 },
  launchButton: { alignItems: 'center', backgroundColor: '#F2C967', borderColor: '#D7A93C', borderCurve: 'continuous', borderRadius: 17, borderWidth: 1, boxShadow: '0 7px 18px rgba(92,57,20,0.24), inset 0 1px 0 rgba(255,255,255,0.4)', flexDirection: 'row', gap: 9, minHeight: 56, paddingHorizontal: 13 },
  launchIcon: { alignItems: 'center', backgroundColor: 'rgba(255,248,231,0.42)', borderRadius: 999, height: 32, justifyContent: 'center', width: 32 },
  launchCopy: { flex: 1, gap: 1 },
  launchTitle: { fontFamily: AppFontFamilies.manrope, fontSize: 13, fontWeight: '900' },
  launchHint: { fontFamily: AppFontFamilies.manrope, fontSize: 10.5, fontWeight: '700' },
  pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
  reviewRoot: { gap: 22, paddingBottom: 20, paddingTop: 8 },
  reviewIntro: { alignItems: 'center', backgroundColor: 'rgba(231,185,81,0.13)', borderColor: 'rgba(160,113,30,0.18)', borderCurve: 'continuous', borderRadius: 20, borderWidth: 1, flexDirection: 'row', gap: 12, padding: 14 },
  reviewIcon: { alignItems: 'center', backgroundColor: 'rgba(231,185,81,0.20)', borderRadius: 16, height: 48, justifyContent: 'center', width: 48 },
  reviewIntroCopy: { flex: 1, gap: 3, minWidth: 0 },
  reviewTitle: { fontSize: 17, fontWeight: '900' },
  reviewHelper: { fontSize: 12.5, lineHeight: 18 },
  reviewPrompt: { fontSize: 15, fontStyle: 'italic', lineHeight: 22 },
  reviewAnswer: { backgroundColor: 'rgba(255,248,232,0.42)', borderColor: Meadow.cardBorder, borderCurve: 'continuous', borderRadius: 18, borderWidth: 1, gap: 12, minHeight: 126, padding: 16 },
  reviewAnswerText: { fontSize: 16, lineHeight: 24 },
  voiceIncluded: { alignItems: 'center', flexDirection: 'row', gap: 7 },
  voiceIncludedText: { fontSize: 12, fontWeight: '800' },
});
