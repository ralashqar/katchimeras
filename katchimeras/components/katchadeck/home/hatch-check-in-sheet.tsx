import { Pressable, StyleSheet, View } from 'react-native';

import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { KatchaSheet } from '@/components/katchadeck/ui/katcha-sheet';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { KatchaSurfacePalette } from '@/constants/katcha-ui';
import type { HomeDayRecord } from '@/types/home';
import {
  currentHatchCheckInQuestion,
  type HatchCheckInAnswerKind,
  type HatchCheckInChoice,
} from '@/utils/hatch-check-in';

const PARCHMENT = KatchaSurfacePalette.parchment;

export function HatchCheckInSheet({
  day,
  onAnswer,
  onComplete,
  onHatchNow,
  onClose,
}: {
  day: HomeDayRecord;
  onAnswer: (input: { kind: HatchCheckInAnswerKind; id: string }) => void;
  onComplete: () => void;
  onHatchNow: () => void;
  onClose: () => void;
}) {
  const question = currentHatchCheckInQuestion(day);
  if (!question) return null;
  const isReflection = day.hatchCheckIn?.mode === 'reflect' || question.kind === 'meaning' || question.kind === 'moment';

  return (
    <KatchaSheet
      footer={<KatchaButton fullWidth label="Hatch now" onPress={onHatchNow} variant="secondary" />}
      header={{
        eyebrow: isReflection ? 'Give the day its meaning' : 'A little more can shape the hatch',
        title: question.title,
        subtitle: question.subtitle,
        step: { current: question.step, total: question.total },
      }}
      maxHeight="78%"
      onRequestClose={onClose}
      scroll={question.choices.length > 6}
      surface="parchment">
      <View accessibilityLabel={`${question.title}. Step ${question.step} of ${question.total}.`} style={styles.grid}>
        {question.choices.map((choice) => (
          <ChoiceButton
            choice={choice}
            key={choice.id}
            suggested={choice.id === question.suggestedId}
            onPress={() => {
              onAnswer({ kind: question.kind, id: choice.id });
              if (question.step === question.total) onComplete();
            }}
          />
        ))}
      </View>
      <ThemedText style={styles.reassurance} lightColor={PARCHMENT.textTertiary} darkColor={PARCHMENT.textTertiary}>
        Optional. Skipping never changes whether your egg can hatch.
      </ThemedText>
    </KatchaSheet>
  );
}

function ChoiceButton({ choice, suggested, onPress }: { choice: HatchCheckInChoice; suggested: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityHint={suggested ? 'Suggested from signals already on this device' : undefined}
      accessibilityLabel={`${choice.label}${suggested ? ', suggested' : ''}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.choice, suggested && styles.suggestedChoice, pressed && styles.pressed]}>
      <View style={[styles.iconWell, { backgroundColor: `${choice.accent}2E` }]}>
        <IconSymbol color={PARCHMENT.text} name={choice.icon} size={20} />
      </View>
      <ThemedText numberOfLines={2} style={styles.choiceLabel} lightColor={PARCHMENT.text} darkColor={PARCHMENT.text}>
        {choice.label}
      </ThemedText>
      {suggested ? (
        <ThemedText style={styles.suggestedLabel} lightColor={PARCHMENT.textTertiary} darkColor={PARCHMENT.textTertiary}>
          Suggested
        </ThemedText>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 2 },
  choice: {
    alignItems: 'center',
    backgroundColor: PARCHMENT.subtle,
    borderColor: PARCHMENT.border,
    borderCurve: 'continuous',
    borderRadius: 16,
    borderWidth: 1,
    flexBasis: '47%',
    flexGrow: 1,
    gap: 5,
    justifyContent: 'center',
    minHeight: 94,
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  suggestedChoice: { borderColor: '#C89532', backgroundColor: 'rgba(255,211,107,0.22)' },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
  iconWell: { alignItems: 'center', borderRadius: 999, height: 34, justifyContent: 'center', width: 34 },
  choiceLabel: { fontSize: 13.5, fontWeight: '800', lineHeight: 17, textAlign: 'center' },
  suggestedLabel: { fontSize: 10.5, fontWeight: '700', textTransform: 'uppercase' },
  reassurance: { fontSize: 11.5, lineHeight: 16, paddingHorizontal: 4, paddingTop: 8, textAlign: 'center' },
});
