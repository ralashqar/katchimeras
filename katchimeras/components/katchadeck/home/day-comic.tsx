import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { forwardRef, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { HomeDayRecord } from '@/types/home';
import { buildComicStrip, type ComicBeats } from '@/utils/day-comic';
import { getCreatureVisual } from '@/utils/home-engine';

type DayComicProps = {
  day: HomeDayRecord & {
    creature: NonNullable<HomeDayRecord['creature']>;
  };
  // Optional LLM-written panel captions; falls back to local beats when absent.
  beats?: ComicBeats | null;
};

const CARD_WIDTH = 900;
const CARD_HEIGHT = 1200;

// The 4-panel day comic — the Plus flagship share artifact. Rendered off-screen
// and captured to an image (react-native-view-shot), like MemoryPostcard. Story
// logic lives in utils/day-comic.ts; this is the composition.
export const DayComic = forwardRef<View, DayComicProps>(function DayComic({ day, beats }, ref) {
  const visual = getCreatureVisual(day.creature.visualKey);
  const strip = useMemo(() => buildComicStrip(day, beats), [day, beats]);

  if (!strip) {
    return <View collapsable={false} ref={ref} style={styles.captureFrame} />;
  }

  const accent = strip.accentColor;

  return (
    <View collapsable={false} ref={ref} style={styles.captureFrame}>
      <LinearGradient
        colors={['#16112B', '#0C0A14', '#1A1226']}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={[styles.card, { borderColor: `${accent}44` }]}>
        <View style={styles.header}>
          <Text style={styles.kicker}>Katchimeras</Text>
          <Text style={styles.date}>
            {day.dayLabel} • {day.dateLabel}
          </Text>
        </View>

        <View style={styles.titleBlock}>
          <Text style={styles.title}>{strip.title}</Text>
          <View style={[styles.subtitlePill, { borderColor: `${accent}66` }]}>
            <Text style={[styles.subtitleText, { color: accent }]}>{strip.subtitle}</Text>
          </View>
        </View>

        <View style={styles.grid}>
          {strip.panels.map((panel, index) => (
            <View key={panel.kind} style={[styles.panel, { borderColor: `${accent}33` }]}>
              {panel.photoUri ? (
                <Image contentFit="cover" source={panel.photoUri} style={styles.panelFill} transition={0} />
              ) : (
                <LinearGradient
                  colors={[`${accent}3C`, '#14111F', `${accent}1E`]}
                  end={{ x: 1, y: 1 }}
                  start={{ x: 0, y: 0 }}
                  style={styles.panelFill}
                />
              )}

              {panel.showCreature ? (
                <View style={panel.photoUri ? styles.creatureCorner : styles.creatureCenter}>
                  <View
                    style={[
                      panel.photoUri ? styles.creatureHaloSmall : styles.creatureHaloBig,
                      { backgroundColor: `${accent}2E` },
                    ]}
                  />
                  <Image
                    contentFit="contain"
                    source={visual.source}
                    style={panel.photoUri ? styles.creatureSmall : styles.creatureBig}
                    transition={0}
                  />
                </View>
              ) : null}

              <LinearGradient
                colors={['rgba(8,6,14,0)', 'rgba(8,6,14,0.88)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={styles.panelScrim}
              />

              <View style={[styles.panelBadge, { backgroundColor: accent }]}>
                <Text style={styles.panelBadgeText}>{index + 1}</Text>
              </View>
              <Text style={styles.panelCaption}>{panel.caption}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.footer}>A four-panel day, starring {strip.title}.</Text>
      </LinearGradient>
    </View>
  );
});

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
    paddingHorizontal: 46,
    paddingVertical: 48,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  kicker: {
    color: '#C9C2E8',
    fontFamily: 'Manrope',
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  date: {
    color: '#908AB5',
    fontFamily: 'Manrope',
    fontSize: 22,
    fontWeight: '600',
  },
  titleBlock: {
    alignItems: 'center',
    gap: 12,
    marginTop: 14,
  },
  title: {
    color: '#F6F3FF',
    fontFamily: 'InstrumentSerif',
    fontSize: 64,
    fontStyle: 'italic',
    lineHeight: 68,
  },
  subtitlePill: {
    borderRadius: 999,
    borderWidth: 2,
    paddingHorizontal: 22,
    paddingVertical: 8,
  },
  subtitleText: {
    fontFamily: 'Manrope',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    justifyContent: 'space-between',
    marginTop: 26,
  },
  panel: {
    borderRadius: 30,
    borderWidth: 1,
    height: 396,
    overflow: 'hidden',
    position: 'relative',
    width: '48.5%',
  },
  panelFill: {
    ...StyleSheet.absoluteFillObject,
  },
  panelScrim: {
    bottom: 0,
    height: '52%',
    left: 0,
    position: 'absolute',
    right: 0,
  },
  creatureCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 30,
  },
  creatureCorner: {
    alignItems: 'center',
    bottom: 70,
    justifyContent: 'center',
    position: 'absolute',
    right: 12,
  },
  creatureHaloBig: {
    borderRadius: 999,
    height: 230,
    position: 'absolute',
    width: 230,
  },
  creatureHaloSmall: {
    borderRadius: 999,
    height: 150,
    position: 'absolute',
    width: 150,
  },
  creatureBig: {
    height: 240,
    width: 240,
  },
  creatureSmall: {
    height: 150,
    width: 150,
  },
  panelBadge: {
    alignItems: 'center',
    borderRadius: 999,
    height: 40,
    justifyContent: 'center',
    left: 16,
    position: 'absolute',
    top: 16,
    width: 40,
  },
  panelBadgeText: {
    color: '#1A1226',
    fontFamily: 'Manrope',
    fontSize: 20,
    fontWeight: '800',
  },
  panelCaption: {
    bottom: 0,
    color: '#F6F3FF',
    fontFamily: 'Manrope',
    fontSize: 22,
    fontWeight: '600',
    left: 0,
    lineHeight: 28,
    padding: 22,
    position: 'absolute',
    right: 0,
  },
  footer: {
    color: '#908AB5',
    fontFamily: 'Manrope',
    fontSize: 22,
    fontWeight: '600',
    marginTop: 'auto',
    textAlign: 'center',
  },
});
