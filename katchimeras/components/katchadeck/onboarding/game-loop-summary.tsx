import { Image as NativeImage, StyleSheet } from 'react-native';
import { Image } from 'expo-image';

const SUMMARY_ART = require('../../../assets/images/katchimeras/world/ui/ftue-game-loop-baked-v5.png');
const { width, height } = NativeImage.resolveAssetSource(SUMMARY_ART);
const SUMMARY_DESCRIPTION = [
  'Game Loop.',
  '1. Merge & Earn. Merge items to create new things and earn Glow.',
  '2. Upgrade / Discover. Use Glow to restore and upgrade the world. Discover new areas and friends.',
  '3. Hatch Companions. As the world grows, new eggs hatch and new Katchimeras join you.',
  '4. Bond. Spend time with your Katchimeras. Share moments, feed them, and build your bond.',
  '5. Journey with them. Explore, complete adventures together, and see your world come to life.',
  'Small moments. A brighter you, together.',
].join(' ');

/** All visible copy, icons, arrows and scenery are baked into this one portrait. */
export function GameLoopSummary({ scrolling = false }: { scrolling?: boolean }) {
  return <Image
    source={SUMMARY_ART}
    style={scrolling ? styles.scrollingArt : styles.art}
    contentFit={scrolling ? 'contain' : 'cover'}
    transition={0}
    accessible
    accessibilityRole="image"
    accessibilityLabel={SUMMARY_DESCRIPTION}
  />;
}

const styles = StyleSheet.create({
  art: { width: '100%', height: '100%' },
  scrollingArt: { width: '100%', aspectRatio: width / height },
});
