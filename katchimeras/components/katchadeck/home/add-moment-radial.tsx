import { ActivityIndicator, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { AddMomentOrbit } from '@/components/katchadeck/home/add-moment-orbit';
import { PhotoOrbitRing } from '@/components/katchadeck/home/photo-orbit-ring';
import { MomentAbsorptionOverlay } from '@/components/katchadeck/home/moment-absorption-overlay';
import { GlassPanel } from '@/components/katchadeck/ui/glass-panel';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { ThemedText } from '@/components/themed-text';
import type { AddMomentFlowState } from '@/types/home';

type AddMomentRadialProps = {
  anchorY: number;
  onClose: () => void;
  onDismissError: () => void;
  onSelectAction: (actionId: string) => void;
  onSelectRecentPhoto: (assetId: string) => void;
  onUsePickerFallback: () => void;
  state: AddMomentFlowState;
};

export function AddMomentRadial({
  anchorY,
  onClose,
  onDismissError,
  onSelectAction,
  onSelectRecentPhoto,
  onUsePickerFallback,
  state,
}: AddMomentRadialProps) {
  const { width, height } = useWindowDimensions();

  if (state.stage === 'closed') {
    return null;
  }

  const ringSize = Math.min(width - 28, 360);
  const top = Math.max(120, Math.min(anchorY - ringSize / 2, height - ringSize - 120));

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(180)} style={styles.backdrop}>
        <Pressable onPress={state.stage === 'absorbing' ? undefined : onClose} style={StyleSheet.absoluteFill} />
      </Animated.View>

      <View pointerEvents="box-none" style={[styles.ringRegion, { height: ringSize, top, width: ringSize }]}>
        <View pointerEvents="none" style={styles.centerGlow} />
        {state.stage === 'moment_ring' ? (
          <AddMomentOrbit actions={state.actions} onSelectAction={onSelectAction} />
        ) : null}

        {state.stage === 'photo_ring_ready' && state.recentPhotos.length > 0 ? (
          <PhotoOrbitRing onSelectPhoto={onSelectRecentPhoto} photos={state.recentPhotos} />
        ) : null}

        {state.absorption ? <MomentAbsorptionOverlay payload={state.absorption} /> : null}
      </View>

      <View pointerEvents="box-none" style={[styles.panelWrap, { top: Math.max(52, top - 86) }]}>
        {state.stage === 'moment_ring' ? (
          <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)}>
            <GlassPanel contentStyle={styles.panel}>
              <ThemedText type="onboardingLabel" style={styles.label} lightColor="#D7E4FF" darkColor="#D7E4FF">
                Add moment
              </ThemedText>
              <ThemedText style={styles.body} lightColor="#F8FBFF" darkColor="#F8FBFF">
                Choose one thing to feed into the egg.
              </ThemedText>
            </GlassPanel>
          </Animated.View>
        ) : null}

        {state.stage === 'photo_permission_request' || state.stage === 'photo_ring_loading' || state.stage === 'photo_picker_fallback' ? (
          <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)}>
            <GlassPanel contentStyle={styles.panel}>
              <ThemedText type="onboardingLabel" style={styles.label} lightColor="#D7E4FF" darkColor="#D7E4FF">
                Photo
              </ThemedText>
              <ThemedText style={styles.body} lightColor="#F8FBFF" darkColor="#F8FBFF">
                {state.stage === 'photo_permission_request'
                  ? 'Checking access to your recent photos.'
                  : state.stage === 'photo_picker_fallback'
                    ? 'Opening the photo picker.'
                    : 'Loading recent photos around the egg.'}
              </ThemedText>
              <ActivityIndicator color="#E6EDFF" />
            </GlassPanel>
          </Animated.View>
        ) : null}

        {state.stage === 'photo_ring_ready' && state.recentPhotos.length === 0 ? (
          <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)}>
            <GlassPanel contentStyle={styles.panel}>
              <ThemedText type="onboardingLabel" style={styles.label} lightColor="#D7E4FF" darkColor="#D7E4FF">
                Photo
              </ThemedText>
              <ThemedText style={styles.body} lightColor="#F8FBFF" darkColor="#F8FBFF">
                No recent photos were available here. You can still pick one manually.
              </ThemedText>
              <View style={styles.buttonRow}>
                <KatchaButton label="Use picker" onPress={onUsePickerFallback} variant="primary" />
                <KatchaButton label="Back" onPress={onClose} variant="secondary" />
              </View>
            </GlassPanel>
          </Animated.View>
        ) : null}

        {state.stage === 'error' && state.error ? (
          <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)}>
            <GlassPanel contentStyle={styles.panel}>
              <ThemedText type="onboardingLabel" style={styles.label} lightColor="#FFD8C0" darkColor="#FFD8C0">
                {state.error.title}
              </ThemedText>
              <ThemedText style={styles.body} lightColor="#F8FBFF" darkColor="#F8FBFF">
                {state.error.body}
              </ThemedText>
              <View style={styles.buttonRow}>
                {state.error.action === 'retry_photo' ? (
                  <KatchaButton label="Try again" onPress={() => onSelectAction('photo')} variant="primary" />
                ) : state.error.action === 'use_picker' ? (
                  <KatchaButton label="Use picker" onPress={onUsePickerFallback} variant="primary" />
                ) : null}
                <KatchaButton label="Back" onPress={onDismissError} variant="secondary" />
              </View>
            </GlassPanel>
          </Animated.View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(4, 7, 15, 0.36)',
  },
  ringRegion: {
    alignSelf: 'center',
    position: 'absolute',
  },
  centerGlow: {
    backgroundColor: 'rgba(240, 225, 212, 0.06)',
    borderRadius: 999,
    height: 132,
    left: '50%',
    marginLeft: -66,
    marginTop: -66,
    position: 'absolute',
    top: '50%',
    width: 132,
  },
  panelWrap: {
    left: 16,
    position: 'absolute',
    right: 16,
  },
  panel: {
    gap: 10,
  },
  label: {
    fontSize: 11,
  },
  body: {
    fontSize: 15,
    lineHeight: 21,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
});
