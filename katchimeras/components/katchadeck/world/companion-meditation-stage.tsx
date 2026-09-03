import { Pressable, StyleSheet, View } from 'react-native';
import { useState } from 'react';

import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { KatchaUI } from '@/constants/katcha-ui';

export function formatMeditationCountdown(availableAt: number, now: number): string {
  const seconds = Math.max(0, Math.ceil((availableAt - now) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

export function CompanionMeditationStage({
  availableAt,
  companionName,
  now,
  onExitToGarden,
  onMeditationAction,
}: {
  availableAt: number;
  companionName: string;
  now: number;
  onExitToGarden?: () => void;
  onMeditationAction?: (action: 'tend_together' | 'share_moment', optionId?: string) => void;
}) {
  const [sharingMoment, setSharingMoment] = useState(false);
  const [completedAction, setCompletedAction] = useState<'tend_together' | 'share_moment' | null>(null);
  const countdown = formatMeditationCountdown(availableAt, now);
  return (
    <View accessibilityLabel={`${companionName} is meditating. Ready in ${countdown}`} style={styles.stage}>
      <View style={styles.timerPill}>
        <IconSymbol color={KatchaUI.companionScenePanel.accentInk} name="timer" size={18} />
        <View style={styles.timerCopy}>
          <ThemedText style={styles.eyebrow} lightColor={KatchaUI.companionScenePanel.inkSoft} darkColor={KatchaUI.companionScenePanel.inkSoft}>
            NEXT JOURNEY
          </ThemedText>
          <ThemedText style={styles.countdown} lightColor={KatchaUI.companionScenePanel.ink} darkColor={KatchaUI.companionScenePanel.ink}>
            {countdown}
          </ThemedText>
        </View>
      </View>
      <View style={styles.messagePanel}>
        <ThemedText style={styles.messageEyebrow} lightColor={KatchaUI.companionScenePanel.accent} darkColor={KatchaUI.companionScenePanel.accent}>
          OUR NEXT JOURNEY
        </ThemedText>
        <ThemedText style={styles.title} lightColor={KatchaUI.companionScenePanel.ink} darkColor={KatchaUI.companionScenePanel.ink}>
          {companionName} is reflecting
        </ThemedText>
        <ThemedText style={styles.note} lightColor={KatchaUI.companionScenePanel.inkSoft} darkColor={KatchaUI.companionScenePanel.inkSoft}>
          He is thinking about what you shared. Meditation pauses Journey dialogue, not your Garden.
        </ThemedText>
        {sharingMoment ? (
          <View style={styles.thoughtPanel}>
            <ThemedText style={styles.thoughtTitle}>One thing… when a day gets difficult, what disappears first?</ThemedText>
            {[
              ['sleep', '😴 Sleep'],
              ['movement', '🚶 Moving around'],
              ['time_for_myself', '🧘 Time for myself'],
              ['organisation', '🧹 Staying organised'],
              ['depends', '🤷 It depends'],
            ].map(([id, label]) => (
              <Pressable
                accessibilityRole="button"
                key={id}
                onPress={() => {
                  onMeditationAction?.('share_moment', id);
                  setCompletedAction('share_moment');
                  setSharingMoment(false);
                }}
                style={({ pressed }) => [styles.thoughtOption, pressed && styles.pressed]}>
                <ThemedText style={styles.thoughtOptionLabel}>{label}</ThemedText>
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={styles.actions}>
            <KatchaButton
              disabled={completedAction === 'tend_together'}
              fullWidth
              icon="drop.fill"
              label={completedAction === 'tend_together' ? 'Water Together · Done' : 'Tend Together'}
              onPress={() => {
                onMeditationAction?.('tend_together');
                setCompletedAction('tend_together');
              }}
            />
            {onExitToGarden ? <KatchaButton fullWidth icon="leaf.fill" label="Tend the Garden" onPress={onExitToGarden} variant="secondary" /> : null}
            <KatchaButton
              disabled={completedAction === 'share_moment'}
              fullWidth
              icon="bubble.left.fill"
              label={completedAction === 'share_moment' ? 'Moment shared' : 'Share a Moment'}
              onPress={() => setSharingMoment(true)}
              variant="secondary"
            />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  countdown: { fontSize: 24, fontVariant: ['tabular-nums'], fontWeight: '900', letterSpacing: 0.8, lineHeight: 29 },
  eyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  messageEyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  messagePanel: {
    backgroundColor: KatchaUI.companionScenePanel.background,
    borderColor: KatchaUI.companionScenePanel.border,
    borderCurve: 'continuous',
    borderRadius: 22,
    borderWidth: 1,
    boxShadow: KatchaUI.companionScenePanel.shadow,
    gap: 10,
    padding: 18,
  },
  note: { fontSize: 15, lineHeight: 22 },
  stage: { gap: 12, paddingBottom: 4 },
  title: { fontSize: 26, fontWeight: '900', letterSpacing: -0.4, lineHeight: 31 },
  timerCopy: { alignItems: 'flex-start' },
  timerPill: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: KatchaUI.companionScenePanel.optionBackground,
    borderColor: KatchaUI.companionScenePanel.optionBorder,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minWidth: 190,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  actions: { gap: 8 },
  thoughtPanel: { gap: 7, paddingTop: 2 },
  thoughtTitle: { fontSize: 16, fontWeight: '800', lineHeight: 22 },
  thoughtOption: { backgroundColor: KatchaUI.companionScenePanel.optionBackground, borderColor: KatchaUI.companionScenePanel.optionBorder, borderRadius: 14, borderWidth: 1, minHeight: 44, justifyContent: 'center', paddingHorizontal: 13 },
  thoughtOptionLabel: { fontSize: 14, fontWeight: '800' },
  pressed: { opacity: 0.76, transform: [{ scale: 0.99 }] },
});
