import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { KatchaSheet } from '@/components/katchadeck/ui/katcha-sheet';
import { KatchaSurfacePalette } from '@/constants/katcha-ui';
import type { ClassifiedMemory } from '@/types/home';
import {
  answerClarification,
  currentClarificationNode,
  dismissClarification,
  skipClarificationGoal,
  type ClarificationOption,
} from '@/utils/intelligence/clarification';

const PARCHMENT = KatchaSurfacePalette.parchment;

type MemoryClarificationSheetProps = {
  memory: ClassifiedMemory;
  onResolve: (memory: ClassifiedMemory) => void;
  onClose: () => void;
};

export function MemoryClarificationSheet({ memory, onResolve, onClose }: MemoryClarificationSheetProps) {
  const [workingMemory, setWorkingMemory] = useState(memory);
  const node = currentClarificationNode(workingMemory);

  const choose = (option: ClarificationOption) => {
    if (!node) return;
    const next = answerClarification(workingMemory, node, option);
    if (next.promptState.status === 'answered') {
      onResolve(next);
      onClose();
      return;
    }
    setWorkingMemory(next);
  };

  const dismiss = () => {
    onResolve(dismissClarification(workingMemory));
    onClose();
  };

  const skip = () => {
    const next = skipClarificationGoal(workingMemory);
    if (next.promptState.status === 'pending') {
      setWorkingMemory(next);
      return;
    }
    onResolve(next);
    onClose();
  };

  return (
    <KatchaSheet header={{ eyebrow: 'A little context', title: node?.question ?? 'Keep this as it is?' }} onRequestClose={() => dismiss()} surface="parchment">
      <View style={styles.options}>
        {(node?.options ?? []).map((option) => (
          <Pressable key={option.id} accessibilityRole="button" onPress={() => choose(option)} style={styles.option}>
            <ThemedText style={styles.emoji}>{option.emoji}</ThemedText>
            <ThemedText style={styles.label} lightColor={PARCHMENT.text} darkColor={PARCHMENT.text}>
              {option.label}
            </ThemedText>
          </Pressable>
        ))}
      </View>
      <Pressable accessibilityRole="button" onPress={skip} style={styles.skip}>
        <ThemedText style={styles.skipLabel} lightColor={PARCHMENT.textSecondary} darkColor={PARCHMENT.textSecondary}>
          Skip
        </ThemedText>
      </Pressable>
    </KatchaSheet>
  );
}

const styles = StyleSheet.create({
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, justifyContent: 'center' },
  option: {
    alignItems: 'center',
    backgroundColor: 'rgba(20,17,31,0.78)',
    borderColor: 'rgba(125,232,205,0.18)',
    borderCurve: 'continuous',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    minWidth: '46%',
    paddingHorizontal: 13,
    paddingVertical: 12,
  },
  emoji: { fontSize: 17 },
  label: { flex: 1, fontSize: 13, fontWeight: '800', lineHeight: 17 },
  skip: { alignSelf: 'center', marginTop: 4, paddingHorizontal: 18, paddingVertical: 10 },
  skipLabel: { fontSize: 13, fontWeight: '800' },
});
