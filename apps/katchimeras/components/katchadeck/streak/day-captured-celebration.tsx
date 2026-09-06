import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutUp, useReducedMotion } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AppFontFamilies } from '@/constants/theme';

export function DayCapturedCelebration({ days, onDismiss }: { days: number; onDismiss: () => void }) {
  const reduceMotion = useReducedMotion();
  useEffect(() => {
    if (process.env.EXPO_OS === 'ios') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const timer = setTimeout(onDismiss, reduceMotion ? 1_500 : 2_500);
    return () => clearTimeout(timer);
  }, [onDismiss, reduceMotion]);
  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      entering={FadeInDown.duration(reduceMotion ? 80 : 240)}
      exiting={FadeOutUp.duration(reduceMotion ? 80 : 180)}
      pointerEvents="none"
      style={styles.toast}>
      <View style={styles.icon}><IconSymbol color="#6B430E" name="sparkles" size={20} /></View>
      <View style={styles.copy}>
        <ThemedText style={styles.title} lightColor="#392716" darkColor="#392716">Day captured</ThemedText>
        <ThemedText style={styles.body} lightColor="#6B4D2B" darkColor="#6B4D2B">{days} {days === 1 ? 'day' : 'days'} together</ThemedText>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: { alignItems: 'center', alignSelf: 'center', backgroundColor: 'rgba(255,248,225,0.96)', borderColor: 'rgba(255,255,255,0.82)', borderCurve: 'continuous', borderRadius: 21, borderWidth: 1, bottom: 122, boxShadow: '0 14px 30px rgba(48,30,10,0.24), inset 0 1px 0 rgba(255,255,255,0.8)', flexDirection: 'row', gap: 10, minWidth: 218, paddingHorizontal: 14, paddingVertical: 11, position: 'absolute', zIndex: 90 },
  icon: { alignItems: 'center', backgroundColor: '#F3D58E', borderRadius: 999, height: 38, justifyContent: 'center', width: 38 },
  copy: { gap: 1 },
  title: { fontFamily: AppFontFamilies.fredokaBold, fontSize: 16, lineHeight: 20 },
  body: { fontFamily: AppFontFamilies.manrope, fontSize: 12, fontWeight: '800' },
});
