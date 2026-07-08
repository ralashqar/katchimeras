import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { forwardRef, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { DayMapNode, HomeDayRecord } from '@/types/home';
import { getCreatureVisual } from '@/game/days';

type MemoryPostcardProps = {
  day: HomeDayRecord & {
    creature: NonNullable<HomeDayRecord['creature']>;
  };
};

type Point = {
  x: number;
  y: number;
};

const CARD_WIDTH = 900;
const CARD_HEIGHT = 1200;

export const MemoryPostcard = forwardRef<View, MemoryPostcardProps>(function MemoryPostcard({ day }, ref) {
  const visual = getCreatureVisual(day.creature.visualKey);
  const mapPoints = useMemo(() => buildMapPoints(day.dayMap?.nodes ?? []), [day.dayMap?.nodes]);
  const cardPhotos = useMemo(() => collectCardPhotos(day), [day]);
  const rarityLine = buildRarityLine(day.creature);

  return (
    <View collapsable={false} ref={ref} style={styles.captureFrame}>
      <LinearGradient
        colors={['#16112B', '#0C0A14', '#1A1226']}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={[styles.card, { borderColor: `${day.creature.accentColor}44` }]}>
        <View style={styles.backdropOrbWrap}>
          <View style={[styles.backdropOrb, { backgroundColor: `${day.creature.accentColor}20` }]} />
          <View style={[styles.backdropOrbSecondary, { backgroundColor: `${day.creature.accentColor}14` }]} />
        </View>

        <View style={styles.header}>
          <Text style={styles.kicker}>Katchimeras</Text>
          <Text style={styles.date}>{day.dayLabel} • {day.dateLabel}</Text>
        </View>

        <View style={styles.heroSection}>
          <View style={[styles.creatureHalo, { backgroundColor: `${day.creature.accentColor}24` }]} />
          <View style={styles.creaturePlate}>
            <Image contentFit="contain" source={visual.source} style={styles.creatureImage} transition={0} />
          </View>
          <Text style={styles.creatureName}>{day.creature.name}</Text>
          <Text style={styles.highlight}>{day.highlight ?? day.creature.highlight}</Text>
          {buildEncounterCue(day.creature) ? (
            <View style={[styles.cuePill, { borderColor: `${day.creature.accentColor}66` }]}>
              <Text style={[styles.cueText, { color: day.creature.accentColor }]}>
                {buildEncounterCue(day.creature)}
              </Text>
            </View>
          ) : null}
          {rarityLine ? <Text style={styles.rarityLine}>{rarityLine}</Text> : null}
        </View>

        {cardPhotos.length > 0 ? (
          <View style={styles.photosRow}>
            {cardPhotos.map((uri) => (
              <View key={uri} style={styles.photoFrame}>
                <Image contentFit="cover" source={uri} style={styles.photo} transition={0} />
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.mapCard}>
          <Text style={styles.mapLabel}>Where the day left its trace</Text>
          <View style={styles.mapStage}>
            {mapPoints.lines.map((line, index) => (
              <View
                key={`line-${index}`}
                style={[
                  styles.mapLine,
                  {
                    backgroundColor: `${day.creature.accentColor}66`,
                    height: line.length,
                    left: line.left,
                    top: line.top,
                    transform: [{ rotateZ: `${line.angle}deg` }],
                    width: 3,
                  },
                ]}
              />
            ))}
            {mapPoints.nodes.map((node, index) => (
              <View
                key={node.id}
                style={[
                  styles.mapNode,
                  {
                    backgroundColor: index === 0 ? day.creature.accentColor : `${day.creature.accentColor}B2`,
                    left: node.x - 12,
                    top: node.y - 12,
                    transform: [{ scale: index === 0 ? 1.15 : 1 }],
                  },
                ]}
              />
            ))}
          </View>
          <Text style={styles.mapCaption}>
            {buildMapCaption(day)}
          </Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Your day became something living and keepable.</Text>
        </View>
      </LinearGradient>
    </View>
  );
});

// The curated keepers behind the day — the photo-journaling centerpiece of the
// Day Card. Pulled from the day-map clusters (already deduped/curated), in the
// order the day unfolded, capped so the collage stays clean.
function collectCardPhotos(day: HomeDayRecord): string[] {
  const uris: string[] = [];
  const seen = new Set<string>();
  if (day.heroPhoto?.thumbnailUri) {
    seen.add(day.heroPhoto.thumbnailUri);
    uris.push(day.heroPhoto.thumbnailUri);
  }
  const nodes = day.dayMap?.nodes ?? [];
  for (const node of nodes) {
    for (const photo of node.photos ?? []) {
      if (seen.has(photo.thumbnailUri)) {
        continue;
      }
      seen.add(photo.thumbnailUri);
      uris.push(photo.thumbnailUri);
      if (uris.length >= 3) {
        return uris;
      }
    }
  }
  return uris;
}

// The rarity-from-living line: surfaces *why* this creature was rare (the lived
// conditions), the "you can only collect it by having the day" beat. Only shown
// when the day actually earned rarity above the common floor.
function buildRarityLine(creature: NonNullable<HomeDayRecord['creature']>) {
  if (creature.rarity === 'common' || !creature.rarityReason) {
    return null;
  }
  const tier = creature.rarity.charAt(0).toUpperCase() + creature.rarity.slice(1);
  return `${tier} — only from ${creature.rarityReason}`;
}

function buildEncounterCue(creature: NonNullable<HomeDayRecord['creature']>) {
  if (!creature.encounterProfileId) {
    return null;
  }

  const cue = creature.motifTags[0];
  if (!cue) {
    return null;
  }

  return creature.repeatDepth > 0 ? `${cue} · visit ${creature.repeatDepth + 1}` : cue;
}

function buildMapCaption(day: HomeDayRecord) {
  if (day.newPlaceCount > 0) {
    return `${day.newPlaceCount} new ${day.newPlaceCount === 1 ? 'place' : 'places'} nudged the hatch outward.`;
  }

  if (day.visitedPlaceCount > 1) {
    return `${day.visitedPlaceCount} places left a visible thread through the day.`;
  }

  if (day.locationSampleCount > 0) {
    return 'Even one familiar place can leave enough behind to matter.';
  }

  return 'The day kept its shape in smaller ways.';
}

function buildMapPoints(nodes: DayMapNode[]) {
  if (nodes.length === 0) {
    const fallbackNodes = [
      { id: 'fallback-a', x: 86, y: 96 },
      { id: 'fallback-b', x: 196, y: 60 },
      { id: 'fallback-c', x: 294, y: 110 },
    ];

    return {
      nodes: fallbackNodes,
      lines: buildLinesFromPoints(fallbackNodes),
    };
  }

  const minLat = Math.min(...nodes.map((node) => node.latitude));
  const maxLat = Math.max(...nodes.map((node) => node.latitude));
  const minLng = Math.min(...nodes.map((node) => node.longitude));
  const maxLng = Math.max(...nodes.map((node) => node.longitude));
  const latRange = Math.max(maxLat - minLat, 0.0015);
  const lngRange = Math.max(maxLng - minLng, 0.0015);

  const normalizedNodes = nodes.map((node) => ({
    id: node.id,
    x: 56 + ((node.longitude - minLng) / lngRange) * 268,
    y: 26 + (1 - (node.latitude - minLat) / latRange) * 92,
  }));

  return {
    nodes: normalizedNodes,
    lines: buildLinesFromPoints(normalizedNodes),
  };
}

function buildLinesFromPoints(points: Point[]) {
  if (points.length <= 1) {
    return [];
  }

  return points.slice(0, -1).map((point, index) => {
    const next = points[index + 1];
    const deltaX = next.x - point.x;
    const deltaY = next.y - point.y;
    const length = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI) + 90;

    return {
      angle,
      left: point.x,
      length,
      top: point.y,
    };
  });
}

const styles = StyleSheet.create({
  captureFrame: {
    backgroundColor: '#09111E',
    width: CARD_WIDTH,
  },
  card: {
    borderRadius: 54,
    borderWidth: 1,
    height: CARD_HEIGHT,
    overflow: 'hidden',
    paddingHorizontal: 52,
    paddingVertical: 58,
  },
  backdropOrbWrap: {
    ...StyleSheet.absoluteFillObject,
  },
  backdropOrb: {
    borderRadius: 999,
    height: 440,
    position: 'absolute',
    right: -90,
    top: 110,
    width: 440,
  },
  backdropOrbSecondary: {
    borderRadius: 999,
    height: 280,
    left: -60,
    position: 'absolute',
    top: 640,
    width: 280,
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  kicker: {
    color: '#C9C2E8',
    fontFamily: 'Manrope',
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  date: {
    color: '#908AB5',
    fontFamily: 'Manrope',
    fontSize: 24,
    fontWeight: '600',
  },
  heroSection: {
    alignItems: 'center',
    marginTop: 28,
  },
  creatureHalo: {
    borderRadius: 999,
    height: 340,
    position: 'absolute',
    top: 14,
    width: 340,
  },
  creaturePlate: {
    alignItems: 'center',
    height: 324,
    justifyContent: 'center',
    width: 324,
  },
  creatureImage: {
    height: '100%',
    width: '100%',
  },
  creatureName: {
    color: '#F6F3FF',
    fontFamily: 'InstrumentSerif',
    fontSize: 74,
    fontStyle: 'italic',
    lineHeight: 80,
    marginTop: 16,
    textAlign: 'center',
  },
  highlight: {
    color: '#E5EEFF',
    fontFamily: 'Manrope',
    fontSize: 30,
    fontWeight: '500',
    lineHeight: 40,
    marginTop: 14,
    maxWidth: 720,
    textAlign: 'center',
  },
  rarityLine: {
    color: '#FFD9B8',
    fontFamily: 'Manrope',
    fontSize: 23,
    fontStyle: 'italic',
    fontWeight: '500',
    lineHeight: 30,
    marginTop: 14,
    maxWidth: 700,
    textAlign: 'center',
  },
  photosRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 36,
  },
  photoFrame: {
    borderRadius: 24,
    flex: 1,
    height: 210,
    overflow: 'hidden',
  },
  photo: {
    height: '100%',
    width: '100%',
  },
  cuePill: {
    borderRadius: 999,
    borderWidth: 2,
    marginTop: 22,
    paddingHorizontal: 26,
    paddingVertical: 10,
  },
  cueText: {
    fontFamily: 'Manrope',
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  mapCard: {
    backgroundColor: 'rgba(20, 17, 31, 0.85)',
    borderRadius: 38,
    marginTop: 30,
    paddingHorizontal: 28,
    paddingVertical: 24,
  },
  mapLabel: {
    color: '#D9E7FF',
    fontFamily: 'Manrope',
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  mapStage: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 28,
    height: 150,
    marginTop: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  mapNode: {
    borderColor: 'rgba(248,251,255,0.22)',
    borderRadius: 999,
    borderWidth: 2,
    height: 24,
    position: 'absolute',
    width: 24,
  },
  mapLine: {
    borderRadius: 999,
    position: 'absolute',
  },
  mapCaption: {
    color: '#D7E3FA',
    fontFamily: 'Manrope',
    fontSize: 24,
    fontWeight: '500',
    lineHeight: 34,
    marginTop: 18,
  },
  footer: {
    marginTop: 'auto',
  },
  footerText: {
    color: '#908AB5',
    fontFamily: 'Manrope',
    fontSize: 24,
    fontWeight: '600',
    lineHeight: 32,
    textAlign: 'center',
  },
});
