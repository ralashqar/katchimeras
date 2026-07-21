import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { createContext, type ReactNode, use } from 'react';
import {
  Pressable,
  StyleSheet,
  type StyleProp,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';

import {
  OrnateCardFrame,
} from '@/components/katchadeck/cards/ornate-card-frame';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { getCreatureVisual } from '@/game/days';
import type { CardFacet, CardFacetKey, DailyCreatureCard } from '@/types/home';
import { resolveCreatureVariantSource } from '@/utils/creature-variant';
import {
  COMPACT_DAILY_CARD_HORIZONTAL_GUTTER,
  COMPACT_DAILY_CARD_MAX_HEIGHT,
  COMPACT_DAILY_CARD_MAX_WIDTH,
  type DailyCardSize,
  resolveCompactDailyCardSize,
  resolveDetailDailyCardSize,
} from '@/utils/daily-card-layout';

type DailyCardVariant = 'carousel' | 'detail';

export type { DailyCardSize } from '@/utils/daily-card-layout';
export { resolveCompactDailyCardSize } from '@/utils/daily-card-layout';

type DailyCardProps = {
  card: DailyCreatureCard;
  compact?: boolean;
  frameSize?: DailyCardSize;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  variant?: DailyCardVariant;
};

export { COMPACT_DAILY_CARD_HORIZONTAL_GUTTER, COMPACT_DAILY_CARD_MAX_HEIGHT, COMPACT_DAILY_CARD_MAX_WIDTH };

const CompactDailyCardSizeContext = createContext<DailyCardSize | null>(null);

const RARITY_COLORS: Record<DailyCreatureCard['rarity'], string> = {
  common: '#87734B',
  rare: '#47704E',
  epic: '#66508F',
  legendary: '#A66A20',
};

const SCENE_COLORS: Record<NonNullable<DailyCreatureCard['scene']>['backdrop'], [string, string, string]> = {
  meadow: ['#DCE7B6', '#8EB371', '#6F8C55'],
  nature: ['#DDE8B1', '#86A85F', '#526D42'],
  city: ['#D8D0DF', '#8B809F', '#574E70'],
  cafe: ['#F1D8AE', '#B77E4A', '#69472F'],
  rain: ['#D8E5DF', '#809B91', '#48635F'],
  storm: ['#CCC8D6', '#716B80', '#3D3948'],
  snow: ['#F0F3EA', '#B7CDCF', '#78979D'],
  night: ['#292943', '#3F4168', '#171727'],
  dawn: ['#F5D8B6', '#D88D69', '#866054'],
  home: ['#F1DFC2', '#BE956C', '#795B43'],
};

const meadowScene = require('../../../assets/images/katchimeras/world/base/base_meadow.png');
const cafeScene = require('../../../assets/images/katchimeras/environments/coffee_cafe/base.jpg');

const FACET_ORDER: CardFacetKey[] = ['mood', 'energy', 'sleep', 'place', 'social'];

export function CompactDailyCardSizeProvider({ children, size }: { children: ReactNode; size: DailyCardSize }) {
  return <CompactDailyCardSizeContext value={size}>{children}</CompactDailyCardSizeContext>;
}

export function DailyCard({ card, compact, frameSize, onPress, style, variant = compact ? 'carousel' : 'detail' }: DailyCardProps) {
  const window = useWindowDimensions();
  const inheritedSize = use(CompactDailyCardSizeContext);
  const isCarousel = variant === 'carousel';
  const defaultCompactMaxHeight = Math.max(312, window.height - 260);
  const size = isCarousel
    ? frameSize ?? inheritedSize ?? resolveCompactDailyCardSize(window.width, defaultCompactMaxHeight)
    : resolveDetailDailyCardSize(window.width);
  const content = <CardContent card={card} size={size} style={style} variant={variant} />;

  return (
    <Pressable
      accessibilityLabel={onPress ? `Open ${card.creatureName} card` : `${card.creatureName}, ${card.rarity} daily card`}
      accessibilityRole={onPress ? 'button' : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => pressed ? styles.pressed : null}>
      {content}
    </Pressable>
  );
}

function CardContent({ card, size, style, variant }: { card: DailyCreatureCard; size: DailyCardSize; style?: StyleProp<ViewStyle>; variant: DailyCardVariant }) {
  const compact = variant === 'carousel';
  const facets = resolveFacets(card);
  const facts = card.dayFacts;
  return (
    <View style={style}>
      <OrnateCardFrame
        background={<Scene card={card} scale={size.scale} />}
        height={size.height}
        width={size.width}>
        <CardHeader card={card} compact={compact} scale={size.scale} />
        <View style={[frameRect(size.scale, 72, 1047, 797, 57), styles.centerBox]}>
          <ThemedText
            adjustsFontSizeToFit
            maxFontSizeMultiplier={1.15}
            minimumFontScale={0.72}
            numberOfLines={2}
            selectable={!compact}
            style={[styles.story, scaledText(size.scale, 24, 29)]}
            lightColor="#5A472E"
            darkColor="#5A472E">
            ❧ {card.storyLine ?? card.memorySpark?.caption ?? card.state.label} ❧
          </ThemedText>
        </View>
        <View style={[frameRect(size.scale, 58, 1100, 825, 203), styles.row, { gap: 8 * size.scale }]}>
          {FACET_ORDER.map((key) => <FacetCell facet={facets[key]} key={key} scale={size.scale} selectable={!compact} />)}
        </View>
        <View style={[frameRect(size.scale, 58, 1312, 825, 126), styles.row, { gap: 9 * size.scale }]}>
          <WideFact icon="figure.walk" label={facts?.stepsLabel ?? 'Steps'} scale={size.scale} selectable={!compact} value={(facts?.steps ?? 0).toLocaleString()} />
          <WideFact icon="sparkles" label="Highlight" scale={size.scale} selectable={!compact} value={facts?.highlight ?? card.memorySpark?.caption ?? 'A quiet day'} />
          <WideFact icon="leaf.fill" label="Bonus Trait" scale={size.scale} selectable={!compact} value={facts?.bonusTrait?.label ?? card.traits[0]?.label ?? 'One of a kind'} />
        </View>
        <MemoryStrip card={card} compact={compact} scale={size.scale} />
      </OrnateCardFrame>
    </View>
  );
}

function CardHeader({ card, compact, scale }: { card: DailyCreatureCard; compact: boolean; scale: number }) {
  const date = formatCardDateParts(card.isoDate);
  const backdrop = card.scene?.backdrop ?? card.treatment.backdrop;
  return (
    <>
      <View style={[frameRect(scale, 61, 67, 126, 143), styles.badgeIcon]}>
        <IconSymbol color="#FFF0B1" name="sparkles" size={Math.max(15, 54 * scale)} />
      </View>
      <View style={[frameRect(scale, 58, 218, 133, 58), styles.centerBox]}>
        <ThemedText
          adjustsFontSizeToFit
          maxFontSizeMultiplier={1.15}
          minimumFontScale={0.76}
          numberOfLines={1}
          style={[styles.centered, styles.rarity, scaledText(scale, 27, 32)]}
          lightColor="#FFF0C7"
          darkColor="#FFF0C7">
          {card.rarity.toUpperCase()}
        </ThemedText>
      </View>
      <View style={[frameRect(scale, 202, 67, 544, 135), styles.centerBox]}>
        <ThemedText
          adjustsFontSizeToFit
          maxFontSizeMultiplier={1.15}
          minimumFontScale={0.64}
          numberOfLines={1}
          selectable={!compact}
          style={[styles.centered, styles.name, scaledText(scale, 61, 68)]}
          lightColor="#3E6522"
          darkColor="#3E6522">
          {card.creatureName.toUpperCase()}
        </ThemedText>
      </View>
      <View style={[frameRect(scale, 278, 229, 385, 54), styles.centerBox]}>
        <ThemedText
          adjustsFontSizeToFit
          maxFontSizeMultiplier={1.15}
          minimumFontScale={0.72}
          numberOfLines={1}
          style={[styles.centered, styles.epithet, scaledText(scale, 34, 39)]}
          lightColor="#FFF7E8"
          darkColor="#FFF7E8">
          ✦ {card.epithet} ✦
        </ThemedText>
      </View>
      <View style={[frameRect(scale, 755, 72, 127, 183), styles.dateStamp]}>
        <IconSymbol color="#70562E" name="calendar" size={Math.max(12, 38 * scale)} />
        <ThemedText style={[styles.centered, styles.dateWeekday, scaledText(scale, 35, 38)]} lightColor="#59472E" darkColor="#59472E">{date.weekday}</ThemedText>
        <ThemedText style={[styles.centered, styles.dateValue, scaledText(scale, 34, 38)]} lightColor="#59472E" darkColor="#59472E">{date.dayMonth}</ThemedText>
      </View>
      <View style={[frameRect(scale, 750, 330, 112, 160), styles.dayTag]}>
        <IconSymbol color="#FFE4A1" name="leaf.fill" size={Math.max(11, 32 * scale)} />
        <ThemedText
          adjustsFontSizeToFit
          maxFontSizeMultiplier={1.15}
          minimumFontScale={0.72}
          numberOfLines={2}
          style={[styles.centered, styles.dayTagText, scaledText(scale, 25, 28)]}
          lightColor="#FFF0C7"
          darkColor="#FFF0C7">
          {sceneLabel(backdrop)}
        </ThemedText>
      </View>
    </>
  );
}

function Scene({ card, scale }: { card: DailyCreatureCard; scale: number }) {
  const visual = getCreatureVisual(card.visualKey);
  const source = resolveCreatureVariantSource(card.visualKey, card.variantCell) ?? visual.source;
  const backdrop = card.scene?.backdrop ?? card.treatment.backdrop;
  const colors = SCENE_COLORS[backdrop];
  const weather = card.scene?.weather ?? (backdrop === 'rain' || backdrop === 'storm' || backdrop === 'snow' ? backdrop : 'clear');
  const sceneSource = backdrop === 'cafe' || backdrop === 'home' || backdrop === 'city' ? cafeScene : meadowScene;
  return (
    <LinearGradient
      colors={colors}
      style={[frameRect(scale, 53, 286, 835, 770), styles.scene, { borderRadius: 22 * scale }]}>
      <Image cachePolicy="memory-disk" contentFit="cover" source={sceneSource} style={styles.sceneImage} transition={0} />
      <LinearGradient colors={['rgba(255,244,207,0.04)', `${colors[2]}88`]} style={StyleSheet.absoluteFill} />
      <View style={styles.sceneGlow} />
      {weather === 'rain' || weather === 'storm' ? <RainOverlay scale={scale} /> : null}
      {weather === 'snow' ? <SnowOverlay scale={scale} /> : null}
      <Image cachePolicy="memory-disk" contentFit="contain" source={source} style={styles.creature} transition={0} />
    </LinearGradient>
  );
}

function RainOverlay({ scale }: { scale: number }) {
  return <View pointerEvents="none" style={styles.weather}>{[8, 21, 35, 50, 66, 81, 94].map((left, index) => <View key={left} style={[styles.rainDrop, { height: Math.max(10, 40 * scale), left: `${left}%`, top: `${5 + (index % 3) * 12}%` }]} />)}</View>;
}

function SnowOverlay({ scale }: { scale: number }) {
  return <View pointerEvents="none" style={styles.weather}>{[9, 23, 38, 53, 69, 83, 94].map((left, index) => <View key={left} style={[styles.snowDot, { height: Math.max(3, 12 * scale), left: `${left}%`, top: `${7 + (index % 4) * 13}%`, width: Math.max(3, 12 * scale) }]} />)}</View>;
}

function FacetCell({ facet, scale, selectable }: { facet: CardFacet; scale: number; selectable: boolean }) {
  return (
    <View style={[styles.facet, { borderRadius: 20 * scale, paddingHorizontal: 5 * scale, paddingVertical: 13 * scale }]}>
      <FacetIcon facet={facet} scale={scale} />
      <ThemedText maxFontSizeMultiplier={1.15} numberOfLines={1} style={[styles.facetLabel, scaledText(scale, 20, 23)]} lightColor="#7A6746" darkColor="#7A6746">{facet.label}</ThemedText>
      <ThemedText
        adjustsFontSizeToFit
        maxFontSizeMultiplier={1.15}
        minimumFontScale={0.72}
        numberOfLines={2}
        selectable={selectable}
        style={[styles.facetValue, scaledText(scale, 29, 32)]}
        lightColor="#44351F"
        darkColor="#44351F">
        {facet.value}
      </ThemedText>
    </View>
  );
}

function FacetIcon({ facet, scale }: { facet: CardFacet; scale: number }) {
  const name: IconSymbolName = facet.key === 'mood' ? 'face.smiling' : facet.key === 'sleep' ? 'moon.fill' : facet.key === 'place' ? 'mappin' : facet.key === 'social' ? 'person.2.fill' : 'drop.fill';
  return <View style={[styles.facetIcon, { height: 74 * scale }]}><IconSymbol color="#617B3D" name={name} size={Math.max(13, 45 * scale)} /></View>;
}

function WideFact({ icon, label, scale, selectable, value }: { icon: IconSymbolName; label: string; scale: number; selectable: boolean; value: string }) {
  return (
    <View style={[styles.wideFact, { borderRadius: 18 * scale, gap: 9 * scale, padding: 12 * scale }]}>
      <IconSymbol color="#77603A" name={icon} size={Math.max(14, 46 * scale)} />
      <View style={styles.wideCopy}>
        <ThemedText maxFontSizeMultiplier={1.15} numberOfLines={1} style={[styles.wideLabel, scaledText(scale, 17, 20)]} lightColor="#806C4A" darkColor="#806C4A">{label}</ThemedText>
        <ThemedText
          adjustsFontSizeToFit
          maxFontSizeMultiplier={1.15}
          minimumFontScale={0.68}
          numberOfLines={2}
          selectable={selectable}
          style={[styles.wideValue, scaledText(scale, 25, 28)]}
          lightColor="#483A27"
          darkColor="#483A27">
          {value}
        </ThemedText>
      </View>
    </View>
  );
}

function MemoryStrip({ card, compact, scale }: { card: DailyCreatureCard; compact: boolean; scale: number }) {
  return (
    <View style={[frameRect(scale, 68, 1462, 805, 151), styles.memory]}>
      <View style={[styles.memorySeal, { borderRadius: 999, height: 118 * scale, left: 8 * scale, width: 118 * scale }]}>
        <IconSymbol color="#FFE6A0" name="sparkles" size={Math.max(17, 58 * scale)} />
      </View>
      <View style={[styles.memoryCopy, { left: 143 * scale, width: 355 * scale }]}>
        <ThemedText numberOfLines={1} style={[styles.memoryLabel, scaledText(scale, 35, 39)]} lightColor="#F4D68A" darkColor="#F4D68A">Memory Spark ✦</ThemedText>
        <ThemedText
          adjustsFontSizeToFit
          maxFontSizeMultiplier={1.15}
          minimumFontScale={0.72}
          numberOfLines={3}
          selectable={!compact}
          style={[styles.memoryText, scaledText(scale, 23, 28)]}
          lightColor="#FFF8E8"
          darkColor="#FFF8E8">
          {card.memorySpark?.caption ?? 'This day kept its quieter moments close.'}
        </ThemedText>
      </View>
      {card.memorySpark?.photoUri ? (
        <Image
          cachePolicy="memory-disk"
          contentFit="cover"
          source={card.memorySpark.photoUri}
          style={[styles.memoryPhoto, { borderRadius: 10 * scale, height: 126 * scale, left: 510 * scale, top: 7 * scale, width: 145 * scale }]}
          transition={0}
        />
      ) : (
        <View style={[styles.memoryPlaceholder, { height: 105 * scale, left: 535 * scale, top: 19 * scale, width: 105 * scale }]}>
          <IconSymbol color="rgba(255,226,159,0.72)" name="photo.fill" size={Math.max(15, 42 * scale)} />
        </View>
      )}
      <View style={[styles.memoryStamp, { height: 78 * scale, right: 18 * scale, width: 78 * scale }]}>
        <IconSymbol color="#F4C65F" name="heart.fill" size={Math.max(12, 34 * scale)} />
      </View>
    </View>
  );
}

function resolveFacets(card: DailyCreatureCard): Record<CardFacetKey, CardFacet> {
  if (card.facets) return card.facets;
  const fallback = (key: CardFacetKey, label: string, value: string): CardFacet => ({ key, label, value, iconKey: key, evidence: [] });
  return {
    mood: fallback('mood', 'Mood', card.state.tone),
    energy: fallback('energy', 'Energy', card.state.vitality),
    sleep: fallback('sleep', 'Sleep', 'Not logged'),
    place: fallback('place', 'Place', card.placeLabel ?? 'Not logged'),
    social: fallback('social', 'Social', 'Not noted'),
  };
}

export function DailyCardThumbnail({ card, onPress }: Pick<DailyCardProps, 'card' | 'onPress'>) {
  const visual = getCreatureVisual(card.visualKey);
  const source = resolveCreatureVariantSource(card.visualKey, card.variantCell) ?? visual.source;
  const accent = RARITY_COLORS[card.rarity];
  const colors = SCENE_COLORS[card.scene?.backdrop ?? card.treatment.backdrop];
  return (
    <Pressable accessibilityLabel={`Open ${card.creatureName} card`} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.thumbnail, { borderColor: accent }, pressed ? styles.pressed : null]}>
      <LinearGradient colors={['#FFF9EA', '#E8D2A6']} style={StyleSheet.absoluteFill} />
      <View style={styles.thumbnailTop}><ThemedText style={styles.thumbnailDate} lightColor="#705E41" darkColor="#705E41">{formatCardDate(card.isoDate)}</ThemedText><View style={[styles.rarityDot, { backgroundColor: accent }]} /></View>
      <LinearGradient colors={colors} style={styles.thumbnailArt}><Image cachePolicy="memory-disk" contentFit="contain" source={source} style={styles.thumbnailCreature} transition={0} /></LinearGradient>
      <ThemedText numberOfLines={1} type="display" style={styles.thumbnailName} lightColor="#3D311F" darkColor="#3D311F">{card.creatureName}</ThemedText>
      <ThemedText numberOfLines={1} style={styles.thumbnailState} lightColor="#715E41" darkColor="#715E41">{card.epithet}</ThemedText>
    </Pressable>
  );
}

function formatCardDateParts(isoDate: string): { dayMonth: string; weekday: string } {
  const date = new Date(`${isoDate}T12:00:00`);
  return {
    dayMonth: date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
    weekday: date.toLocaleDateString(undefined, { weekday: 'short' }),
  };
}

function formatCardDate(isoDate: string): string {
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function sceneLabel(backdrop: NonNullable<DailyCreatureCard['scene']>['backdrop']): string {
  const labels: Record<typeof backdrop, string> = {
    cafe: 'Café Day', city: 'City Day', dawn: 'First Light', home: 'Home Day', meadow: 'Meadow Day', nature: 'Nature Day', night: 'Night Day', rain: 'Rainy Day', snow: 'Snow Day', storm: 'Storm Day',
  };
  return labels[backdrop];
}

export function frameRect(scale: number, x: number, y: number, width: number, height: number) {
  return { height: height * scale, left: x * scale, position: 'absolute' as const, top: y * scale, width: width * scale };
}

function scaledText(scale: number, fontSize: number, lineHeight: number) {
  return { fontSize: fontSize * scale, lineHeight: lineHeight * scale };
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.9, transform: [{ scale: 0.985 }] },
  centerBox: { alignItems: 'center', justifyContent: 'center' },
  centered: { textAlign: 'center' },
  badgeIcon: { alignItems: 'center', justifyContent: 'center' },
  rarity: { fontFamily: 'Manrope', fontWeight: '900', letterSpacing: 0.3 },
  name: { fontFamily: 'Manrope', fontWeight: '900', letterSpacing: -1 },
  epithet: { fontFamily: 'InstrumentSerif', fontStyle: 'italic' },
  dateStamp: { alignItems: 'center', justifyContent: 'center' },
  dateWeekday: { fontFamily: 'Manrope', fontWeight: '900' },
  dateValue: { fontFamily: 'InstrumentSerif', fontWeight: '700' },
  dayTag: { alignItems: 'center', gap: 2, justifyContent: 'center' },
  dayTagText: { fontFamily: 'InstrumentSerif', fontWeight: '700' },
  scene: { alignItems: 'center', justifyContent: 'flex-end', overflow: 'hidden' },
  sceneImage: { ...StyleSheet.absoluteFillObject, opacity: 0.82 },
  sceneGlow: { backgroundColor: 'rgba(255,229,153,0.34)', borderRadius: 999, height: '56%', position: 'absolute', top: '-10%', width: '62%' },
  creature: { bottom: '1%', height: '83%', position: 'absolute', width: '85%', zIndex: 2 },
  weather: { ...StyleSheet.absoluteFillObject, zIndex: 3 },
  rainDrop: { backgroundColor: 'rgba(225,243,240,0.72)', position: 'absolute', transform: [{ rotate: '12deg' }], width: 1 },
  snowDot: { backgroundColor: 'rgba(255,255,255,0.88)', borderRadius: 999, position: 'absolute' },
  story: { alignItems: 'center', fontFamily: 'InstrumentSerif', fontStyle: 'italic', fontWeight: '600', justifyContent: 'center', paddingHorizontal: 8, textAlign: 'center', textAlignVertical: 'center' },
  row: { flexDirection: 'row' },
  facet: { alignItems: 'center', backgroundColor: 'rgba(255,250,235,0.52)', borderColor: 'rgba(125,91,40,0.22)', borderCurve: 'continuous', borderWidth: 1, boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.5), 0 1px 2px rgba(77,49,13,0.13)', flex: 1, justifyContent: 'center' },
  facetIcon: { alignItems: 'center', justifyContent: 'center' },
  facetLabel: { fontFamily: 'Manrope', fontWeight: '700', textAlign: 'center' },
  facetValue: { fontFamily: 'InstrumentSerif', fontWeight: '700', textAlign: 'center' },
  wideFact: { alignItems: 'center', backgroundColor: 'rgba(255,250,235,0.48)', borderColor: 'rgba(125,91,40,0.2)', borderCurve: 'continuous', borderWidth: 1, boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.48), 0 1px 2px rgba(77,49,13,0.12)', flex: 1, flexDirection: 'row', justifyContent: 'center' },
  wideCopy: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  wideLabel: { fontFamily: 'Manrope', fontWeight: '800', textAlign: 'center', textTransform: 'uppercase' },
  wideValue: { fontFamily: 'InstrumentSerif', fontWeight: '700', textAlign: 'center' },
  memory: { alignItems: 'center', flexDirection: 'row' },
  memorySeal: { alignItems: 'center', borderColor: '#E9D087', borderWidth: 1, justifyContent: 'center', position: 'absolute' },
  memoryCopy: { justifyContent: 'center', position: 'absolute' },
  memoryLabel: { fontFamily: 'InstrumentSerif', fontWeight: '700' },
  memoryText: { fontFamily: 'InstrumentSerif', fontStyle: 'italic' },
  memoryPhoto: { borderColor: '#F3DFB0', borderWidth: 2, position: 'absolute', transform: [{ rotate: '-3deg' }] },
  memoryPlaceholder: { alignItems: 'center', borderColor: 'rgba(255,226,159,0.34)', borderRadius: 12, borderWidth: 1, justifyContent: 'center', position: 'absolute', transform: [{ rotate: '-3deg' }] },
  memoryStamp: { alignItems: 'center', borderColor: 'rgba(244,198,95,0.55)', borderRadius: 999, borderWidth: 1, justifyContent: 'center', position: 'absolute' },
  thumbnail: { aspectRatio: 0.7, borderCurve: 'continuous', borderRadius: 22, borderWidth: 1.5, boxShadow: '0 8px 18px rgba(9,7,4,0.22)', gap: 6, overflow: 'hidden', padding: 9 },
  thumbnailTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  thumbnailDate: { fontSize: 9, fontWeight: '800' },
  rarityDot: { borderRadius: 999, height: 8, width: 8 },
  thumbnailArt: { alignItems: 'center', borderRadius: 14, flex: 1, justifyContent: 'flex-end', overflow: 'hidden' },
  thumbnailCreature: { height: '96%', width: '96%' },
  thumbnailName: { fontSize: 17, lineHeight: 19, textAlign: 'center' },
  thumbnailState: { fontSize: 9, fontStyle: 'italic', fontWeight: '700', textAlign: 'center' },
});
