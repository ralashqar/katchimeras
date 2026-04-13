import { Pressable, StyleSheet, View } from 'react-native';
import { useState } from 'react';
import Animated from 'react-native-reanimated';

import { GlassPanel } from '@/components/katchadeck/ui/glass-panel';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import type { HomeDayRecord } from '@/types/home';
import { presenceEnter } from '@/components/katchadeck/motion';

type InsightPathsPanelProps = {
  day: HomeDayRecord;
  onSelectPath: (pathId: string) => void;
};

export function InsightPathsPanel({ day, onSelectPath }: InsightPathsPanelProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <GlassPanel contentStyle={styles.panel}>
      <Pressable onPress={() => setExpanded((current) => !current)} style={styles.header}>
        <View style={styles.headerCopy}>
          <ThemedText type="onboardingLabel" style={styles.label} lightColor="#D7E4FF" darkColor="#D7E4FF">
            Insight + paths
          </ThemedText>
          <ThemedText style={styles.insight} lightColor="#E8EEFF" darkColor="#E8EEFF">
            {day.insightLine}
          </ThemedText>
        </View>
        <IconSymbol color="#D7E4FF" name={expanded ? 'xmark' : 'sparkles'} size={16} />
      </Pressable>

      {expanded ? (
        <Animated.View entering={presenceEnter(40)} style={styles.pathList}>
          {day.pathOptions.map((path) => {
            const selected = day.selectedPathId === path.id;

            return (
              <Pressable
                key={path.id}
                onPress={() => onSelectPath(path.id)}
                style={[
                  styles.pathCard,
                  {
                    borderColor: selected ? `${path.accentColor}AA` : `${path.accentColor}44`,
                    backgroundColor: selected ? `${path.accentColor}16` : 'rgba(255,255,255,0.03)',
                  },
                ]}>
                <View style={[styles.pathIcon, { backgroundColor: `${path.accentColor}18` }]}>
                  <IconSymbol color={path.accentColor} name={path.icon} size={16} />
                </View>
                <View style={styles.pathCopy}>
                  <View style={styles.pathTitleRow}>
                    <ThemedText type="subtitle" style={styles.pathTitle} lightColor="#F8FBFF" darkColor="#F8FBFF">
                      {path.title}
                    </ThemedText>
                    {selected ? (
                      <View style={[styles.activeBadge, { backgroundColor: `${path.accentColor}22`, borderColor: `${path.accentColor}52` }]}>
                        <ThemedText type="onboardingLabel" style={styles.activeBadgeLabel} lightColor="#F8FBFF" darkColor="#F8FBFF">
                          Active
                        </ThemedText>
                      </View>
                    ) : null}
                  </View>
                  <ThemedText style={styles.pathBody} lightColor="#DCE6FF" darkColor="#DCE6FF">
                    {path.body}
                  </ThemedText>
                </View>
              </Pressable>
            );
          })}
        </Animated.View>
      ) : null}
    </GlassPanel>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: 10,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  headerCopy: {
    flex: 1,
    gap: 4,
  },
  label: {
    fontSize: 11,
  },
  insight: {
    fontSize: 14,
    lineHeight: 20,
  },
  pathList: {
    gap: 10,
  },
  pathCard: {
    borderCurve: 'continuous',
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  pathIcon: {
    alignItems: 'center',
    borderRadius: 999,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  pathCopy: {
    flex: 1,
    gap: 4,
  },
  pathTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pathTitle: {
    fontSize: 18,
    lineHeight: 22,
  },
  activeBadge: {
    borderCurve: 'continuous',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  activeBadgeLabel: {
    fontSize: 10,
  },
  pathBody: {
    fontSize: 13,
    lineHeight: 18,
  },
});
