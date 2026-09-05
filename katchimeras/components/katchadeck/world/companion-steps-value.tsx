import { Image } from 'expo-image';
import { View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { katchimeraActionArt } from '@/constants/katchimera-action-art';
import { GAME_CTA } from '@/constants/game-cta';
import { useCompanionSteps } from '@/hooks/use-companion-steps';

export function CompanionStepsValue({ journal = false, scale = 1 }: { journal?: boolean; scale?: number }) {
  const { steps, available } = useCompanionSteps();
  if (!available) return null;
  return <View pointerEvents="none" accessibilityLabel={`${steps.toLocaleString()} steps today`} style={{
    flexDirection: 'row', alignItems: 'center', gap: 7 * scale,
    ...(journal ? { paddingVertical: 12 } : {
      position: 'absolute', right: 0, bottom: '8%',
      backgroundColor: '#FFF5DC', borderRadius: 22 * scale,
      borderColor: '#D5B57A', borderWidth: 1.5 * scale,
      paddingLeft: 6 * scale, paddingRight: 12 * scale, paddingVertical: 3 * scale,
    }),
  }}>
    <Image source={katchimeraActionArt('today:movement')} contentFit="contain" transition={0} style={{ width: 34 * scale, height: 34 * scale }} />
    <ThemedText lightColor={GAME_CTA.text} darkColor={GAME_CTA.text} style={{ ...GAME_CTA.label, color: GAME_CTA.text, textTransform: 'none', fontSize: 18 * scale, lineHeight: 24 * scale }}>
      {steps.toLocaleString()}{journal ? ' steps today' : ''}
    </ThemedText>
  </View>;
}
