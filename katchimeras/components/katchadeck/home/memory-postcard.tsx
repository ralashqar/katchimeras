import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { forwardRef, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { DayMapNode, HomeDayRecord } from '@/types/home';
import { getCreatureVisual } from '@/utils/home-engine';

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

  return (
    <View collapsable={false} ref={ref} style={styles.captureFrame}>
      <LinearGradient
        colors={['#09111E', '#101B31', '#161D37']}
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
        </View>

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
      { id: 'fallback-a', x: 86, y: 120 },
      { id: 'fallback-b', x: 196, y: 88 },
      { id: 'fallback-c', x: 294, y: 146 },
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
    y: 48 + (1 - (node.latitude - minLat) / latRange) * 132,
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
    color: '#EAF2FF',
    fontFamily: 'Manrope',
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  date: {
    color: '#CAD8F7',
    fontFamily: 'Manrope',
    fontSize: 24,
    fontWeight: '600',
  },
  heroSection: {
    alignItems: 'center',
    marginTop: 44,
  },
  creatureHalo: {
    borderRadius: 999,
    height: 428,
    position: 'absolute',
    top: 18,
    width: 428,
  },
  creaturePlate: {
    alignItems: 'center',
    backgroundColor: 'rgba(9,14,25,0.94)',
    borderColor: 'rgba(224,234,255,0.18)',
    borderRadius: 999,
    borderWidth: 1,
    height: 408,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 408,
  },
  creatureImage: {
    height: '100%',
    width: '100%',
  },
  creatureName: {
    color: '#F8FBFF',
    fontFamily: 'InstrumentSerif',
    fontSize: 78,
    lineHeight: 84,
    marginTop: 24,
    textAlign: 'center',
  },
  highlight: {
    color: '#E5EEFF',
    fontFamily: 'Manrope',
    fontSize: 32,
    fontWeight: '500',
    lineHeight: 44,
    marginTop: 18,
    maxWidth: 720,
    textAlign: 'center',
  },
  mapCard: {
    backgroundColor: 'rgba(9, 14, 25, 0.7)',
    borderColor: 'rgba(224,234,255,0.14)',
    borderRadius: 38,
    borderWidth: 1,
    marginTop: 54,
    paddingHorizontal: 28,
    paddingVertical: 28,
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
    height: 228,
    marginTop: 18,
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
    color: '#C7D5F4',
    fontFamily: 'Manrope',
    fontSize: 24,
    fontWeight: '600',
    lineHeight: 32,
    textAlign: 'center',
  },
});
