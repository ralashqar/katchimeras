import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { createContext, memo, type ReactNode, use } from 'react';
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
import { CreatureGroundShadow } from '@/components/katchadeck/creature-ground-shadow';
import { WispArtwork } from '@/components/katchadeck/wisps/wisp-artwork';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { TODAY_ATMOSPHERE_BACKGROUND_SOURCES } from '@/constants/today-atmosphere-background-sources.gen';
import { TODAY_EXPLORATION_BACKGROUND_SOURCES } from '@/constants/today-exploration-background-sources.gen';
import { AppFontFamilies } from '@/constants/theme';
import { sceneDefinition } from '@/constants/scenes';
import type {
  CardDayGlyph,
  CardDayGlyphKey,
  CardFacet,
  CardFacetKey,
  DailyCreatureCard,
  WeatherCondition,
} from '@/types/home';
import { resolveCreatureArtSource } from '@/utils/creature-art';
import { resolveDailyCardSkySceneId } from '@/utils/daily-card-scene';
import { compactCardQuote, compactFacetValue, compactHighlight, compactStoryLine, formatCardSteps } from '@/utils/daily-card-display';
import {
  CARD_SCENE_TOP,
  COMPACT_CARD_FRAME_RECTS,
  COMPACT_CARD_SCENE_HEIGHT,
  COMPACT_CARD_SCENE_TOP,
  COMPACT_CARD_STORY_HEIGHT,
  COMPACT_CARD_STORY_TOP,
  COMPACT_DAILY_CARD_HORIZONTAL_GUTTER,
  COMPACT_DAILY_CARD_MAX_HEIGHT,
  COMPACT_DAILY_CARD_MAX_WIDTH,
  FULL_CARD_SCENE_HEIGHT,
  type DailyCardSize,
  resolveCompactDailyCardSize,
  resolveDetailDailyCardSize,
} from '@/utils/daily-card-layout';
import { kingdomResidentTileForIdentity } from '@/utils/kingdom-surface-tiles';
import { kingdomHexTileSourceForLod } from '@/utils/world-visuals';

type DailyCardVariant = 'carousel' | 'detail';
export type DailyCardSceneArt = 'day' | 'kingdom';
export type DailyCardRenderTier = 'focused' | 'neighbor' | 'buffer';

export type { DailyCardSize } from '@/utils/daily-card-layout';
export { resolveCompactDailyCardSize } from '@/utils/daily-card-layout';

type DailyCardProps = {
  card: DailyCreatureCard;
  compact?: boolean;
  frameSize?: DailyCardSize;
  onPress?: () => void;
  renderTier?: DailyCardRenderTier;
  sceneArt?: DailyCardSceneArt;
  style?: StyleProp<ViewStyle>;
  variant?: DailyCardVariant;
};

export { COMPACT_DAILY_CARD_HORIZONTAL_GUTTER, COMPACT_DAILY_CARD_MAX_HEIGHT, COMPACT_DAILY_CARD_MAX_WIDTH };

const DAY_CARD_WISP_SCALE = 1.35;
const DAY_CARD_WISP_LIFT_RATIO = 0.4;

const CompactDailyCardSizeContext = createContext<DailyCardSize | null>(null);

function areDailyCardPropsEqual(previous: DailyCardProps, next: DailyCardProps) {
  return previous.card.id === next.card.id
    && previous.card.sealedAt === next.card.sealedAt
    && previous.card.schemaVersion === next.card.schemaVersion
    && dayGlyphSignature(previous.card) === dayGlyphSignature(next.card)
    && previous.compact === next.compact
    && previous.frameSize?.height === next.frameSize?.height
    && previous.frameSize?.width === next.frameSize?.width
    && previous.onPress === next.onPress
    && previous.renderTier === next.renderTier
    && previous.sceneArt === next.sceneArt
    && previous.style === next.style
    && previous.variant === next.variant;
}

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

const meadowScene = require('@incubator/art-world/base/base_meadow.webp');
const cafeScene = require('@incubator/art-environments/coffee_cafe/base.jpg');

const FACET_ORDER: CardFacetKey[] = ['mood', 'energy', 'sleep', 'place'];

const FACET_ART: Partial<Record<CardFacetKey, number>> = {
  place: require('@incubator/art-card-icons/place.png'),
};

const ENERGY_ART = {
  high: require('@incubator/art-card-icons/energy.png'),
  low: require('@incubator/art-card-icons/energy-low.png'),
  steady: require('@incubator/art-card-icons/energy-steady.png'),
} as const;

const MOOD_ART: Record<string, number> = {
  radiant: require('@incubator/art-today-icons/moods/radiant.webp'),
  light: require('@incubator/art-today-icons/moods/light.webp'),
  meh: require('@incubator/art-today-icons/moods/meh.webp'),
  heavy: require('@incubator/art-today-icons/moods/heavy.webp'),
  stormy: require('@incubator/art-today-icons/moods/stormy.webp'),
};

const SLEEP_ART: Record<string, number> = {
  good: require('@incubator/art-today-icons/sleep/good.webp'),
  low: require('@incubator/art-today-icons/sleep/low.webp'),
  normal: require('@incubator/art-today-icons/sleep/normal.webp'),
};

const FACT_ART = {
  steps: require('@incubator/art-card-icons/steps.png'),
  highlight: require('@incubator/art-card-icons/highlight.png'),
  trait: require('@incubator/art-card-icons/trait.png'),
} as const;

const DAY_GLYPH_ART: Record<CardDayGlyphKey, number> = {
  movement: require('@incubator/art-card-glyphs/movement.png'),
  connection: require('@incubator/art-card-glyphs/connection.png'),
  milestone: require('@incubator/art-card-glyphs/milestone.png'),
  explore: require('@incubator/art-card-glyphs/explore.png'),
  nature: require('@incubator/art-card-glyphs/nature.png'),
  food: require('@incubator/art-card-glyphs/food.png'),
  culture: require('@incubator/art-card-glyphs/culture.png'),
  focus: require('@incubator/art-card-glyphs/focus.png'),
};

export function CompactDailyCardSizeProvider({ children, size }: { children: ReactNode; size: DailyCardSize }) {
  return <CompactDailyCardSizeContext value={size}>{children}</CompactDailyCardSizeContext>;
}

export const DailyCard = memo(function DailyCard({ card, compact, frameSize, onPress, renderTier = 'focused', sceneArt = 'day', style, variant = compact ? 'carousel' : 'detail' }: DailyCardProps) {
  const inheritedSize = use(CompactDailyCardSizeContext);
  const fixedSize = frameSize ?? (variant === 'carousel' ? inheritedSize : null);
  if (fixedSize) {
    return <ResolvedDailyCard card={card} onPress={onPress} renderTier={renderTier} sceneArt={sceneArt} size={fixedSize} style={style} variant={variant} />;
  }
  return <ResponsiveDailyCard card={card} onPress={onPress} renderTier={renderTier} sceneArt={sceneArt} style={style} variant={variant} />;
}, areDailyCardPropsEqual);

function ResponsiveDailyCard({ card, onPress, renderTier, sceneArt, style, variant }: Omit<DailyCardProps, 'compact' | 'frameSize' | 'variant'> & { variant: DailyCardVariant }) {
  const window = useWindowDimensions();
  const defaultCompactMaxHeight = Math.max(312, window.height - 260);
  const size = variant === 'carousel'
    ? resolveCompactDailyCardSize(window.width, defaultCompactMaxHeight)
    : resolveDetailDailyCardSize(window.width);
  return <ResolvedDailyCard card={card} onPress={onPress} renderTier={renderTier} sceneArt={sceneArt} size={size} style={style} variant={variant} />;
}

function ResolvedDailyCard({ card, onPress, renderTier = 'focused', sceneArt, size, style, variant }: Omit<DailyCardProps, 'compact' | 'frameSize' | 'variant'> & { size: DailyCardSize; variant: DailyCardVariant }) {
  return (
    <Pressable
      accessibilityLabel={cardAccessibilityLabel(card, Boolean(onPress))}
      accessibilityRole={onPress ? 'button' : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => (pressed ? styles.pressed : null)}>
      <CardContent card={card} renderTier={renderTier} sceneArt={sceneArt} size={size} style={style} variant={variant} />
    </Pressable>
  );
}

const CardContent = memo(function CardContent({ card, renderTier, sceneArt = 'day', size, style, variant }: { card: DailyCreatureCard; renderTier: DailyCardRenderTier; sceneArt?: DailyCardSceneArt; size: DailyCardSize; style?: StyleProp<ViewStyle>; variant: DailyCardVariant }) {
  const compact = variant === 'carousel';
  if (compact) {
    return (
      <View style={style}>
        <OrnateCardFrame
          background={<Scene card={card} compact renderTier={renderTier} scale={size.scale} sceneArt={sceneArt} />}
          height={size.height}
          variant="compact"
          width={size.width}>
          <CardHeader card={card} compact scale={size.scale} />
          <CardStory card={card} compact scale={size.scale} />
        </OrnateCardFrame>
      </View>
    );
  }

  const facets = resolveFacets(card);
  const facts = card.dayFacts;
  return (
    <View style={style}>
      <OrnateCardFrame
        background={<Scene card={card} compact={false} renderTier="focused" scale={size.scale} sceneArt={sceneArt} />}
        height={size.height}
        variant="full"
        width={size.width}>
        <CardHeader card={card} compact={false} scale={size.scale} />
        <CardStory card={card} compact={false} scale={size.scale} />
        <View style={[frameRect(size.scale, 58, 1102, 825, 178), styles.row, { gap: 10 * size.scale }]}>
          {FACET_ORDER.map((key) => <FacetCell facet={facets[key]} key={key} scale={size.scale} selectable={!compact} />)}
        </View>
        <View style={[frameRect(size.scale, 58, 1288, 825, 118), styles.row, { gap: 9 * size.scale }]}>
          <StepsFact art={FACT_ART.steps} scale={size.scale} selectable={!compact} steps={facts?.steps ?? 0} />
          <WideFact art={FACT_ART.highlight} label="Highlight" scale={size.scale} selectable={!compact} value={compactHighlight(facts?.highlight ?? card.memorySpark?.caption ?? 'A quiet day')} />
          <WideFact art={FACT_ART.trait} label="Trait" scale={size.scale} selectable={!compact} value={facts?.bonusTrait?.label ?? card.traits[0]?.label ?? 'Unique'} />
        </View>
        <MemoryStrip card={card} compact={false} scale={size.scale} />
      </OrnateCardFrame>
    </View>
  );
}, (previous, next) => previous.card.id === next.card.id
  && previous.card.sealedAt === next.card.sealedAt
  && previous.card.schemaVersion === next.card.schemaVersion
  && dayGlyphSignature(previous.card) === dayGlyphSignature(next.card)
  && (previous.renderTier === 'buffer') === (next.renderTier === 'buffer')
  && previous.size.height === next.size.height
  && previous.size.width === next.size.width
  && previous.sceneArt === next.sceneArt
  && previous.style === next.style
  && previous.variant === next.variant);

function CardStory({ card, compact, scale }: { card: DailyCreatureCard; compact: boolean; scale: number }) {
  const rect = compact
    ? frameRect(scale, 108, COMPACT_CARD_STORY_TOP, 725, COMPACT_CARD_STORY_HEIGHT)
    : frameRect(scale, 72, 1047, 797, 47);
  const story = compact
    ? compactCardQuote(card)
    : compactStoryLine(card);
  return (
    <View style={[rect, styles.centerBox]}>
      <ThemedText
        adjustsFontSizeToFit
        maxFontSizeMultiplier={1.15}
        minimumFontScale={compact ? 0.78 : 0.72}
        numberOfLines={compact ? 3 : 1}
        selectable={!compact}
        style={[styles.story, compact ? styles.compactStory : null, scaledText(scale, compact ? 42 : 22, compact ? 50 : 26)]}
        lightColor="#5A472E"
        darkColor="#5A472E">
        ❧ {story} ❧
      </ThemedText>
    </View>
  );
}

function CardHeader({ card, compact, scale }: { card: DailyCreatureCard; compact: boolean; scale: number }) {
  const date = formatCardDateParts(card.isoDate);
  const backdrop = card.scene?.backdrop ?? card.treatment.backdrop;
  const badgeRect = compact ? scaledFrameSlot(scale, COMPACT_CARD_FRAME_RECTS.badge) : frameRect(scale, 61, 67, 126, 143);
  const rarityRect = compact ? scaledFrameSlot(scale, COMPACT_CARD_FRAME_RECTS.rarity) : frameRect(scale, 58, 218, 133, 58);
  const nameRect = compact ? scaledFrameSlot(scale, COMPACT_CARD_FRAME_RECTS.name) : frameRect(scale, 202, 67, 544, 135);
  const epithetRect = compact ? scaledFrameSlot(scale, COMPACT_CARD_FRAME_RECTS.epithet) : frameRect(scale, 278, 229, 385, 54);
  const dateRect = compact ? scaledFrameSlot(scale, COMPACT_CARD_FRAME_RECTS.date) : frameRect(scale, 755, 72, 127, 183);
  const tagRect = compact ? scaledFrameSlot(scale, COMPACT_CARD_FRAME_RECTS.tag) : frameRect(scale, 750, 330, 112, 160);
  return (
    <>
      <View style={[badgeRect, styles.badgeIcon]}>
        <IconSymbol color="#FFF0B1" name="sparkles" size={Math.max(15, 54 * scale)} />
      </View>
      <View style={[rarityRect, styles.centerBox]}>
        <ThemedText
          adjustsFontSizeToFit
          maxFontSizeMultiplier={1.15}
          minimumFontScale={0.76}
          numberOfLines={1}
          style={[styles.centered, styles.rarity, scaledText(scale, compact ? 29 : 27, compact ? 35 : 32)]}
          lightColor="#FFF0C7"
          darkColor="#FFF0C7">
          {card.primaryWispId ? 'DAY WISP' : card.rarity.toUpperCase()}
        </ThemedText>
      </View>
      <View style={[nameRect, styles.centerBox]}>
        <ThemedText
          adjustsFontSizeToFit
          maxFontSizeMultiplier={1.15}
          minimumFontScale={0.64}
          numberOfLines={1}
          selectable={!compact}
          style={[styles.centered, styles.name, scaledText(scale, compact ? 58 : 58, compact ? 65 : 65)]}
          lightColor="#3E6522"
          darkColor="#3E6522">
          {card.creatureName.toUpperCase()}
        </ThemedText>
      </View>
      <View style={[epithetRect, styles.centerBox]}>
        <ThemedText
          adjustsFontSizeToFit
          maxFontSizeMultiplier={1.15}
          minimumFontScale={0.72}
          numberOfLines={1}
          style={[styles.centered, styles.epithet, scaledText(scale, compact ? 35 : 34, compact ? 42 : 39)]}
          lightColor="#FFF7E8"
          darkColor="#FFF7E8">
          ✦ {card.epithet} ✦
        </ThemedText>
      </View>
      <View style={[dateRect, styles.dateStamp]}>
        <IconSymbol color="#70562E" name="calendar" size={Math.max(12, (compact ? 42 : 38) * scale)} />
        <ThemedText style={[styles.centered, styles.dateWeekday, scaledText(scale, compact ? 38 : 35, compact ? 39 : 38)]} lightColor="#59472E" darkColor="#59472E">{date.weekday}</ThemedText>
        <ThemedText style={[styles.centered, styles.dateValue, scaledText(scale, compact ? 36 : 34, 38)]} lightColor="#59472E" darkColor="#59472E">{date.dayMonth}</ThemedText>
      </View>
      <View style={[tagRect, styles.dayTag]}>
        <IconSymbol color="#FFE4A1" name="leaf.fill" size={Math.max(11, 32 * scale)} />
        <ThemedText
          adjustsFontSizeToFit
          maxFontSizeMultiplier={1.15}
          minimumFontScale={0.72}
          numberOfLines={2}
          style={[styles.centered, styles.dayTagText, scaledText(scale, compact ? 27 : 25, compact ? 32 : 28)]}
          lightColor="#FFF0C7"
          darkColor="#FFF0C7">
          {card.sceneVariantId ? sceneDefinition(card.sceneVariantId).name : sceneLabel(backdrop)}
        </ThemedText>
      </View>
    </>
  );
}

function Scene({ card, compact, renderTier, scale, sceneArt }: { card: DailyCreatureCard; compact: boolean; renderTier: DailyCardRenderTier; scale: number; sceneArt: DailyCardSceneArt }) {
  // Cards animate between carousel positions and into the expanded viewer. Keep
  // visible cards on their full source so those transforms never enlarge a
  // thumbnail that was decoded for a smaller slot.
  const imageLod = compact && renderTier === 'buffer' ? 'medium' : 'full';
  const imagePriority = renderTier === 'focused' ? 'high' : renderTier === 'neighbor' ? 'normal' : 'low';
  const source = card.primaryWispId ? null : resolveCreatureArtSource(card.visualKey, {
    lod: imageLod,
    variantCell: card.variantCell,
  });
  const backdrop = card.scene?.backdrop ?? card.treatment.backdrop;
  const colors = SCENE_COLORS[backdrop];
  const weatherModifier = card.scene?.atmosphere?.weatherModifier;
  const weather = weatherModifier?.condition
    ?? card.scene?.weather
    ?? (backdrop === 'rain' || backdrop === 'storm' || backdrop === 'snow' ? backdrop : 'clear');
  const weatherStrength = weatherModifier?.strength ?? 0;
  const sceneSource = backdrop === 'cafe' || backdrop === 'home' || backdrop === 'city' ? cafeScene : meadowScene;
  const environmentVisualKey = card.scene?.environment?.visualKey ?? card.visualKey;
  const kingdomTile = sceneArt === 'kingdom' && !card.primaryWispId
    ? kingdomResidentTileForIdentity({ visualKey: environmentVisualKey })
    : null;
  const kingdomSource = kingdomTile
    ? kingdomHexTileSourceForLod(kingdomTile, imageLod)
    : null;
  const skySource = TODAY_ATMOSPHERE_BACKGROUND_SOURCES[
    resolveDailyCardSkySceneId(card)
  ].source;
  const cinematicSceneSource = card.primaryWispId && card.sceneVariantId
    ? TODAY_EXPLORATION_BACKGROUND_SOURCES[card.sceneVariantId].source
    : null;
  const kingdomEnvironmentSize = (compact ? 785 : 763) * scale;
  const kingdomEnvironmentBottom = (compact ? 0 : 5) * scale;
  const kingdomCreatureFrameSize = Math.min(
    835 * 0.389,
    (compact ? COMPACT_CARD_SCENE_HEIGHT : FULL_CARD_SCENE_HEIGHT) * 0.3651,
  ) * scale;
  const primaryWispSize = (compact ? 300 : 270) * scale * DAY_CARD_WISP_SCALE;
  return (
    <LinearGradient
      colors={colors}
      style={[frameRect(scale, 53, compact ? COMPACT_CARD_SCENE_TOP : CARD_SCENE_TOP, 835, compact ? COMPACT_CARD_SCENE_HEIGHT : FULL_CARD_SCENE_HEIGHT), styles.scene, { borderRadius: 22 * scale }]}>
        {kingdomSource || cinematicSceneSource ? (
          <Image
            allowDownscaling={false}
            cachePolicy="memory-disk"
            contentFit="cover"
            pointerEvents="none"
            priority={imagePriority}
            source={cinematicSceneSource ?? skySource}
            style={styles.cardSkyImage}
            transition={0}
          />
        ) : null}
        {kingdomSource ? (
          <Image
            allowDownscaling={false}
            cachePolicy="memory-disk"
            contentFit="contain"
            pointerEvents="none"
            priority={imagePriority}
            source={kingdomSource}
            style={[
              styles.kingdomSceneImage,
              {
                bottom: kingdomEnvironmentBottom,
                height: kingdomEnvironmentSize,
                marginLeft: -kingdomEnvironmentSize / 2,
                width: kingdomEnvironmentSize,
              },
            ]}
            transition={0}
          />
        ) : cinematicSceneSource ? null : (
          <Image allowDownscaling={false} cachePolicy="memory-disk" contentFit="cover" priority={imagePriority} source={sceneSource} style={styles.sceneImage} transition={0} />
        )}
        <LinearGradient
          colors={kingdomSource ? ['rgba(255,244,207,0.01)', 'rgba(38,43,28,0.24)'] : ['rgba(255,244,207,0.04)', `${colors[2]}88`]}
          style={StyleSheet.absoluteFill}
        />
        {weatherModifier ? <WeatherTint condition={weatherModifier.condition} strength={weatherStrength} /> : null}
        {renderTier !== 'buffer' && (weather === 'rain' || weather === 'storm') ? <RainOverlay scale={scale} strength={weatherStrength || 1} /> : null}
        {renderTier !== 'buffer' && weather === 'snow' ? <SnowOverlay scale={scale} strength={weatherStrength || 1} /> : null}
        {kingdomSource && source ? (
          <View
            pointerEvents="none"
            style={[
              styles.kingdomCreatureFrame,
              {
                bottom: '41%',
                height: kingdomCreatureFrameSize,
                marginLeft: -kingdomCreatureFrameSize / 2,
                width: kingdomCreatureFrameSize,
              },
            ]}>
            <CreatureGroundShadow
              frameSize={kingdomCreatureFrameSize}
              visualKey={card.visualKey}
            />
            <Image
              allowDownscaling={false}
              cachePolicy="memory-disk"
              contentFit="contain"
              priority={imagePriority}
              source={source}
              style={StyleSheet.absoluteFill}
              transition={0}
            />
          </View>
        ) : source ? (
          <Image
            allowDownscaling={false}
            cachePolicy="memory-disk"
            contentFit="contain"
            priority={imagePriority}
            source={source}
            style={[styles.creature, compact ? styles.compactCreature : null]}
            transition={0}
          />
        ) : card.primaryWispId ? (
          <View
            pointerEvents="none"
            style={[
              styles.primaryWisp,
              { transform: [{ translateY: -primaryWispSize * DAY_CARD_WISP_LIFT_RATIO }] },
            ]}>
            <WispArtwork
              id={card.primaryWispId}
              size={primaryWispSize}
              thumbnail={compact}
            />
          </View>
        ) : null}
      {!card.primaryWispId && (card.featuredWisps ?? []).slice(0, 2).map((featured, index) => (
        <WispArtwork
          id={featured.wispId}
          key={featured.wispId}
          size={(compact ? 88 : 78) * scale}
          thumbnail={compact}
          style={[
            styles.featuredWisp,
            index === 0 ? styles.featuredWispLeft : styles.featuredWispRight,
            { top: (compact ? 95 : 86) * scale },
          ]}
        />
      ))}
      <CardGlyphStrip compact={compact} glyphs={card.dayGlyphs ?? []} scale={scale} />
    </LinearGradient>
  );
}

function CardGlyphStrip({
  compact,
  glyphs,
  scale,
}: {
  compact: boolean;
  glyphs: readonly CardDayGlyph[];
  scale: number;
}) {
  if (glyphs.length === 0) return null;
  const diameter = (compact ? 74 : 62) * scale;
  const compactHalfIconOffset = compact ? diameter / 2 : 0;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[
        styles.dayGlyphStrip,
        {
          bottom: (compact ? 78 : 46) * scale + compactHalfIconOffset,
          gap: 10 * scale,
          right: 18 * scale + compactHalfIconOffset,
        },
      ]}>
      {[...glyphs].reverse().map((glyph) => (
        <View
          key={glyph.key}
          style={[
            styles.dayGlyphCircle,
            {
              borderRadius: diameter / 2,
              borderWidth: Math.max(1, 2.5 * scale),
              height: diameter,
              width: diameter,
            },
          ]}>
          <Image
            contentFit="contain"
            source={DAY_GLYPH_ART[glyph.key]}
            style={{ height: diameter * 0.68, width: diameter * 0.68 }}
            transition={0}
          />
        </View>
      ))}
    </View>
  );
}

function WeatherTint({ condition, strength }: { condition: WeatherCondition; strength: number }) {
  const color = weatherTintColor(condition, strength);
  return color ? <View pointerEvents="none" style={[styles.weatherTint, { backgroundColor: color }]} /> : null;
}

function RainOverlay({ scale, strength }: { scale: number; strength: number }) {
  return <View pointerEvents="none" style={[styles.weather, { opacity: Math.min(0.72, 0.28 + strength) }]}>{[8, 21, 35, 50, 66, 81, 94].map((left, index) => <View key={left} style={[styles.rainDrop, { height: Math.max(10, 40 * scale), left: `${left}%`, top: `${5 + (index % 3) * 12}%` }]} />)}</View>;
}

function SnowOverlay({ scale, strength }: { scale: number; strength: number }) {
  return <View pointerEvents="none" style={[styles.weather, { opacity: Math.min(0.8, 0.35 + strength) }]}>{[9, 23, 38, 53, 69, 83, 94].map((left, index) => <View key={left} style={[styles.snowDot, { height: Math.max(3, 12 * scale), left: `${left}%`, top: `${7 + (index % 4) * 13}%`, width: Math.max(3, 12 * scale) }]} />)}</View>;
}

function weatherTintColor(condition: WeatherCondition, strength: number): string | null {
  const alpha = Math.max(0, Math.min(0.25, strength));
  if (alpha === 0) return null;
  switch (condition) {
    case 'clear': return `rgba(255,220,143,${alpha * 0.22})`;
    case 'partly_cloudy': return `rgba(210,220,222,${alpha * 0.28})`;
    case 'cloudy': return `rgba(112,126,136,${alpha * 0.48})`;
    case 'fog': return `rgba(225,232,226,${alpha * 0.72})`;
    case 'rain': return `rgba(68,92,108,${alpha * 0.52})`;
    case 'snow': return `rgba(224,239,241,${alpha * 0.6})`;
    case 'storm': return `rgba(45,43,68,${alpha * 0.7})`;
  }
}

function FacetCell({ facet, scale, selectable }: { facet: CardFacet; scale: number; selectable: boolean }) {
  return (
    <View style={[styles.facet, { borderRadius: 20 * scale, paddingHorizontal: 7 * scale, paddingVertical: 7 * scale }]}>
      <FacetIcon facet={facet} scale={scale} />
      <ThemedText maxFontSizeMultiplier={1.15} numberOfLines={1} style={[styles.facetLabel, scaledText(scale, 17, 20)]} lightColor="#7A6746" darkColor="#7A6746">{facet.label}</ThemedText>
      <ThemedText
        adjustsFontSizeToFit
        maxFontSizeMultiplier={1.15}
        minimumFontScale={0.72}
        numberOfLines={1}
        selectable={selectable}
        style={[styles.facetValue, scaledText(scale, 27, 30)]}
        lightColor="#44351F"
        darkColor="#44351F">
        {compactFacetValue(facet)}
      </ThemedText>
    </View>
  );
}

function FacetIcon({ facet, scale }: { facet: CardFacet; scale: number }) {
  const art = resolveFacetArt(facet);
  if (art) {
    return (
      <View style={[styles.facetIcon, { height: 82 * scale, width: '100%' }]}>
        <Image contentFit="contain" source={art} style={{ height: 78 * scale, width: 78 * scale }} transition={0} />
      </View>
    );
  }
  return <View style={[styles.facetIcon, { height: 86 * scale }]}><IconSymbol color="#617B3D" name="person.2.fill" size={Math.max(13, 50 * scale)} /></View>;
}

function resolveFacetArt(facet: CardFacet): number | undefined {
  if (facet.key === 'mood') return MOOD_ART[facet.iconKey.split(':')[1]] ?? MOOD_ART.meh;
  if (facet.key === 'energy') {
    const value = facet.value.toLowerCase();
    if (value === 'high' || value === 'bright') return ENERGY_ART.high;
    if (value === 'calm' || value === 'low-key' || value === 'low') return ENERGY_ART.low;
    return ENERGY_ART.steady;
  }
  if (facet.key === 'sleep') {
    const value = facet.value.toLowerCase();
    const loggedHours = Number.parseInt(value.match(/^(\d+)h/)?.[1] ?? '', 10);
    if (value === 'good' || loggedHours >= 7) return SLEEP_ART.good;
    if (value === 'low' || loggedHours < 6) return SLEEP_ART.low;
    return SLEEP_ART.normal;
  }
  return FACET_ART[facet.key];
}

function StepsFact({ art, scale, selectable, steps }: { art: number; scale: number; selectable: boolean; steps: number }) {
  return (
    <View style={[styles.wideFact, { borderRadius: 18 * scale, gap: 7 * scale, paddingHorizontal: 8 * scale, paddingVertical: 5 * scale }]}>
      <Image contentFit="contain" source={art} style={{ height: 88 * scale, width: 88 * scale }} transition={0} />
      <View style={styles.stepsCopy}>
        <ThemedText
          selectable={selectable}
          style={[styles.stepsValue, scaledText(scale, 39, 40)]}
          lightColor="#483A27"
          darkColor="#483A27">
          {formatCardSteps(steps)}
        </ThemedText>
        <ThemedText style={[styles.stepsLabel, scaledText(scale, 14, 16)]} lightColor="#806C4A" darkColor="#806C4A">
          Steps
        </ThemedText>
      </View>
    </View>
  );
}

function WideFact({ art, label, scale, selectable, value }: { art: number; label: string; scale: number; selectable: boolean; value: string }) {
  return (
    <View style={[styles.wideFact, { borderRadius: 18 * scale, gap: 7 * scale, paddingHorizontal: 8 * scale, paddingVertical: 5 * scale }]}>
      <Image contentFit="contain" source={art} style={{ height: 88 * scale, width: 88 * scale }} transition={0} />
      <View style={styles.wideCopy}>
        <ThemedText maxFontSizeMultiplier={1.15} numberOfLines={1} style={[styles.wideLabel, scaledText(scale, 15, 18)]} lightColor="#806C4A" darkColor="#806C4A">{label}</ThemedText>
        <ThemedText
          adjustsFontSizeToFit
          maxFontSizeMultiplier={1.15}
          minimumFontScale={0.68}
          numberOfLines={1}
          selectable={selectable}
          style={[styles.wideValue, scaledText(scale, 23, 26)]}
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
          style={[styles.memoryPhoto, { borderRadius: 12 * scale, height: 134 * scale, left: 510 * scale, top: 3 * scale, width: 276 * scale }]}
          transition={0}
        />
      ) : (
        <View style={[styles.memoryPlaceholder, { height: 134 * scale, left: 510 * scale, top: 3 * scale, width: 276 * scale }]}>
          <IconSymbol color="rgba(255,226,159,0.72)" name="photo.fill" size={Math.max(18, 62 * scale)} />
        </View>
      )}
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

function formatCardDateParts(isoDate: string): { dayMonth: string; weekday: string } {
  const date = new Date(`${isoDate}T12:00:00`);
  return {
    dayMonth: date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
    weekday: date.toLocaleDateString(undefined, { weekday: 'short' }),
  };
}

function sceneLabel(backdrop: NonNullable<DailyCreatureCard['scene']>['backdrop']): string {
  const labels: Record<typeof backdrop, string> = {
    cafe: 'Café Day', city: 'City Day', dawn: 'First Light', home: 'Home Day', meadow: 'Meadow Day', nature: 'Nature Day', night: 'Night Day', rain: 'Rainy Day', snow: 'Snow Day', storm: 'Storm Day',
  };
  return labels[backdrop];
}

function dayGlyphSignature(card: DailyCreatureCard): string {
  return (card.dayGlyphs ?? []).map((glyph) => glyph.key).join(':');
}

function cardAccessibilityLabel(card: DailyCreatureCard, opensCard: boolean): string {
  const base = opensCard
    ? `Open ${card.creatureName} card`
    : `${card.creatureName}, ${card.rarity} daily card`;
  const highlights = (card.dayGlyphs ?? []).map((glyph) => glyph.label);
  return highlights.length > 0 ? `${base}. Day highlights: ${highlights.join(', ')}` : base;
}

export function frameRect(scale: number, x: number, y: number, width: number, height: number) {
  return { height: height * scale, left: x * scale, position: 'absolute' as const, top: y * scale, width: width * scale };
}

function scaledFrameSlot(
  scale: number,
  slot: { x: number; y: number; width: number; height: number }
) {
  return frameRect(scale, slot.x, slot.y, slot.width, slot.height);
}

function scaledText(scale: number, fontSize: number, lineHeight: number) {
  return { fontSize: fontSize * scale, lineHeight: lineHeight * scale };
}

const styles = StyleSheet.create({
  centerBox: { alignItems: 'center', justifyContent: 'center' },
  centered: { textAlign: 'center' },
  badgeIcon: { alignItems: 'center', justifyContent: 'center' },
  rarity: { fontFamily: 'Manrope', fontWeight: '900', letterSpacing: 0.3 },
  name: {
    fontFamily: AppFontFamilies.fredokaBold,
    letterSpacing: -0.35,
    textShadowColor: 'rgba(255,255,255,0.42)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  epithet: { fontFamily: 'InstrumentSerif', fontStyle: 'italic' },
  dateStamp: { alignItems: 'center', justifyContent: 'center' },
  dateWeekday: { fontFamily: 'Manrope', fontWeight: '900' },
  dateValue: { fontFamily: 'InstrumentSerif', fontWeight: '700' },
  dayTag: { alignItems: 'center', gap: 2, justifyContent: 'center' },
  dayTagText: { fontFamily: 'InstrumentSerif', fontWeight: '700' },
  pressed: { opacity: 0.9, transform: [{ scale: 0.985 }] },
  scene: { alignItems: 'center', justifyContent: 'flex-end', overflow: 'hidden' },
  cardSkyImage: { ...StyleSheet.absoluteFillObject },
  sceneImage: { ...StyleSheet.absoluteFillObject, opacity: 0.82 },
  kingdomSceneImage: { left: '50%', position: 'absolute', zIndex: 1 },
  creature: { bottom: '1%', height: '83%', position: 'absolute', width: '85%', zIndex: 2 },
  primaryWisp: { alignItems: 'center', bottom: '19%', justifyContent: 'center', position: 'absolute', zIndex: 4 },
  featuredWisp: { position: 'absolute', zIndex: 4 },
  featuredWispLeft: { left: '7%' },
  featuredWispRight: { right: '7%' },
  compactCreature: { bottom: '5%' },
  kingdomCreatureFrame: { left: '50%', position: 'absolute', zIndex: 2 },
  weather: { ...StyleSheet.absoluteFillObject, zIndex: 3 },
  weatherTint: { ...StyleSheet.absoluteFillObject, zIndex: 2 },
  dayGlyphStrip: { alignItems: 'center', flexDirection: 'row', position: 'absolute', zIndex: 4 },
  dayGlyphCircle: {
    alignItems: 'center',
    backgroundColor: 'rgba(35,39,29,0.82)',
    borderColor: '#D9AF61',
    borderCurve: 'continuous',
    boxShadow: '0 2px 5px rgba(38,25,10,0.28), inset 0 1px 1px rgba(255,244,207,0.22)',
    justifyContent: 'center',
  },
  rainDrop: { backgroundColor: 'rgba(225,243,240,0.72)', position: 'absolute', transform: [{ rotate: '12deg' }], width: 1 },
  snowDot: { backgroundColor: 'rgba(255,255,255,0.88)', borderRadius: 999, position: 'absolute' },
  story: { alignItems: 'center', fontFamily: AppFontFamilies.instrumentSerif, fontStyle: 'italic', fontWeight: '600', justifyContent: 'center', paddingHorizontal: 8, textAlign: 'center', textAlignVertical: 'center' },
  compactStory: { fontStyle: 'normal', fontWeight: '700', letterSpacing: 0.1 },
  row: { flexDirection: 'row' },
  facet: { alignItems: 'center', backgroundColor: 'rgba(255,250,235,0.52)', borderColor: 'rgba(125,91,40,0.22)', borderCurve: 'continuous', borderWidth: 1, boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.5), 0 1px 2px rgba(77,49,13,0.13)', flex: 1, justifyContent: 'center' },
  facetIcon: { alignItems: 'center', justifyContent: 'center' },
  facetLabel: { fontFamily: 'Manrope', fontWeight: '700', textAlign: 'center' },
  facetValue: { fontFamily: 'InstrumentSerif', fontWeight: '700', textAlign: 'center' },
  wideFact: { alignItems: 'center', backgroundColor: 'rgba(255,250,235,0.48)', borderColor: 'rgba(125,91,40,0.2)', borderCurve: 'continuous', borderWidth: 1, boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.48), 0 1px 2px rgba(77,49,13,0.12)', flex: 1, flexDirection: 'row', justifyContent: 'center' },
  wideCopy: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  wideLabel: { fontFamily: 'Manrope', fontWeight: '800', textAlign: 'center', textTransform: 'uppercase' },
  wideValue: { fontFamily: 'InstrumentSerif', fontWeight: '700', textAlign: 'center' },
  stepsCopy: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  stepsValue: { fontFamily: 'Manrope', fontVariant: ['tabular-nums'], fontWeight: '900', letterSpacing: -0.7, textAlign: 'center' },
  stepsLabel: { fontFamily: 'Manrope', fontWeight: '800', letterSpacing: 0.5, marginTop: -2, textAlign: 'center', textTransform: 'uppercase' },
  memory: { alignItems: 'center', flexDirection: 'row' },
  memorySeal: { alignItems: 'center', borderColor: '#E9D087', borderWidth: 1, justifyContent: 'center', position: 'absolute' },
  memoryCopy: { justifyContent: 'center', position: 'absolute' },
  memoryLabel: { fontFamily: 'InstrumentSerif', fontWeight: '700' },
  memoryText: { fontFamily: 'InstrumentSerif', fontStyle: 'italic' },
  memoryPhoto: { borderColor: '#F3DFB0', borderWidth: 2, position: 'absolute', transform: [{ rotate: '-3deg' }] },
  memoryPlaceholder: { alignItems: 'center', borderColor: 'rgba(255,226,159,0.34)', borderRadius: 12, borderWidth: 1, justifyContent: 'center', position: 'absolute', transform: [{ rotate: '-3deg' }] },
});
