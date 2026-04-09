import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Link } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';

export default function ModalScreen() {
  return (
    <LinearGradient colors={['#111422', '#191b2f', '#1f2241']} style={styles.screen}>
      <View style={styles.container}>
        <ThemedText style={styles.kicker} lightColor="#c8d8ff" darkColor="#c8d8ff">
          Premium placeholder
        </ThemedText>
        <ThemedText type="title" style={styles.title} lightColor="#f8fbff" darkColor="#f8fbff">
          Unlock the full version of your life.
        </ThemedText>
        <ThemedText style={styles.body} lightColor="#d9e2ff" darkColor="#d9e2ff">
          This placeholder paywall validates the emotional position of premium before real billing is
          added.
        </ThemedText>
        <BlurView intensity={26} tint="dark" style={styles.panel}>
          <ThemedText style={styles.featureText} lightColor="#f8fbff" darkColor="#f8fbff">
            Enhanced card variants
          </ThemedText>
          <ThemedText style={styles.featureText} lightColor="#f8fbff" darkColor="#f8fbff">
            Full story + comic moments
          </ThemedText>
          <ThemedText style={styles.featureText} lightColor="#f8fbff" darkColor="#f8fbff">
            Deeper identity insights
          </ThemedText>
          <ThemedText style={styles.featureText} lightColor="#f8fbff" darkColor="#f8fbff">
            Evolution and fusion systems
          </ThemedText>
        </BlurView>
        <Link href="/" dismissTo style={styles.link}>
          <ThemedText style={styles.linkText} lightColor="#101322" darkColor="#101322">
            Back to deck
          </ThemedText>
        </Link>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  container: {
    flex: 1,
    gap: 16,
    justifyContent: 'center',
    padding: 24,
  },
  kicker: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 38,
    fontWeight: '700',
    lineHeight: 40,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
  },
  panel: {
    borderColor: 'rgba(255,255,255,0.08)',
    borderCurve: 'continuous',
    borderRadius: 28,
    borderWidth: 1,
    gap: 12,
    overflow: 'hidden',
    padding: 20,
  },
  featureText: {
    fontSize: 16,
    lineHeight: 22,
  },
  link: {
    alignItems: 'center',
    backgroundColor: '#dde8ff',
    borderRadius: 999,
    justifyContent: 'center',
    marginTop: 12,
    minHeight: 54,
  },
  linkText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
