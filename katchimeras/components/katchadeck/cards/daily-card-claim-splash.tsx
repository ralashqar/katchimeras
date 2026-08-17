import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Modal, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { Easing, FadeIn, FadeInUp, useReducedMotion } from 'react-native-reanimated';

import { DailyCardViewer } from '@/components/katchadeck/cards/daily-card-viewer';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { RotatingRadialSunburst } from '@/components/katchadeck/ui/radial-sunburst';
import type { DailyCreatureCard, HomeDayRecord } from '@/types/home';

type DailyCardClaimSplashProps = {
  card: DailyCreatureCard;
  claimAvailable: boolean;
  claiming: boolean;
  day: HomeDayRecord;
  onClaim: () => void;
};

const GOLD = '#F2D48A';

export function DailyCardClaimSplash({ card, claimAvailable, claiming, day, onClaim }: DailyCardClaimSplashProps) {
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const bottomInset = Math.max(16, insets.bottom + 10);
  const topInset = Math.max(18, insets.top + 8);
  const actionHeight = 58;
  const stageGap = 18;
  const maxCardHeight = Math.max(360, height - topInset - bottomInset - actionHeight - stageGap - 20);
  const raySize = Math.min(width * 1.32, maxCardHeight * 0.88, 520);

  return (
    <Modal
      animationType="none"
      navigationBarTranslucent
      onRequestClose={() => {}}
      presentationStyle="fullScreen"
      statusBarTranslucent
      transparent={false}
      visible>
      <StatusBar style="light" />
      <Animated.View
        accessibilityViewIsModal
        entering={FadeIn.duration(reduceMotion ? 80 : 320)}
        style={styles.screen}>
        <LinearGradient
          colors={['#263243', '#17202D', '#0E111A']}
          end={{ x: 0.72, y: 1 }}
          start={{ x: 0.22, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
        <View
          style={[
            styles.layout,
            { paddingBottom: bottomInset, paddingTop: topInset },
          ]}>
          <View style={styles.stage}>
            <RotatingRadialSunburst
              baseOpacity={0.72}
              size={raySize}
              style={styles.rays}
            />
            <Animated.View
              entering={reduceMotion
                ? FadeIn.duration(100)
                : FadeInUp.duration(420).easing(Easing.out(Easing.cubic))}
              style={styles.card}>
              <DailyCardViewer
                card={card}
                day={day}
                maxCardHeight={maxCardHeight}
                showFaceControls={false}
              />
            </Animated.View>
          </View>

          <View style={styles.actionDock}>
            {claiming ? (
              <ActivityIndicator accessibilityLabel="Claiming Day Card" color={GOLD} size="large" />
            ) : claimAvailable ? (
              <Animated.View entering={FadeIn.duration(reduceMotion ? 80 : 220)} style={styles.action}>
                <KatchaButton
                  fullWidth
                  glow
                  icon="sparkles"
                  label="Claim Day Card"
                  onPress={onClaim}
                />
              </Animated.View>
            ) : null}
          </View>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  actionDock: {
    alignItems: 'center',
    height: 58,
    justifyContent: 'center',
    paddingHorizontal: 24,
    width: '100%',
  },
  action: { width: '100%' },
  card: { alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  layout: { flex: 1, gap: 18 },
  rays: { alignSelf: 'center', position: 'absolute' },
  screen: {
    backgroundColor: '#0E111A',
    flex: 1,
  },
  stage: { alignItems: 'center', flex: 1, justifyContent: 'center' },
});
