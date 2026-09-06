import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import type { DayTag } from '@/types/home';
import { Lantern } from '@/constants/theme';

type EggTagFieldProps = {
  tags: DayTag[];
};

// The day-tag field: every signal the day surfaced, sized by weight, drifting
// around the egg. Tapping a tag glows the others that feed the same hidden
// candidate — the day is being read, and you can see the threads. The candidate
// creatures themselves stay secret until the hatch (locked product decision).
export function EggTagField({ tags }: EggTagFieldProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedSpecies = useMemo(() => {
    const selected = tags.find((tag) => tag.id === selectedId);
    return new Set(selected?.feedsSpecies ?? []);
  }, [tags, selectedId]);

  if (tags.length === 0) {
    return null;
  }

  const toggle = (tag: DayTag) => {
    setSelectedId((current) => (current === tag.id ? null : tag.id));
  };

  return (
    <View style={styles.wrap}>
      {tags.map((tag, index) => {
        const linked =
          selectedId != null &&
          (tag.id === selectedId || tag.feedsSpecies.some((id) => selectedSpecies.has(id)));
        const dimmed = selectedId != null && !linked;
        const scale = 0.86 + tag.weight * 0.28;

        return (
          <Animated.View key={tag.id} entering={FadeIn.delay(index * 40).duration(260)}>
            <Pressable
              onPress={() => toggle(tag)}
              style={[
                styles.chip,
                {
                  borderColor: `${tag.accentColor}${linked ? 'CC' : '40'}`,
                  backgroundColor: `${tag.accentColor}${linked ? '2A' : '14'}`,
                  opacity: dimmed ? 0.4 : 1,
                  transform: [{ scale }],
                },
              ]}>
              <IconSymbol color={tag.accentColor} name={tag.icon} size={13} />
              <ThemedText style={styles.label} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
                {tag.label}
              </ThemedText>
            </Pressable>
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
    justifyContent: 'center',
  },
  chip: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  label: {
    fontSize: 13,
    lineHeight: 16,
  },
});
