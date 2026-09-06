import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';

import { GlassPanel } from '@/components/katchadeck/ui/glass-panel';
import { ThemedText } from '@/components/themed-text';
import { homeMomentOptions } from '@/constants/home-mvp';
import type { HomeMomentType } from '@/types/home';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { IconSymbol } from '@/components/ui/icon-symbol';

type AddMomentSheetProps = {
  open: boolean;
  onClose: () => void;
  onSelectMoment: (momentType: HomeMomentType) => void;
};

export function AddMomentSheet({ open, onClose, onSelectMoment }: AddMomentSheetProps) {
  if (!open) {
    return null;
  }

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(180)} style={styles.backdrop}>
        <Pressable onPress={onClose} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <Animated.View entering={SlideInDown.duration(320)} exiting={SlideOutDown.duration(220)} style={styles.sheetWrap}>
        <GlassPanel contentStyle={styles.sheet}>
          <View style={styles.header}>
            <View>
              <ThemedText type="onboardingLabel" style={styles.label} lightColor="#D7E4FF" darkColor="#D7E4FF">
                Add moment
              </ThemedText>
              <ThemedText type="subtitle" style={styles.title} lightColor="#F8FBFF" darkColor="#F8FBFF">
                Feed the egg in one tap
              </ThemedText>
            </View>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <IconSymbol color="#E8EEFF" name="xmark" size={16} />
            </Pressable>
          </View>

          <View style={styles.optionGrid}>
            {Object.values(homeMomentOptions).map((option) => (
              <Pressable
                key={option.id}
                onPress={() => onSelectMoment(option.id)}
                style={[styles.option, { borderColor: `${option.accentColor}50` }]}>
                <View style={[styles.optionIconWrap, { backgroundColor: `${option.accentColor}20` }]}>
                  <IconSymbol color={option.accentColor} name={option.icon} size={18} />
                </View>
                <ThemedText type="subtitle" style={styles.optionTitle} lightColor="#F8FBFF" darkColor="#F8FBFF">
                  {option.label}
                </ThemedText>
              </Pressable>
            ))}
          </View>

          <View style={styles.footer}>
            <KatchaButton disabled label="Photo later" variant="secondary" />
            <KatchaButton disabled label="Text later" variant="secondary" />
          </View>
        </GlassPanel>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2, 5, 12, 0.54)',
  },
  sheetWrap: {
    bottom: 0,
    left: 0,
    padding: 16,
    position: 'absolute',
    right: 0,
  },
  sheet: {
    gap: 18,
    paddingBottom: 18,
    paddingTop: 18,
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: 11,
  },
  title: {
    fontSize: 23,
    lineHeight: 28,
    marginTop: 4,
  },
  closeButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  option: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderCurve: 'continuous',
    borderRadius: 22,
    borderWidth: 1,
    gap: 10,
    minWidth: '31%',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  optionIconWrap: {
    alignItems: 'center',
    borderRadius: 999,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  optionTitle: {
    fontSize: 15,
    lineHeight: 18,
  },
  footer: {
    gap: 10,
  },
});
